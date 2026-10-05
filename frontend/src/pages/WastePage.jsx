import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { rp, fq, fdt } from "@/lib/format";
import { WASTE_REASONS } from "@/lib/constants";
import { useCatalog, useFetch } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { ProductPicker } from "@/components/ProductPicker";
import { Empty, Field, LocSelect } from "@/components/Modal";

export default function WastePage() {
  const { user, location } = useAuth();
  const [loc, setLoc] = useState(location);
  useEffect(() => setLoc(location), [location]);
  const { items, adjustLocal } = useCatalog(loc);
  const logs = useFetch(async () => (await api.get("/waste", { params: { location: loc } })).data, [loc]);
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(0);
  const [np, setNp] = useState(false);
  const [reason, setReason] = useState("Busuk");
  const [note, setNote] = useState("");
  const submit = async () => {
    try {
      const { data } = await api.post("/waste", { product_id: p.id, location_name: loc, qty, reason: note ? `${reason} - ${note}` : reason });
      toast.success(`Dicatat. Stok berkurang ${fq(qty)} ${p.unit}${data.total_loss_cogs ? `, kerugian ${rp(data.total_loss_cogs)}` : ""}`);
      adjustLocal({ [p.id]: -qty });
      setP(null); setQty(0); setNote(""); logs.reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="page">
      <div className="flex flex-wrap items-center gap-2 mb-4"><h1 className="h1 flex-1">Barang Rusak / Busuk</h1><LocSelect value={loc} onChange={setLoc} options={user.allowed_locations} testid="waste-loc" /></div>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="card p-4 space-y-3">
          <Field label="Produk"><ProductPicker items={items} onPick={(x) => { setP(x); setNp(true); }} testid="waste-picker" /></Field>
          {p && <div className="card p-3 bg-slate-50 flex justify-between items-center"><span><b>{p.name}</b><div className="text-xs text-slate-500">Stok {fq(p.stock)} {p.unit}</div></span>
            <button data-testid="waste-qty-btn" onClick={() => setNp(true)} className="h-10 px-3 rounded-lg border-2 border-slate-300 mono font-bold">{fq(qty)} {p.unit}</button></div>}
          <div><span className="label">Alasan</span><div className="flex flex-wrap gap-2">{WASTE_REASONS.map((r) => <button key={r} data-testid={`waste-reason-${r.toLowerCase()}`} onClick={() => setReason(r)} className={`chip ${reason === r ? "chip-on" : "chip-off"}`}>{r}</button>)}</div></div>
          <Field label="Keterangan (opsional)"><input data-testid="waste-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button data-testid="waste-submit" disabled={!p || qty <= 0} onClick={submit} className="btn btn-danger w-full btn-lg">Catat Barang Rusak</button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead><tr><th className="th">Waktu</th><th className="th">Produk</th><th className="th text-right">Qty</th><th className="th">Alasan</th>{logs.data?.[0]?.total_loss_cogs !== undefined && <th className="th text-right">Kerugian</th>}</tr></thead>
            <tbody>{(logs.data || []).map((w) => (
              <tr key={w.id}><td className="td whitespace-nowrap text-xs">{fdt(w.created_at)}<div className="text-slate-400">{w.reported_by}</div></td><td className="td font-semibold">{w.product_name}</td>
                <td className="td text-right mono">{fq(w.qty)} {w.unit}</td><td className="td">{w.reason}</td>{w.total_loss_cogs !== undefined && <td className="td text-right mono text-red-600">{rp(w.total_loss_cogs)}</td>}</tr>))}</tbody>
          </table>
          {!logs.data?.length && <Empty />}
        </div>
      </div>
      <Numpad key={p?.id || "none"} open={np && !!p} title={p?.name} subtitle="Jumlah barang rusak" unit={p?.unit} decimal={p?.is_decimal_allowed} initial={qty || undefined} submitLabel="OK"
        onSubmit={(v) => { setQty(v); setNp(false); }} onClose={() => setNp(false)} testid="waste-numpad" />
    </div>
  );
}
