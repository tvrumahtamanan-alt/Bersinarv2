import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { rp, fq } from "@/lib/format";
import { CATEGORIES, LOCATIONS } from "@/lib/constants";
import { useFetch, useDebounced } from "@/hooks/usePos";
import { ProductForm } from "@/components/ProductForm";
import { Empty } from "@/components/Modal";

export default function ProductsPage() {
  const { can } = useAuth();
  const { data, reload } = useFetch(async () => (await api.get("/products")).data, []);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [cat, setCat] = useState("");
  const [form, setForm] = useState(null);
  const rows = useMemo(() => (data || []).filter((p) => (!cat || p.category === cat) && (!dq || p.name.toLowerCase().includes(dq.toLowerCase()) || p.sku.includes(dq))), [data, dq, cat]);
  const toggle = async (p) => {
    try { await api.patch(`/products/${p.id}/active`, { active: !p.active }); toast.success(p.active ? "Produk dinonaktifkan" : "Produk diaktifkan"); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="h1">Produk</h1>
        {can("products.add") && <button data-testid="add-product-btn" onClick={() => setForm({})} className="btn btn-primary"><Plus size={18} />Tambah Produk Baru</button>}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input data-testid="products-search" className="input pl-10" placeholder="Cari nama / barcode" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select data-testid="products-cat" className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Semua Kategori</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr><th className="th">Produk</th><th className="th">Kategori</th><th className="th">Harga (E / G / P)</th>{LOCATIONS.map((l) => <th key={l} className="th text-right">{l}</th>)}<th className="th" /></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} data-testid={`product-row-${p.sku}`} className={p.active ? "" : "opacity-50"}>
              <td className="td"><div className="font-semibold">{p.name}</div><div className="mono text-xs text-slate-500">{p.sku} · {p.unit}{p.is_decimal_allowed ? " · desimal" : ""}</div></td>
              <td className="td">{p.category}</td>
              <td className="td mono text-xs">{p.tiers.map((t) => <div key={t.id}>{rp(t.price)} {t.min_qty > 0 && <span className="text-slate-400">≥{fq(t.min_qty)}</span>}</div>)}</td>
              {LOCATIONS.map((l) => { const s = p.locations[l]; const low = s && s.stock_quantity <= s.min_stock_alert; return (
                <td key={l} className={`td text-right mono ${low ? "text-amber-700 font-bold" : ""}`}>{fq(s?.stock_quantity)}<div className="text-[10px] text-slate-400">min {fq(s?.min_stock_alert)}</div></td>); })}
              <td className="td whitespace-nowrap text-right">
                {can("products.edit") && <button data-testid={`product-edit-${p.sku}`} onClick={() => setForm({ product: p })} className="btn btn-sm btn-secondary">Edit</button>}
                {can("products.deactivate") && <button data-testid={`product-toggle-${p.sku}`} onClick={() => toggle(p)} className="btn btn-sm btn-secondary ml-1">{p.active ? "Nonaktifkan" : "Aktifkan"}</button>}
              </td>
            </tr>))}</tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      <ProductForm open={!!form} product={form?.product} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />
    </div>
  );
}
