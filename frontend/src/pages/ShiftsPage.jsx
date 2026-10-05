import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { submitOrQueue } from "@/lib/offline";
import { rp, fdt, uid, today } from "@/lib/format";
import { shiftText } from "@/lib/printer";
import { getShift, setShiftLocal, useFetch } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { Modal, Field, Empty, LocSelect } from "@/components/Modal";
import { PrintModal } from "@/components/PrintModal";

function Summary({ s }) {
  const row = (l, v, b) => <div className={`flex justify-between ${b ? "font-bold" : ""}`}><span>{l}</span><span className="mono">{v}</span></div>;
  return (
    <div className="text-sm space-y-1">
      {row("Jumlah transaksi", s.tx_count)}
      {Object.entries(s.by_method || {}).map(([m, v]) => row(`Penjualan ${m}`, rp(v)))}
      {row("Total penjualan", rp(s.sales_total), true)}
      <div className="border-t border-slate-100 my-1" />
      {row("Modal awal", rp(s.opening_cash))}{row("Penjualan tunai", rp(s.cash_sales))}{row("Pelunasan bon tunai", rp(s.credit_payments_cash))}{row("Pengeluaran", `-${rp(s.expenses_total)}`)}
      {row("Kas seharusnya", rp(s.expected_cash), true)}
      {s.closing_cash !== null && s.closing_cash !== undefined && <>{row("Kas fisik", rp(s.closing_cash))}
        <div className={`flex justify-between font-bold ${s.difference < 0 ? "text-red-600" : "text-emerald-700"}`}><span>Selisih {s.difference < 0 ? "(kurang)" : s.difference > 0 ? "(lebih)" : ""}</span><span className="mono" data-testid="shift-difference">{rp(s.difference)}</span></div></>}
      {s.expenses?.length > 0 && <div className="pt-2"><div className="label">Daftar pengeluaran</div>{s.expenses.map((e) => <div key={e.id} className="flex justify-between text-xs"><span>{e.category} {e.notes && `· ${e.notes}`}</span><span className="mono">{rp(e.amount)}</span></div>)}</div>}
    </div>
  );
}

function ExpenseForm({ shift, location, cats, onSaved }) {
  const [f, setF] = useState({ category: cats[0] || "Lainnya", amount: "", notes: "" });
  const save = async () => {
    if (!(Number(f.amount) > 0)) return toast.error("Nominal wajib diisi");
    try {
      const r = await submitOrQueue("expense", { id: uid(), shift_id: shift?.id || null, location_name: shift?.location_name || location, category: f.category, amount: Number(f.amount), notes: f.notes, created_at: new Date().toISOString() });
      toast.success(r.queued ? "Pengeluaran disimpan offline" : "Pengeluaran dicatat");
      setF({ ...f, amount: "", notes: "" });
      onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card p-4">
      <div className="font-bold mb-3">Input Pengeluaran Harian {shift ? "(dari kas laci)" : `· ${location}`}</div>
      <div className="grid sm:grid-cols-3 gap-2">
        <Field label="Kategori"><select data-testid="expense-category" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Nominal (Rp)"><input data-testid="expense-amount" type="number" inputMode="numeric" className="input mono" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Keterangan"><input data-testid="expense-notes" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <button data-testid="expense-save-btn" onClick={save} className="btn btn-dark mt-3">Simpan Pengeluaran</button>
    </div>
  );
}

export default function ShiftsPage() {
  const { user, can, location, store } = useAuth();
  const [shift, setShift] = useState(() => getShift(user));
  const [cur, setCur] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [print, setPrint] = useState(null);
  const [f, setF] = useState({ date_from: today(), date_to: today(), location: "", cashier_id: "" });
  const list = useFetch(async () => (await api.get("/shifts", { params: { ...f, location: f.location || undefined, cashier_id: f.cashier_id || undefined } })).data, [f]);
  const loadCur = () => api.get("/shifts/current").then(({ data }) => setCur(data)).catch(() => {});
  useEffect(() => { loadCur(); }, []);

  const close = async (cash) => {
    try {
      const r = await submitOrQueue("shift_close", { shift_id: shift.id, closing_cash: cash, closed_at: new Date().toISOString() });
      setShiftLocal(user, null); setShift(null); setCur(null); setCloseOpen(false);
      toast.success(r.queued ? "Shift ditutup (menunggu sinkron)" : "Shift ditutup");
      if (r.data) setDetail(r.data);
      list.reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const cashiers = [...new Map((list.data || []).map((s) => [s.cashier_id, s.cashier_name])).entries()];
  return (
    <div className="page space-y-4">
      <h1 className="h1">Shift & Pengeluaran</h1>
      {shift ? (
        <div className="card p-4" data-testid="current-shift-card">
          <div className="flex flex-wrap justify-between gap-2 mb-3">
            <div><div className="font-bold">Shift Aktif · {shift.location_name}</div><div className="text-xs text-slate-500">Dibuka {fdt(shift.opened_at)}</div></div>
            {can("shift.open_close") && <button data-testid="close-shift-btn" onClick={() => setCloseOpen(true)} className="btn btn-danger">Tutup Shift</button>}
          </div>
          {cur ? <Summary s={cur} /> : <div className="text-sm text-slate-500">Ringkasan tersedia saat online.</div>}
        </div>
      ) : <div className="card p-4 text-sm text-slate-600">Tidak ada shift aktif. Buka shift dari halaman Kasir (POS).</div>}
      {can("shift.expense") && <ExpenseForm shift={shift} location={location} cats={store.expense_categories || ["Lainnya"]} onSaved={loadCur} />}

      <div>
        <div className="font-bold text-lg mb-2">Laporan Shift</div>
        <div className="flex flex-wrap gap-2 mb-3">
          <input data-testid="shift-date-from" type="date" className="input !h-10 !w-auto" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
          <input data-testid="shift-date-to" type="date" className="input !h-10 !w-auto" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
          <LocSelect all value={f.location} onChange={(v) => setF({ ...f, location: v })} options={user.allowed_locations} testid="shift-loc" />
          {can("shift.view_all") && <select data-testid="shift-cashier" className="input !h-10 !w-auto" value={f.cashier_id} onChange={(e) => setF({ ...f, cashier_id: e.target.value })}><option value="">Semua Kasir</option>{cashiers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">Kasir</th><th className="th">Lokasi</th><th className="th">Buka</th><th className="th">Tutup</th><th className="th text-right">Penjualan</th><th className="th text-right">Selisih</th></tr></thead>
            <tbody>{(list.data || []).map((s) => (
              <tr key={s.id} data-testid={`shift-row-${s.id}`} onClick={() => setDetail(s)} className="cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                <td className="td font-semibold">{s.cashier_name}</td><td className="td">{s.location_name}</td><td className="td whitespace-nowrap">{fdt(s.opened_at)}</td>
                <td className="td whitespace-nowrap">{s.status === "open" ? <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300">Aktif</span> : fdt(s.closed_at)}</td>
                <td className="td text-right mono">{rp(s.sales_total)}</td><td className={`td text-right mono ${s.difference < 0 ? "text-red-600" : ""}`}>{s.difference === null ? "-" : rp(s.difference)}</td>
              </tr>))}</tbody>
          </table>
          {!list.data?.length && <Empty />}
        </div>
      </div>
      <Numpad open={closeOpen} money title="Tutup Shift: Kas Fisik" subtitle="Masukkan jumlah uang fisik di laci" submitLabel="Tutup Shift" onSubmit={close} onClose={() => setCloseOpen(false)} testid="close-shift-numpad" />
      <Modal open={!!detail && !print} onClose={() => setDetail(null)} title={`Rekap Shift · ${detail?.cashier_name || ""}`} testid="shift-detail"
        footer={detail?.status === "closed" && <button data-testid="shift-print-btn" className="btn btn-primary w-full" onClick={() => setPrint(detail)}>Cetak Rekap Shift</button>}>
        {detail && <><div className="text-xs text-slate-500 mb-2">{detail.location_name} · {fdt(detail.opened_at)} – {fdt(detail.closed_at)}</div><Summary s={detail} /></>}
      </Modal>
      <PrintModal open={!!print} onClose={() => setPrint(null)} title="Rekap Shift" text={print ? shiftText(print, store) : ""} testid="shift-print" />
    </div>
  );
}
