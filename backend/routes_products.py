import random
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core import db, new_id, now_iso, get_current_user, require, check_loc, loc_filter, LOCATIONS, r2, date_q

router = APIRouter(prefix="/api")


async def build_catalog(location: Optional[str], include_cogs: bool, active_only=True):
    q = {"active": True} if active_only else {}
    products = await db.products.find(q, {"_id": 0}).sort("name", 1).to_list(20000)
    tiers = await db.tier_prices.find({}, {"_id": 0}).to_list(100000)
    lq = {"location_name": location} if location else {}
    locs = await db.product_locations.find(lq, {"_id": 0}).to_list(100000)
    tmap, lmap = {}, {}
    for t in tiers:
        tmap.setdefault(t["product_id"], []).append(t)
    for l in locs:
        if not include_cogs:
            l.pop("cogs_price", None)
        lmap.setdefault(l["product_id"], {})[l["location_name"]] = l
    for p in products:
        p["tiers"] = sorted(tmap.get(p["id"], []), key=lambda x: x["min_qty"])
        ls = lmap.get(p["id"], {})
        if location:
            l = ls.get(location) or {}
            p["stock"] = l.get("stock_quantity", 0)
            p["min_stock"] = l.get("min_stock_alert", p.get("min_stock_alert", 0))
            if include_cogs:
                p["cogs_price"] = l.get("cogs_price", 0)
        else:
            p["locations"] = ls
    return products


@router.get("/catalog")
async def catalog(location: str, user=Depends(get_current_user)):
    check_loc(user, location)
    return await build_catalog(location, "products.view_cogs" in user["permissions"])


@router.get("/products")
async def list_products(user=Depends(require("products.view", "stock.adjust", "stock.transfer"))):
    return await build_catalog(None, "products.view_cogs" in user["permissions"], active_only=False)


@router.get("/products/generate-sku")
async def gen_sku(user=Depends(get_current_user)):
    while True:
        sku = "20" + "".join(random.choices("0123456789", k=11))
        if not await db.products.find_one({"sku": sku}):
            return {"sku": sku}


@router.get("/products/by-sku/{sku}")
async def by_sku(sku: str, user=Depends(get_current_user)):
    p = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Barcode tidak ditemukan")
    return p


class TierIn(BaseModel):
    tier_name: str
    min_qty: float
    price: float


class LocIn(BaseModel):
    location_name: str
    stock_quantity: float = 0
    cogs_price: float = 0
    min_stock_alert: float = 0


class ProductIn(BaseModel):
    sku: str
    name: str
    category: str
    unit: str
    is_decimal_allowed: bool = False
    is_expirable: bool = False
    min_stock_alert: float = 0
    tiers: List[TierIn]
    locations: List[LocIn] = []


async def save_children(pid, body: ProductIn, user, is_new):
    await db.tier_prices.delete_many({"product_id": pid})
    for t in body.tiers:
        if t.price > 0:
            await db.tier_prices.insert_one({"id": new_id(), "product_id": pid, **t.model_dump()})
    can_cogs = "products.view_cogs" in user["permissions"]
    for l in body.locations:
        if l.location_name not in LOCATIONS:
            continue
        upd = {"min_stock_alert": l.min_stock_alert}
        if can_cogs:
            upd["cogs_price"] = l.cogs_price
        if is_new:
            upd["stock_quantity"] = l.stock_quantity
        await db.product_locations.update_one(
            {"product_id": pid, "location_name": l.location_name},
            {"$set": upd, "$setOnInsert": {"id": new_id(), **({} if is_new else {"stock_quantity": 0}),
                                           **({} if can_cogs else {"cogs_price": 0})}},
            upsert=True)
    for loc in LOCATIONS:
        await db.product_locations.update_one(
            {"product_id": pid, "location_name": loc},
            {"$setOnInsert": {"id": new_id(), "stock_quantity": 0, "cogs_price": 0, "min_stock_alert": body.min_stock_alert}},
            upsert=True)


async def sku_conflict(sku, pid=None):
    other = await db.products.find_one({"sku": sku, **({"id": {"$ne": pid}} if pid else {})})
    if other:
        raise HTTPException(400, f"Barcode sudah terdaftar: {other['name']}")


@router.post("/products")
async def create_product(body: ProductIn, user=Depends(require("products.add"))):
    if not body.tiers or body.tiers[0].price <= 0:
        raise HTTPException(400, "Harga eceran wajib diisi")
    await sku_conflict(body.sku)
    pid = new_id()
    doc = body.model_dump(exclude={"tiers", "locations"})
    await db.products.insert_one({"id": pid, **doc, "active": True, "created_at": now_iso()})
    await save_children(pid, body, user, True)
    return {"id": pid}


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, user=Depends(require("products.edit"))):
    await sku_conflict(body.sku, pid)
    await db.products.update_one({"id": pid}, {"$set": body.model_dump(exclude={"tiers", "locations"})})
    await save_children(pid, body, user, False)
    return {"ok": True}


class ActiveIn(BaseModel):
    active: bool


@router.patch("/products/{pid}/active")
async def set_active(pid: str, body: ActiveIn, user=Depends(require("products.deactivate"))):
    await db.products.update_one({"id": pid}, {"$set": {"active": body.active}})
    return {"ok": True}


# ---------- Stock ops ----------
async def inc_stock(pid, loc, delta):
    await db.product_locations.update_one({"product_id": pid, "location_name": loc},
                                          {"$inc": {"stock_quantity": delta},
                                           "$setOnInsert": {"id": new_id(), "cogs_price": 0, "min_stock_alert": 0}},
                                          upsert=True)


async def log_move(pid, loc, delta, kind, ref, user):
    await db.stock_movements.insert_one({"id": new_id(), "product_id": pid, "location_name": loc, "delta": delta,
                                         "kind": kind, "ref": ref, "user": user["name"], "created_at": now_iso()})


class AdjustIn(BaseModel):
    product_id: str
    location_name: str
    new_qty: float
    reason: str = "Stock opname"


@router.post("/stock/adjust")
async def adjust(body: AdjustIn, user=Depends(require("stock.adjust"))):
    check_loc(user, body.location_name)
    pl = await db.product_locations.find_one({"product_id": body.product_id, "location_name": body.location_name}) or {}
    delta = r2(body.new_qty - pl.get("stock_quantity", 0))
    await db.product_locations.update_one({"product_id": body.product_id, "location_name": body.location_name},
                                          {"$set": {"stock_quantity": body.new_qty}}, upsert=True)
    await log_move(body.product_id, body.location_name, delta, "adjust", body.reason, user)
    return {"ok": True, "delta": delta}


class ItemQty(BaseModel):
    product_id: str
    qty: float
    name: Optional[str] = None
    unit: Optional[str] = None


class TransferIn(BaseModel):
    to_location: str
    items: List[ItemQty]
    notes: str = ""


@router.post("/stock/transfer")
async def transfer(body: TransferIn, user=Depends(require("stock.transfer"))):
    src = "Gudang Utama"
    check_loc(user, src)
    if body.to_location not in ("Cabang 1", "Cabang 2"):
        raise HTTPException(400, "Tujuan harus cabang")
    items = [i for i in body.items if i.qty > 0]
    for it in items:
        pl = await db.product_locations.find_one({"product_id": it.product_id, "location_name": src}) or {}
        if pl.get("stock_quantity", 0) < it.qty:
            p = await db.products.find_one({"id": it.product_id}) or {}
            raise HTTPException(400, f"Stok gudang tidak cukup: {p.get('name', '-')}")
    tid = new_id()
    for it in items:
        src_pl = await db.product_locations.find_one({"product_id": it.product_id, "location_name": src}) or {}
        await inc_stock(it.product_id, src, -it.qty)
        await inc_stock(it.product_id, body.to_location, it.qty)
        dst = await db.product_locations.find_one({"product_id": it.product_id, "location_name": body.to_location})
        if dst and not dst.get("cogs_price"):
            await db.product_locations.update_one({"_id": dst["_id"]}, {"$set": {"cogs_price": src_pl.get("cogs_price", 0)}})
        await log_move(it.product_id, src, -it.qty, "transfer_out", tid, user)
        await log_move(it.product_id, body.to_location, it.qty, "transfer_in", tid, user)
    await db.stock_transfers.insert_one({"id": tid, "from_location": src, "to_location": body.to_location,
                                         "items": [i.model_dump() for i in items], "notes": body.notes,
                                         "user": user["name"], "created_at": now_iso()})
    return {"id": tid}


@router.get("/stock/transfers")
async def transfers(user=Depends(require("stock.transfer"))):
    return await db.stock_transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/stock/low")
async def low_stock(location: str, user=Depends(require("stock.low"))):
    check_loc(user, location)
    cat = await build_catalog(location, False)
    return [p for p in cat if p["stock"] <= p["min_stock"]]


class KulakanIn(BaseModel):
    items: List[ItemQty]


@router.get("/kulakan/{location}")
async def get_kulakan(location: str, user=Depends(require("stock.low"))):
    check_loc(user, location)
    doc = await db.kulakan.find_one({"location_name": location}, {"_id": 0})
    return doc or {"location_name": location, "items": []}


@router.put("/kulakan/{location}")
async def put_kulakan(location: str, body: KulakanIn, user=Depends(require("stock.low"))):
    check_loc(user, location)
    await db.kulakan.update_one({"location_name": location},
                                {"$set": {"items": [i.model_dump() for i in body.items], "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}


# ---------- Receive goods ----------
class ReceiptIn(BaseModel):
    id: Optional[str] = None
    location_name: str
    supplier: str = ""
    notes: str = ""
    items: List[ItemQty]


@router.post("/receipts")
async def create_receipt(body: ReceiptIn, user=Depends(require("stock.receive"))):
    check_loc(user, body.location_name)
    rid = body.id or new_id()
    if await db.receipts.find_one({"id": rid}):
        return {"id": rid, "duplicate": True}
    items = [i for i in body.items if i.qty > 0]
    if not items:
        raise HTTPException(400, "Daftar barang kosong")
    for it in items:
        await inc_stock(it.product_id, body.location_name, it.qty)
        await log_move(it.product_id, body.location_name, it.qty, "receive", rid, user)
    count = await db.receipts.count_documents({}) + 1
    doc = {"id": rid, "receipt_number": f"TB-{count:05d}", "location_name": body.location_name,
           "supplier": body.supplier, "notes": body.notes, "items": [i.model_dump() for i in items],
           "user": user["name"], "created_at": now_iso()}
    await db.receipts.insert_one(doc)
    return {"id": rid, "receipt_number": doc["receipt_number"]}


@router.get("/receipts")
async def list_receipts(location: Optional[str] = None, user=Depends(require("stock.receive_history"))):
    locs = loc_filter(user, location)
    return await db.receipts.find({"location_name": {"$in": locs}}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- Waste ----------
class WasteIn(BaseModel):
    product_id: str
    location_name: str
    qty: float
    reason: str


@router.post("/waste")
async def create_waste(body: WasteIn, user=Depends(require("stock.waste"))):
    check_loc(user, body.location_name)
    if body.qty <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")
    pl = await db.product_locations.find_one({"product_id": body.product_id, "location_name": body.location_name}) or {}
    p = await db.products.find_one({"id": body.product_id}) or {}
    loss = round(body.qty * pl.get("cogs_price", 0))
    await inc_stock(body.product_id, body.location_name, -body.qty)
    wid = new_id()
    await db.waste_logs.insert_one({"id": wid, "product_id": body.product_id, "product_name": p.get("name"),
                                    "unit": p.get("unit"), "location_name": body.location_name, "qty": body.qty,
                                    "reason": body.reason, "total_loss_cogs": loss, "reported_by": user["name"],
                                    "created_at": now_iso()})
    await log_move(body.product_id, body.location_name, -body.qty, "waste", wid, user)
    return {"id": wid, "total_loss_cogs": loss}


@router.get("/waste")
async def list_waste(location: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
                     user=Depends(require("stock.waste", "reports.waste"))):
    q = {"location_name": {"$in": loc_filter(user, location)}}
    if date_from or date_to:
        q["created_at"] = date_q(date_from, date_to)
    rows = await db.waste_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    if "products.view_cogs" not in user["permissions"] and "reports.pnl" not in user["permissions"]:
        for r in rows:
            r.pop("total_loss_cogs", None)
    return rows
