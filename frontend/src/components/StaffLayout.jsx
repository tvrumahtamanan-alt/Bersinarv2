import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, Maximize, Minimize, Wifi, WifiOff, LogOut, X, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/lib/offline";
import { useFullscreen, toggleFullscreen } from "@/hooks/usePos";
import { api } from "@/lib/api";
import { orderAlert } from "@/lib/sound";
import { rp } from "@/lib/format";
import { Modal } from "./Modal";

export const NAV = [
  ["/pos", "Kasir (POS)", ["pos.access"]],
  ["/orders", "Pesanan Online", ["orders.process"]],
  ["/transactions", "Riwayat Transaksi", ["pos.access", "reports.sales"]],
  ["/shifts", "Shift & Pengeluaran", ["shift.open_close", "shift.view_all", "shift.expense"]],
  ["/products", "Produk", ["products.view"]],
  ["/stock", "Stok & Transfer", ["stock.adjust", "stock.transfer"]],
  ["/receive", "Terima Barang", ["stock.receive", "stock.receive_history"]],
  ["/low-stock", "Stok Menipis & Kulakan", ["stock.low"]],
  ["/waste", "Barang Rusak", ["stock.waste"]],
  ["/customers", "Pelanggan & Bon", ["customers.manage", "customers.payment", "customers.credit_limit"]],
  ["/reports", "Laporan", ["reports.sales", "reports.pnl", "reports.waste", "reports.receivables"]],
  ["/settings", "Pengaturan", ["settings.users", "settings.roles", "settings.store", "settings.expense_cats"]],
];

function OrderAlert() {
  const { can, location } = useAuth();
  const nav = useNavigate();
  const seen = useRef(null);
  const [fresh, setFresh] = useState([]);
  const active = can("orders.process") && location !== "Gudang Utama";
  useEffect(() => {
    if (!active) return undefined;
    seen.current = null;
    const poll = async () => {
      try {
        const { data } = await api.get("/orders/pending", { params: { location } });
        const ids = new Set(data.map((o) => o.id));
        if (seen.current) {
          const nw = data.filter((o) => !seen.current.has(o.id));
          if (nw.length) { orderAlert(); setFresh(nw); }
        }
        seen.current = ids;
      } catch { /* offline */ }
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [active, location]);
  return (
    <Modal open={fresh.length > 0} onClose={() => setFresh([])} title="Pesanan Online Masuk" testid="order-alert"
      footer={<button data-testid="order-alert-view" className="btn btn-primary btn-lg w-full" onClick={() => { setFresh([]); nav("/orders"); }}>Lihat Pesanan</button>}>
      <div className="flex items-center gap-3 mb-3 text-emerald-700"><Bell /><b>{fresh.length} pesanan baru untuk {location}</b></div>
      {fresh.map((o) => (
        <div key={o.id} className="flex justify-between border-b border-slate-100 py-2 text-sm">
          <span><b className="mono">{o.order_number}</b> · {o.customer_name}</span><b>{rp(o.total_amount)}</b>
        </div>
      ))}
    </Modal>
  );
}

export default function StaffLayout() {
  const { user, can, location, setLocation, logout, store } = useAuth();
  const { online, pending } = useNetwork();
  const fs = useFullscreen();
  const [menu, setMenu] = useState(false);
  const items = NAV.filter(([, , p]) => can(...p));
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-slate-100">
      <header className="h-14 flex-shrink-0 bg-slate-900 text-white flex items-center gap-2 px-2 sm:px-3">
        <button data-testid="nav-menu-btn" onClick={() => setMenu(true)} className="h-10 w-10 flex items-center justify-center rounded-lg active:bg-slate-700"><Menu /></button>
        <div className="font-extrabold tracking-tight text-lg">{store.store_name || "BERSINAR"}</div>
        <select data-testid="nav-location-select" value={location} onChange={(e) => setLocation(e.target.value)}
          className="ml-1 bg-slate-800 border border-slate-700 rounded-lg h-9 px-2 text-sm font-semibold max-w-[130px]">
          {user.allowed_locations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <div className="flex-1" />
        <div data-testid="nav-network-status" className={`flex items-center gap-1 text-xs font-bold px-2 h-8 rounded-lg ${online ? "bg-emerald-700" : "bg-red-600"}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}<span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
          {pending > 0 && <span data-testid="nav-pending-count" className="ml-1 bg-white text-slate-900 rounded px-1">{pending}</span>}
        </div>
        <button data-testid="nav-fullscreen-btn" onClick={toggleFullscreen} className="h-10 w-10 flex items-center justify-center rounded-lg active:bg-slate-700" title="Fullscreen">
          {fs ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto"><Outlet /></main>
      {menu && (
        <div className="fixed inset-0 z-50 flex" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)} style={{ background: "rgba(15,23,42,.5)" }}>
          <nav data-testid="nav-drawer" className="w-72 max-w-[85vw] h-full bg-white flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 flex-shrink-0">
              <div><div className="font-bold">{user.name}</div><div className="text-xs text-slate-500">{user.role_name}</div></div>
              <button data-testid="nav-drawer-close" onClick={() => setMenu(false)} className="h-10 w-10 flex items-center justify-center"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {items.map(([to, label]) => (
                <NavLink key={to} to={to} onClick={() => setMenu(false)} data-testid={`nav-link-${to.slice(1)}`}
                  className={({ isActive }) => `block px-4 py-3 font-semibold text-sm border-l-4 ${isActive ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent active:bg-slate-100"}`}>
                  {label}
                </NavLink>
              ))}
            </div>
            <button data-testid="nav-logout-btn" onClick={logout} className="h-14 flex-shrink-0 border-t border-slate-200 flex items-center gap-2 px-4 text-red-600 font-semibold"><LogOut size={18} />Keluar</button>
          </nav>
        </div>
      )}
      <OrderAlert />
    </div>
  );
}
