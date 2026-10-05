import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { LOCATIONS } from "@/lib/constants";
import { useFetch } from "@/hooks/usePos";
import { Modal, Field, Tabs, Confirm } from "@/components/Modal";

function Users({ roles }) {
  const { data, reload } = useFetch(async () => (await api.get("/users")).data, []);
  const [f, setF] = useState(null);
  const save = async () => {
    try {
      const body = { username: f.username, name: f.name, pin: f.pin || null, role_id: f.role_id, locations: f.locations.length ? f.locations : ["ALL"], active: f.active };
      f.id ? await api.put(`/users/${f.id}`, body) : await api.post("/users", body);
      toast.success("Akun disimpan"); setF(null); reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const toggleLoc = (l) => setF((s) => {
    if (l === "ALL") return { ...s, locations: ["ALL"] };
    const cur = s.locations.filter((x) => x !== "ALL");
    return { ...s, locations: cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l] };
  });
  const rname = (id) => roles.find((r) => r.id === id)?.name || "-";
  return (
    <>
      <button data-testid="add-user-btn" onClick={() => setF({ username: "", name: "", pin: "", role_id: roles.find((r) => !r.is_admin)?.id, locations: ["ALL"], active: true })} className="btn btn-primary mb-3"><Plus size={18} />Tambah Akun Staf</button>
      <div className="card overflow-x-auto"><table className="w-full min-w-[560px]">
        <thead><tr><th className="th">Username</th><th className="th">Nama</th><th className="th">Peran</th><th className="th">Lokasi</th><th className="th">Status</th><th className="th" /></tr></thead>
        <tbody>{(data || []).map((u) => (
          <tr key={u.id} data-testid={`user-row-${u.username}`}><td className="td mono font-semibold">{u.username}</td><td className="td">{u.name}</td><td className="td">{rname(u.role_id)}</td>
            <td className="td text-xs">{u.locations.includes("ALL") ? "Semua" : u.locations.join(", ")}</td><td className="td">{u.active ? "Aktif" : <span className="text-red-600">Nonaktif</span>}</td>
            <td className="td text-right"><button data-testid={`user-edit-${u.username}`} onClick={() => setF({ ...u, pin: "" })} className="btn btn-sm btn-secondary">Edit</button></td></tr>))}</tbody>
      </table></div>
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? "Edit Akun" : "Akun Staf Baru"} testid="user-form" footer={<button data-testid="user-save" onClick={save} className="btn btn-primary w-full">Simpan</button>}>
        {f && <div className="space-y-3">
          <Field label="Username"><input data-testid="uf-username" disabled={!!f.id} className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Nama"><input data-testid="uf-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={f.id ? "Reset PIN (kosongkan jika tidak diubah)" : "PIN (min. 4 digit)"}><input data-testid="uf-pin" className="input mono" inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Peran"><select data-testid="uf-role" className="input" value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <div><span className="label">Batas Lokasi</span><div className="flex flex-wrap gap-2">{["ALL", ...LOCATIONS].map((l) => (
            <button key={l} data-testid={`uf-loc-${l.toLowerCase().replace(" ", "-")}`} onClick={() => toggleLoc(l)} className={`chip ${f.locations.includes(l) ? "chip-on" : "chip-off"}`}>{l === "ALL" ? "Semua" : l}</button>))}</div></div>
          <label className="flex items-center gap-2"><input data-testid="uf-active" type="checkbox" className="w-5 h-5 accent-emerald-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span className="font-semibold text-sm">Akun aktif</span></label>
        </div>}
      </Modal>
    </>
  );
}

function Roles({ roles, reload }) {
  const { refresh } = useAuth();
  const { data: meta } = useFetch(async () => (await api.get("/meta")).data, []);
  const [edit, setEdit] = useState({});
  const [nameModal, setNameModal] = useState(null);
  const [del, setDel] = useState(null);
  useEffect(() => setEdit(Object.fromEntries(roles.map((r) => [r.id, r.permissions]))), [roles]);
  const groups = useMemo(() => {
    const g = {};
    (meta?.permissions || []).forEach((p) => (g[p.group] = g[p.group] || []).push(p));
    return Object.entries(g);
  }, [meta]);
  const toggle = (rid, key) => setEdit((s) => ({ ...s, [rid]: s[rid].includes(key) ? s[rid].filter((x) => x !== key) : [...s[rid], key] }));
  const dirty = roles.filter((r) => !r.is_admin && JSON.stringify([...r.permissions].sort()) !== JSON.stringify([...(edit[r.id] || [])].sort()));
  const saveAll = async () => {
    try { for (const r of dirty) await api.put(`/roles/${r.id}`, { name: r.name, permissions: edit[r.id] }); toast.success("Hak akses disimpan"); reload(); refresh(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const saveName = async () => {
    try {
      nameModal.id ? await api.put(`/roles/${nameModal.id}`, { name: nameModal.name, permissions: edit[nameModal.id] || [] }) : await api.post("/roles", { name: nameModal.name, permissions: [] });
      toast.success("Peran disimpan"); setNameModal(null); reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const doDel = async () => { try { await api.delete(`/roles/${del.id}`); toast.success("Peran dihapus"); reload(); } catch (e) { toast.error(errMsg(e)); } setDel(null); };
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <button data-testid="add-role-btn" onClick={() => setNameModal({ name: "" })} className="btn btn-secondary"><Plus size={18} />Peran Baru</button>
        <button data-testid="roles-save-btn" disabled={!dirty.length} onClick={saveAll} className="btn btn-primary">Simpan Perubahan {dirty.length > 0 && `(${dirty.length})`}</button>
      </div>
      <div className="card overflow-auto max-h-[70dvh]">
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-0 z-10"><tr><th className="th">Hak Akses</th>{roles.map((r) => (
            <th key={r.id} className="th text-center min-w-[110px]">
              <button data-testid={`role-name-${r.name.toLowerCase().replace(/\s/g, "-")}`} onClick={() => setNameModal({ id: r.id, name: r.name })} className="font-bold underline decoration-dotted">{r.name}</button>
              {!r.is_admin && <button data-testid={`role-del-${r.name.toLowerCase().replace(/\s/g, "-")}`} onClick={() => setDel(r)} className="ml-1 text-red-500 align-middle"><Trash2 size={13} /></button>}
            </th>))}</tr></thead>
          <tbody>{groups.map(([g, perms]) => [
            <tr key={g}><td colSpan={roles.length + 1} className="px-3 py-1.5 bg-slate-100 text-xs font-extrabold uppercase text-slate-600">{g}</td></tr>,
            ...perms.map((p) => (
              <tr key={p.key}><td className="td">{p.label}</td>{roles.map((r) => (
                <td key={r.id} className="td text-center"><input data-testid={`perm-${r.name.toLowerCase().replace(/\s/g, "-")}-${p.key}`} type="checkbox" className="w-5 h-5 accent-emerald-600"
                  disabled={r.is_admin} checked={r.is_admin || (edit[r.id] || []).includes(p.key)} onChange={() => toggle(r.id, p.key)} /></td>))}</tr>)),
          ])}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">Peran Admin selalu memiliki semua hak. Perubahan berlaku langsung pada staf yang sedang login (maks. 30 detik).</p>
      <Modal open={!!nameModal} onClose={() => setNameModal(null)} title={nameModal?.id ? "Ganti Nama Peran" : "Peran Baru"} testid="role-form" footer={<button data-testid="role-save" onClick={saveName} disabled={!nameModal?.name?.trim()} className="btn btn-primary w-full">Simpan</button>}>
        <Field label="Nama Peran"><input data-testid="role-name-input" className="input" value={nameModal?.name || ""} onChange={(e) => setNameModal({ ...nameModal, name: e.target.value })} /></Field>
      </Modal>
      <Confirm open={!!del} danger title="Hapus Peran" message={`Hapus peran ${del?.name}?`} onNo={() => setDel(null)} onYes={doDel} testid="role-del-confirm" />
    </>
  );
}

function StoreSettings() {
  const { store, setStore } = useAuth();
  const [f, setF] = useState(store);
  useEffect(() => setF(store), [store]);
  const save = async () => {
    try { const body = { ...f, delivery_fee: Number(f.delivery_fee) || 0 }; await api.put("/settings", body); setStore({ ...store, ...body }); toast.success("Pengaturan toko disimpan"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const fields = [["store_name", "Nama Toko"], ["address", "Alamat"], ["phone", "No. Telepon"], ["bank_info", "Info Rekening Bank"], ["qris_image_url", "URL Gambar QRIS"], ["delivery_fee", "Ongkir Kurir Lokal (Rp)"], ["receipt_footer", "Footer Struk"]];
  return (
    <div className="card p-4 max-w-xl space-y-3">
      {fields.map(([k, l]) => <Field key={k} label={l}><input data-testid={`store-${k}`} className="input" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
      <button data-testid="store-save" onClick={save} className="btn btn-primary">Simpan</button>
    </div>
  );
}

function ExpenseCats() {
  const { store, setStore } = useAuth();
  const [cats, setCats] = useState(store.expense_categories || []);
  const [n, setN] = useState("");
  const save = async (c) => {
    try { await api.put("/settings/expense-categories", { expense_categories: c }); setCats(c); setStore({ ...store, expense_categories: c }); toast.success("Kategori disimpan"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card p-4 max-w-md">
      {cats.map((c) => <div key={c} className="flex justify-between items-center border-b border-slate-100 py-2"><span>{c}</span><button data-testid={`cat-del-${c}`} onClick={() => save(cats.filter((x) => x !== c))} className="text-red-600 h-8 w-8 flex items-center justify-center"><Trash2 size={16} /></button></div>)}
      <div className="flex gap-2 mt-3"><input data-testid="cat-new-input" className="input" placeholder="Kategori baru" value={n} onChange={(e) => setN(e.target.value)} />
        <button data-testid="cat-add-btn" disabled={!n.trim()} onClick={() => { save([...cats, n.trim()]); setN(""); }} className="btn btn-primary">Tambah</button></div>
    </div>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  const roles = useFetch(async () => (await api.get("/roles")).data, []);
  const tabs = [can("settings.users") && ["users", "Akun Staf"], can("settings.roles") && ["roles", "Hak Akses"], can("settings.store") && ["store", "Toko"], can("settings.expense_cats") && ["cats", "Kategori Pengeluaran"]].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  return (
    <div className="page">
      <h1 className="h1 mb-4">Pengaturan</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} testid="settings-tabs" />
      <div className="mt-3">
        {tab === "users" && <Users roles={roles.data || []} />}
        {tab === "roles" && <Roles roles={roles.data || []} reload={roles.reload} />}
        {tab === "store" && <StoreSettings />}
        {tab === "cats" && <ExpenseCats />}
      </div>
    </div>
  );
}
