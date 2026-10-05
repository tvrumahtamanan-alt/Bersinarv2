import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search, ShoppingBag, Minus, Plus, MapPin, Store, Bike, LogIn, LogOut } from "lucide-react";
import { shopApi, errMsg } from "@/lib/api";
import { rp, fq, priceFor } from "@/lib/format";
import { cacheGet, cacheSet } from "@/lib/offline";
import { BRANCHES, CATEGORIES, CAT_COLOR } from "@/lib/constants";
import { useDebounced } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { Modal, Field } from "@/components/Modal";

function BranchPick({ onPick }) {
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center p-6 bg-emerald-700 text-white">
      <div className="text-5xl font-extrabold tracking-tight">BERSINAR</div>
      <div className="mt-2 text-emerald-100">Sayur segar & sembako, pesan dari rumah.</div>
      <div className="mt-8 font-bold">Pilih cabang terdekat</div>
      <div className="grid gap-3 mt-3">{BRANCHES.map((b) => (
        <button key={b} data-testid={`shop-branch-${b.toLowerCase().replace(" ", "-")}`} onClick={() => onPick(b)} className="h-16 rounded-xl bg-white text-slate-900 font-bold text-lg flex items-center gap-3 px-5 active:bg-emerald-50"><MapPin className="text-emerald-600" />{b}</button>))}
      </div>
    </div>
  );
}

function B2BLogin({ open, onClose, onDone }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const go = async () => {
    try { const { data } = await shopApi.post("/shop/b2b-login", { phone, pin }); localStorage.setItem("bs_b2b_token", data.token); onDone(data.customer); toast.success(`Masuk sebagai ${data.customer.name}`); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Masuk Pelanggan B2B" testid="b2b-login" footer={<button data-testid="b2b-login-submit" onClick={go} className="btn btn-primary w-full">Masuk</button>}>
      <div className="space-y-3">
        <Field label="No. HP"><input data-testid="b2b-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="PIN"><input data-testid="b2b-pin" type="password" inputMode="numeric" className="input mono" value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">Akun B2B dibuat oleh toko. Pelanggan B2B dapat membayar dengan Bon.</p>
      </div>
    </Modal>
  );
}

function Checkout({ open, onClose, lines, total, branch, b2b, settings, onPlaced }) {
  const [f, setF] = useState({ customer_name: "", customer_phone: "", delivery_type: "pickup", delivery_address: "", payment_method: "QRIS", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && b2b) setF((s) => ({ ...s, customer_name: s.customer_name || b2b.name, customer_phone: s.customer_phone || b2b.phone })); }, [open, b2b]);
  const fee = f.delivery_type === "delivery" ? settings.delivery_fee || 0 : 0;
  const set = (k, v) => setF({ ...f, [k]: v });
  const place = async () => {
    setBusy(true);
    try { const { data } = await shopApi.post("/shop/orders", { ...f, location_name: branch, items: lines.map((l) => ({ product_id: l.p.id, qty: l.qty })) }); onPlaced(data); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const methods = ["QRIS", "Transfer", "COD", ...(b2b ? ["Bon"] : [])];
  return (
    <Modal open={open} onClose={onClose} title="Checkout" testid="checkout"
      footer={<button data-testid="checkout-submit" disabled={busy} onClick={place} className="btn btn-primary btn-lg w-full">Pesan Sekarang · {rp(total + fee)}</button>}>
      <div className="space-y-3">
        <Field label="Nama"><input data-testid="co-name" className="input" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Field>
        <Field label="No. HP / WhatsApp"><input data-testid="co-phone" className="input" inputMode="tel" value={f.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">{[["pickup", "Ambil di Toko", Store], ["delivery", "Kirim Kurir Lokal", Bike]].map(([k, l, I]) => (
          <button key={k} data-testid={`co-delivery-${k}`} onClick={() => set("delivery_type", k)} className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center text-sm font-bold ${f.delivery_type === k ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300"}`}><I size={20} />{l}</button>))}</div>
        {f.delivery_type === "delivery" && <Field label="Alamat Lengkap"><textarea data-testid="co-address" className="input !h-20 py-2" value={f.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} /></Field>}
        <div><span className="label">Metode Pembayaran</span><div className="grid grid-cols-4 gap-2">{methods.map((m) => (
          <button key={m} data-testid={`co-pay-${m.toLowerCase()}`} onClick={() => set("payment_method", m)} className={`h-11 rounded-lg border-2 text-sm font-bold ${f.payment_method === m ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300"}`}>{m}</button>))}</div></div>
        {f.payment_method === "QRIS" && <div className="card p-3 text-sm text-center">{settings.qris_image_url ? <img src={settings.qris_image_url} alt="QRIS" className="mx-auto max-h-56" /> : <div className="text-slate-500">[Gambar QRIS toko]</div>}<div className="text-xs text-slate-500 mt-1">Scan & bayar, toko akan mengonfirmasi.</div></div>}
        {f.payment_method === "Transfer" && <div className="card p-3 text-sm">Transfer ke: <b>{settings.bank_info}</b></div>}
        {f.payment_method === "Bon" && b2b && <div className="card p-3 text-sm">Sisa limit kredit: <b className="mono">{rp(b2b.remaining_credit)}</b></div>}
        <Field label="Catatan (opsional)"><input data-testid="co-notes" className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="text-sm space-y-1 border-t border-slate-100 pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span className="mono">{rp(total)}</span></div>
          {f.delivery_type === "delivery" && <div className="flex justify-between"><span>Ongkir</span><span className="mono">{rp(fee)}</span></div>}
        </div>
      </div>
    </Modal>
  );
}

export default function ShopPage() {
  const nav = useNavigate();
  const [branch, setBranch] = useState(() => localStorage.getItem("bs_shop_branch") || "");
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [cart, setCart] = useState(() => cacheGet(`bs_shop_cart_${branch}`, {}));
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [cat, setCat] = useState("Semua");
  const [np, setNp] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [b2b, setB2b] = useState(null);
  const [login, setLogin] = useState(false);
  const [track, setTrack] = useState("");

  useEffect(() => {
    shopApi.get("/settings").then(({ data }) => setSettings(data)).catch(() => {});
    if (localStorage.getItem("bs_b2b_token")) shopApi.get("/shop/b2b-me").then(({ data }) => setB2b(data)).catch(() => localStorage.removeItem("bs_b2b_token"));
  }, []);
  useEffect(() => {
    if (!branch) return undefined;
    setCart(cacheGet(`bs_shop_cart_${branch}`, {}));
    const load = () => shopApi.get("/shop/catalog", { params: { location: branch } }).then(({ data }) => setItems(data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [branch]);

  const setQty = (id, qty) => setCart((c) => { const n = { ...c }; if (qty > 0) n[id] = Math.round(qty * 1000) / 1000; else delete n[id]; cacheSet(`bs_shop_cart_${branch}`, n); return n; });
  const byId = useMemo(() => Object.fromEntries(items.map((p) => [p.id, p])), [items]);
  const filtered = useMemo(() => items.filter((p) => (cat === "Semua" || p.category === cat) && (!dq || p.name.toLowerCase().includes(dq.toLowerCase()))), [items, cat, dq]);
  const lines = Object.entries(cart).filter(([id]) => byId[id]).map(([id, qty]) => { const p = byId[id]; const t = priceFor(p.tiers, qty); return { p, qty, price: t.price, tier: t.tier_name, sub: Math.round(qty * t.price) }; });
  const total = lines.reduce((a, l) => a + l.sub, 0);
  const add = (p) => (p.is_decimal_allowed ? setNp(p) : setQty(p.id, (cart[p.id] || 0) + 1));

  if (!branch) return <BranchPick onPick={(b) => { setBranch(b); localStorage.setItem("bs_shop_branch", b); }} />;
  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 bg-emerald-700 text-white">
        <div className="h-14 flex items-center gap-2 px-3">
          <div className="font-extrabold text-lg">{settings.store_name || "BERSINAR"}</div>
          <select data-testid="shop-branch-select" value={branch} onChange={(e) => { setBranch(e.target.value); localStorage.setItem("bs_shop_branch", e.target.value); }} className="bg-emerald-800 border border-emerald-600 rounded-lg h-9 px-2 text-sm font-semibold">{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
          <div className="flex-1" />
          {b2b ? <button data-testid="shop-b2b-logout" onClick={() => { localStorage.removeItem("bs_b2b_token"); setB2b(null); }} className="text-xs font-semibold flex items-center gap-1"><LogOut size={14} />{b2b.name}</button>
            : <button data-testid="shop-b2b-login-btn" onClick={() => setLogin(true)} className="text-xs font-semibold flex items-center gap-1"><LogIn size={14} />B2B</button>}
        </div>
        <div className="px-3 pb-2"><div className="relative"><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input data-testid="shop-search" className="input pl-10 border-0" placeholder="Cari sayur, buah, sembako..." value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      </header>
      <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b border-slate-200">{["Semua", ...CATEGORIES].map((c) => (
        <button key={c} data-testid={`shop-cat-${c.toLowerCase()}`} onClick={() => setCat(c)} className={`chip flex-shrink-0 ${cat === c ? "chip-on" : "chip-off"}`}>{c}</button>))}</div>
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {filtered.map((p) => { const out = p.stock <= 0; const inCart = cart[p.id]; return (
          <div key={p.id} data-testid={`shop-product-${p.sku}`} className={`card p-3 flex flex-col relative overflow-hidden ${out ? "opacity-60" : ""}`}>
            <span className={`absolute left-0 top-0 right-0 h-1 ${CAT_COLOR[p.category]}`} />
            <div className="text-[11px] font-bold text-slate-500 uppercase">{p.category}</div>
            <div className="font-bold leading-tight min-h-[2.5rem]">{p.name}</div>
            <div className="mono font-bold text-emerald-700 mt-1">{rp(p.tiers[0]?.price)}<span className="text-xs text-slate-500 font-sans">/{p.unit}</span></div>
            {p.tiers.length > 1 && <div className="text-[11px] text-slate-500">Grosir ≥{fq(p.tiers[1].min_qty)}: {rp(p.tiers[1].price)}</div>}
            <div className="mt-2">
              {out ? <div data-testid={`shop-out-${p.sku}`} className="h-10 rounded-lg bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center">Habis</div>
                : inCart ? <div className="flex items-center gap-1">
                  <button data-testid={`shop-dec-${p.sku}`} onClick={() => setQty(p.id, p.is_decimal_allowed ? 0 : inCart - 1)} className="h-10 w-10 rounded-lg border border-slate-300 flex items-center justify-center"><Minus size={16} /></button>
                  <button data-testid={`shop-qty-${p.sku}`} onClick={() => p.is_decimal_allowed && setNp(p)} className="flex-1 h-10 mono font-bold text-sm">{fq(inCart)} {p.unit}</button>
                  <button data-testid={`shop-inc-${p.sku}`} onClick={() => (p.is_decimal_allowed ? setNp(p) : setQty(p.id, Math.min(inCart + 1, p.stock)))} className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><Plus size={16} /></button>
                </div> : <button data-testid={`shop-add-${p.sku}`} onClick={() => add(p)} className="btn btn-primary w-full !h-10">Tambah</button>}
            </div>
          </div>); })}
      </div>
      <div className="max-w-5xl mx-auto px-3 py-4 flex gap-2">
        <input data-testid="shop-track-input" className="input" placeholder="Lacak pesanan: masukkan nomor pesanan" value={track} onChange={(e) => setTrack(e.target.value)} />
        <button data-testid="shop-track-btn" disabled={!track.trim()} onClick={() => nav(`/shop/track/${track.trim().toUpperCase()}`)} className="btn btn-dark">Lacak</button>
      </div>
      {lines.length > 0 && (
        <button data-testid="shop-cart-bar" onClick={() => setSheet(true)} className="fixed bottom-4 left-4 right-4 z-40 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-between px-4 max-w-xl mx-auto">
          <span className="mono font-bold">[ {lines.length} Item | {rp(total)} ]</span><span className="flex items-center gap-2 font-bold"><ShoppingBag size={18} />Keranjang</span>
        </button>)}
      {sheet && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 flex flex-col justify-end" onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div data-testid="shop-cart-sheet" className="max-h-[85dvh] bg-white rounded-t-2xl flex flex-col max-w-xl w-full mx-auto">
            <div className="h-12 flex items-center justify-between px-4 border-b border-slate-200 flex-shrink-0"><b>Keranjang · {branch}</b><button onClick={() => setSheet(false)} className="text-sm font-semibold text-slate-500">Tutup</button></div>
            <div className="flex-1 overflow-y-auto min-h-0">{lines.map((l) => (
              <div key={l.p.id} className="flex justify-between px-4 py-2 border-b border-slate-100 text-sm">
                <span><b>{l.p.name}</b><div className="text-xs text-slate-500">{fq(l.qty)} {l.p.unit} × {rp(l.price)} {l.tier !== "Eceran" && <span className="badge bg-amber-100 text-amber-800 border-amber-300">{l.tier}</span>}</div></span>
                <span className="text-right"><b className="mono">{rp(l.sub)}</b><button data-testid={`shop-remove-${l.p.sku}`} onClick={() => setQty(l.p.id, 0)} className="block text-xs text-red-600 ml-auto">Hapus</button></span>
              </div>))}</div>
            <div className="p-3 border-t border-slate-200 flex-shrink-0">
              <div className="flex justify-between font-bold mb-2"><span>Total</span><span className="mono text-xl">{rp(total)}</span></div>
              <button data-testid="shop-checkout-btn" onClick={() => { setSheet(false); setCheckout(true); }} className="btn btn-primary btn-lg w-full">Lanjut ke Checkout</button>
            </div>
          </div>
        </div>)}
      <Numpad key={np?.id || "none"} open={!!np} title={np?.name} subtitle={np && `Tersedia ${fq(np.stock)} ${np.unit}`} unit={np?.unit} decimal initial={np && cart[np.id]} presets={[0.25, 0.5, 1, 1.5, 2]}
        onSubmit={(v) => { if (v > np.stock) return toast.error(`Stok tersisa ${fq(np.stock)} ${np.unit}`); setQty(np.id, v); setNp(null); }} onClose={() => setNp(null)} testid="shop-numpad" />
      <Checkout open={checkout} onClose={() => setCheckout(false)} lines={lines} total={total} branch={branch} b2b={b2b} settings={settings}
        onPlaced={(d) => { setCart({}); cacheSet(`bs_shop_cart_${branch}`, {}); setCheckout(false); nav(`/shop/track/${d.order_number}`); }} />
      <B2BLogin open={login} onClose={() => setLogin(false)} onDone={(c) => { setB2b(c); setLogin(false); }} />
    </div>
  );
}
