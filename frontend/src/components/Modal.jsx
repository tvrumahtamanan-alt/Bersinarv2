import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, footer, wide, testid = "modal" }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div data-testid={testid} className={`bg-white rounded-xl border border-slate-300 w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[85dvh] flex flex-col`}>
        <div className="flex items-center justify-between pl-4 pr-2 h-14 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-bold text-lg truncate">{title}</h3>
          {onClose && (
            <button data-testid={`${testid}-close`} onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-lg active:bg-slate-100">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-slate-200 p-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, message, onYes, onNo, yesLabel = "Ya, Lanjutkan", danger, testid = "confirm" }) {
  return (
    <Modal open={open} onClose={onNo} title={title} testid={testid}
      footer={<div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={onNo}>Batal</button>
        <button data-testid={`${testid}-yes`} className={`btn flex-1 ${danger ? "btn-danger" : "btn-primary"}`} onClick={onYes}>{yesLabel}</button></div>}>
      <div className="text-slate-700 whitespace-pre-line">{message}</div>
    </Modal>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ text = "Belum ada data" }) {
  return <div className="text-center text-slate-400 py-10 text-sm">{text}</div>;
}

export function Tabs({ tabs, value, onChange, testid = "tabs" }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid={testid}>
      {tabs.map(([k, l]) => (
        <button key={k} data-testid={`${testid}-${k}`} onClick={() => onChange(k)} className={`chip ${value === k ? "chip-on" : "chip-off"}`}>{l}</button>
      ))}
    </div>
  );
}

export function LocSelect({ value, onChange, options, testid = "loc-select", all }) {
  return (
    <select data-testid={testid} className="input !h-10 !w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      {all && <option value="">Semua Lokasi</option>}
      {options.map((l) => <option key={l} value={l}>{l}</option>)}
    </select>
  );
}
