import os
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
LOCATIONS = ["Gudang Utama", "Cabang 1", "Cabang 2"]
BRANCHES = ["Cabang 1", "Cabang 2"]
CATEGORIES = ["Sayur", "Buah", "Sembako", "Minuman", "Daging", "Lainnya"]

PERMISSIONS = [
    ("pos.access", "POS", "Akses kasir"),
    ("pos.discount", "POS", "Beri diskon"),
    ("pos.remove_item", "POS", "Hapus item dari keranjang"),
    ("pos.void", "POS", "Batalkan/void transaksi"),
    ("pos.bon", "POS", "Bayar dengan Bon"),
    ("pos.reprint", "POS", "Cetak ulang struk"),
    ("shift.open_close", "Shift & Kas", "Buka/tutup shift"),
    ("shift.expense", "Shift & Kas", "Input pengeluaran harian"),
    ("shift.view_all", "Shift & Kas", "Lihat laporan shift semua kasir"),
    ("orders.process", "Pesanan Online", "Lihat & proses pesanan"),
    ("orders.mark_paid", "Pesanan Online", "Tandai sudah dibayar"),
    ("orders.cancel", "Pesanan Online", "Tolak/batalkan pesanan"),
    ("products.view", "Produk", "Lihat produk"),
    ("products.add", "Produk", "Tambah produk"),
    ("products.edit", "Produk", "Edit produk & harga"),
    ("products.deactivate", "Produk", "Nonaktifkan produk"),
    ("products.view_cogs", "Produk", "Lihat HPP"),
    ("stock.receive", "Stok", "Terima barang"),
    ("stock.receive_history", "Stok", "Lihat riwayat terima barang"),
    ("stock.adjust", "Stok", "Penyesuaian/stock opname"),
    ("stock.transfer", "Stok", "Transfer stok Gudang → Cabang"),
    ("stock.waste", "Stok", "Catat barang rusak"),
    ("stock.low", "Stok", "Lihat stok menipis & daftar kulakan"),
    ("customers.manage", "Pelanggan & Bon", "Kelola pelanggan B2B"),
    ("customers.credit_limit", "Pelanggan & Bon", "Ubah limit kredit"),
    ("customers.payment", "Pelanggan & Bon", "Catat pelunasan bon"),
    ("reports.sales", "Laporan", "Laporan penjualan"),
    ("reports.shift", "Laporan", "Laporan per shift"),
    ("reports.pnl", "Laporan", "Laporan Laba Rugi"),
    ("reports.waste", "Laporan", "Laporan barang rusak"),
    ("reports.receivables", "Laporan", "Laporan piutang"),
    ("settings.users", "Pengaturan", "Kelola akun staf"),
    ("settings.roles", "Pengaturan", "Kelola hak akses"),
    ("settings.store", "Pengaturan", "Pengaturan toko (nama, rekening, QRIS, ongkir)"),
    ("settings.expense_cats", "Pengaturan", "Kelola kategori pengeluaran"),
]
ALL_PERMS = [p[0] for p in PERMISSIONS]

KASIR_PERMS = ["pos.access", "pos.discount", "pos.remove_item", "pos.bon", "pos.reprint", "shift.open_close",
               "shift.expense", "orders.process", "orders.mark_paid", "orders.cancel", "products.view", "stock.waste",
               "stock.low", "stock.receive", "stock.receive_history", "customers.payment"]
GUDANG_PERMS = ["products.view", "products.add", "products.edit", "stock.adjust", "stock.transfer", "stock.waste",
                "stock.low", "reports.waste", "stock.receive", "stock.receive_history"]


TZ = timezone(timedelta(hours=7))


def now_iso():
    return datetime.now(timezone.utc).astimezone(TZ).isoformat()


def to_local(iso):
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(TZ).isoformat()
    except Exception:
        return now_iso()


def date_q(date_from=None, date_to=None):
    q = {}
    if date_from:
        q["$gte"] = date_from
    if date_to:
        q["$lte"] = date_to + "T99"
    return q


def new_id():
    return str(uuid.uuid4())


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def verify_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode(), hashed.encode())


def create_token(sub: str, kind: str, days: int = 7) -> str:
    payload = {"sub": sub, "type": kind, "exp": datetime.now(timezone.utc) + timedelta(days=days)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth[7:], os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None


async def load_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "pin_hash": 0})
    if not user or not user.get("active", True):
        return None
    role = await db.roles.find_one({"id": user["role_id"]}, {"_id": 0}) or {"name": "-", "permissions": []}
    user["role_name"] = role["name"]
    user["is_admin"] = role.get("is_admin", False)
    user["permissions"] = ALL_PERMS if user["is_admin"] else role.get("permissions", [])
    locs = user.get("locations") or ["ALL"]
    user["allowed_locations"] = LOCATIONS if "ALL" in locs else [l for l in LOCATIONS if l in locs]
    return user


async def get_current_user(request: Request):
    payload = decode_token(request)
    if not payload or payload.get("type") != "staff":
        raise HTTPException(401, "Sesi tidak valid, silakan login ulang")
    user = await load_user(payload["sub"])
    if not user:
        raise HTTPException(401, "Akun tidak ditemukan atau nonaktif")
    return user


def require(*perms):
    async def dep(user=Depends(get_current_user)):
        if not any(p in user["permissions"] for p in perms):
            raise HTTPException(403, "Anda tidak memiliki hak untuk aksi ini")
        return user
    return dep


def check_loc(user, location):
    if location not in LOCATIONS:
        raise HTTPException(400, "Lokasi tidak valid")
    if location not in user["allowed_locations"]:
        raise HTTPException(403, f"Anda tidak memiliki akses ke {location}")


def loc_filter(user, location=None):
    if location:
        check_loc(user, location)
        return [location]
    return user["allowed_locations"]


def apply_tier(tiers, qty):
    best = None
    for t in sorted(tiers, key=lambda x: x["min_qty"]):
        if qty >= t["min_qty"] or best is None:
            best = t
    return best


def r2(x):
    return round(float(x or 0), 3)
