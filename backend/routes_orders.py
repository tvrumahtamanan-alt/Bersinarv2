import random
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import (db, new_id, now_iso, require, check_loc, loc_filter, date_q, decode_token, create_token,
                  verify_pin, apply_tier, BRANCHES)
from routes_products import build_catalog
from routes_sales import insert_transaction, restore_tx, TxIn, TxItem

router = APIRouter(prefix="/api")


@router.get("/shop/catalog")
async def shop_catalog(location: str):
    if location not in BRANCHES:
        raise HTTPException(400, "Cabang tidak valid")
    rows = await build_catalog(location, False)
    for r in rows:
        r.pop("min_stock", None)
        r["stock"] = max(r["stock"], 0)
    return rows


class B2BLoginIn(BaseModel):
    phone: str
    pin: str


@router.post("/shop/b2b-login")
async def b2b_login(body: B2BLoginIn):
    c = await db.customers.find_one({"phone": body.phone.strip(), "customer_type": "B2B"})
    if not c or not c.get("pin_hash") or not verify_pin(body.pin, c["pin_hash"]):
        raise HTTPException(401, "No. HP atau PIN salah")
    return {"token": create_token(c["id"], "b2b", 30), "customer": await b2b_info(c["id"])}


async def b2b_info(cid):
    c = await db.customers.find_one({"id": cid}, {"_id": 0, "pin_hash": 0})
    return c and {"id": c["id"], "name": c["name"], "phone": c["phone"],
                  "remaining_credit": c["credit_limit"] - c.get("current_credit", 0)}


@router.get("/shop/b2b-me")
async def b2b_me(request: Request):
    p = decode_token(request)
    if not p or p.get("type") != "b2b":
        raise HTTPException(401, "Sesi B2B tidak valid")
    return await b2b_info(p["sub"])


class OrderItemIn(BaseModel):
    product_id: str
    qty: float


class OrderIn(BaseModel):
    location_name: str
    customer_name: str
    customer_phone: str
    delivery_type: str
    delivery_address: str = ""
    payment_method: str
    notes: str = ""
    items: List[OrderItemIn]


@router.post("/shop/orders")
async def create_order(body: OrderIn, request: Request):
    if body.location_name not in BRANCHES:
        raise HTTPException(400, "Cabang tidak valid")
    if body.payment_method not in ("QRIS", "Transfer", "COD", "Bon"):
        raise HTTPException(400, "Metode bayar tidak valid")
    if body.delivery_type == "delivery" and len(body.delivery_address.strip()) < 5:
        raise HTTPException(400, "Alamat pengiriman wajib diisi lengkap")
    if not body.customer_name.strip() or len(body.customer_phone.strip()) < 8:
        raise HTTPException(400, "Nama dan No. HP wajib diisi")
    customer_id = None
    if body.payment_method == "Bon":
        p = decode_token(request)
        if not p or p.get("type") != "b2b":
            raise HTTPException(401, "Bon hanya untuk pelanggan B2B yang login")
        customer_id = p["sub"]
    cat = {p["id"]: p for p in await build_catalog(body.location_name, False)}
    items, total = [], 0
    for it in body.items:
        p = cat.get(it.product_id)
        if not p or it.qty <= 0:
            raise HTTPException(400, "Produk tidak tersedia")
        if not p["is_decimal_allowed"] and it.qty != int(it.qty):
            raise HTTPException(400, f"{p['name']} tidak bisa dibeli desimal")
        if p["stock"] < it.qty:
            raise HTTPException(400, f"Stok {p['name']} tidak cukup (tersisa {p['stock']:g})")
        tier = apply_tier(p["tiers"], it.qty)
        sub = round(it.qty * tier["price"])
        total += sub
        items.append({"product_id": p["id"], "name": p["name"], "unit": p["unit"], "qty": it.qty,
                      "applied_unit_price": tier["price"], "tier_name": tier["tier_name"], "subtotal": sub})
    if not items:
        raise HTTPException(400, "Keranjang kosong")
    settings = await db.settings.find_one({"id": "store"}) or {}
    fee = settings.get("delivery_fee", 0) if body.delivery_type == "delivery" else 0
    if customer_id:
        c = await db.customers.find_one({"id": customer_id})
        if total + fee > c["credit_limit"] - c.get("current_credit", 0):
            raise HTTPException(400, "Total melebihi sisa limit kredit Anda")
    no = f"ON{datetime.now().strftime('%y%m%d')}{random.randint(1000, 9999)}"
    doc = {"id": new_id(), "order_number": no, "location_name": body.location_name, "customer_name": body.customer_name.strip(),
           "customer_phone": body.customer_phone.strip(), "customer_id": customer_id, "delivery_type": body.delivery_type,
           "delivery_address": body.delivery_address, "payment_method": body.payment_method, "notes": body.notes,
           "items": items, "subtotal": total, "delivery_fee": fee, "total_amount": total + fee, "status": "Menunggu",
           "is_paid": False, "transaction_id": None, "created_at": now_iso(),
           "history": [{"status": "Menunggu", "at": now_iso()}]}
    await db.online_orders.insert_one(doc)
    return {"order_number": no, "total_amount": doc["total_amount"]}


@router.get("/shop/orders/{no}")
async def track_order(no: str):
    o = await db.online_orders.find_one({"order_number": no.strip().upper()}, {"_id": 0, "customer_id": 0})
    if not o:
        raise HTTPException(404, "Nomor pesanan tidak ditemukan")
    return o


# ---------- Staff side ----------
@router.get("/orders")
async def list_orders(location: Optional[str] = None, status: Optional[str] = None, date_from: Optional[str] = None,
                      user=Depends(require("orders.process"))):
    q = {"location_name": {"$in": [l for l in loc_filter(user, location) if l in BRANCHES]}}
    if status == "aktif":
        q["status"] = {"$in": ["Menunggu", "Diterima", "Dikemas", "Siap"]}
    elif status:
        q["status"] = status
    if date_from:
        q["created_at"] = date_q(date_from)
    return await db.online_orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)


@router.get("/orders/pending")
async def pending_orders(location: str, user=Depends(require("orders.process"))):
    check_loc(user, location)
    return await db.online_orders.find({"location_name": location, "status": "Menunggu"},
                                       {"_id": 0, "id": 1, "order_number": 1, "customer_name": 1, "total_amount": 1,
                                        "created_at": 1}).to_list(50)


class StatusIn(BaseModel):
    action: str
    shift_id: Optional[str] = None


NEXT = {"process": ("Diterima", "Dikemas"), "ready": ("Dikemas", "Siap"), "done": ("Siap", "Selesai")}


async def accept_order(o, user, shift_id):
    done = []
    for it in o["items"]:
        r = await db.product_locations.update_one(
            {"product_id": it["product_id"], "location_name": o["location_name"], "stock_quantity": {"$gte": it["qty"]}},
            {"$inc": {"stock_quantity": -it["qty"]}})
        if r.modified_count == 0:
            for d in done:
                await db.product_locations.update_one({"product_id": d["product_id"], "location_name": o["location_name"]},
                                                      {"$inc": {"stock_quantity": d["qty"]}})
            raise HTTPException(400, f"Stok {it['name']} tidak cukup, pesanan tidak bisa diterima")
        done.append(it)
    try:
        items = [TxItem(**{k: it[k] for k in ("product_id", "name", "unit", "qty", "applied_unit_price", "tier_name")}) for it in o["items"]]
        tx_in = TxIn(id=new_id(), location_name=o["location_name"], customer_id=o.get("customer_id"), items=items,
                     discount=-o.get("delivery_fee", 0), payment_method=o["payment_method"], shift_id=shift_id)
        tx = await insert_transaction(tx_in, user, channel="online", skip_stock=True, order_id=o["id"])
    except HTTPException:
        for d in done:
            await db.product_locations.update_one({"product_id": d["product_id"], "location_name": o["location_name"]},
                                                  {"$inc": {"stock_quantity": d["qty"]}})
        raise
    return tx


@router.post("/orders/{oid}/status")
async def order_status(oid: str, body: StatusIn, user=Depends(require("orders.process"))):
    o = await db.online_orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    check_loc(user, o["location_name"])
    upd = {}
    if body.action == "accept":
        if o["status"] != "Menunggu":
            raise HTTPException(400, "Pesanan sudah diproses")
        tx = await accept_order(o, user, body.shift_id)
        upd = {"status": "Diterima", "transaction_id": tx["id"], "invoice_number": tx["invoice_number"]}
    elif body.action == "cancel":
        if "orders.cancel" not in user["permissions"]:
            raise HTTPException(403, "Tidak punya hak membatalkan pesanan")
        if o["status"] in ("Selesai", "Dibatalkan"):
            raise HTTPException(400, "Pesanan tidak bisa dibatalkan")
        if o.get("transaction_id"):
            tx = await db.transactions.find_one({"id": o["transaction_id"]})
            if tx and not tx.get("voided"):
                await restore_tx(tx)
        upd = {"status": "Dibatalkan"}
    elif body.action in NEXT:
        frm, to = NEXT[body.action]
        if o["status"] != frm:
            raise HTTPException(400, f"Status harus {frm}")
        upd = {"status": to}
        if to == "Selesai" and o["payment_method"] == "COD" and not o["is_paid"]:
            await mark_paid_tx(o, body.shift_id)
            upd["is_paid"] = True
    else:
        raise HTTPException(400, "Aksi tidak valid")
    await db.online_orders.update_one({"id": oid}, {"$set": upd, "$push": {"history": {"status": upd["status"], "at": now_iso(), "by": user["name"]}}})
    return {"ok": True, **upd}


async def mark_paid_tx(o, shift_id):
    if o.get("transaction_id") and o["payment_method"] != "Bon":
        tx = await db.transactions.find_one({"id": o["transaction_id"]})
        s = {"payment_status": "Lunas", "paid_amount": tx["total_amount"]}
        if shift_id and o["payment_method"] == "COD":
            s["shift_id"] = shift_id
        await db.transactions.update_one({"id": o["transaction_id"]}, {"$set": s})


@router.post("/orders/{oid}/paid")
async def order_paid(oid: str, body: StatusIn, user=Depends(require("orders.mark_paid"))):
    o = await db.online_orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    check_loc(user, o["location_name"])
    if o["payment_method"] == "Bon":
        raise HTTPException(400, "Pesanan Bon dilunasi lewat menu Pelanggan")
    await mark_paid_tx(o, body.shift_id)
    await db.online_orders.update_one({"id": oid}, {"$set": {"is_paid": True}})
    return {"ok": True}
