import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanLine, Wand2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useScanner } from "@/lib/scanner";
import { beepOk, beepErr } from "@/lib/sound";
import { CATEGORIES, UNITS, LOCATIONS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { Modal, Field } from "./Modal";

const TIERS = ["Eceran", "Grosir", "Partai Besar"];

function blank(sku) {
  return {
    sku: sku || "", name: "", category: "Sayur", unit: "Kg", is_decimal_allowed: true, is_expirable: false, min_stock_alert: 5,
    tiers: TIERS.map((t, i) => ({ tier_name: t, min_qty: [0, 10, 50][i], price: "" })),
    locations: LOCATIONS.map((l) => ({ location_name: l, stock_quantity: "", cogs_price: "", min_stock_alert: 5 })),
  };
}

function fromProduct(p) {
  return {
    ...blank(p.sku), ...p,
    tiers: TIERS.map((t, i) => p.tiers.find((x) => x.tier_name === t) || { tier_name: t, min_qty: [0, 10, 50][i], price: "" }),
    locations: LOCATIONS.map((l) => ({ location_name: l, stock_quantity: p.locations?.[l]?.stock_quantity ?? 0,
      cogs_price: p.locations?.[l]?.cogs_price ?? "", min_stock_alert: p.locations?.[l]?.min_stock_alert ?? p.min_stock_alert })),
  };
}

export function ProductForm({ open, product, initialSku, onClose, onSaved }) {
  const { can } = useAuth();
  const [f, setF] = useState(blank());
  const [dup, setDup] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setF(product ? fromProduct(product) : blank(initialSku)); setDup(""); }
  }, [open, product, initialSku]);

  const checkSku = async (sku) => {
    try {
      const { data } = await api.get(`/products/by-sku/${encodeURIComponent(sku)}`);
      setDup(data.id !== product?.id ? `Barcode sudah terdaftar: ${data.name}` : "");
    } catch { setDup(""); }
  };
  useScanner((code) => { setF((s) => ({ ...s, sku: code })); beepOk(); checkSku(code); }, open);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setTier = (i, k, v) => setF((s) => ({ ...s, tiers: s.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const setLoc = (i, k, v) => setF((s) => ({ ...s, locations: s.locations.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const genSku = async () => { const { data } = await api.get("/products/generate-sku"); set("sku", data.sku); setDup(""); };

  const save = async () => {
    if (!f.name.trim() || !f.sku.trim()) return toast.error("Nama dan Barcode/SKU wajib diisi");
    if (dup) { beepErr(); return toast.error(dup); }
    const body = {
      ...f, min_stock_alert: Number(f.min_stock_alert) || 0,
      tiers: f.tiers.map((t) => ({ ...t, min_qty: Number(t.min_qty) || 0, price: Number(t.price) || 0 })),
      locations: f.locations.map((l) => ({ ...l, stock_quantity: Number(l.stock_quantity) || 0, cogs_price: Number(l.cogs_price) || 0, min_stock_alert: Number(l.min_stock_alert) || 0 })),
    };
    setSaving(true);
    try {
      const { data } = product ? await api.put(`/products/${product.id}`, body) : await api.post("/products", body);
      toast.success(product ? "Produk diperbarui" : "Produk ditambahkan");
      onSaved?.({ ...body, id: product?.id || data.id });
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide testid="product-form" title={product ? "Edit Produk" : "+ Tambah Produk Baru"}
      footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={onClose}>Batal</button>
        <button data-testid="product-form-save" disabled={saving} className="btn btn-primary flex-[2]" onClick={save}>Simpan Produk</button></div>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nama Produk" className="sm:col-span-2"><input data-testid="pf-name" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Barcode / SKU" className="sm:col-span-2">
          <div className="flex gap-2">
            <input data-testid="pf-sku" className="input mono" value={f.sku} placeholder="Scan barcode atau ketik" onChange={(e) => { set("sku", e.target.value); setDup(""); }} onBlur={(e) => e.target.value && checkSku(e.target.value)} />
            <button data-testid="pf-gen-sku" type="button" className="btn btn-secondary" onClick={genSku}><Wand2 size={16} />Auto</button>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><ScanLine size={14} />Scan barang kapan saja, kolom ini terisi otomatis</div>
          {dup && <div data-testid="pf-sku-dup" className="text-sm text-red-600 font-semibold mt-1">{dup}</div>}
        </Field>
        <Field label="Kategori"><select data-testid="pf-category" className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Satuan Utama"><select data-testid="pf-unit" className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)}>{UNITS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <label className="flex items-center gap-3 card p-3"><input data-testid="pf-decimal" type="checkbox" className="w-5 h-5 accent-emerald-600" checked={f.is_decimal_allowed} onChange={(e) => set("is_decimal_allowed", e.target.checked)} /><span className="font-semibold text-sm">Penjualan Desimal (timbang)</span></label>
        <label className="flex items-center gap-3 card p-3"><input data-testid="pf-expirable" type="checkbox" className="w-5 h-5 accent-emerald-600" checked={f.is_expirable} onChange={(e) => set("is_expirable", e.target.checked)} /><span className="font-semibold text-sm">Memiliki Masa Kadaluarsa</span></label>
      </div>
      <div className="mt-4 font-bold text-sm">Harga Bertingkat</div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {f.tiers.map((t, i) => (
          <div key={t.tier_name} className="card p-2">
            <div className="text-xs font-bold text-slate-600 mb-1">{t.tier_name}</div>
            <input data-testid={`pf-tier-price-${i}`} type="number" inputMode="numeric" className="input !h-10 mono" placeholder="Harga" value={t.price} onChange={(e) => setTier(i, "price", e.target.value)} />
            <div className="text-[11px] text-slate-500 mt-1">Min qty</div>
            <input data-testid={`pf-tier-min-${i}`} type="number" inputMode="decimal" disabled={i === 0} className="input !h-9 mono" value={t.min_qty} onChange={(e) => setTier(i, "min_qty", e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-4 font-bold text-sm">Stok, HPP & Batas Minimum per Lokasi</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Lokasi</th>{!product && <th className="th">Stok Awal</th>}{can("products.view_cogs") && <th className="th">HPP</th>}<th className="th">Min. Stok</th></tr></thead>
          <tbody>
            {f.locations.map((l, i) => (
              <tr key={l.location_name}>
                <td className="td font-semibold whitespace-nowrap">{l.location_name}</td>
                {!product && <td className="td"><input data-testid={`pf-stock-${i}`} type="number" inputMode="decimal" className="input !h-9 mono min-w-[80px]" value={l.stock_quantity} onChange={(e) => setLoc(i, "stock_quantity", e.target.value)} /></td>}
                {can("products.view_cogs") && <td className="td"><input data-testid={`pf-cogs-${i}`} type="number" inputMode="numeric" className="input !h-9 mono min-w-[90px]" value={l.cogs_price} onChange={(e) => setLoc(i, "cogs_price", e.target.value)} /></td>}
                <td className="td"><input data-testid={`pf-min-${i}`} type="number" inputMode="decimal" className="input !h-9 mono min-w-[70px]" value={l.min_stock_alert} onChange={(e) => setLoc(i, "min_stock_alert", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
