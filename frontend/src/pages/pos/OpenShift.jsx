import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { submitOrQueue } from "@/lib/offline";
import { errMsg } from "@/lib/api";
import { uid } from "@/lib/format";
import { setShiftLocal } from "@/hooks/usePos";
import { Numpad } from "@/components/Numpad";

export function OpenShift({ user, location, canOpen, onOpened }) {
  const [open, setOpen] = useState(false);
  const submit = async (cash) => {
    const s = { id: uid(), location_name: location, opening_cash: cash, opened_at: new Date().toISOString() };
    try {
      const r = await submitOrQueue("shift_open", s);
      const shift = r.data ? { id: r.data.id, location_name: r.data.location_name, opening_cash: r.data.opening_cash, opened_at: r.data.opened_at } : s;
      setShiftLocal(user, shift);
      setOpen(false);
      toast.success(r.queued ? "Shift dibuka (offline, menunggu sinkron)" : "Shift dibuka");
      onOpened(shift);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="card p-6 max-w-sm w-full text-center" data-testid="open-shift-card">
        <Lock className="mx-auto text-slate-400" size={36} />
        <h2 className="text-xl font-bold mt-3">Shift belum dibuka</h2>
        <p className="text-sm text-slate-500 mt-1">Buka shift di <b>{location}</b> dengan mengisi modal awal kas laci sebelum mulai bertransaksi.</p>
        {canOpen ? (
          <button data-testid="open-shift-btn" onClick={() => setOpen(true)} className="btn btn-primary btn-lg w-full mt-5">Buka Shift</button>
        ) : <p className="text-sm text-red-600 mt-4">Anda tidak punya hak membuka shift.</p>}
      </div>
      <Numpad open={open} money title="Modal Awal Kas Laci" subtitle={location} presets={[100000, 200000, 300000, 500000]}
        submitLabel="Buka Shift" onSubmit={submit} onClose={() => setOpen(false)} testid="open-shift-numpad" />
    </div>
  );
}
