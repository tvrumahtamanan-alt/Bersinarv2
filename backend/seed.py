import os
from core import db, new_id, now_iso, hash_pin, verify_pin, LOCATIONS, KASIR_PERMS, GUDANG_PERMS

SAMPLE = [
    ("Bayam", "Sayur", "Ikat", False, [3000, 2500, 2000], 40, 1800),
    ("Kangkung", "Sayur", "Ikat", False, [3000, 2500, 2000], 40, 1700),
    ("Tomat", "Sayur", "Kg", True, [14000, 13000, 12000], 25, 9000),
    ("Cabai Merah", "Sayur", "Kg", True, [60000, 57000, 54000], 10, 45000),
    ("Bawang Merah", "Sayur", "Kg", True, [38000, 36000, 34000], 20, 30000),
    ("Bawang Putih", "Sayur", "Kg", True, [32000, 30000, 28000], 20, 25000),
    ("Kentang", "Sayur", "Kg", True, [18000, 17000, 16000], 30, 13000),
    ("Wortel", "Sayur", "Kg", True, [15000, 14000, 13000], 25, 10000),
    ("Pisang Ambon", "Buah", "Kg", True, [20000, 18500, 17000], 15, 14000),
    ("Jeruk Medan", "Buah", "Kg", True, [28000, 26000, 24000], 15, 20000),
    ("Apel Fuji", "Buah", "Kg", True, [40000, 38000, 36000], 10, 31000),
    ("Beras Premium 5kg", "Sembako", "Pack", False, [75000, 73000, 71000], 20, 66000),
    ("Gula Pasir 1kg", "Sembako", "PCS", False, [17000, 16500, 16000], 30, 14500),
    ("Minyak Goreng 2L", "Sembako", "PCS", False, [36000, 35000, 34000], 24, 31000),
    ("Indomie Goreng", "Sembako", "PCS", False, [3500, 3300, 3100], 80, 2800),
    ("Telur Ayam", "Sembako", "Kg", True, [29000, 28000, 27000], 20, 24500),
    ("Tepung Terigu 1kg", "Sembako", "PCS", False, [13000, 12500, 12000], 20, 10500),
    ("Air Mineral 600ml", "Minuman", "PCS", False, [4000, 3700, 3500], 48, 2700),
    ("Teh Botol 450ml", "Minuman", "PCS", False, [6000, 5600, 5300], 36, 4300),
    ("Daging Sapi", "Daging", "Kg", True, [135000, 130000, 125000], 8, 115000),
    ("Daging Ayam", "Daging", "Kg", True, [38000, 36500, 35000], 10, 31000),
    ("Kantong Plastik", "Lainnya", "Pack", False, [10000, 9500, 9000], 10, 7500),
]


async def ensure_role(name, perms, is_admin=False):
    r = await db.roles.find_one({"name": name})
    if r:
        return r["id"]
    rid = new_id()
    await db.roles.insert_one({"id": rid, "name": name, "permissions": perms, "is_admin": is_admin, "created_at": now_iso()})
    return rid


async def ensure_user(username, name, pin, role_id, locations):
    u = await db.users.find_one({"username": username})
    if not u:
        await db.users.insert_one({"id": new_id(), "username": username, "name": name, "pin_hash": hash_pin(pin),
                                   "role_id": role_id, "locations": locations, "active": True, "created_at": now_iso()})
    elif not verify_pin(pin, u["pin_hash"]):
        await db.users.update_one({"username": username}, {"$set": {"pin_hash": hash_pin(pin)}})


async def run_seed():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.products.create_index("sku")
    await db.product_locations.create_index([("product_id", 1), ("location_name", 1)], unique=True)
    await db.tier_prices.create_index("product_id")
    await db.transactions.create_index("id", unique=True)
    await db.transactions.create_index([("location_name", 1), ("created_at", -1)])
    await db.online_orders.create_index("order_number", unique=True)
    await db.login_attempts.create_index("identifier")

    admin_role = await ensure_role("Admin", [], True)
    kasir_role = await ensure_role("Kasir", KASIR_PERMS)
    gudang_role = await ensure_role("Staf Gudang", GUDANG_PERMS)
    await ensure_user(os.environ["ADMIN_USERNAME"], "Administrator", os.environ["ADMIN_PIN"], admin_role, ["ALL"])
    await ensure_user("kasir1", "Kasir Cabang 1", "1111", kasir_role, ["Cabang 1"])
    await ensure_user("kasir2", "Kasir Cabang 2", "2222", kasir_role, ["Cabang 2"])
    await ensure_user("gudang", "Staf Gudang", "3333", gudang_role, ["Gudang Utama"])

    if not await db.settings.find_one({"id": "store"}):
        await db.settings.insert_one({
            "id": "store", "store_name": "BERSINAR", "address": "[Alamat toko]", "phone": "[No. telepon toko]",
            "bank_info": "[Nama Bank] - [No. Rekening] a.n. [Nama Pemilik]", "qris_image_url": "",
            "delivery_fee": 0, "receipt_footer": "Terima kasih telah berbelanja",
            "expense_categories": ["Bayar Barang Titipan", "Token Listrik", "Lainnya"],
        })

    if await db.products.count_documents({}) == 0:
        for i, (name, cat, unit, dec, prices, minstock, cogs) in enumerate(SAMPLE):
            pid = new_id()
            await db.products.insert_one({"id": pid, "sku": f"899{1000000000 + i}", "name": name, "category": cat,
                                          "unit": unit, "is_decimal_allowed": dec, "is_expirable": cat in ("Daging", "Sembako"),
                                          "min_stock_alert": 5, "active": True, "created_at": now_iso()})
            for tier, mq, pr in zip(["Eceran", "Grosir", "Partai Besar"], [0, 10, 50], prices):
                await db.tier_prices.insert_one({"id": new_id(), "product_id": pid, "tier_name": tier, "min_qty": mq, "price": pr})
            for loc in LOCATIONS:
                stock = minstock * (6 if loc == "Gudang Utama" else 1) + (0 if i % 7 else -minstock + 2)
                await db.product_locations.insert_one({"id": new_id(), "product_id": pid, "location_name": loc,
                                                       "stock_quantity": max(stock, 0), "cogs_price": cogs, "min_stock_alert": 5})
        await db.customers.insert_one({"id": new_id(), "name": "Warung Bu Sari", "phone": "081200000001",
                                       "customer_type": "B2B", "credit_limit": 1000000, "current_credit": 0,
                                       "payment_terms_days": 14, "pin_hash": hash_pin("1234"), "created_at": now_iso()})
