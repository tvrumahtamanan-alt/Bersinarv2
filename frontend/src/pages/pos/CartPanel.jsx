import { Minus, Plus, Trash2, User } from "lucide-react";
import { rp, fq } from "@/lib/format";

export function CartPanel({ lines, totals, onInc, onDec, onEdit, onRemove, canRemove, customers, customer, setCustomer,
  discount, onDiscount, canDiscount, onPay, onClear }) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-white" data-testid="cart-panel">
      <div className="h-12 flex-shrink-0 flex items-center justify-between px-3 border-b border-slate-200">
        <div className="font-bold">Keranjang <span className="text-slate-500 font-semibold text-sm">({lines.length} item)</span></div>
        {lines.length > 0 && canRemove && <button data-testid="cart-clear-btn" onClick={onClear} className="text-sm font-semibold text-red-600 px-2 h-9">Kosongkan</button>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {lines.length === 0 && <div className="text-center text-slate-400 text-sm py-12">Ketuk produk atau scan barcode</div>}
        {lines.map((l) => (
          <div key={l.p.id} data-testid={`cart-line-${l.p.sku}`} className="px-3 py-2 border-b border-slate-100">
            <div className="flex justify-between gap-2">
              <div className="font-semibold text-sm leading-tight">{l.p.name}</div>
              <div className="mono font-bold text-sm whitespace-nowrap">{rp(l.sub)}</div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${l.tier === "Eceran" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-amber-100 text-amber-800 border-amber-300"}`}>{l.tier}</span>
              <span className="text-xs text-slate-500 mono">@{rp(l.price)}</span>
              <div className="flex-1" />
              <button data-testid={`cart-dec-${l.p.sku}`} onClick={() => onDec(l.p)} className="h-9 w-9 rounded-lg border border-slate-300 flex items-center justify-center active:bg-slate-200"><Minus size={16} /></button>
              <button data-testid={`cart-qty-${l.p.sku}`} onClick={() => onEdit(l)} className="h-9 min-w-[64px] px-2 rounded-lg border-2 border-slate-300 mono font-bold text-sm active:bg-slate-100">{fq(l.qty)} <span className="text-[10px] text-slate-500">{l.p.unit}</span></button>
              <button data-testid={`cart-inc-${l.p.sku}`} onClick={() => onInc(l.p)} className="h-9 w-9 rounded-lg border border-slate-300 flex items-center justify-center active:bg-slate-200"><Plus size={16} /></button>
              {canRemove && <button data-testid={`cart-remove-${l.p.sku}`} onClick={() => onRemove(l.p)} className="h-9 w-9 rounded-lg flex items-center justify-center text-red-600 active:bg-red-50"><Trash2 size={16} /></button>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 border-t-2 border-slate-200 p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <User size={16} className="absolute left-3 top-3 text-slate-400" />
            <select data-testid="cart-customer-select" className="input !h-10 pl-9 text-sm" value={customer?.id || ""} onChange={(e) => setCustomer(customers.find((c) => c.id === e.target.value) || null)}>
              <option value="">Pelanggan Umum</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {canDiscount && (
            <input data-testid="cart-discount-input" type="number" inputMode="numeric" placeholder="Diskon Rp" className="input !h-10 !w-28 mono text-sm" value={discount || ""} onChange={(e) => onDiscount(Number(e.target.value) || 0)} />
          )}
        </div>
        {customer && <div className="text-xs text-slate-600">Sisa limit kredit: <b className="mono">{rp(customer.credit_limit - customer.current_credit)}</b></div>}
        <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span className="mono">{rp(totals.subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Diskon</span><span className="mono">-{rp(discount)}</span></div>}
        <div className="flex justify-between items-end"><span className="font-bold">TOTAL</span><span data-testid="cart-total" className="mono text-3xl font-bold">{rp(totals.total)}</span></div>
        <button data-testid="cart-pay-btn" disabled={!lines.length} onClick={onPay} className="btn btn-primary btn-lg w-full text-lg">Bayar</button>
      </div>
    </div>
  );
}
