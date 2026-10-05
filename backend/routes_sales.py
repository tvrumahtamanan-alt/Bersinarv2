from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import (db, new_id, now_iso, to_local, get_current_user, require, check_loc, loc_filter, date_q,
                  hash_pin, BRANCHES)

router = APIRouter(prefix="/api")


class TxItem(BaseModel):
    product_id: str
    name: str = ""
    unit: str = ""
    qty: float
    applied_unit_price: float
    tier_name: str = ""


class TxIn(BaseModel):
    id: str
    invoice_number: Optional[str] = None
    location_name: str
    customer_id: Optional[str] = None
    items: List[TxItem]
    discount: float = 0
    payment_method: str
    cash_received: float = 0
    shift_id: Optional[str] = None
    created_at: Optional[str] = None
    offline: bool = False


async def insert_transaction(body: TxIn, user, channel="pos", skip_stock=False, order_id=None):
    existing = await db.transactions.find_one({"id": body.id}, {"_id": 0})
    if existing:
        return existing
    if not body.items:
        raise HTTPException(400, "Keranjang kosong")
    subtotal = 0
    items = []
    for it in body.items:
        pl = await db.product_locations.find_one({"product_id": it.product_id, "location_name": body.location_name}) or {}
        st = round(it.qty * it.applied_unit_price)
        subtotal += st
        items.append({"id": new_id(), "transaction_id": body.id, "product_id": it.product_id, "name": it.name,
                      "unit": it.unit, "qty": it.qty, "applied_unit_price": it.applied_unit_price,
                      "tier_name": it.tier_name, "subtotal": st, "cogs_price": pl.get("cogs_price", 0)})
    total = max(subtotal - (body.discount or 0), 0)
    needs_review = False
    customer = None
    if body.payment_method == "Bon":
        if not body.customer_id:
            raise HTTPException(400, "Pilih pelanggan B2B untuk Bon")
        customer = await db.customers.find_one({"id": body.customer_id})
        if not customer:
            raise HTTPException(404, "Pelanggan tidak ditemukan")
        remaining = customer["credit_limit"] - customer.get("current_credit", 0)
        if total > remaining:
            if not body.offline:
                raise HTTPException(400, f"Melebihi sisa limit kredit (sisa Rp {remaining:,.0f})".replace(",", "."))
            needs_review = True
    if not skip_stock:
        for it in items:
            await db.product_locations.update_one({"product_id": it["product_id"], "location_name": body.location_name},
                                                  {"$inc": {"stock_quantity": -it["qty"]}})
    created = to_local(body.created_at) if body.created_at else now_iso()
    inv = body.invoice_number or f"{'C1' if body.location_name == 'Cabang 1' else 'C2'}-{created[2:10].replace('-', '')}-{body.id[:6].upper()}"
    doc = {"id": body.id, "invoice_number": inv, "location_name": body.location_name, "customer_id": body.customer_id,
           "customer_name": customer["name"] if customer else None, "subtotal": subtotal, "total_amount": total,
           "discount": body.discount, "payment_method": body.payment_method,
           "payment_status": "Belum Lunas" if body.payment_method == "Bon" else (
               "Belum Dibayar" if channel == "online" and body.payment_method != "Bon" else "Lunas"),
           "paid_amount": 0 if body.payment_method == "Bon" or channel == "online" else total,
           "cash_received": body.cash_received, "change": max(body.cash_received - total, 0) if body.payment_method == "Tunai" else 0,
           "cashier_id": user["id"], "cashier_name": user["name"], "shift_id": body.shift_id, "channel": channel,
           "order_id": order_id, "needs_review": needs_review, "voided": False, "items": items, "created_at": created,
           "synced_at": now_iso()}
    if body.payment_method == "Bon":
        due = datetime.fromisoformat(created) + timedelta(days=customer.get("payment_terms_days", 0))
        doc["due_date"] = due.date().isoformat()
        await db.customers.update_one({"id": body.customer_id}, {"$inc": {"current_credit": total}})
    await db.transactions.insert_one(doc)
    await db.transaction_items.insert_many([dict(i) for i in items])
    doc.pop("_id", None)
    return doc


@router.post("/transactions")
async def create_tx(body: TxIn, user=Depends(require("pos.access"))):
    check_loc(user, body.location_name)
    if body.payment_method == "Bon" and "pos.bon" not in user["permissions"]:
        raise HTTPException(403, "Tidak punya hak bayar dengan Bon")
    if body.discount > 0 and "pos.discount" not in user["permissions"]:
        raise HTTPException(403, "Tidak punya hak memberi diskon")
    return await insert_transaction(body, user)


@router.get("/transactions")
async def list_tx(location: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
                  customer_id: Optional[str] = None, q: Optional[str] = None, user=Depends(get_current_user)):
    query = {"location_name": {"$in": loc_filter(user, location)}}
    if date_from or date_to:
        query["created_at"] = date_q(date_from, date_to)
    if customer_id:
        query["customer_id"] = customer_id
    if q:
        query["invoice_number"] = {"$regex": q, "$options": "i"}
    if not set(user["permissions"]) & {"reports.sales", "shift.view_all"}:
        query["cashier_id"] = user["id"]
    rows = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    if "products.view_cogs" not in user["permissions"]:
        for r in rows:
            for i in r["items"]:
                i.pop("cogs_price", None)
    return rows


async def restore_tx(tx):
    for it in tx["items"]:
        await db.product_locations.update_one({"product_id": it["product_id"], "location_name": tx["location_name"]},
                                              {"$inc": {"stock_quantity": it["qty"]}})
    if tx["payment_method"] == "Bon" and tx.get("customer_id"):
        outstanding = tx["total_amount"] - tx.get("paid_amount", 0)
        await db.customers.update_one({"id": tx["customer_id"]}, {"$inc": {"current_credit": -outstanding}})
    await db.transactions.update_one({"id": tx["id"]}, {"$set": {"voided": True, "voided_at": now_iso()}})


@router.post("/transactions/{tid}/void")
async def void_tx(tid: str, user=Depends(require("pos.void"))):
    tx = await db.transactions.find_one({"id": tid})
    if not tx or tx.get("voided"):
        raise HTTPException(400, "Transaksi tidak ditemukan atau sudah dibatalkan")
    check_loc(user, tx["location_name"])
    if tx.get("order_id"):
        raise HTTPException(400, "Transaksi pesanan online dibatalkan dari menu Pesanan")
    await restore_tx(tx)
    return {"ok": True}


# ---------- Shifts ----------
class ShiftOpenIn(BaseModel):
    id: str
    location_name: str
    opening_cash: float
    opened_at: Optional[str] = None


class ShiftCloseIn(BaseModel):
    closing_cash: float
    closed_at: Optional[str] = None
    notes: str = ""


async def shift_summary(shift):
    txs = await db.transactions.find({"shift_id": shift["id"], "voided": False}, {"_id": 0, "items": 0}).to_list(5000)
    by_method = {}
    for t in txs:
        by_method[t["payment_method"]] = by_method.get(t["payment_method"], 0) + t["total_amount"]
    cash_sales = sum(t["total_amount"] for t in txs if t["payment_method"] == "Tunai") + sum(
        t["total_amount"] for t in txs if t["payment_method"] == "COD" and t["payment_status"] == "Lunas")
    pays = await db.credit_payments.find({"shift_id": shift["id"]}, {"_id": 0}).to_list(1000)
    cash_pay = sum(p["payment_amount"] for p in pays if p["payment_method"] == "Tunai")
    exps = await db.expenses.find({"shift_id": shift["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    exp_total = sum(e["amount"] for e in exps)
    expected = shift["opening_cash"] + cash_sales + cash_pay - exp_total
    s = dict(shift)
    s.update({"tx_count": len(txs), "sales_total": sum(t["total_amount"] for t in txs), "by_method": by_method,
              "cash_sales": cash_sales, "credit_payments_cash": cash_pay, "credit_payments_total": sum(p["payment_amount"] for p in pays),
              "expenses": exps, "expenses_total": exp_total, "expected_cash": expected,
              "difference": (shift["closing_cash"] - expected) if shift.get("closing_cash") is not None else None})
    return s


@router.post("/shifts/open")
async def open_shift(body: ShiftOpenIn, user=Depends(require("shift.open_close"))):
    check_loc(user, body.location_name)
    ex = await db.shifts.find_one({"id": body.id}, {"_id": 0})
    if ex:
        return ex
    active = await db.shifts.find_one({"cashier_id": user["id"], "status": "open"}, {"_id": 0})
    if active:
        return active
    doc = {"id": body.id, "location_name": body.location_name, "cashier_id": user["id"], "cashier_name": user["name"],
           "opening_cash": body.opening_cash, "opened_at": to_local(body.opened_at) if body.opened_at else now_iso(),
           "closed_at": None, "closing_cash": None, "status": "open"}
    await db.shifts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/shifts/current")
async def current_shift(user=Depends(get_current_user)):
    s = await db.shifts.find_one({"cashier_id": user["id"], "status": "open"}, {"_id": 0})
    return await shift_summary(s) if s else None


@router.post("/shifts/{sid}/close")
async def close_shift(sid: str, body: ShiftCloseIn, user=Depends(require("shift.open_close"))):
    s = await db.shifts.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shift tidak ditemukan")
    if s["status"] == "closed":
        return await shift_summary(s)
    if s["cashier_id"] != user["id"] and "shift.view_all" not in user["permissions"]:
        raise HTTPException(403, "Bukan shift Anda")
    upd = {"status": "closed", "closing_cash": body.closing_cash, "notes": body.notes,
           "closed_at": to_local(body.closed_at) if body.closed_at else now_iso()}
    await db.shifts.update_one({"id": sid}, {"$set": upd})
    s.update(upd)
    summ = await shift_summary(s)
    await db.shifts.update_one({"id": sid}, {"$set": {"expected_cash": summ["expected_cash"], "difference": summ["difference"]}})
    return summ


@router.get("/shifts")
async def list_shifts(location: Optional[str] = None, cashier_id: Optional[str] = None, date_from: Optional[str] = None,
                      date_to: Optional[str] = None, user=Depends(get_current_user)):
    q = {"location_name": {"$in": loc_filter(user, location)}}
    if not {"shift.view_all", "reports.shift"} & set(user["permissions"]):
        q["cashier_id"] = user["id"]
    elif cashier_id:
        q["cashier_id"] = cashier_id
    if date_from or date_to:
        q["opened_at"] = date_q(date_from, date_to)
    rows = await db.shifts.find(q, {"_id": 0}).sort("opened_at", -1).to_list(200)
    return [await shift_summary(s) for s in rows]


# ---------- Expenses ----------
class ExpenseIn(BaseModel):
    id: str
    shift_id: Optional[str] = None
    location_name: str
    category: str
    amount: float
    notes: str = ""
    created_at: Optional[str] = None


@router.post("/expenses")
async def create_expense(body: ExpenseIn, user=Depends(require("shift.expense"))):
    check_loc(user, body.location_name)
    if body.amount <= 0:
        raise HTTPException(400, "Nominal harus lebih dari 0")
    if await db.expenses.find_one({"id": body.id}):
        return {"id": body.id}
    doc = body.model_dump()
    doc.update({"cashier_id": user["id"], "cashier_name": user["name"],
                "created_at": to_local(body.created_at) if body.created_at else now_iso()})
    await db.expenses.insert_one(doc)
    return {"id": body.id}


@router.get("/expenses")
async def list_expenses(location: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
                        user=Depends(get_current_user)):
    q = {"location_name": {"$in": loc_filter(user, location)}}
    if "shift.view_all" not in user["permissions"] and "reports.pnl" not in user["permissions"]:
        q["cashier_id"] = user["id"]
    if date_from or date_to:
        q["created_at"] = date_q(date_from, date_to)
    return await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ---------- Customers ----------
class CustomerIn(BaseModel):
    name: str
    phone: str
    customer_type: str = "B2B"
    credit_limit: float = 0
    payment_terms_days: int = 14
    pin: Optional[str] = None


@router.get("/customers")
async def list_customers(user=Depends(get_current_user)):
    return await db.customers.find({}, {"_id": 0, "pin_hash": 0}).sort("name", 1).to_list(2000)


@router.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(require("customers.manage"))):
    if await db.customers.find_one({"phone": body.phone}):
        raise HTTPException(400, "No. HP sudah terdaftar")
    doc = body.model_dump(exclude={"pin"})
    if "customers.credit_limit" not in user["permissions"]:
        doc["credit_limit"] = 0
    doc.update({"id": new_id(), "current_credit": 0, "created_at": now_iso()})
    if body.pin:
        doc["pin_hash"] = hash_pin(body.pin)
    await db.customers.insert_one(doc)
    return {"id": doc["id"]}


@router.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user=Depends(require("customers.manage", "customers.credit_limit"))):
    upd = {}
    if "customers.manage" in user["permissions"]:
        upd.update({"name": body.name, "phone": body.phone, "customer_type": body.customer_type,
                    "payment_terms_days": body.payment_terms_days})
        if body.pin:
            upd["pin_hash"] = hash_pin(body.pin)
    if "customers.credit_limit" in user["permissions"]:
        upd["credit_limit"] = body.credit_limit
    await db.customers.update_one({"id": cid}, {"$set": upd})
    return {"ok": True}


@router.get("/customers/{cid}/bons")
async def customer_bons(cid: str, user=Depends(get_current_user)):
    rows = await db.transactions.find({"customer_id": cid, "payment_method": "Bon", "voided": False},
                                      {"_id": 0, "items": 0}).sort("created_at", -1).to_list(500)
    pays = await db.credit_payments.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"bons": rows, "payments": pays}


class PaymentIn(BaseModel):
    customer_id: str
    transaction_id: Optional[str] = None
    payment_amount: float
    payment_method: str = "Tunai"
    notes: str = ""
    shift_id: Optional[str] = None
    location_name: Optional[str] = None


@router.post("/credit-payments")
async def pay_credit(body: PaymentIn, user=Depends(require("customers.payment"))):
    cust = await db.customers.find_one({"id": body.customer_id})
    if not cust:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if body.payment_amount <= 0 or body.payment_amount > cust.get("current_credit", 0) + 0.5:
        raise HTTPException(400, "Nominal tidak valid / melebihi total bon")
    q = {"customer_id": body.customer_id, "payment_method": "Bon", "voided": False, "payment_status": {"$ne": "Lunas"}}
    if body.transaction_id:
        q["id"] = body.transaction_id
    remaining = body.payment_amount
    for tx in await db.transactions.find(q).sort("created_at", 1).to_list(1000):
        if remaining <= 0:
            break
        out = tx["total_amount"] - tx.get("paid_amount", 0)
        pay = min(out, remaining)
        remaining -= pay
        paid = tx.get("paid_amount", 0) + pay
        await db.transactions.update_one({"id": tx["id"]}, {"$set": {
            "paid_amount": paid, "payment_status": "Lunas" if paid >= tx["total_amount"] else "Sebagian"}})
    applied = body.payment_amount - remaining
    doc = {"id": new_id(), "customer_id": body.customer_id, "customer_name": cust["name"], "transaction_id": body.transaction_id,
           "payment_amount": applied, "payment_method": body.payment_method, "notes": body.notes, "shift_id": body.shift_id,
           "location_name": body.location_name, "received_by": user["name"], "created_at": now_iso()}
    await db.credit_payments.insert_one(doc)
    await db.customers.update_one({"id": body.customer_id}, {"$inc": {"current_credit": -applied}})
    doc.pop("_id", None)
    return doc
