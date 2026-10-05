import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { shopApi, errMsg } from "@/lib/api";
import { rp, fq, fdt } from "@/lib/format";
import { STATUS_COLOR } from "@/lib/constants";

const FLOW = ["Menunggu", "Diterima", "Dikemas", "Siap", "Selesai"];
const LABEL = { Menunggu: "Menunggu konfirmasi", Diterima: "Pesanan diterima", Dikemas: "Diproses / Dikemas", Siap: "Siap diambil / dikirim", Selesai: "Selesai" };

export default function TrackPage() {
  const { no } = useParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const load = () => shopApi.get(`/shop/orders/${no}`).then(({ data }) => { setO(data); setErr(""); }).catch((e) => setErr(errMsg(e)));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [no]);
  const idx = o ? FLOW.indexOf(o.status) : -1;
  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="h-14 bg-emerald-700 text-white flex items-center px-4 font-extrabold text-lg"><Link to="/shop" data-testid="track-back">BERSINAR</Link><span className="ml-2 font-semibold text-sm opacity-80">Lacak Pesanan</span></header>
      <div className="max-w-lg mx-auto p-4">
        {err && <div data-testid="track-error" className="card p-4 text-red-600">{err}</div>}
        {o && <>
          <div className="card p-4">
            <div className="flex justify-between items-start"><div><div className="text-xs text-slate-500">No. Pesanan</div><div data-testid="track-order-number" className="mono text-xl font-bold">{o.order_number}</div></div>
              <span data-testid="track-status" className={`badge ${STATUS_COLOR[o.status]}`}>{o.status}</span></div>
            <div className="text-sm mt-2">{o.location_name} · {o.delivery_type === "delivery" ? `Kirim ke ${o.delivery_address}` : "Ambil di Toko"}</div>
            <div className="text-xs text-slate-500">{fdt(o.created_at)} · Bayar {o.payment_method} {o.is_paid ? "(Lunas)" : ""}</div>
          </div>
          {o.status === "Dibatalkan" ? <div className="card p-4 mt-3 text-red-700 font-semibold">Pesanan dibatalkan oleh toko.</div> : (
            <div className="card p-4 mt-3">{FLOW.map((s, i) => (
              <div key={s} className="flex items-center gap-3 py-2">
                <span className={`h-7 w-7 rounded-full flex items-center justify-center border-2 ${i <= idx ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"}`}>{i <= idx && <Check size={16} />}</span>
                <span className={i <= idx ? "font-bold" : "text-slate-400"}>{LABEL[s]}</span>
              </div>))}</div>)}
          <div className="card p-4 mt-3">
            {o.items.map((i) => <div key={i.product_id} className="flex justify-between text-sm py-1"><span>{fq(i.qty)} {i.unit} {i.name}</span><span className="mono">{rp(i.subtotal)}</span></div>)}
            {o.delivery_fee > 0 && <div className="flex justify-between text-sm"><span>Ongkir</span><span className="mono">{rp(o.delivery_fee)}</span></div>}
            <div className="flex justify-between font-bold border-t border-slate-100 mt-2 pt-2"><span>Total</span><span className="mono">{rp(o.total_amount)}</span></div>
          </div>
        </>}
      </div>
    </div>
  );
}
