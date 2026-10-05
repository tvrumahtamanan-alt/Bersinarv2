import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fq } from "@/lib/format";
import { useFetch } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";
import { Empty, Confirm, LocSelect } from "@/components/Modal";

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export default function LowStockPage() {
  const { user, location } = useAuth();
  const [loc, setLoc] = useState(location);
  useEffect(() => setLoc(location), [location]);
  const low = useFetch(async () => (await api.get("/stock/low", { params: { location: loc } })).data, [loc]);
  const [list, setList] = useState([]);
  const [np, setNp] = useState(null);
  const [clear, setClear] = useState(false);
  useEffect(() => { api.get(`/kulakan/${encodeURIComponent(loc)}`).then(({ data }) => setList(data.items)).catch(() => {}); }, [loc]);
  const save = async (items) => {
    setList(items);
    try { await api.put(`/kulakan/${encodeURIComponent(loc)}`, { items }); } catch (e) { toast.error(errMsg(e)); }
  };
  const onQty = (v) => {
    const ex = list.find((i) => i.product_id === np.id);
    save(ex ? list.map((i) => (i === ex ? { ...i, qty: np.edit ? v : i.qty + v } : i)) : [...list, { product_id: np.id, name: np.name, unit: np.unit, qty: v }]);
    if (!np.edit) toast.success(`${np.name} masuk daftar kulakan`);
    setNp(null);
  };
  const doCopy = async () => {
    const t = list.map((i) => `${fq(i.qty)} ${i.name.toLowerCase()}`).join("\n");
    if (await copyText(t)) toast.success("Daftar disalin, siap ditempel ke WhatsApp");
    else toast.error("Gagal menyalin");
  };
  return (
    <div className="page">
      <div className="flex flex-wrap items-center gap-2 mb-4"><h1 className="h1 flex-1">Stok Menipis & Kulakan</h1><LocSelect value={loc} onChange={setLoc} options={user.allowed_locations} testid="low-loc" /></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-4 h-12 flex items-center border-b border-slate-200 font-bold">Daftar Stok Menipis <span className="ml-2 badge bg-amber-100 text-amber-800 border-amber-300">{low.data?.length || 0}</span></div>
          {(low.data || []).map((p) => (
            <button key={p.id} data-testid={`low-item-${p.sku}`} onClick={() => setNp(p)} className="w-full text-left px-4 py-3 border-b border-slate-100 flex justify-between gap-2 active:bg-amber-50 hover:bg-slate-50">
              <span className="font-semibold text-sm">{p.name}</span>
              <span className="text-sm whitespace-nowrap"><b className={`mono ${p.stock <= 0 ? "text-red-600" : "text-amber-700"}`}>{fq(p.stock)}</b><span className="text-slate-500"> / min {fq(p.min_stock)} {p.unit}</span></span>
            </button>))}
          {!low.data?.length && <Empty text="Semua stok aman" />}
        </div>
        <div className="card flex flex-col">
          <div className="px-4 h-12 flex items-center justify-between border-b border-slate-200"><b>Daftar Belanja Kulakan</b><span className="text-sm text-slate-500">{list.length} item</span></div>
          <div className="flex-1">
            {list.map((i) => (
              <div key={i.product_id} data-testid={`kulakan-item-${i.product_id}`} className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
                <span className="flex-1 text-sm font-semibold">{i.name}</span>
                <button data-testid={`kulakan-qty-${i.product_id}`} onClick={() => setNp({ id: i.product_id, name: i.name, unit: i.unit, qty: i.qty, edit: true, is_decimal_allowed: true })} className="h-9 px-3 rounded-lg border-2 border-slate-300 mono font-bold text-sm">{fq(i.qty)}</button>
                <button data-testid={`kulakan-del-${i.product_id}`} onClick={() => save(list.filter((x) => x !== i))} className="h-9 w-9 flex items-center justify-center text-red-600"><Trash2 size={16} /></button>
              </div>))}
            {!list.length && <Empty text="Ketuk item stok menipis untuk menambah" />}
          </div>
          <div className="p-3 border-t border-slate-200 flex gap-2">
            <button data-testid="kulakan-clear" disabled={!list.length} onClick={() => setClear(true)} className="btn btn-secondary">Kosongkan Daftar</button>
            <button data-testid="kulakan-copy" disabled={!list.length} onClick={doCopy} className="btn btn-primary flex-1"><Copy size={16} />Salin</button>
          </div>
        </div>
      </div>
      <Numpad open={!!np} title={np?.name} subtitle={np?.edit ? "Ubah jumlah pesan" : `Stok ${fq(np?.stock)} · min ${fq(np?.min_stock)} ${np?.unit}`} unit={np?.unit} decimal={np?.is_decimal_allowed} initial={np?.qty}
        submitLabel={np?.edit ? "Simpan" : "Masukkan ke Kulakan"} onSubmit={onQty} onClose={() => setNp(null)} testid="kulakan-numpad" />
      <Confirm open={clear} danger title="Kosongkan Daftar" message="Hapus semua item di daftar kulakan?" onNo={() => setClear(false)} onYes={() => { save([]); setClear(false); }} testid="kulakan-clear-confirm" />
    </div>
  );
}
