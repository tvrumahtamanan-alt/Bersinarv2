from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends

from core import db, require, loc_filter, date_q, BRANCHES

router = APIRouter(prefix="/api/reports")


def base_q(user, location, date_from, date_to, field="created_at"):
    q = {"location_name": {"$in": loc_filter(user, location)}}
    if date_from or date_to:
        q[field] = date_q(date_from, date_to)
    return q


@router.get("/sales")
async def sales(location: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
                user=Depends(require("reports.sales"))):
    q = {**base_q(user, location, date_from, date_to), "voided": False}
    txs = await db.transactions.find(q, {"_id": 0, "items": 0}).to_list(50000)
    by_method, by_day, by_loc = {}, {}, {}
    for t in txs:
        by_method[t["payment_method"]] = by_method.get(t["payment_method"], 0) + t["total_amount"]
        d = t["created_at"][:10]
        row = by_day.setdefault(d, {"date": d, "total": 0, "count": 0})
        row["total"] += t["total_amount"]
        row["count"] += 1
        by_loc[t["location_name"]] = by_loc.get(t["location_name"], 0) + t["total_amount"]
    return {"total": sum(t["total_amount"] for t in txs), "count": len(txs), "by_method": by_method,
            "by_day": sorted(by_day.values(), key=lambda x: x["date"], reverse=True), "by_location": by_loc,
            "discount": sum(max(t.get("discount", 0), 0) for t in txs)}


@router.get("/pnl")
async def pnl(location: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
              user=Depends(require("reports.pnl"))):
    locs = loc_filter(user, location)
    out = {}
    for loc in locs:
        q = base_q(user, loc, date_from, date_to)
        txs = await db.transactions.find({**q, "voided": False}, {"_id": 0}).to_list(50000)
        revenue = sum(t["total_amount"] for t in txs)
        cogs = round(sum(i["qty"] * i.get("cogs_price", 0) for t in txs for i in t["items"]))
        waste = sum(w["total_loss_cogs"] for w in await db.waste_logs.find(q, {"_id": 0}).to_list(50000))
        exp = sum(e["amount"] for e in await db.expenses.find(q, {"_id": 0}).to_list(50000))
        out[loc] = {"revenue": revenue, "cogs": cogs, "gross_profit": revenue - cogs, "waste_loss": waste,
                    "expenses": exp, "net_profit": revenue - cogs - waste - exp}
    total = {k: sum(v[k] for v in out.values()) for k in ["revenue", "cogs", "gross_profit", "waste_loss", "expenses", "net_profit"]}
    return {"by_location": out, "total": total}


@router.get("/receivables")
async def receivables(user=Depends(require("reports.receivables"))):
    today = date.today().isoformat()
    custs = await db.customers.find({"current_credit": {"$gt": 0}}, {"_id": 0, "pin_hash": 0}).to_list(5000)
    bons = await db.transactions.find({"payment_method": "Bon", "voided": False, "payment_status": {"$ne": "Lunas"}},
                                      {"_id": 0, "items": 0}).sort("created_at", 1).to_list(10000)
    for b in bons:
        b["outstanding"] = b["total_amount"] - b.get("paid_amount", 0)
        b["overdue"] = (b.get("due_date") or "9999") < today
    return {"customers": custs, "bons": bons, "total": sum(c["current_credit"] for c in custs),
            "overdue_total": sum(b["outstanding"] for b in bons if b["overdue"])}
