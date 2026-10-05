import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fq } from "@/lib/format";
import { useDebounced } from "@/hooks/usePos";

export function ProductPicker({ items, onPick, testid = "product-picker", placeholder = "Cari nama / barcode produk..." }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const res = useMemo(() => {
    const s = dq.trim().toLowerCase();
    if (!s) return [];
    return items.filter((p) => p.name.toLowerCase().includes(s) || p.sku.includes(s)).slice(0, 30);
  }, [dq, items]);
  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-3 text-slate-400" />
        <input data-testid={testid} className="input pl-10" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {res.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg max-h-72 overflow-y-auto">
          {res.map((p) => (
            <button key={p.id} data-testid={`${testid}-opt-${p.sku}`} onClick={() => { onPick(p); setQ(""); }}
              className="w-full text-left px-3 py-2 border-b border-slate-100 active:bg-emerald-50 hover:bg-slate-50 flex justify-between gap-2">
              <span className="font-semibold text-sm">{p.name}</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">{p.stock !== undefined ? `Stok ${fq(p.stock)} ${p.unit}` : p.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
