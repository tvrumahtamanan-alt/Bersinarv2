import { useEffect, useState } from "react";
import { Banknote, QrCode, Landmark, NotebookPen } from "lucide-react";
import { rp } from "@/lib/format";
import { Modal } from "@/components/Modal";

const METHODS = [["Tunai", Banknote], ["QRIS", QrCode], ["Transfer", Landmark], ["Bon", NotebookPen]];

export function PaymentModal({ open, total, customer, canBon, busy, onClose, onConfirm }) {
  const [method, setMethod] = useState("Tunai");
  const [cash, setCash] = useState("");
  useEffect(() => { if (open) { setMethod("Tunai"); setCash(""); } }, [open]);
  const cashN = Number(cash) || 0;
  const remaining = customer ? customer.credit_limit - customer.current_credit : 0;
  let error = "";
  if (method === "Tunai" && cashN < total) error = "Uang diterima kurang";
  if (method === "Bon" && !customer) error = "Pilih pelanggan B2B di keranjang terlebih dahulu";
  else if (method === "Bon" && total > remaining) error = `Ditolak: melebihi sisa limit kredit (${rp(remaining)})`;
  const quick = [total, ...[20000, 50000, 100000].filter((x) => x > total), Math.ceil(total / 50000) * 50000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  return (
    <Modal open={open} onClose={onClose} title="Pembayaran" testid="payment-modal"
      footer={<button data-testid="payment-confirm-btn" disabled={!!error || busy} onClick={() => onConfirm({ method, cash: method === "Tunai" ? cashN : 0 })} className="btn btn-primary btn-lg w-full text-lg">
        {busy ? "Memproses..." : `Selesaikan ${rp(total)}`}</button>}>
      <div className="text-center mb-4"><div className="text-xs font-bold text-slate-500 uppercase">Total Tagihan</div><div data-testid="payment-total" className="mono text-4xl font-bold">{rp(total)}</div></div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {METHODS.filter(([m]) => m !== "Bon" || canBon).map(([m, Icon]) => (
          <button key={m} data-testid={`payment-method-${m.toLowerCase()}`} onClick={() => setMethod(m)}
            className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1 text-xs font-bold ${method === m ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 active:bg-slate-100"}`}>
            <Icon size={20} />{m}
          </button>
        ))}
      </div>
      {method === "Tunai" && (
        <div>
          <label className="label">Uang Diterima</label>
          <input data-testid="payment-cash-input" autoFocus type="number" inputMode="numeric" className="input mono text-xl !h-12" value={cash} onChange={(e) => setCash(e.target.value)} />
          <div className="flex gap-2 mt-2 flex-wrap">
            {quick.map((q, i) => <button key={q} data-testid={`payment-quick-${i}`} onClick={() => setCash(String(q))} className="chip chip-off">{i === 0 ? "Uang Pas" : rp(q)}</button>)}
          </div>
          <div className="flex justify-between mt-4 text-lg"><span className="font-semibold">Kembalian</span><span data-testid="payment-change" className="mono font-bold">{rp(Math.max(cashN - total, 0))}</span></div>
        </div>
      )}
      {(method === "QRIS" || method === "Transfer") && <div className="text-sm text-slate-600 card p-3">Pastikan pembayaran {method} sudah diterima sebelum menyelesaikan transaksi.</div>}
      {method === "Bon" && customer && <div className="text-sm card p-3">Pelanggan: <b>{customer.name}</b><br />Sisa limit: <b className="mono">{rp(remaining)}</b></div>}
      {error && <div data-testid="payment-error" className="mt-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>}
    </Modal>
  );
}
