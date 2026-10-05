import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanLine, Trash2, PackagePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cacheGet, cacheSet, submitOrQueue } from "@/lib/offline";
import { errMsg } from "@/lib/api";
import { useScanner } from "@/lib/scanner";
import { beepOk, beepErr } from "@/lib/sound";
import { fq, fdt, uid } from "@/lib/format";
import { useCatalog, useFetch } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { ProductPicker } from "@/components/ProductPicker";
import { ProductForm } from "@/components/ProductForm";
import { Modal, Confirm, Empty, Tabs, Field } from "@/components/Modal";

const blank = { supplier: "", notes: "", items: [] };

function History({ location }) {
  const { data } = useFetch(async () => (await api.get("/receipts", { params: { location } })).data, [location]);
  const [open, setOpen] = useState(null);
  return (
    <div className="card">
      {(data || []).map((r) => (
        <button key={r.id} data-testid={`receipt-row-${r.receipt_number}`} onClick={() => setOpen(r)} className="w-full text-left px-4 py-3 border-b border-slate-100 active:bg-slate-50 flex justify-between gap-2">
          <span><b className="mono">{r.receipt_number}</b> <span className="text-sm">{r.supplier || "Tanpa supplier"}</span><div className="text-xs text-slate-500">{fdt(r.created_at)} · {r.location_name} · {r.user}</div></span>
          <span className="text-sm font-semibold whitespace-nowrap">{r.items.length} jenis</span>
        </button>))}
      {!data?.length && <Empty text="Belum ada riwayat terima barang" />}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.receipt_number} testid="receipt-detail">
        {open && <div className="text-sm"><div className="mb-2">{fdt(open.created_at)} · {open.location_name}<br />Supplier: {open.supplier || "-"} · Staf: {open.user}{open.notes && <><br />Catatan: {open.notes}</>}</div>
          {open.items.map((i) => <div key={i.product_id} className="flex justify-between border-b border-slate-100 py-1"><span>{i.name}</span><b className="mono">{fq(i.qty)} {i.unit}</b></div>)}</div>}
      </Modal>
    </div>
  );
}

export default function ReceivePage() {
  const { can, location } = useAuth();
  const { items: catalog, reload } = useCatalog(location);
  const key = `bs_receive_${location}`;
  const [draft, setDraft] = useState(() => cacheGet(key, blank));
  const [np, setNp] = useState(null);
  const [unknown, setUnknown] = useState(null);
  const [form, setForm] = useState(null);
  const [conf, setConf] = useState(false);
  const [tab, setTab] = useState(can("stock.receive") ? "new" : "history");
  useEffect(() => setDraft(cacheGet(key, blank)), [key]);
  const update = (d) => { setDraft(d); cacheSet(key, d); };

  useScanner((code) => {
    const p = catalog.find((x) => x.sku === code);
    if (!p) { beepErr(); setNp(null); setUnknown(code); return; }
    beepOk();
    setNp({ p, n: performance.now() });
  }, tab === "new" && !form);

  const addQty = (v) => {
    const p = np.p;
    const ex = draft.items.find((i) => i.product_id === p.id);
    const items = ex && !np.edit ? draft.items.map((i) => (i === ex ? { ...i, qty: Math.round((i.qty + v) * 1000) / 1000 } : i))
      : ex ? draft.items.map((i) => (i === ex ? { ...i, qty: v } : i)) : [...draft.items, { product_id: p.id, name: p.name, unit: p.unit, qty: v, decimal: p.is_decimal_allowed }];
    update({ ...draft, items });
    setNp(null);
  };
  const submit = async () => {
    try {
      const r = await submitOrQueue("receipt", { id: uid(), location_name: location, supplier: draft.supplier, notes: draft.notes, items: draft.items.map(({ product_id, name, unit, qty }) => ({ product_id, name, unit, qty })) });
      toast.success(r.queued ? "Disimpan offline, stok diperbarui saat online" : `Stok diperbarui (${r.data.receipt_number})`);
      update(blank); setConf(false); reload();
    } catch (e) { toast.error(errMsg(e)); setConf(false); }
  };
  const total = draft.items.reduce((a, i) => a + i.qty, 0);
  const tabs = [can("stock.receive") && ["new", "Terima Barang"], can("stock.receive_history") && ["history", "Riwayat"]].filter(Boolean);

  return (
    <div className="page">
      <h1 className="h1 mb-1">Terima Barang · {location}</h1>
      <p className="text-sm text-slate-500 mb-3">Dari supplier atau belanja grosir. Lokasi tujuan mengikuti pilihan di navbar.</p>
      <Tabs tabs={tabs} value={tab} onChange={setTab} testid="receive-tabs" />
      <div className="mt-3">
        {tab === "history" ? <History location={location} /> : (
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3" data-testid="receive-scan-hint"><ScanLine size={18} />Scanner siap — scan barang langsung, tanpa klik apa pun</div>
              <Field label="Cari barang tanpa barcode"><ProductPicker items={catalog} onPick={(p) => setNp({ p, n: performance.now() })} testid="receive-picker" /></Field>
              <Field label="Nama Supplier (opsional)"><input data-testid="receive-supplier" className="input" value={draft.supplier} onChange={(e) => update({ ...draft, supplier: e.target.value })} /></Field>
              <Field label="Catatan (opsional)"><input data-testid="receive-notes" className="input" value={draft.notes} onChange={(e) => update({ ...draft, notes: e.target.value })} /></Field>
            </div>
            <div className="card flex flex-col">
              <div className="px-4 h-12 flex items-center justify-between border-b border-slate-200"><b>Daftar Penerimaan</b><span className="text-sm text-slate-500">{draft.items.length} jenis</span></div>
              <div className="flex-1">
                {draft.items.map((i) => (
                  <div key={i.product_id} data-testid={`receive-item-${i.product_id}`} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
                    <span className="flex-1 font-semibold text-sm">{i.name}</span>
                    <button data-testid={`receive-item-qty-${i.product_id}`} onClick={() => setNp({ p: { id: i.product_id, name: i.name, unit: i.unit, is_decimal_allowed: i.decimal }, qty: i.qty, edit: true, n: 1 })} className="h-9 px-3 rounded-lg border-2 border-slate-300 mono font-bold text-sm">{fq(i.qty)} {i.unit}</button>
                    <button data-testid={`receive-item-del-${i.product_id}`} onClick={() => update({ ...draft, items: draft.items.filter((x) => x !== i) })} className="h-9 w-9 flex items-center justify-center text-red-600"><Trash2 size={16} /></button>
                  </div>))}
                {!draft.items.length && <Empty text="Scan barang untuk mulai" />}
              </div>
              <div className="p-3 border-t border-slate-200"><button data-testid="receive-submit" disabled={!draft.items.length} onClick={() => setConf(true)} className="btn btn-primary btn-lg w-full">Kirim & Update Stok</button></div>
            </div>
          </div>
        )}
      </div>
      <Numpad key={np ? `${np.p.id}-${np.n}` : "none"} open={!!np} title={np?.p.name} subtitle="Jumlah barang diterima" unit={np?.p.unit} decimal={np?.p.is_decimal_allowed} initial={np?.qty}
        submitLabel="OK" onSubmit={addQty} onClose={() => setNp(null)} testid="receive-numpad" />
      <Modal open={!!unknown && !form} onClose={() => setUnknown(null)} title="Barcode belum terdaftar" testid="receive-unknown"
        footer={can("products.add") && <button data-testid="receive-add-product" onClick={() => setForm(unknown)} className="btn btn-primary w-full"><PackagePlus size={18} />Tambah Produk Baru</button>}>
        <div className="mono text-lg font-bold">{unknown}</div><div className="text-sm text-slate-500 mt-1">Produk dengan barcode ini belum ada di sistem.</div>
      </Modal>
      <ProductForm open={!!form} initialSku={form} onClose={() => setForm(null)}
        onSaved={(p) => { setForm(null); setUnknown(null); reload(); setNp({ p: { ...p, stock: 0 }, n: performance.now() }); }} />
      <Confirm open={conf} title="Kirim & Update Stok" message={`${draft.items.length} jenis barang, total ${fq(total)} item akan ditambahkan ke stok ${location}.`} onNo={() => setConf(false)} onYes={submit} yesLabel="Kirim" testid="receive-confirm" />
    </div>
  );
}
