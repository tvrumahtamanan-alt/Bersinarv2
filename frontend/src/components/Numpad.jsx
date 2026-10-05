import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { rp } from "@/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Numpad({ open, title, subtitle, unit, decimal, initial, money, presets, submitLabel = "Tambah ke Keranjang", onSubmit, onClose, testid = "numpad" }) {
  const [v, setV] = useState("");
  useEffect(() => {
    if (open) setV(initial ? String(initial).replace(".", ",") : "");
  }, [open, initial]);

  const num = Number(v.replace(",", ".")) || 0;
  const press = (k) =>
    setV((s) => {
      if (k === "del") return s.slice(0, -1);
      if (k === ",") return !decimal || s.includes(",") ? s : (s || "0") + ",";
      if (s.includes(",") && s.split(",")[1].length >= 3) return s;
      if (s === "0") return k;
      return (s + k).slice(0, 12);
    });
  const submit = () => num > 0 || money ? onSubmit(num) : null;

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") { e.preventDefault(); submit(); }
      else if (e.key === "Escape") onClose();
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-900/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div data-testid={testid} className="bg-white rounded-xl border border-slate-300 w-full max-w-sm max-h-[85dvh] flex flex-col">
        <div className="px-4 pt-3 pb-2 flex-shrink-0 border-b border-slate-200">
          <div className="font-bold text-lg leading-tight truncate">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
          <div data-testid={`${testid}-display`} className="mono text-3xl font-bold text-right mt-2 h-10 truncate">
            {money ? rp(num) : `${v || "0"} ${unit || ""}`}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          {presets && (
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {presets.map((p) => (
                <button key={p} data-testid={`${testid}-preset-${p}`} onClick={() => setV(String(p).replace(".", ","))} className="chip chip-off flex-shrink-0">
                  {money ? rp(p) : String(p).replace(".", ",")}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[...KEYS, decimal ? "," : "00", "0", "del"].map((k) => (
              <button key={k} data-testid={`${testid}-key-${k === "," ? "comma" : k}`}
                onClick={() => (k === "00" ? (press("0"), press("0")) : press(k))}
                className="h-14 rounded-lg border-2 border-slate-300 bg-slate-50 text-2xl font-bold active:bg-emerald-600 active:text-white flex items-center justify-center">
                {k === "del" ? <Delete /> : k}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 p-3 border-t border-slate-200 flex gap-2">
          <button data-testid={`${testid}-cancel`} onClick={onClose} className="btn btn-secondary btn-lg flex-1">Batal</button>
          <button data-testid={`${testid}-submit`} onClick={submit} disabled={!money && num <= 0} className="btn btn-primary btn-lg flex-[2]">{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
