import { memo, useEffect, useRef, useState } from "react";
import { Scale } from "lucide-react";
import { rp, fq } from "@/lib/format";
import { CAT_COLOR } from "@/lib/constants";

const ROW = 124;
const GRID = { 2: "grid-cols-2", 4: "grid-cols-4", 5: "grid-cols-5" };

export const ProductCard = memo(function ProductCard({ p, onPick }) {
  const low = p.stock <= (p.min_stock || 0);
  return (
    <button data-testid={`product-card-${p.sku}`} onClick={() => onPick(p)}
      className="tap relative h-full w-full text-left bg-white border-2 border-slate-200 rounded-lg pl-3 pr-2 py-2 flex flex-col overflow-hidden active:border-emerald-600 active:bg-emerald-50">
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${CAT_COLOR[p.category] || "bg-slate-400"}`} />
      <span className="font-bold text-sm leading-tight line-clamp-2">{p.name}</span>
      <span className="mt-auto">
        <span className="block mono font-bold text-emerald-700 text-[15px]">{rp(p.tiers[0]?.price)}<span className="text-[11px] text-slate-500 font-sans">/{p.unit}</span></span>
        <span className="flex items-center justify-between text-[11px] mt-0.5">
          <span className={`font-semibold ${p.stock <= 0 ? "text-red-600" : low ? "text-amber-600" : "text-slate-500"}`}>Stok {fq(p.stock)}</span>
          {p.is_decimal_allowed && <Scale size={13} className="text-slate-400" />}
        </span>
      </span>
    </button>
  );
});

export const ProductGrid = memo(function ProductGrid({ items, cols, onPick, padBottom }) {
  const ref = useRef(null);
  const [st, setSt] = useState({ top: 0, h: 900 });
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setSt((s) => ({ ...s, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    ref.current.scrollTop = 0;
    setSt((s) => ({ ...s, top: 0 }));
  }, [items]);
  const rows = Math.ceil(items.length / cols);
  const first = Math.max(0, Math.floor(st.top / ROW) - 6);
  const last = Math.min(rows, Math.ceil((st.top + st.h) / ROW) + 6);
  const out = [];
  for (let r = first; r < last; r++) {
    out.push(
      <div key={r} className={`absolute left-0 right-0 grid gap-2 ${GRID[cols]}`} style={{ top: r * ROW, height: ROW - 8 }}>
        {items.slice(r * cols, r * cols + cols).map((p) => <ProductCard key={p.id} p={p} onPick={onPick} />)}
      </div>
    );
  }
  return (
    <div ref={ref} data-testid="pos-product-grid" onScroll={(e) => { const top = e.currentTarget.scrollTop; setSt((s) => ({ ...s, top })); }} className="flex-1 min-h-0 overflow-y-auto px-2 pt-2">
      {items.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">Produk tidak ditemukan</div>}
      <div className="relative" style={{ height: rows * ROW + (padBottom ? 96 : 8) }}>{out}</div>
    </div>
  );
});
