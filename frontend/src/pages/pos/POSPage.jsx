import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, ShoppingCart, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCatalog, useDebounced, useMedia, useFullscreen, getShift, setShiftLocal } from "@/hooks/usePos";
import { api, errMsg } from "@/lib/api";
import { cacheGet, cacheSet, submitOrQueue, getQueue } from "@/lib/offline";
import { useScanner } from "@/lib/scanner";
import { beepOk, beepErr } from "@/lib/sound";
import { rp, fq, uid, priceFor } from "@/lib/format";
import { receiptText } from "@/lib/printer";
import { CATEGORIES } from "@/lib/constants";
import { Numpad } from "@/components/Numpad";
import { PrintModal } from "@/components/PrintModal";
import { ProductGrid } from "./ProductGrid";
import { CartPanel } from "./CartPanel";
import { PaymentModal } from "./PaymentModal";
import { OpenShift } from "./OpenShift";

function useCustomers() {
  const [list, setList] = useState(() => cacheGet("bs_customers", []));
  useEffect(() => {
    api.get("/customers").then(({ data }) => { setList(data); cacheSet("bs_customers", data); }).catch(() => {});
  }, []);
  const bump = (id, amt) => setList((l) => { const n = l.map((c) => (c.id === id ? { ...c, current_credit: c.current_credit + amt } : c)); cacheSet("bs_customers", n); return n; });
  return [list, bump];
}

export default function POSPage() {
  const { user, can, location, store } = useAuth();
  const [shift, setShift] = useState(() => getShift(user));
  const posLoc = shift?.location_name || location;
  const isBranch = posLoc !== "Gudang Utama";
  const { items, adjustLocal } = useCatalog(isBranch ? posLoc : null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [customers, bumpCredit] = useCustomers();
  const md = useMedia("(min-width: 768px)");
  const fs = useFullscreen();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 150);
  const [cat, setCat] = useState("Semua");
  const [cart, setCart] = useState([]);
  const [numpad, setNumpad] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api.get("/shifts/current").then(({ data }) => {
      const pendingOpen = getQueue().some((x) => x.type === "shift_open");
      if (data) { const s = { id: data.id, location_name: data.location_name, opening_cash: data.opening_cash, opened_at: data.opened_at }; setShiftLocal(user, s); setShift(s); }
      else if (!pendingOpen) { setShiftLocal(user, null); setShift(null); }
    }).catch(() => {});
  }, [user]);

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return items.filter((p) => (cat === "Semua" || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.sku.includes(s)));
  }, [items, dq, cat]);

  const setQty = useCallback((p, qty, add) => setCart((c) => {
    const i = c.findIndex((x) => x.p.id === p.id);
    if (i < 0) return qty > 0 ? [...c, { p, qty }] : c;
    const nq = Math.round((add ? c[i].qty + qty : qty) * 1000) / 1000;
    if (nq <= 0) return c.filter((_, j) => j !== i);
    return c.map((x, j) => (j === i ? { ...x, qty: nq } : x));
  }), []);

  const onPick = useCallback((p) => (p.is_decimal_allowed ? setNumpad({ p, n: performance.now() }) : setQty(p, 1, true)), [setQty]);

  useScanner((code) => {
    const p = itemsRef.current.find((x) => x.sku === code);
    if (!p) { beepErr(); toast.error(`Barcode tidak ditemukan: ${code}`); return; }
    beepOk();
    onPick(p);
  }, !!shift && isBranch && !payOpen && !receipt);

  const lines = useMemo(() => cart.map(({ p, qty }) => {
    const t = priceFor(p.tiers, qty);
    return { p, qty, tier: t.tier_name, price: t.price, sub: Math.round(qty * t.price) };
  }), [cart]);
  const subtotal = lines.reduce((a, l) => a + l.sub, 0);
  const totals = { subtotal, total: Math.max(subtotal - discount, 0) };
  const canRemove = can("pos.remove_item");

  const onDec = useCallback((p) => setCart((c) => {
    const l = c.find((x) => x.p.id === p.id);
    if (!l) return c;
    const step = p.is_decimal_allowed ? Math.min(1, l.qty) : 1;
    if (l.qty - step <= 0 && !canRemove) return c;
    return l.qty - step <= 0 ? c.filter((x) => x !== l) : c.map((x) => (x === l ? { ...x, qty: Math.round((x.qty - step) * 1000) / 1000 } : x));
  }), [canRemove]);

  const pay = async ({ method, cash }) => {
    const created = new Date();
    const id = uid();
    const ymd = `${String(created.getFullYear()).slice(2)}${String(created.getMonth() + 1).padStart(2, "0")}${String(created.getDate()).padStart(2, "0")}`;
    const tx = {
      id, invoice_number: `${posLoc === "Cabang 1" ? "C1" : "C2"}-${ymd}-${id.slice(0, 6).toUpperCase()}`, location_name: posLoc,
      customer_id: customer?.id || null, discount, payment_method: method, cash_received: cash, shift_id: shift.id, created_at: created.toISOString(),
      items: lines.map((l) => ({ product_id: l.p.id, name: l.p.name, unit: l.p.unit, qty: l.qty, applied_unit_price: l.price, tier_name: l.tier })),
    };
    setBusy(true);
    try {
      const r = await submitOrQueue("transaction", tx);
      const doc = r.data || { ...tx, subtotal: totals.subtotal, total_amount: totals.total, change: method === "Tunai" ? cash - totals.total : 0,
        cashier_name: user.name, customer_name: customer?.name, items: tx.items.map((i) => ({ ...i, subtotal: Math.round(i.qty * i.applied_unit_price) })) };
      const deltas = {};
      lines.forEach((l) => (deltas[l.p.id] = -l.qty));
      adjustLocal(deltas);
      if (method === "Bon") bumpCredit(customer.id, totals.total);
      setCart([]); setDiscount(0); setCustomer(null); setPayOpen(false); setSheet(false);
      setReceipt(doc);
      toast.success(r.queued ? "Transaksi disimpan offline" : "Transaksi berhasil");
    } catch (e) {
      beepErr();
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  };

  if (!isBranch) return <div className="page"><div className="card p-6">POS hanya untuk Cabang 1 / Cabang 2. Pilih cabang di navbar atas.</div></div>;
  if (!shift) return <OpenShift user={user} location={posLoc} canOpen={can("shift.open_close")} onOpened={setShift} />;

  const cart_ = (
    <CartPanel lines={lines} totals={totals} onInc={(p) => setQty(p, 1, true)} onDec={onDec} onEdit={(l) => setNumpad({ p: l.p, qty: l.qty, edit: true })}
      onRemove={(p) => setQty(p, 0)} canRemove={canRemove} customers={customers} customer={customer} setCustomer={setCustomer}
      discount={discount} onDiscount={setDiscount} canDiscount={can("pos.discount")} onPay={() => setPayOpen(true)} onClear={() => setCart([])} />
  );
  const count = cart.length;

  return (
    <div className="h-full flex min-h-0">
      <section className="w-full md:w-[62%] flex flex-col min-h-0 md:border-r-2 border-slate-300 bg-slate-50">
        <div className="flex-shrink-0 p-2 space-y-2 bg-white border-b border-slate-200">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input data-testid="pos-search-input" className="input pl-10 !h-11" placeholder="Cari produk atau scan barcode..." value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button data-testid="pos-search-clear" onClick={() => setQ("")} className="absolute right-2 top-1.5 h-8 w-8 flex items-center justify-center"><X size={16} /></button>}
            </div>
            <span className="hidden sm:block text-xs text-slate-500 whitespace-nowrap">{posLoc} · Shift aktif</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {["Semua", ...CATEGORIES].map((c) => (
              <button key={c} data-testid={`pos-cat-${c.toLowerCase()}`} onClick={() => setCat(c)} className={`chip flex-shrink-0 ${cat === c ? "chip-on" : "chip-off"}`}>{c}</button>
            ))}
          </div>
        </div>
        <ProductGrid items={filtered} cols={md ? (fs ? 5 : 4) : 2} onPick={onPick} padBottom={!md} />
      </section>
      {md && <aside className="w-[38%] flex flex-col min-h-0">{cart_}</aside>}
      {!md && count > 0 && !sheet && (
        <button data-testid="floating-cart-bar" onClick={() => setSheet(true)} className="fixed bottom-4 left-4 right-4 z-40 h-14 rounded-xl bg-emerald-700 text-white flex items-center justify-between px-4 border border-emerald-800">
          <span className="mono font-bold text-sm whitespace-nowrap">[ {count} Item | {rp(totals.total)} ]</span>
          <span className="flex items-center gap-2 font-bold text-sm whitespace-nowrap"><ShoppingCart size={18} />Lihat Keranjang</span>
        </button>
      )}
      {!md && sheet && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 flex flex-col justify-end" onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div data-testid="cart-bottom-sheet" className="h-[85dvh] bg-white rounded-t-2xl border-t-4 border-emerald-600 flex flex-col min-h-0 overflow-hidden">
            <button data-testid="cart-sheet-close" onClick={() => setSheet(false)} className="h-8 flex-shrink-0 flex items-center justify-center"><span className="w-12 h-1.5 rounded-full bg-slate-300" /></button>
            <div className="flex-1 min-h-0">{cart_}</div>
          </div>
        </div>
      )}
      <Numpad key={numpad ? `${numpad.p.id}-${numpad.n || 0}` : "none"} open={!!numpad} title={numpad?.p.name} unit={numpad?.p.unit} decimal={numpad?.p.is_decimal_allowed} initial={numpad?.qty}
        subtitle={numpad && `${rp(numpad.p.tiers[0]?.price)}/${numpad.p.unit} · Stok ${fq(numpad.p.stock)}`}
        presets={numpad?.p.is_decimal_allowed ? [0.25, 0.5, 1, 1.5, 2] : [1, 2, 5, 10]}
        submitLabel={numpad?.edit ? "Simpan Jumlah" : "Tambah ke Keranjang"}
        onSubmit={(v) => { setQty(numpad.p, v, !numpad.edit); setNumpad(null); }} onClose={() => setNumpad(null)} testid="qty-numpad" />
      <PaymentModal open={payOpen} total={totals.total} customer={customer} canBon={can("pos.bon")} busy={busy} onClose={() => setPayOpen(false)} onConfirm={pay} />
      <PrintModal open={!!receipt} onClose={() => setReceipt(null)} title={`Struk ${receipt?.invoice_number || ""}`} text={receipt ? receiptText(receipt, store) : ""} testid="receipt-modal" />
    </div>
  );
}
