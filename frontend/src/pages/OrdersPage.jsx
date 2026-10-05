import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Store, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { rp, fq, fdt } from "@/lib/format";
import { STATUS_COLOR } from "@/lib/constants";
import { getShift } from "@/hooks/usePos";
import { Tabs, Empty, Confirm } from "@/components/Modal";

const NEXT = { Menunggu: ["accept", "Terima Pesanan"], Diterima: ["process", "Diproses / Dikemas"], Dikemas: ["ready", "Siap Diambil / Dikirim"], Siap: ["done", "Selesai"] };

function OrderCard({ o, can, act }) {
  const nx = NEXT[o.status];
  const unpaid = !o.is_paid && ["QRIS", "Transfer"].includes(o.payment_method) && !["Menunggu", "Dibatalkan"].includes(o.status);
  return (
    <div className="card p-3" data-testid={`order-card-${o.order_number}`}>
      <div className="flex justify-between items-start gap-2">
        <div><div className="mono font-bold">{o.order_number}</div><div className="text-xs text-slate-500">{fdt(o.created_at)}</div></div>
        <span data-testid={`order-status-${o.order_number}`} className={`badge ${STATUS_COLOR[o.status]}`}>{o.status}</span>
      </div>
      <div className="mt-2 text-sm"><b>{o.customer_name}</b> <span className="text-slate-500 inline-flex items-center gap-1"><Phone size={12} />{o.customer_phone}</span></div>
      <div className="text-sm flex items-start gap-1 mt-1">{o.delivery_type === "delivery" ? <><Bike size={16} className="flex-shrink-0" />Kirim: {o.delivery_address}</> : <><Store size={16} />Ambil di Toko</>}</div>
      <div className="text-sm mt-1">Bayar: <b>{o.payment_method}</b> {o.payment_method !== "Bon" && (o.is_paid ? <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300">Lunas</span> : <span className="badge bg-amber-100 text-amber-800 border-amber-300">Belum dibayar</span>)}</div>
      {o.notes && <div className="text-xs text-slate-600 mt-1">Catatan: {o.notes}</div>}
      <div className="mt-2 border-t border-slate-100 pt-2 space-y-0.5">
        {o.items.map((i) => <div key={i.product_id} className="flex justify-between text-sm"><span>{fq(i.qty)} {i.unit} {i.name}</span><span className="mono">{rp(i.subtotal)}</span></div>)}
        {o.delivery_fee > 0 && <div className="flex justify-between text-sm text-slate-500"><span>Ongkir</span><span className="mono">{rp(o.delivery_fee)}</span></div>}
        <div className="flex justify-between font-bold"><span>Total</span><span className="mono">{rp(o.total_amount)}</span></div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {nx && <button data-testid={`order-action-${nx[0]}-${o.order_number}`} onClick={() => act(o, nx[0])} className="btn btn-primary flex-1">{nx[1]}</button>}
        {unpaid && can("orders.mark_paid") && <button data-testid={`order-paid-${o.order_number}`} onClick={() => act(o, "paid")} className="btn btn-secondary">Tandai Sudah Dibayar</button>}
        {!["Selesai", "Dibatalkan"].includes(o.status) && can("orders.cancel") && <button data-testid={`order-cancel-${o.order_number}`} onClick={() => act(o, "cancel")} className="btn btn-secondary text-red-600">{o.status === "Menunggu" ? "Tolak" : "Batalkan"}</button>}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { user, can, location } = useAuth();
  const [tab, setTab] = useState("aktif");
  const [rows, setRows] = useState([]);
  const [cancel, setCancel] = useState(null);
  const branch = location !== "Gudang Utama";
  const load = useCallback(async () => {
    if (!branch) return;
    try { const { data } = await api.get("/orders", { params: { location, status: tab } }); setRows(data); } catch (e) { toast.error(errMsg(e)); }
  }, [location, tab, branch]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const run = async (o, action) => {
    const shift_id = getShift(user)?.id || null;
    try {
      if (action === "paid") await api.post(`/orders/${o.id}/paid`, { action, shift_id });
      else await api.post(`/orders/${o.id}/status`, { action, shift_id });
      toast.success("Status pesanan diperbarui");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const act = (o, a) => (a === "cancel" ? setCancel(o) : run(o, a));

  if (!branch) return <div className="page"><div className="card p-6">Pilih Cabang 1 / Cabang 2 di navbar untuk melihat pesanan.</div></div>;
  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h1 className="h1">Pesanan Online · {location}</h1></div>
      <Tabs tabs={[["aktif", "Aktif"], ["Selesai", "Selesai"], ["Dibatalkan", "Dibatalkan"]]} value={tab} onChange={setTab} testid="orders-tabs" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{rows.map((o) => <OrderCard key={o.id} o={o} can={can} act={act} />)}</div>
      {!rows.length && <Empty text="Tidak ada pesanan" />}
      <Confirm open={!!cancel} danger title="Batalkan Pesanan" message={`Batalkan pesanan ${cancel?.order_number}? Stok yang sudah dipotong akan dikembalikan.`}
        onNo={() => setCancel(null)} onYes={() => { run(cancel, "cancel"); setCancel(null); }} testid="order-cancel-confirm" />
    </div>
  );
}
