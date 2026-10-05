"""BERSINAR POS - Backend API tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "pin": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def kasir1_token():
    r = requests.post(f"{API}/auth/login", json={"username": "kasir1", "pin": "1111"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def kasir1_headers(kasir1_token):
    return {"Authorization": f"Bearer {kasir1_token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_wrong_pin(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "pin": "000000"})
        assert r.status_code == 401

    def test_me_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["is_admin"] is True
        assert "Gudang Utama" in d["allowed_locations"]

    def test_me_kasir1_location_bound(self, kasir1_headers):
        r = requests.get(f"{API}/auth/me", headers=kasir1_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["is_admin"] is False
        assert d["allowed_locations"] == ["Cabang 1"]
        assert "pos.access" in d["permissions"]
        assert "settings.users" not in d["permissions"]

    def test_meta(self):
        r = requests.get(f"{API}/meta")
        assert r.status_code == 200
        d = r.json()
        assert "Cabang 1" in d["locations"]
        assert len(d["permissions"]) > 10


# ---------- Catalog ----------
class TestCatalog:
    def test_catalog_cabang1(self, kasir1_headers):
        r = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=kasir1_headers)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        assert "tiers" in rows[0] and "stock" in rows[0]
        # Kasir should not see cogs
        assert "cogs_price" not in rows[0]

    def test_catalog_forbidden_location(self, kasir1_headers):
        r = requests.get(f"{API}/catalog", params={"location": "Cabang 2"}, headers=kasir1_headers)
        assert r.status_code == 403

    def test_by_sku(self, admin_headers):
        r = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers)
        sku = r.json()[0]["sku"]
        r2 = requests.get(f"{API}/products/by-sku/{sku}", headers=admin_headers)
        assert r2.status_code == 200

    def test_by_sku_notfound(self, admin_headers):
        r = requests.get(f"{API}/products/by-sku/UNKNOWN123", headers=admin_headers)
        assert r.status_code == 404


# ---------- Products ----------
class TestProducts:
    created_pid = None

    def test_gen_sku(self, admin_headers):
        r = requests.get(f"{API}/products/generate-sku", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()["sku"]) == 13

    def test_create_product_and_duplicate_sku(self, admin_headers):
        sku = requests.get(f"{API}/products/generate-sku", headers=admin_headers).json()["sku"]
        body = {
            "sku": sku, "name": "TEST_Produk1", "category": "Lainnya", "unit": "PCS",
            "is_decimal_allowed": False, "min_stock_alert": 2,
            "tiers": [{"tier_name": "Eceran", "min_qty": 0, "price": 5000}],
            "locations": [{"location_name": "Cabang 1", "stock_quantity": 10, "cogs_price": 3000, "min_stock_alert": 2}],
        }
        r = requests.post(f"{API}/products", headers=admin_headers, json=body)
        assert r.status_code == 200, r.text
        TestProducts.created_pid = r.json()["id"]

        # duplicate
        body["name"] = "TEST_Produk2"
        r2 = requests.post(f"{API}/products", headers=admin_headers, json=body)
        assert r2.status_code == 400
        assert "sudah terdaftar" in r2.text


# ---------- Shift ----------
@pytest.fixture(scope="session")
def kasir1_shift(kasir1_headers):
    # ensure shift open for kasir1
    r = requests.get(f"{API}/shifts/current", headers=kasir1_headers)
    if r.status_code == 200 and r.json():
        return r.json()["id"]
    sid = str(uuid.uuid4())
    r = requests.post(f"{API}/shifts/open", headers=kasir1_headers, json={
        "id": sid, "location_name": "Cabang 1", "opening_cash": 100000})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- Transactions / POS ----------
class TestPOS:
    def test_tier_pricing_and_tx(self, kasir1_headers, kasir1_shift):
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=kasir1_headers).json()
        indomie = next((p for p in cat if p["name"] == "Indomie Goreng"), None)
        assert indomie, "Indomie seed missing"
        # expect Grosir tier price for qty 10 = 3300
        grosir = [t for t in indomie["tiers"] if t["tier_name"] == "Grosir"][0]
        assert grosir["price"] == 3300
        tx_id = str(uuid.uuid4())
        body = {
            "id": tx_id, "location_name": "Cabang 1",
            "items": [{"product_id": indomie["id"], "name": indomie["name"], "unit": indomie["unit"],
                       "qty": 10, "applied_unit_price": 3300, "tier_name": "Grosir"}],
            "payment_method": "Tunai", "cash_received": 50000, "shift_id": kasir1_shift,
        }
        r = requests.post(f"{API}/transactions", headers=kasir1_headers, json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_amount"] == 33000
        assert d["change"] == 17000
        assert d["payment_status"] == "Lunas"

    def test_bon_without_customer_fails(self, kasir1_headers, kasir1_shift):
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=kasir1_headers).json()
        p = cat[0]
        body = {
            "id": str(uuid.uuid4()), "location_name": "Cabang 1",
            "items": [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
                       "qty": 1, "applied_unit_price": p["tiers"][0]["price"], "tier_name": "Eceran"}],
            "payment_method": "Bon", "shift_id": kasir1_shift,
        }
        r = requests.post(f"{API}/transactions", headers=kasir1_headers, json=body)
        assert r.status_code == 400

    def test_bon_exceed_limit(self, admin_headers, kasir1_headers, kasir1_shift):
        # fetch Warung Bu Sari
        custs = requests.get(f"{API}/customers", headers=kasir1_headers).json()
        bu_sari = next((c for c in custs if c["name"] == "Warung Bu Sari"), None)
        assert bu_sari
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=kasir1_headers).json()
        p = next((p for p in cat if p["stock"] >= 1), cat[0])
        body = {
            "id": str(uuid.uuid4()), "location_name": "Cabang 1", "customer_id": bu_sari["id"],
            "items": [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
                       "qty": 1, "applied_unit_price": 9999999, "tier_name": "Eceran"}],
            "payment_method": "Bon", "shift_id": kasir1_shift,
        }
        r = requests.post(f"{API}/transactions", headers=kasir1_headers, json=body)
        assert r.status_code == 400
        assert "limit" in r.text.lower() or "ditolak" in r.text.lower() or "melebihi" in r.text.lower()


# ---------- Shop (online) ----------
class TestShop:
    def test_shop_catalog(self):
        r = requests.get(f"{API}/shop/catalog", params={"location": "Cabang 1"})
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_b2b_login(self):
        r = requests.post(f"{API}/shop/b2b-login", json={"phone": "081200000001", "pin": "1234"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_create_order_cod_pickup(self):
        cat = requests.get(f"{API}/shop/catalog", params={"location": "Cabang 1"}).json()
        p = next((x for x in cat if x["stock"] >= 1 and not x["is_decimal_allowed"]), None)
        assert p
        r = requests.post(f"{API}/shop/orders", json={
            "location_name": "Cabang 1", "customer_name": "TEST_Online", "customer_phone": "081200009999",
            "delivery_type": "pickup", "payment_method": "COD",
            "items": [{"product_id": p["id"], "qty": 1}],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_number"].startswith("ON")
        # track
        t = requests.get(f"{API}/shop/orders/{d['order_number']}")
        assert t.status_code == 200
        assert t.json()["status"] == "Menunggu"


# ---------- Orders accept flow (stock atomic) ----------
class TestOrderFlow:
    def test_accept_decreases_stock_and_cancel_restores(self, admin_headers):
        # fetch a product in cabang 1 with stock
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        p = next((x for x in cat if x["stock"] >= 2 and not x["is_decimal_allowed"]), None)
        assert p
        before = p["stock"]
        # create online order
        r = requests.post(f"{API}/shop/orders", json={
            "location_name": "Cabang 1", "customer_name": "TEST_Flow", "customer_phone": "081200000900",
            "delivery_type": "pickup", "payment_method": "COD",
            "items": [{"product_id": p["id"], "qty": 1}],
        })
        assert r.status_code == 200
        order_no = r.json()["order_number"]
        # find staff order id via /orders
        orders = requests.get(f"{API}/orders", params={"location": "Cabang 1"}, headers=admin_headers).json()
        o = next((x for x in orders if x["order_number"] == order_no), None)
        assert o, f"Order {order_no} not found in staff list"
        # accept
        r2 = requests.post(f"{API}/orders/{o['id']}/status", headers=admin_headers, json={"action": "accept"})
        assert r2.status_code == 200, r2.text
        # check stock decreased
        cat2 = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        after = next(x["stock"] for x in cat2 if x["id"] == p["id"])
        assert after == before - 1, f"stock {before} -> {after}"
        # cancel
        r3 = requests.post(f"{API}/orders/{o['id']}/status", headers=admin_headers, json={"action": "cancel"})
        assert r3.status_code == 200
        cat3 = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        restored = next(x["stock"] for x in cat3 if x["id"] == p["id"])
        assert restored == before, f"restore mismatch {before} -> {restored}"


# ---------- Stock receive / waste / transfer / low ----------
class TestStock:
    def test_receive_increases_stock(self, admin_headers):
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        p = cat[0]
        before = p["stock"]
        r = requests.post(f"{API}/receipts", headers=admin_headers, json={
            "location_name": "Cabang 1", "supplier": "TEST_Supplier",
            "items": [{"product_id": p["id"], "qty": 3, "name": p["name"], "unit": p["unit"]}],
        })
        assert r.status_code == 200, r.text
        assert r.json()["receipt_number"].startswith("TB-")
        cat2 = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        after = next(x["stock"] for x in cat2 if x["id"] == p["id"])
        assert after == before + 3

    def test_waste_decreases_stock_and_loss(self, admin_headers):
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        p = next((x for x in cat if x["stock"] >= 2), None)
        before = p["stock"]
        r = requests.post(f"{API}/waste", headers=admin_headers, json={
            "product_id": p["id"], "location_name": "Cabang 1", "qty": 1, "reason": "TEST_rusak",
        })
        assert r.status_code == 200
        assert r.json()["total_loss_cogs"] > 0
        cat2 = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        after = next(x["stock"] for x in cat2 if x["id"] == p["id"])
        assert after == before - 1

    def test_transfer_gudang_to_cabang(self, admin_headers):
        prods = requests.get(f"{API}/products", headers=admin_headers).json()
        # pick a product with Gudang stock
        p = next((x for x in prods if x.get("locations", {}).get("Gudang Utama", {}).get("stock_quantity", 0) >= 2), None)
        assert p, "No product with Gudang stock"
        before_g = p["locations"]["Gudang Utama"]["stock_quantity"]
        before_c = p["locations"]["Cabang 1"]["stock_quantity"]
        r = requests.post(f"{API}/stock/transfer", headers=admin_headers, json={
            "to_location": "Cabang 1",
            "items": [{"product_id": p["id"], "qty": 2, "name": p["name"], "unit": p["unit"]}],
            "notes": "TEST_transfer",
        })
        assert r.status_code == 200, r.text
        prods2 = requests.get(f"{API}/products", headers=admin_headers).json()
        p2 = next(x for x in prods2 if x["id"] == p["id"])
        assert p2["locations"]["Gudang Utama"]["stock_quantity"] == before_g - 2
        assert p2["locations"]["Cabang 1"]["stock_quantity"] == before_c + 2

    def test_adjust_stock(self, admin_headers):
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=admin_headers).json()
        p = cat[0]
        r = requests.post(f"{API}/stock/adjust", headers=admin_headers, json={
            "product_id": p["id"], "location_name": "Cabang 1", "new_qty": p["stock"] + 5, "reason": "TEST_opname",
        })
        assert r.status_code == 200
        assert r.json()["delta"] == 5

    def test_low_stock_list(self, admin_headers):
        r = requests.get(f"{API}/stock/low", params={"location": "Cabang 1"}, headers=admin_headers)
        assert r.status_code == 200


# ---------- Customers / Bon / payment ----------
class TestCustomers:
    def test_bon_payment_restores_limit(self, admin_headers, kasir1_headers, kasir1_shift):
        custs = requests.get(f"{API}/customers", headers=admin_headers).json()
        c = next(x for x in custs if x["name"] == "Warung Bu Sari")
        before_credit = c.get("current_credit", 0)
        cat = requests.get(f"{API}/catalog", params={"location": "Cabang 1"}, headers=kasir1_headers).json()
        p = next(x for x in cat if x["stock"] >= 1 and not x["is_decimal_allowed"])
        price = p["tiers"][0]["price"]
        tx_id = str(uuid.uuid4())
        r = requests.post(f"{API}/transactions", headers=kasir1_headers, json={
            "id": tx_id, "location_name": "Cabang 1", "customer_id": c["id"],
            "items": [{"product_id": p["id"], "name": p["name"], "unit": p["unit"],
                       "qty": 1, "applied_unit_price": price, "tier_name": "Eceran"}],
            "payment_method": "Bon", "shift_id": kasir1_shift,
        })
        assert r.status_code == 200, r.text
        total = r.json()["total_amount"]
        # verify credit increased
        custs2 = requests.get(f"{API}/customers", headers=admin_headers).json()
        c2 = next(x for x in custs2 if x["id"] == c["id"])
        assert c2["current_credit"] == before_credit + total
        # partial payment
        pay = total // 2 or 1
        rp = requests.post(f"{API}/credit-payments", headers=admin_headers, json={
            "customer_id": c["id"], "transaction_id": tx_id, "payment_amount": pay,
            "payment_method": "Tunai",
        })
        assert rp.status_code == 200, rp.text
        custs3 = requests.get(f"{API}/customers", headers=admin_headers).json()
        c3 = next(x for x in custs3 if x["id"] == c["id"])
        assert c3["current_credit"] == c2["current_credit"] - pay


# ---------- Reports ----------
class TestReports:
    def test_sales(self, admin_headers):
        r = requests.get(f"{API}/reports/sales", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "by_method" in d

    def test_pnl(self, admin_headers):
        r = requests.get(f"{API}/reports/pnl", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "by_location" in d and "total" in d

    def test_receivables(self, admin_headers):
        r = requests.get(f"{API}/reports/receivables", headers=admin_headers)
        assert r.status_code == 200


# ---------- Expense ----------
class TestExpense:
    def test_create_expense(self, kasir1_headers, kasir1_shift):
        r = requests.post(f"{API}/expenses", headers=kasir1_headers, json={
            "id": str(uuid.uuid4()), "shift_id": kasir1_shift, "location_name": "Cabang 1",
            "category": "Lainnya", "amount": 1500, "notes": "TEST_exp",
        })
        assert r.status_code == 200
