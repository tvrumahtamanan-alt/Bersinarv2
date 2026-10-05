import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { rp, fq, fdt, today } from "@/lib/format";
import { useFetch } from "@/hooks/usePos";
import { Tabs, Empty, LocSelect } from "@/components/Modal";

const firstOfMonth = () => `${today().slice(0, 8)}01`;
const Stat = ({ l, v, cls = "", testid }) => <div className="card p-3"><div className="label">{l}</div><div data-testid={testid} className={`mono font-bold text-xl ${cls}`}>{v}</div></div>;

function Sales({ p }) {
  const { data } = useFetch(async () => (await api.get("/reports/sales", { params: p })).data, [JSON.stringify(p)]);
  if (!data) return null;
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><Stat l="Total Penjualan" v={rp(data.total)} testid="rep-sales-total" /><Stat l="Transaksi" v={data.count} />
      {Object.entries(data.by_location).map(([l, v]) => <Stat key={l} l={l} v={rp(v)} />)}</div>
    <div className="grid md:grid-cols-2 gap-3 mt-3">
      <div className="card p-3"><div className="font-bold mb-2">Per Metode Bayar</div>{Object.entries(data.by_method).map(([m, v]) => <div key={m} className="flex justify-between text-sm py-1 border-b border-slate-100"><span>{m}</span><b className="mono">{rp(v)}</b></div>)}{!Object.keys(data.by_method).length && <Empty />}</div>
      <div className="card p-3"><div className="font-bold mb-2">Harian</div>{data.by_day.map((d) => <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100"><span>{d.date} · {d.count} trx</span><b className="mono">{rp(d.total)}</b></div>)}{!data.by_day.length && <Empty />}</div>
    </div>
  </>);
}

function Pnl({ p }) {
  const { data } = useFetch(async () => (await api.get("/reports/pnl", { params: p })).data, [JSON.stringify(p)]);
  if (!data) return null;
  const rows = [["Penjualan", "revenue"], ["HPP", "cogs", -1], ["Laba Kotor", "gross_profit", 0, 1], ["Beban Kerugian Barang Rusak", "waste_loss", -1], ["Pengeluaran Harian", "expenses", -1], ["Laba Bersih", "net_profit", 0, 1]];
  const cols = [...Object.keys(data.by_location), "Total"];
  const val = (c, k) => (c === "Total" ? data.total[k] : data.by_location[c][k]);
  return (
    <div className="card overflow-x-auto"><table className="w-full min-w-[560px]">
      <thead><tr><th className="th">Laba Rugi</th>{cols.map((c) => <th key={c} className="th text-right">{c}</th>)}</tr></thead>
      <tbody>{rows.map(([l, k, neg, bold]) => <tr key={k} className={bold ? "bg-slate-50 font-bold" : ""}><td className="td">{l}</td>{cols.map((c) => <td key={c} data-testid={`pnl-${k}-${c.toLowerCase().replace(" ", "-")}`} className={`td text-right mono ${val(c, k) < 0 ? "text-red-600" : ""}`}>{neg ? `(${rp(val(c, k))})` : rp(val(c, k))}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function Waste({ p }) {
  const { data } = useFetch(async () => (await api.get("/waste", { params: p })).data, [JSON.stringify(p)]);
  const total = (data || []).reduce((a, w) => a + (w.total_loss_cogs || 0), 0);
  return (<><Stat l="Total Kerugian" v={rp(total)} cls="text-red-600" />
    <div className="card overflow-x-auto mt-3"><table className="w-full min-w-[560px]"><thead><tr><th className="th">Waktu</th><th className="th">Lokasi</th><th className="th">Produk</th><th className="th text-right">Qty</th><th className="th">Alasan</th><th className="th text-right">Kerugian</th></tr></thead>
      <tbody>{(data || []).map((w) => <tr key={w.id}><td className="td text-xs">{fdt(w.created_at)}</td><td className="td">{w.location_name}</td><td className="td">{w.product_name}</td><td className="td text-right mono">{fq(w.qty)} {w.unit}</td><td className="td">{w.reason}</td><td className="td text-right mono">{rp(w.total_loss_cogs)}</td></tr>)}</tbody></table>{!data?.length && <Empty />}</div></>);
}

function Receivables() {
  const { data } = useFetch(async () => (await api.get("/reports/receivables")).data, []);
  if (!data) return null;
  return (<>
    <div className="grid grid-cols-2 gap-2"><Stat l="Total Piutang" v={rp(data.total)} testid="rep-receivable-total" /><Stat l="Lewat Jatuh Tempo" v={rp(data.overdue_total)} cls="text-red-600" /></div>
    <div className="card overflow-x-auto mt-3"><table className="w-full min-w-[560px]"><thead><tr><th className="th">Invoice</th><th className="th">Pelanggan</th><th className="th">Jatuh Tempo</th><th className="th text-right">Sisa</th></tr></thead>
      <tbody>{data.bons.map((b) => <tr key={b.id} className={b.overdue ? "text-red-700" : ""}><td className="td mono">{b.invoice_number}</td><td className="td">{b.customer_name}</td><td className="td">{b.due_date}{b.overdue && " (terlambat)"}</td><td className="td text-right mono font-bold">{rp(b.outstanding)}</td></tr>)}</tbody></table>{!data.bons.length && <Empty text="Tidak ada piutang" />}</div>
  </>);
}

function Expenses({ p }) {
  const { data } = useFetch(async () => (await api.get("/expenses", { params: p })).data, [JSON.stringify(p)]);
  const by = {};
  (data || []).forEach((e) => { const k = `${e.cashier_name} · ${e.location_name}`; by[k] = (by[k] || 0) + e.amount; });
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(by).map(([k, v]) => <Stat key={k} l={k} v={rp(v)} />)}</div>
    <div className="card overflow-x-auto mt-3"><table className="w-full min-w-[560px]"><thead><tr><th className="th">Waktu</th><th className="th">Kasir</th><th className="th">Lokasi</th><th className="th">Kategori</th><th className="th">Keterangan</th><th className="th text-right">Nominal</th></tr></thead>
      <tbody>{(data || []).map((e) => <tr key={e.id}><td className="td text-xs">{fdt(e.created_at)}</td><td className="td">{e.cashier_name}</td><td className="td">{e.location_name}</td><td className="td">{e.category}</td><td className="td">{e.notes}</td><td className="td text-right mono">{rp(e.amount)}</td></tr>)}</tbody></table>{!data?.length && <Empty />}</div>
  </>);
}

export default function ReportsPage() {
  const { user, can } = useAuth();
  const tabs = [can("reports.sales") && ["sales", "Penjualan"], can("reports.pnl") && ["pnl", "Laba Rugi"], can("reports.waste") && ["waste", "Barang Rusak"],
    can("reports.receivables") && ["recv", "Piutang"], can("reports.pnl", "shift.view_all") && ["exp", "Pengeluaran"]].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  const [f, setF] = useState({ date_from: firstOfMonth(), date_to: today(), location: "" });
  const p = { date_from: f.date_from, date_to: f.date_to, location: f.location || undefined };
  return (
    <div className="page">
      <h1 className="h1 mb-4">Laporan</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} testid="report-tabs" />
      {tab !== "recv" && <div className="flex flex-wrap gap-2 my-3">
        <input data-testid="rep-date-from" type="date" className="input !h-10 !w-auto" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
        <input data-testid="rep-date-to" type="date" className="input !h-10 !w-auto" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
        <LocSelect all value={f.location} onChange={(v) => setF({ ...f, location: v })} options={user.allowed_locations} testid="rep-loc" />
      </div>}
      <div className="mt-3">
        {tab === "sales" && <Sales p={p} />}{tab === "pnl" && <Pnl p={p} />}{tab === "waste" && <Waste p={p} />}{tab === "recv" && <Receivables />}{tab === "exp" && <Expenses p={p} />}
      </div>
    </div>
  );
}
