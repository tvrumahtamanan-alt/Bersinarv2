# BERSINAR — POS & Gudang Toko Sayur & Sembako + Aplikasi Pesan Online

## Original problem statement
Sistem Kasir / POS & Manajemen Stok/Gudang yang terintegrasi penuh dengan Aplikasi Pesan Online Pelanggan untuk Toko Sayur & Sembako (1 Gudang Utama, 2 Cabang Retail). Ultra fast, ringan, minim animasi, offline-capable, fully responsive. Tablet split-pane 62/38, grid 4→5 kolom saat fullscreen, numpad modal tengah (tombol flex-shrink-0), mobile 2 kolom + floating cart bar + bottom sheet, 100dvh. React.memo ProductCard, debounce 150ms, virtualisasi. Desimal/timbangan, harga bertingkat, kelola produk, waste_logs (kerugian HPP ke Laba Rugi), pelanggan B2B + Bon + limit kredit + pelunasan, aplikasi pesan online (shared DB, real-time stok, auto habis, pickup/kurir, QRIS/Transfer/COD/Bon), pesanan masuk di POS (popup+suara, status flow, potong stok atomic). Skema: products, product_locations, tier_prices, customers, transactions, transaction_items, waste_logs, credit_payments, online_orders.
Approved plan additions: login Username+PIN, matriks hak akses + peran custom + batas lokasi, shift kasir & pengeluaran, barcode scanner (POS auto-add, form produk auto-fill), stok menipis + daftar kulakan (Salin), terima barang, transfer gudang→cabang, laporan.

## Architecture
- Backend FastAPI (/app/backend): core.py (db, JWT Bearer, permissions, location checks), seed.py, routes_auth/products/sales/orders/reports.py. MongoDB with UUID string ids, timestamps in WIB (+07:00).
- Frontend React SPA (/app/frontend/src): lib/{api,offline(outbox queue + cache),scanner(global keyboard-wedge stack),printer(Web Bluetooth ESC/POS + browser print),sound}, context/AuthContext, pages/pos/*, pages/*, pages/shop/*. Service worker (production only) caches app shell.

## User personas
Admin/Pemilik, Kasir cabang, Staf Gudang, Pelanggan umum, Pelanggan B2B.

## Implemented (2026-10-05)
- Staff auth (username+PIN, 5x lock 15min), roles + editable permission matrix, location-bound accounts, live permission refresh (30s)
- POS: split-pane/mobile sheet, virtualized memo grid, fullscreen 5 cols, decimal numpad, auto tier pricing, discount, Tunai/QRIS/Transfer/Bon (limit check), receipt preview + BT/browser print, offline queue + auto sync, scanner auto-add
- Shifts (open/close, expected vs physical cash), daily expenses, shift report + print recap
- Products CRUD (scanner auto-fill SKU, duplicate warning, per-location HPP/min stock), stock adjust, transfer Gudang→Cabang
- Low stock + kulakan list (numpad, Salin, Kosongkan); Receive goods (scan→numpad, draft saved locally, history)
- Waste logs with HPP loss; B2B customers, bon, partial payments (FIFO)
- Online shop (branch, categories, search, decimal, Habis, pickup/delivery, QRIS/Transfer/COD/Bon B2B login, tracking); POS order inbox with popup+sound, status flow, atomic stock on accept, cancel restores
- Reports: sales, P&L, waste, receivables, expenses
- Tested: iteration_1 backend 27/27 pass, frontend flows pass

## Notes
- POS sales may drive stock negative by design (offline/physical sales); online orders are strictly guarded.
- Placeholders: store address, phone, bank info, QRIS image, delivery fee (Pengaturan → Toko).

## Backlog
- P1: Payment gateway QRIS/Transfer (Midtrans/Xendit); WhatsApp notifications; Purchase Order + average HPP; expiry batch tracking
- P2: Analytics dashboard, loyalty/promo, Excel/PDF export, flexible new branches
