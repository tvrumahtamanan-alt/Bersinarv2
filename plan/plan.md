# Rencana Pelaksanaan: BERSINAR — Sistem POS & Gudang Toko Sayur & Sembako + Aplikasi Pesan Online

Sistem kasir (POS) dan manajemen stok untuk 1 Gudang Utama dan 2 Cabang Retail, dibuat sangat cepat, ringan, tetap bisa dipakai saat offline, dan responsif di tablet maupun HP.
Satu database dipakai bersama oleh POS kasir dan aplikasi pesan online pelanggan, jadi stok dan harga selalu sama di kedua sisi tanpa sinkronisasi manual.

## Untuk Siapa
- **Admin / Pemilik**: mengelola produk, harga bertingkat, stok per lokasi, akun staf, pelanggan B2B dan limit kredit, serta melihat laporan.
- **Kasir Cabang (Cabang 1 / Cabang 2)**: melayani penjualan di toko, menimbang barang, menerima pembayaran termasuk Bon, mencetak struk, dan memproses pesanan online cabangnya.
- **Staf Gudang**: mencatat stok di Gudang Utama dan barang rusak/busuk.
- **Pelanggan Umum**: memesan online dari HP lalu memilih ambil di toko atau dikirim kurir.
- **Pelanggan B2B (warung, rumah makan)**: memesan online atau belanja di kasir dengan pembayaran Bon sesuai limit kredit.

## Fitur Utama & Pengalaman Pengguna

### Login Staf
- Staf masuk dengan **Username + PIN**. Semua akun staf dibuat oleh Admin di dalam aplikasi, tidak ada pendaftaran terbuka.
- Peran bawaan: Admin, Kasir (terikat ke satu cabang), Staf Gudang. Setiap peran hanya melihat menu dan tombol yang menjadi haknya.

### Pengaturan Hak Akses (bisa diubah)
- Halaman **Pengaturan → Hak Akses** menampilkan tabel centang: baris berisi daftar hak, kolom berisi peran. Admin cukup mencentang atau menghapus centang, lalu menyimpan.
- Admin bisa **membuat peran baru** (mis. Supervisor, Kepala Cabang), mengganti nama peran, dan menghapus peran yang tidak dipakai. Setiap akun staf diberi satu peran.
- Peran **Admin** selalu punya semua hak dan tidak bisa dikurangi, supaya pengaturan tidak terkunci.
- Perubahan hak langsung berlaku pada staf yang sedang login: menu dan tombol yang tidak diizinkan langsung tersembunyi, dan aksinya juga ditolak oleh sistem.
- Daftar hak yang bisa diatur:
  - **POS**: Akses kasir, Beri diskon, Hapus item dari keranjang, Batalkan/void transaksi, Bayar dengan Bon, Cetak ulang struk.
  - **Shift & Kas**: Buka/tutup shift, Input pengeluaran harian, Lihat laporan shift semua kasir.
  - **Pesanan Online**: Lihat & proses pesanan, Tandai sudah dibayar, Tolak/batalkan pesanan.
  - **Produk**: Lihat produk, Tambah produk, Edit produk & harga, Nonaktifkan produk, Lihat HPP.
  - **Stok**: Terima barang, Lihat riwayat terima barang, Penyesuaian/stock opname, Transfer stok Gudang → Cabang, Catat barang rusak, Lihat stok menipis & daftar kulakan.
  - **Pelanggan & Bon**: Kelola pelanggan B2B, Ubah limit kredit, Catat pelunasan bon.
  - **Laporan**: Laporan penjualan, Laporan Laba Rugi, Laporan barang rusak, Laporan piutang.
  - **Pengaturan**: Kelola akun staf, Kelola hak akses, Pengaturan toko (nama, rekening, QRIS, ongkir), Kelola kategori pengeluaran.
- **Batas lokasi**: tiap akun staf bisa dibatasi ke lokasi tertentu (Gudang, Cabang 1, Cabang 2, atau semua), sehingga hak di atas hanya berlaku untuk data lokasi tersebut.
- Login dikunci sementara (15 menit) setelah 5 kali PIN salah.
- Admin bisa mereset PIN dan menonaktifkan akun staf.
- Sesi kasir tetap aktif saat jaringan putus, jadi kasir tetap bisa berjualan offline.

### POS Kasir
- **Tablet landscape (11 inci)**: dua panel, katalog di kiri (62%) dan keranjang + pembayaran di kanan (38%). Grid katalog 4 kolom, otomatis jadi 5 kolom dalam mode Fullscreen (tombol di navbar atas).
- **HP (< 768px)**: katalog 2 kolom, bar keranjang mengambang di bawah `[ X Item | Rp XX.XXX ]` + tombol "Lihat Keranjang" yang membuka bottom sheet untuk meninjau keranjang dan membayar.
- Tinggi layar mengikuti `100dvh`, jadi tampilan tidak terpotong oleh bar URL Chrome di tablet Android/HarmonyOS.
- Pencarian produk (jeda 150ms) dan filter kategori.
- **Barcode scanner duduk (desktop/USB/Bluetooth)**: begitu barang di-scan, produk langsung masuk keranjang tanpa menekan tombol apa pun dan tanpa harus mengeklik kolom pencarian dulu. Scan barang yang sama lagi menambah jumlahnya. Ada bunyi "beep" saat berhasil, dan pesan singkat "Barcode tidak ditemukan" bila kode belum terdaftar. Produk timbang (desimal) yang di-scan langsung membuka numpad berat.
- **Numpad kuantitas/timbangan**: modal di tengah layar untuk input desimal (mis. 0,25 kg, 1,5 kg) pada produk Sayur/Buah/Daging. Tombol "Tambah ke Keranjang" selalu terlihat di bagian bawah modal.
- **Harga bertingkat otomatis**: Eceran → Grosir → Partai Besar, berpindah otomatis sesuai jumlah yang dibeli dan terlihat di keranjang.
- Diskon per transaksi.
- Metode bayar: Tunai (dengan hitungan kembalian), QRIS, Transfer, dan **Bon / Hutang Pelanggan** (otomatis ditolak jika melebihi sisa limit kredit).
- Cetak struk ke printer thermal Bluetooth (58mm / 80mm) lewat Web Bluetooth. Ada pratinjau struk dan cetak ulang dari riwayat.
- **Offline**: katalog dan harga tersimpan di perangkat. Transaksi saat offline masuk antrean lokal dan otomatis terkirim saat jaringan kembali. Ada indikator status Online/Offline dan jumlah transaksi yang menunggu sinkronisasi.
- Bisa menangani ribuan produk tanpa lambat. Sentuhan langsung bereaksi, tanpa animasi berat, tanpa blur, dan tanpa transisi popup.

### Shift Kasir & Pengeluaran Harian
- Kasir **Buka Shift** dengan mengisi modal awal kas laci, lalu **Tutup Shift** dengan mengisi uang fisik yang dihitung. Sistem menampilkan selisih (lebih/kurang).
- **Input pengeluaran harian** selama shift, tercatat terpisah per kasir dan per cabang: kategori (Bayar Barang Titipan, Token Listrik, Lainnya), nominal, dan keterangan. Admin bisa menambah/mengubah kategori pengeluaran.
- Kas yang seharusnya ada = Modal Awal + Penjualan Tunai + Pelunasan Bon Tunai − Pengeluaran Tunai.
- **Laporan per shift**: kasir, cabang, jam buka/tutup, total penjualan per metode bayar, jumlah transaksi, daftar pengeluaran, kas seharusnya vs kas fisik, dan selisih. Bisa difilter per kasir, per cabang, dan per tanggal. Struk rekap shift bisa dicetak.
- Kasir tidak bisa bertransaksi sebelum membuka shift.

### Pesanan Online Masuk (di POS)
- Popup dan bunyi notifikasi "Pesanan Online Masuk" khusus untuk cabang yang dituju.
- Alur status: **Terima Pesanan → Diproses/Dikemas → Siap Diambil/Dikirim → Selesai**, dengan opsi Tolak/Batalkan.
- Stok dipotong saat kasir menerima pesanan. Jika stok sudah tidak cukup, penerimaan pesanan ditolak dengan pesan yang jelas.
- Untuk QRIS/Transfer, kasir menandai "Sudah Dibayar" secara manual setelah mengecek pembayaran.

### Kelola Produk & Stok
- Form "+ Tambah Produk Baru": Nama, Kategori (Sayur, Buah, Sembako, Minuman, Daging, Lainnya), Barcode/SKU (scan atau buat otomatis), Satuan (Kg, Gram, PCS, Liter, Ikat, Pack, dll), toggle Penjualan Desimal, harga Eceran/Grosir/Partai Besar beserta min qty, toggle Masa Kadaluarsa, serta stok, HPP, dan **batas minimum stok**.
- **Barcode otomatis terisi saat di-scan**: selama form Tambah/Edit Produk terbuka, scan barang dengan barcode scanner langsung mengisi kolom Barcode/SKU tanpa menekan tombol apa pun dan tanpa harus mengeklik kolom Barcode dulu. Scan tidak mengganggu kolom lain yang sedang diketik (mis. Nama). Jika barcode sudah dipakai produk lain, muncul peringatan "Barcode sudah terdaftar: [nama produk]". Selama form terbuka, hasil scan tidak masuk ke keranjang POS.
- **Batas minimum stok berbeda untuk setiap produk** (dan bisa berbeda per lokasi: Gudang, Cabang 1, Cabang 2). Nilainya diisi saat tambah produk dan bisa diubah kapan saja lewat Edit/Pengaturan Produk.
- Daftar produk dengan pencarian, edit, dan nonaktifkan.

### Stok Menipis & Daftar Belanja Kulakan
- **Daftar Stok Menipis** per lokasi: berisi produk yang stoknya di bawah atau sama dengan batas minimum masing-masing, lengkap dengan stok saat ini dan batas minimumnya.
- Ketuk item di daftar, lalu muncul **popup numpad** untuk mengisi jumlah yang ingin dipesan. Setelah diisi, item otomatis masuk ke **Daftar Belanja Kulakan**.
- Item di Daftar Belanja Kulakan bisa diubah jumlahnya atau dihapus, dan daftarnya tetap tersimpan sampai dikosongkan.
- Tombol **"Salin"** menyalin daftar dalam format teks sederhana, satu baris per item, misalnya:
  ```
  10 indomie goreng
  5 minyak goreng 2L
  3 gula pasir
  ```
  Teks ini siap ditempel ke WhatsApp untuk dikirim ke supplier.
- Tombol **"Kosongkan Daftar"** dipakai setelah pesanan terkirim.
- **Transfer stok Gudang Utama → Cabang** (menambah stok cabang dan mengurangi stok gudang).
- Penyesuaian stok / stock opname.

### Terima Barang (dari Supplier / Belanja Grosir)
- Untuk barang yang datang langsung ke cabang atau ke gudang, baik dari supplier maupun dari belanja grosir.
- Staf membuka **Terima Barang**, memilih lokasi tujuan (otomatis sesuai cabangnya), lalu boleh mengisi nama supplier dan catatan (opsional).
- Barang di-scan satu per satu. Setiap kali di-scan, langsung muncul **popup numpad** untuk mengisi jumlah barang yang diterima (mendukung desimal untuk barang timbang), lalu tekan OK. Tidak perlu menekan tombol apa pun untuk memulai scan.
- Jika barang yang sama di-scan lagi, jumlahnya ditambahkan ke baris yang sudah ada.
- Barang tanpa barcode bisa dicari lewat kolom pencarian nama.
- Jika barcode belum terdaftar, muncul pilihan "Tambah Produk Baru" dengan barcode sudah terisi, lalu kembali ke daftar penerimaan.
- Semua barang yang sudah di-scan tampil dalam daftar penerimaan (nama, jumlah, satuan) dan bisa diubah jumlahnya atau dihapus sebelum dikirim.
- Daftar penerimaan tersimpan otomatis di perangkat, jadi tidak hilang jika halaman tertutup atau jaringan putus.
- Tombol **"Kirim & Update Stok"** memunculkan konfirmasi ringkasan (jumlah jenis barang dan total item). Setelah dikonfirmasi, stok lokasi tersebut langsung bertambah, termasuk di aplikasi pesan online.
- Setiap penerimaan tersimpan sebagai **riwayat Terima Barang** (nomor, tanggal, lokasi, staf, supplier, dan daftar barang) yang bisa dilihat kembali.

### Barang Rusak / Busuk
- Pencatatan barang busuk, layu, pecah, atau kadaluarsa per lokasi (gudang/cabang), beserta alasannya.
- Stok langsung berkurang, dan nilai kerugian (Qty × HPP) dicatat sebagai "Beban Kerugian Barang Rusak".

### Pelanggan B2B, Bon & Pelunasan
- Data pelanggan B2B: nama, no. HP, limit kredit, dan tenggat jatuh tempo (hari).
- Daftar bon per pelanggan beserta sisa limit dan tanda jatuh tempo/terlambat.
- Pelunasan bon (Tunai/Transfer, bisa sebagian). Sisa limit kredit otomatis pulih.

### Laporan
- Penjualan harian per cabang dan per metode bayar.
- **Laba Rugi sederhana**: Penjualan − HPP − Beban Kerugian Barang Rusak − Pengeluaran Harian, per cabang dan periode.
- Laporan per shift kasir dan rekap pengeluaran harian per kasir/cabang.
- Riwayat transaksi beserta detailnya, laporan barang rusak, dan daftar piutang.

### Aplikasi Pesan Online Pelanggan (mobile-first)
- Pelanggan memilih Cabang 1 / Cabang 2 untuk melihat stok dan harga cabang itu.
- Navigasi kategori, pencarian, dan pembelian desimal (mis. 0,5 kg). Harga bertingkat ikut berlaku.
- Produk dengan stok 0 otomatis ditandai "Habis" dan tidak bisa dipesan. Stok selalu mengikuti penjualan kasir dan pencatatan barang rusak.
- Checkout: nama + no. HP (tanpa akun), pilih **Ambil di Toko** atau **Kirim Kurir Lokal** (alamat lengkap).
- Pembayaran: QRIS (gambar QRIS statis toko), Transfer Bank (nomor rekening toko), COD, atau **Bon** (khusus B2B yang login dengan no. HP + PIN dari Admin, dan dicek terhadap sisa limit).
- Halaman lacak pesanan menampilkan status terkini berdasarkan nomor pesanan.

## Alur Pengguna
1. **Admin** login → membuat akun kasir/staf gudang → menambah produk, harga bertingkat, stok, dan HPP per lokasi → mendaftarkan pelanggan B2B beserta limit kreditnya.
2. **Kasir** login di tablet → Buka Shift (modal awal) → (opsional) Fullscreen → scan barcode (langsung masuk keranjang) atau ketuk produk → untuk sayur, masukkan berat di numpad → pilih pelanggan (jika Bon) → bayar → cetak struk.
3. **Pelanggan** membuka app pesan online → memilih cabang → menambah produk ke keranjang → checkout (pickup/kurir, metode bayar) → mendapat nomor pesanan untuk dilacak.
4. **Kasir cabang** mendengar notifikasi → Terima Pesanan (stok terpotong) → Dikemas → Siap Diambil/Dikirim → Selesai.
5. **Staf** mencatat barang busuk → stok berkurang → kerugian muncul di Laba Rugi.
6. **Pelanggan B2B** membayar bon → kasir/admin mencatat pelunasan → limit kredit pulih.
7. **Kasir** mencatat pengeluaran (mis. bayar barang titipan, token listrik) selama shift → Tutup Shift (hitung kas) → rekap shift tersimpan dan bisa dicetak.
8. **Admin/Staf** membuka Stok Menipis → mengetuk item → mengisi jumlah di numpad → item masuk Daftar Belanja Kulakan → menekan "Salin" → menempelkan teks di WhatsApp supplier.
9. **Staf cabang/gudang** menerima kiriman supplier → membuka Terima Barang → scan barang → isi jumlah di numpad → ulangi untuk semua barang → tekan "Kirim & Update Stok" → stok cabang bertambah.

## Kesan UI/UX
- Desain flat dan bersih yang fokus pada kecepatan: kontras tinggi, tombol besar yang mudah disentuh, tanpa bayangan tebal, blur, atau animasi. Respons visual langsung saat ditekan.
- Angka harga dan total tampil besar dan jelas dalam format Rupiah (Rp 12.500). Berat menggunakan koma desimal (1,5 kg).
- Seluruh tampilan berbahasa Indonesia.
- Aplikasi pelanggan terasa seperti aplikasi belanja di HP: kategori di atas, kartu produk ringkas, keranjang di bawah.

## Fase Implementasi

### Fase 1 — MVP (dibangun sekarang)
- Login staf Username + PIN dengan peran Admin/Kasir/Gudang, dan manajemen akun oleh Admin.
- Pengaturan Hak Akses: tabel centang hak per peran, peran baru bisa dibuat, dan akun bisa dibatasi per lokasi.
- POS kasir lengkap: layout tablet split-pane + Fullscreen 4→5 kolom, layout HP dengan floating cart + bottom sheet, numpad desimal, harga bertingkat otomatis, diskon, pembayaran Tunai/QRIS/Transfer/Bon dengan cek limit, dan scan barcode.
- Mode offline: katalog tersimpan di perangkat, antrean transaksi, dan sinkronisasi otomatis.
- Cetak struk thermal Bluetooth 58/80mm beserta pratinjau.
- Kelola produk (form lengkap), stok per lokasi, transfer Gudang → Cabang, dan batas minimum stok per produk yang bisa diedit.
- Daftar Stok Menipis + Daftar Belanja Kulakan dengan numpad dan tombol Salin.
- Terima Barang dari supplier/grosir: scan, isi jumlah di numpad, lalu Kirim & Update Stok ke cabang/gudang tujuan, beserta riwayatnya.
- Shift kasir (buka/tutup kas), input pengeluaran harian per kasir/cabang, dan laporan per shift.
- Barcode scanner duduk yang otomatis memasukkan produk ke keranjang.
- Pencatatan barang rusak beserta kerugian HPP.
- Pelanggan B2B, Bon, dan pelunasan.
- Aplikasi pesan online pelanggan (pilih cabang, katalog, checkout pickup/kurir, 4 metode bayar, lacak pesanan).
- Pesanan masuk di POS dengan popup + suara dan alur status lengkap.
- Laporan dasar: penjualan, Laba Rugi sederhana, barang rusak, piutang.

### Fase 2
- Payment gateway otomatis untuk QRIS/Transfer (mis. Midtrans/Xendit) supaya tidak perlu konfirmasi manual.
- Notifikasi WhatsApp/SMS status pesanan ke pelanggan.
- Pembelian dari pemasok (Purchase Order) dan pencatatan HPP rata-rata otomatis.
- Pelacakan tanggal kadaluarsa per batch beserta peringatan mendekati kadaluarsa.

### Fase 3
- Dashboard analitik (produk terlaris, jam ramai, tren kerugian).
- Program loyalitas / poin pelanggan dan promo.
- Ekspor laporan ke Excel/PDF.
- Penambahan cabang baru secara fleksibel.

## Asumsi
- Nama aplikasi dan toko: **"BERSINAR"**. Nama ini tampil di halaman login, navbar POS, struk, dan aplikasi pesan online pelanggan. Alamat, nomor rekening, dan gambar QRIS di struk dan aplikasi pelanggan juga berupa placeholder yang bisa diubah Admin di Pengaturan.
- Lokasi tetap: Gudang Utama, Cabang 1, Cabang 2. Gudang Utama tidak berjualan langsung dan hanya menyuplai cabang lewat transfer stok.
- Harga bertingkat berlaku sama di semua cabang. Stok dan HPP berbeda per lokasi.
- QRIS dan Transfer di fase 1 dikonfirmasi **manual** oleh kasir, tanpa payment gateway.
- Pelanggan umum memesan tanpa akun (nama + no. HP). Pelanggan B2B login ke app pesan online dengan no. HP + PIN yang dibuat Admin, dan hanya mereka yang bisa memakai Bon.
- Stok pesanan online dipotong saat kasir **menerima** pesanan, bukan saat pelanggan checkout. Pesanan yang dibatalkan setelah diterima mengembalikan stok.
- Bon dari pesanan online baru memakai limit kredit saat pesanan diterima kasir.
- Ongkos kirim kurir lokal berupa tarif tetap yang diatur Admin (default Rp 0 / placeholder).
- Saat offline, transaksi Bon tetap dicek terhadap sisa limit yang terakhir tersimpan di perangkat, lalu divalidasi ulang saat sinkronisasi. Pesanan online hanya bisa diproses saat online.
- Cetak struk Bluetooth membutuhkan Chrome/Edge di Android/desktop. Safari iPad tidak mendukung Web Bluetooth, jadi di iPad struk dicetak lewat dialog cetak biasa.
- Akun Admin awal dibuat otomatis, dan kredensialnya diberikan setelah pembangunan selesai.
- Laba Rugi fase 1 mencakup Penjualan, HPP, Beban Kerugian Barang Rusak, dan Pengeluaran Harian dari shift kasir.
- Pengeluaran harian dianggap dibayar tunai dari laci kas sehingga mengurangi kas seharusnya saat tutup shift. Pengeluaran Admin di luar shift tetap dicatat per cabang tanpa memengaruhi kas laci.
- Setiap kasir hanya punya satu shift aktif dalam satu waktu. Shift bisa dibuka dan ditutup saat offline, lalu disinkronkan kemudian.
- Barcode scanner duduk diperlakukan seperti keyboard (mode standar sebagian besar scanner, diakhiri Enter), sehingga tidak perlu driver khusus.
- Format salin Daftar Belanja Kulakan adalah "jumlah nama produk" tanpa satuan, sesuai contoh. Daftar kulakan dibuat per lokasi (Gudang/Cabang 1/Cabang 2).
- Hak bawaan saat pertama dipakai (bisa diubah Admin kapan saja):
  - **Kasir**: POS (tanpa void transaksi dan tanpa ubah limit kredit), shift & pengeluaran miliknya sendiri, pesanan online cabangnya, lihat produk, catat barang rusak, stok menipis & kulakan, catat pelunasan bon. Tidak bisa melihat HPP dan Laba Rugi.
  - **Staf Gudang**: lihat/tambah/edit produk, penyesuaian stok, transfer stok, catat barang rusak, stok menipis & kulakan, laporan barang rusak. Tidak punya akses POS.
- Hak "Terima barang" aktif secara bawaan untuk Kasir (khusus cabangnya) dan Staf Gudang.
- Terima Barang di fase 1 hanya menambah jumlah stok dan tidak mengubah HPP. Pencatatan harga beli dan HPP rata-rata otomatis tetap ada di fase 2 (Purchase Order).
- Ini menggantikan asumsi sebelumnya tentang siapa yang bisa melihat Stok Menipis dan Kulakan. Semuanya kini diatur lewat Hak Akses.
- Kasir yang terikat ke satu cabang hanya melihat data cabangnya, meskipun haknya sama dengan peran lain.
