import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { rp, fdt, today } from "@/lib/format";
import { getShift, useFetch } from "@/hooks/usePos";
import { Modal, Field, Empty } from "@/components/Modal";

function CustomerForm({ open, c, onClose, onSaved, can }) {
  const [f, setF] = useState(null);
  if (open && !f) setF(c ? { ...c, pin: "" } : { name: "", phone: "", customer_type: "B2B", credit_limit: 0, payment_terms_days: 14, pin: "" });
  if (!open && f) setF(null);
  const save = async () => {
    try {
      const body = { ...f, credit_limit: Number(f.credit_limit) || 0, payment_terms_days: Number(f.payment_terms_days) || 0, pin: f.pin || null };
      c ? await api.put(`/customers/${c.id}`, body) : await api.post("/customers", body);
      toast.success("Pelanggan disimpan"); onSaved();
    } catch (e) { toast.error(errMsg(e)); }
  };
  if (!f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const manage = can("customers.manage");
  return (
    <Modal open={open} onClose={onClose} title={c ? "Edit Pelanggan" : "Tambah Pelanggan B2B"} testid="customer-form"
      footer={<button data-testid="customer-save" onClick={save} className="btn btn-primary w-full">Simpan</button>}>
      <div className="space-y-3">
        <Field label="Nama"><input data-testid="cf-name" disabled={!manage} className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="No. HP"><input data-testid="cf-phone" disabled={!manage} className="input" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Limit Kredit (Rp)"><input data-testid="cf-limit" disabled={!can("customers.credit_limit")} type="number" className="input mono" value={f.credit_limit} onChange={(e) => set("credit_limit", e.target.value)} /></Field>
          <Field label="Jatuh Tempo (hari)"><input data-testid="cf-terms" disabled={!manage} type="number" className="input mono" value={f.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} /></Field>
        </div>
        {manage && <Field label={c ? "PIN App Pesan (kosongkan jika tidak diubah)" : "PIN App Pesan Online"}><input data-testid="cf-pin" className="input mono" inputMode="numeric" value={f.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} /></Field>}
      </div>
    </Modal>
  );
}

function Detail({ c, onClose, can, onPaid }) {
  const { user, location } = useAuth();
  const { data, reload } = useFetch(async () => (c ? (await api.get(`/customers/${c.id}/bons`)).data : null), [c?.id]);
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState("Tunai");
  const [notes, setNotes] = useState("");
  const pay = async () => {
    try {
      const shift = getShift(user);
      await api.post("/credit-payments", { customer_id: c.id, payment_amount: Number(amt), payment_method: method, notes, shift_id: method === "Tunai" ? shift?.id || null : null, location_name: shift?.location_name || location });
      toast.success("Pelunasan dicatat, limit kredit pulih"); setAmt(""); setNotes(""); reload(); onPaid();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const t = today();
  return (
    <Modal open={!!c} onClose={onClose} wide title={c?.name} testid="customer-detail">
      {c && <>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[["Limit", c.credit_limit], ["Total Bon", c.current_credit], ["Sisa Limit", c.credit_limit - c.current_credit]].map(([l, v]) => (
            <div key={l} className="card p-3"><div className="label">{l}</div><div data-testid={`customer-detail-${l.toLowerCase().replace(" ", "-")}`} className="mono font-bold text-lg">{rp(v)}</div></div>))}
        </div>
        {can("customers.payment") && c.current_credit > 0 && (
          <div className="card p-3 mb-4 bg-slate-50">
            <div className="font-bold mb-2">Catat Pelunasan Bon</div>
            <div className="flex flex-wrap gap-2">
              <input data-testid="pay-amount" type="number" inputMode="numeric" className="input !w-40 mono" placeholder="Nominal" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <button onClick={() => setAmt(String(c.current_credit))} className="chip chip-off">Lunasi semua</button>
              {["Tunai", "Transfer"].map((m) => <button key={m} data-testid={`pay-method-${m.toLowerCase()}`} onClick={() => setMethod(m)} className={`chip ${method === m ? "chip-on" : "chip-off"}`}>{m}</button>)}
              <input data-testid="pay-notes" className="input flex-1 min-w-[140px]" placeholder="Catatan" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button data-testid="pay-submit" disabled={!(Number(amt) > 0)} onClick={pay} className="btn btn-primary">Simpan</button>
            </div>
          </div>)}
        <div className="font-bold mb-1">Daftar Bon</div>
        {(data?.bons || []).map((b) => { const late = b.payment_status !== "Lunas" && b.due_date < t; return (
          <div key={b.id} className="flex justify-between gap-2 border-b border-slate-100 py-2 text-sm">
            <span><b className="mono">{b.invoice_number}</b> <span className="text-xs text-slate-500">{fdt(b.created_at)}</span><div className="text-xs">Jatuh tempo {b.due_date} {late && <span className="badge bg-red-100 text-red-700 border-red-300">Terlambat</span>}</div></span>
            <span className="text-right"><b className="mono">{rp(b.total_amount)}</b><div className="text-xs">{b.payment_status}{b.paid_amount > 0 && b.payment_status !== "Lunas" ? ` · dibayar ${rp(b.paid_amount)}` : ""}</div></span>
          </div>); })}
        {!data?.bons?.length && <Empty text="Belum ada bon" />}
        <div className="font-bold mt-4 mb-1">Riwayat Pelunasan</div>
        {(data?.payments || []).map((p) => <div key={p.id} className="flex justify-between text-sm border-b border-slate-100 py-1"><span>{fdt(p.created_at)} · {p.payment_method} · {p.received_by}</span><b className="mono">{rp(p.payment_amount)}</b></div>)}
        {!data?.payments?.length && <Empty text="Belum ada pelunasan" />}
      </>}
    </Modal>
  );
}

export default function CustomersPage() {
  const { can } = useAuth();
  const { data, reload } = useFetch(async () => (await api.get("/customers")).data, []);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h1 className="h1">Pelanggan B2B & Bon</h1>
        {can("customers.manage") && <button data-testid="add-customer-btn" onClick={() => setForm({})} className="btn btn-primary"><Plus size={18} />Tambah Pelanggan</button>}</div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Nama</th><th className="th">No. HP</th><th className="th text-right">Limit</th><th className="th text-right">Bon</th><th className="th text-right">Sisa</th><th className="th">Tempo</th><th className="th" /></tr></thead>
          <tbody>{(data || []).map((c) => (
            <tr key={c.id} data-testid={`customer-row-${c.phone}`} className="hover:bg-slate-50">
              <td className="td font-semibold cursor-pointer" onClick={() => setDetail(c)}>{c.name}</td><td className="td">{c.phone}</td>
              <td className="td text-right mono">{rp(c.credit_limit)}</td><td className="td text-right mono font-bold">{rp(c.current_credit)}</td>
              <td className="td text-right mono">{rp(c.credit_limit - c.current_credit)}</td><td className="td">{c.payment_terms_days} hari</td>
              <td className="td text-right whitespace-nowrap">
                <button data-testid={`customer-detail-btn-${c.phone}`} onClick={() => setDetail(c)} className="btn btn-sm btn-secondary">Bon</button>
                {can("customers.manage", "customers.credit_limit") && <button data-testid={`customer-edit-${c.phone}`} onClick={() => setForm({ c })} className="btn btn-sm btn-secondary ml-1">Edit</button>}
              </td>
            </tr>))}</tbody>
        </table>
        {!data?.length && <Empty />}
      </div>
      <CustomerForm open={!!form} c={form?.c} can={can} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />
      <Detail c={detail && (data || []).find((x) => x.id === detail.id)} can={can} onClose={() => setDetail(null)} onPaid={reload} />
    </div>
  );
}
