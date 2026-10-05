import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fq, fdt } from "@/lib/format";
import { useFetch, useDebounced } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { ProductPicker } from "@/components/ProductPicker";
import { Tabs, Empty, Confirm, LocSelect } from "@/components/Modal";

function StockTab({ products, reload, locs, canAdjust }) {
  const [loc, setLoc] = useState(locs[0]);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [adj, setAdj] = useState(null);
  const rows = useMemo(() => products.filter((p) => !dq || p.name.toLowerCase().includes(dq.toLowerCase()) || p.sku.includes(dq)), [products, dq]);
  const save = async (v) => {
    try { await api.post("/stock/adjust", { product_id: adj.id, location_name: loc, new_qty: v, reason: "Stock opname" }); toast.success("Stok disesuaikan"); setAdj(null); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <LocSelect value={loc} onChange={setLoc} options={locs} testid="stock-loc" />
        <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-3 top-2.5 text-slate-400" /><input data-testid="stock-search" className="input !h-10 pl-10" placeholder="Cari produk" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead><tr><th className="th">Produk</th><th className="th text-right">Stok</th><th className="th text-right">Min.</th><th className="th" /></tr></thead>
          <tbody>{rows.map((p) => { const s = p.locations[loc] || {}; const low = (s.stock_quantity || 0) <= (s.min_stock_alert || 0); return (
            <tr key={p.id} data-testid={`stock-row-${p.sku}`}>
              <td className="td"><span className="font-semibold">{p.name}</span> <span className="text-xs text-slate-500">{p.unit}</span></td>
              <td className={`td text-right mono font-bold ${low ? "text-amber-700" : ""}`}>{fq(s.stock_quantity)}</td>
              <td className="td text-right mono text-slate-500">{fq(s.min_stock_alert)}</td>
              <td className="td text-right">{canAdjust && <button data-testid={`stock-adjust-${p.sku}`} onClick={() => setAdj(p)} className="btn btn-sm btn-secondary">Sesuaikan</button>}</td>
            </tr>); })}</tbody>
        </table>
      </div>
      <Numpad open={!!adj} title={`Stok Fisik: ${adj?.name}`} subtitle={`${loc} · tercatat ${fq(adj?.locations[loc]?.stock_quantity)} ${adj?.unit}`} unit={adj?.unit} decimal money={false}
        submitLabel="Simpan Stok" onSubmit={save} onClose={() => setAdj(null)} testid="adjust-numpad" />
    </>
  );
}

function TransferTab({ products, reload }) {
  const [to, setTo] = useState("Cabang 1");
  const [items, setItems] = useState([]);
  const [np, setNp] = useState(null);
  const [conf, setConf] = useState(false);
  const hist = useFetch(async () => (await api.get("/stock/transfers")).data, []);
  const pick = useMemo(() => products.filter((p) => p.active).map((p) => ({ ...p, stock: p.locations["Gudang Utama"]?.stock_quantity || 0 })), [products]);
  const add = (v) => { setItems((s) => [...s.filter((i) => i.product_id !== np.id), { product_id: np.id, name: np.name, unit: np.unit, qty: v }]); setNp(null); };
  const send = async () => {
    try { await api.post("/stock/transfer", { to_location: to, items }); toast.success("Transfer berhasil"); setItems([]); setConf(false); reload(); hist.reload(); }
    catch (e) { toast.error(errMsg(e)); setConf(false); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3"><span className="font-bold">Gudang Utama →</span>
          <LocSelect value={to} onChange={setTo} options={["Cabang 1", "Cabang 2"]} testid="transfer-to" /></div>
        <ProductPicker items={pick} onPick={setNp} testid="transfer-picker" />
        <div className="mt-3">{items.map((i) => (
          <div key={i.product_id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
            <span>{i.name}</span><span className="flex items-center gap-2"><b className="mono">{fq(i.qty)} {i.unit}</b>
              <button onClick={() => setItems((s) => s.filter((x) => x !== i))} className="text-red-600 h-8 w-8 flex items-center justify-center"><Trash2 size={16} /></button></span>
          </div>))}
          {!items.length && <Empty text="Cari & pilih produk untuk ditransfer" />}
        </div>
        <button data-testid="transfer-submit" disabled={!items.length} onClick={() => setConf(true)} className="btn btn-primary w-full mt-3">Kirim Transfer ({items.length} jenis)</button>
      </div>
      <div className="card p-4">
        <div className="font-bold mb-2">Riwayat Transfer</div>
        {(hist.data || []).map((t) => (
          <div key={t.id} className="border-b border-slate-100 py-2 text-sm">
            <div className="flex justify-between"><b>→ {t.to_location}</b><span className="text-xs text-slate-500">{fdt(t.created_at)} · {t.user}</span></div>
            <div className="text-xs text-slate-600">{t.items.map((i) => `${fq(i.qty)} ${i.unit || ""} ${i.name || ""}`).join(", ")}</div>
          </div>))}
        {!hist.data?.length && <Empty />}
      </div>
      <Numpad open={!!np} title={np?.name} subtitle={`Stok gudang ${fq(np?.stock)} ${np?.unit}`} unit={np?.unit} decimal={np?.is_decimal_allowed} submitLabel="Tambahkan" onSubmit={add} onClose={() => setNp(null)} testid="transfer-numpad" />
      <Confirm open={conf} title="Konfirmasi Transfer" message={`Transfer ${items.length} jenis barang dari Gudang Utama ke ${to}?`} onNo={() => setConf(false)} onYes={send} testid="transfer-confirm" />
    </div>
  );
}

export default function StockPage() {
  const { user, can } = useAuth();
  const { data, reload } = useFetch(async () => (await api.get("/products")).data, []);
  const tabs = [can("stock.adjust") && ["stock", "Stok per Lokasi"], can("stock.transfer") && user.allowed_locations.includes("Gudang Utama") && ["transfer", "Transfer Gudang → Cabang"]].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  return (
    <div className="page">
      <h1 className="h1 mb-4">Stok & Transfer</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} testid="stock-tabs" />
      <div className="mt-3">
        {tab === "stock" && <StockTab products={data || []} reload={reload} locs={user.allowed_locations} canAdjust={can("stock.adjust")} />}
        {tab === "transfer" && <TransferTab products={data || []} reload={reload} />}
      </div>
    </div>
  );
}
