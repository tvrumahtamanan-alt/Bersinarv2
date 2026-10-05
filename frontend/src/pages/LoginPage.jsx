import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, login, store } = useAuth();
  const [username, setU] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", { username, pin });
      await login(data.token);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-[100dvh] grid md:grid-cols-2 bg-white">
      <div className="hidden md:flex flex-col justify-end p-10 bg-cover bg-center relative" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1606237906294-ae86d103d715?auto=format&fit=crop&w=1200&q=70)" }}>
        <div className="absolute inset-0 bg-slate-900/55" />
        <div className="relative text-white">
          <div className="text-5xl font-extrabold tracking-tight">{store.store_name || "BERSINAR"}</div>
          <div className="mt-2 text-lg text-slate-200 max-w-sm">Kasir, stok gudang & pesanan online toko sayur dan sembako dalam satu sistem.</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="md:hidden text-4xl font-extrabold tracking-tight mb-1">{store.store_name || "BERSINAR"}</div>
          <h1 className="text-2xl font-bold mb-1">Masuk Staf</h1>
          <p className="text-slate-500 text-sm mb-6">Gunakan Username dan PIN dari Admin.</p>
          <label className="label">Username</label>
          <input data-testid="login-username-input" className="input mb-4" autoCapitalize="none" value={username} onChange={(e) => setU(e.target.value)} />
          <label className="label">PIN</label>
          <input data-testid="login-pin-input" className="input mono tracking-[0.5em] mb-4" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          {err && <div data-testid="login-error" className="mb-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>}
          <button data-testid="login-submit-button" disabled={busy || !username || !pin} className="btn btn-primary btn-lg w-full">{busy ? "Memproses..." : "Masuk"}</button>
          <Link to="/shop" data-testid="login-shop-link" className="block text-center text-sm text-emerald-700 font-semibold mt-6">Buka Aplikasi Pesan Online →</Link>
        </form>
      </div>
    </div>
  );
}
