import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { rp, fq, fdt, today } from "@/lib/format";
import { receiptText } from "@/lib/printer";
import { useFetch } from "@/hooks/usePos";
import { Modal, Confirm, Empty, LocSelect } from "@/components/Modal";
import { PrintModal } from "@/components/PrintModal";

export default function TransactionsPage() {
  const { user, can, store } = useAuth();
  const [f, setF] = useState({ date_from: today(), date_to: today(), location: "", q: "" });
  const { data, reload } = useFetch(async () => (await api.get("/transactions", { params: { ...f, location: f.location || undefined, q: f.q || undefined } })).data, [f]);
  const [sel, setSel] = useState(null);
  const [print, setPrint] = useState(false);
  const [voidC, setVoidC] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const doVoid = async () => {
    try { await api.post(`/transactions/${sel.id}/void`); toast.success("Transaksi dibatalkan, stok dikembalikan"); setVoidC(false); setSel(null); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const rows = data || [];
  return (
    <div className="page">
      <h1 className="h1 mb-4">Riwayat Transaksi</h1>
      <div className="flex flex-wrap gap-2 mb-3">
        <input data-testid="tx-date-from" type="date" className="input !h-10 !w-auto" value={f.date_from} onChange={(e) => set("date_from", e.target.value)} />
        <input data-testid="tx-date-to" type="date" className="input !h-10 !w-auto" value={f.date_to} onChange={(e) => set("date_to", e.target.value)} />
        <LocSelect all value={f.location} onChange={(v) => set("location", v)} options={user.allowed_locations.filter((l) => l !== "Gudang Utama")} testid="tx-loc" />
        <input data-testid="tx-search" className="input !h-10 !w-48" placeholder="No. invoice" value={f.q} onChange={(e) => set("q", e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Invoice</th><th className="th">Waktu</th><th className="th">Lokasi</th><th className="th">Kasir</th><th className="th">Bayar</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} data-testid={`tx-row-${t.invoice_number}`} onClick={() => setSel(t)} className={`cursor-pointer active:bg-slate-100 hover:bg-slate-50 ${t.voided ? "opacity-50 line-through" : ""}`}>
                <td className="td mono font-semibold">{t.invoice_number}{t.channel === "online" && <span className="badge ml-1 bg-sky-50 text-sky-700 border-sky-200 no-underline">Online</span>}</td>
                <td className="td whitespace-nowrap">{fdt(t.created_at)}</td><td className="td">{t.location_name}</td><td className="td">{t.cashier_name}</td>
                <td className="td">{t.payment_method}{t.payment_method === "Bon" && <span className="text-xs text-slate-500"> ({t.payment_status})</span>}</td>
                <td className="td text-right mono font-bold">{rp(t.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="Belum ada transaksi pada periode ini" />}
      </div>
      <div className="mt-3 text-sm text-slate-600">Total ({rows.filter((t) => !t.voided).length} transaksi): <b className="mono">{rp(rows.filter((t) => !t.voided).reduce((a, t) => a + t.total_amount, 0))}</b></div>

      <Modal open={!!sel && !print} onClose={() => setSel(null)} title={sel?.invoice_number} testid="tx-detail"
        footer={sel && <div className="flex gap-2">
          {can("pos.void") && !sel.voided && !sel.order_id && <button data-testid="tx-void-btn" onClick={() => setVoidC(true)} className="btn btn-danger">Void</button>}
          {can("pos.reprint") && <button data-testid="tx-reprint-btn" onClick={() => setPrint(true)} className="btn btn-primary flex-1">Cetak Ulang Struk</button>}
        </div>}>
        {sel && <div className="text-sm space-y-1">
          <div>{fdt(sel.created_at)} · {sel.location_name} · {sel.cashier_name}</div>
          {sel.customer_name && <div>Pelanggan: <b>{sel.customer_name}</b> {sel.due_date && `· Jatuh tempo ${sel.due_date}`}</div>}
          {sel.needs_review && <div className="text-amber-700 font-semibold">Perlu ditinjau: Bon offline melebihi limit</div>}
          {sel.voided && <div className="text-red-600 font-bold">DIBATALKAN</div>}
          <div className="border-t border-slate-100 pt-2 mt-2">{sel.items.map((i) => <div key={i.id} className="flex justify-between"><span>{fq(i.qty)} {i.unit} {i.name} <span className="text-xs text-slate-500">@{rp(i.applied_unit_price)}</span></span><span className="mono">{rp(i.subtotal)}</span></div>)}</div>
          {sel.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span className="mono">-{rp(sel.discount)}</span></div>}
          <div className="flex justify-between font-bold text-base"><span>Total ({sel.payment_method})</span><span className="mono">{rp(sel.total_amount)}</span></div>
        </div>}
      </Modal>
      <PrintModal open={print} onClose={() => setPrint(false)} text={sel ? receiptText(sel, store) : ""} testid="tx-print" />
      <Confirm open={voidC} danger title="Void Transaksi" message="Transaksi akan dibatalkan dan stok dikembalikan." onNo={() => setVoidC(false)} onYes={doVoid} testid="tx-void-confirm" />
    </div>
  );
}
