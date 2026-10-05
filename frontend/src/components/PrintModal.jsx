import { useState } from "react";
import { toast } from "sonner";
import { Bluetooth, Printer } from "lucide-react";
import { btSupported, connectPrinter, paperWidth, setPaperWidth, printText, printerName } from "@/lib/printer";
import { Modal } from "./Modal";

export function PrintModal({ open, onClose, title = "Struk", text, testid = "print-modal" }) {
  const [, force] = useState(0);
  const connect = async () => {
    try {
      const n = await connectPrinter();
      toast.success(`Terhubung: ${n}`);
      force((x) => x + 1);
    } catch (e) {
      toast.error(e.message || "Gagal menghubungkan printer");
    }
  };
  const print = async () => {
    try {
      const how = await printText(text);
      if (how === "bluetooth") toast.success("Struk dicetak");
    } catch (e) {
      toast.error(`Gagal cetak: ${e.message}`);
    }
  };
  const setW = (w) => { setPaperWidth(w); force((x) => x + 1); };
  return (
    <Modal open={open} onClose={onClose} title={title} testid={testid}
      footer={<div className="flex gap-2">
        <button data-testid={`${testid}-done`} className="btn btn-secondary flex-1" onClick={onClose}>Selesai</button>
        <button data-testid={`${testid}-print`} className="btn btn-primary flex-[2]" onClick={print}><Printer size={18} />Cetak Struk</button>
      </div>}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[58, 80].map((w) => (
          <button key={w} data-testid={`${testid}-paper-${w}`} onClick={() => setW(w)} className={`chip ${paperWidth() === w ? "chip-on" : "chip-off"}`}>{w}mm</button>
        ))}
        {btSupported() ? (
          <button data-testid={`${testid}-bt`} onClick={connect} className="btn btn-sm btn-secondary ml-auto"><Bluetooth size={14} />{printerName() || "Hubungkan Printer"}</button>
        ) : (
          <span className="text-xs text-slate-500 ml-auto">Bluetooth tidak didukung, cetak via dialog</span>
        )}
      </div>
      <pre data-testid={`${testid}-preview`} className="mono text-[11px] leading-4 bg-slate-50 border border-dashed border-slate-300 p-3 rounded overflow-x-auto whitespace-pre mx-auto w-fit">{text}</pre>
    </Modal>
  );
}
