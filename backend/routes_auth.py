from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import (db, new_id, now_iso, hash_pin, verify_pin, create_token, get_current_user, require,
                  PERMISSIONS, LOCATIONS, CATEGORIES)

router = APIRouter(prefix="/api")


class LoginIn(BaseModel):
    username: str
    pin: str


@router.post("/auth/login")
async def login(body: LoginIn, request: Request):
    username = body.username.strip().lower()
    ident = f"{request.client.host if request.client else '-'}:{username}"
    att = await db.login_attempts.find_one({"identifier": ident})
    now = datetime.now(timezone.utc)
    if att and att.get("locked_until") and datetime.fromisoformat(att["locked_until"]) > now:
        raise HTTPException(429, "Terlalu banyak percobaan. Akun dikunci 15 menit.")
    user = await db.users.find_one({"username": username})
    if not user or not user.get("active", True) or not verify_pin(body.pin, user["pin_hash"]):
        count = (att or {}).get("count", 0) + 1
        upd = {"count": count}
        if count >= 5:
            upd = {"count": 0, "locked_until": (now + timedelta(minutes=15)).isoformat()}
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(401, "Username atau PIN salah")
    await db.login_attempts.delete_one({"identifier": ident})
    return {"token": create_token(user["id"], "staff", 7)}


@router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@router.get("/meta")
async def meta():
    return {"locations": LOCATIONS, "categories": CATEGORIES,
            "permissions": [{"key": k, "group": g, "label": l} for k, g, l in PERMISSIONS]}


# ---------- Users ----------
class UserIn(BaseModel):
    username: str
    name: str
    pin: Optional[str] = None
    role_id: str
    locations: List[str] = ["ALL"]
    active: bool = True


@router.get("/users")
async def list_users(user=Depends(require("settings.users"))):
    return await db.users.find({}, {"_id": 0, "pin_hash": 0}).sort("created_at", 1).to_list(500)


@router.post("/users")
async def create_user(body: UserIn, user=Depends(require("settings.users"))):
    if not body.pin or not body.pin.isdigit() or len(body.pin) < 4:
        raise HTTPException(400, "PIN minimal 4 digit angka")
    uname = body.username.strip().lower()
    if await db.users.find_one({"username": uname}):
        raise HTTPException(400, "Username sudah dipakai")
    doc = {"id": new_id(), "username": uname, "name": body.name, "pin_hash": hash_pin(body.pin),
           "role_id": body.role_id, "locations": body.locations or ["ALL"], "active": body.active, "created_at": now_iso()}
    await db.users.insert_one(doc)
    return {"id": doc["id"]}


@router.put("/users/{uid}")
async def update_user(uid: str, body: UserIn, user=Depends(require("settings.users"))):
    upd = {"name": body.name, "role_id": body.role_id, "locations": body.locations or ["ALL"], "active": body.active}
    if body.pin:
        if not body.pin.isdigit() or len(body.pin) < 4:
            raise HTTPException(400, "PIN minimal 4 digit angka")
        upd["pin_hash"] = hash_pin(body.pin)
    if uid == user["id"] and not body.active:
        raise HTTPException(400, "Tidak bisa menonaktifkan akun sendiri")
    await db.users.update_one({"id": uid}, {"$set": upd})
    return {"ok": True}


# ---------- Roles ----------
class RoleIn(BaseModel):
    name: str
    permissions: List[str] = []


@router.get("/roles")
async def list_roles(user=Depends(get_current_user)):
    return await db.roles.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)


@router.post("/roles")
async def create_role(body: RoleIn, user=Depends(require("settings.roles"))):
    doc = {"id": new_id(), "name": body.name.strip(), "permissions": body.permissions, "is_admin": False, "created_at": now_iso()}
    await db.roles.insert_one(doc)
    return {"id": doc["id"]}


@router.put("/roles/{rid}")
async def update_role(rid: str, body: RoleIn, user=Depends(require("settings.roles"))):
    role = await db.roles.find_one({"id": rid})
    if not role:
        raise HTTPException(404, "Peran tidak ditemukan")
    upd = {"name": body.name.strip()}
    if not role.get("is_admin"):
        upd["permissions"] = body.permissions
    await db.roles.update_one({"id": rid}, {"$set": upd})
    return {"ok": True}


@router.delete("/roles/{rid}")
async def delete_role(rid: str, user=Depends(require("settings.roles"))):
    role = await db.roles.find_one({"id": rid})
    if not role or role.get("is_admin"):
        raise HTTPException(400, "Peran Admin tidak bisa dihapus")
    if await db.users.count_documents({"role_id": rid}):
        raise HTTPException(400, "Peran masih dipakai oleh akun staf")
    await db.roles.delete_one({"id": rid})
    return {"ok": True}


# ---------- Settings ----------
class SettingsIn(BaseModel):
    store_name: str
    address: str = ""
    phone: str = ""
    bank_info: str = ""
    qris_image_url: str = ""
    delivery_fee: float = 0
    receipt_footer: str = ""


@router.get("/settings")
async def get_settings():
    return await db.settings.find_one({"id": "store"}, {"_id": 0})


@router.put("/settings")
async def put_settings(body: SettingsIn, user=Depends(require("settings.store"))):
    await db.settings.update_one({"id": "store"}, {"$set": body.model_dump()})
    return {"ok": True}


class CatsIn(BaseModel):
    expense_categories: List[str]


@router.put("/settings/expense-categories")
async def put_cats(body: CatsIn, user=Depends(require("settings.expense_cats"))):
    cats = [c.strip() for c in body.expense_categories if c.strip()]
    await db.settings.update_one({"id": "store"}, {"$set": {"expense_categories": cats}})
    return {"ok": True}
