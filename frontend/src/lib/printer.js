import { rp, fq, fdt } from "./format";

const SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];
let ch = null;
let deviceName = "";

export const btSupported = () => !!navigator.bluetooth;
export const printerName = () => (ch ? deviceName : "");
export const paperWidth = () => Number(localStorage.getItem("bs_paper") || 58);
export const setPaperWidth = (w) => localStorage.setItem("bs_paper", String(w));

export async function connectPrinter() {
  const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  const server = await dev.gatt.connect();
  for (const s of await server.getPrimaryServices()) {
    for (const c of await s.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        ch = c;
        deviceName = dev.name || "Printer";
        dev.addEventListener("gattserverdisconnected", () => (ch = null));
        return deviceName;
      }
    }
  }
  throw new Error("Karakteristik printer tidak ditemukan");
}

async function writeBytes(bytes) {
  for (let i = 0; i < bytes.length; i += 100) {
    const chunk = bytes.slice(i, i + 100);
    if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(chunk);
    else await ch.writeValue(chunk);
  }
}

const cols = () => (paperWidth() === 80 ? 48 : 32);
const line = (l, r = "") => {
  const w = cols();
  const s = l.length + r.length >= w ? `${l}\n${" ".repeat(Math.max(w - r.length, 0))}${r}` : l + " ".repeat(w - l.length - r.length) + r;
  return s;
};
const center = (t) => {
  const w = cols();
  return " ".repeat(Math.max(Math.floor((w - t.length) / 2), 0)) + t;
};
const hr = () => "-".repeat(cols());

export function receiptText(tx, st = {}) {
  const out = [center(st.store_name || "BERSINAR"), center(st.address || ""), center(st.phone || ""), hr()];
  out.push(`No : ${tx.invoice_number}`, `Tgl: ${fdt(tx.created_at)}`, `Kasir: ${tx.cashier_name || "-"}`, `Lokasi: ${tx.location_name}`);
  if (tx.customer_name) out.push(`Pelanggan: ${tx.customer_name}`);
  out.push(hr());
  for (const i of tx.items) {
    out.push(i.name);
    out.push(line(`  ${fq(i.qty)} ${i.unit || ""} x ${rp(i.applied_unit_price).replace("Rp ", "")}`, rp(i.subtotal).replace("Rp ", "")));
  }
  out.push(hr());
  out.push(line("Subtotal", rp(tx.subtotal)));
  if (tx.discount > 0) out.push(line("Diskon", `-${rp(tx.discount)}`));
  if (tx.discount < 0) out.push(line("Ongkir", rp(-tx.discount)));
  out.push(line("TOTAL", rp(tx.total_amount)));
  out.push(line("Bayar", tx.payment_method));
  if (tx.payment_method === "Tunai") {
    out.push(line("Tunai", rp(tx.cash_received)));
    out.push(line("Kembali", rp(tx.change)));
  }
  if (tx.payment_method === "Bon") out.push(line("Jatuh tempo", tx.due_date || "-"));
  out.push(hr(), center(st.receipt_footer || "Terima kasih"), "", "", "");
  return out.join("\n");
}

export function shiftText(s, st = {}) {
  const out = [center(st.store_name || "BERSINAR"), center("REKAP SHIFT"), hr(),
    `Kasir : ${s.cashier_name}`, `Lokasi: ${s.location_name}`, `Buka  : ${fdt(s.opened_at)}`, `Tutup : ${fdt(s.closed_at)}`, hr(),
    line("Jml Transaksi", String(s.tx_count))];
  for (const [m, v] of Object.entries(s.by_method || {})) out.push(line(`Penjualan ${m}`, rp(v)));
  out.push(line("Total Penjualan", rp(s.sales_total)), hr(), line("Modal Awal", rp(s.opening_cash)),
    line("Penjualan Tunai", rp(s.cash_sales)), line("Pelunasan Bon Tunai", rp(s.credit_payments_cash)),
    line("Pengeluaran", `-${rp(s.expenses_total)}`));
  for (const e of s.expenses || []) out.push(line(`  ${e.category}`, rp(e.amount)));
  out.push(hr(), line("Kas Seharusnya", rp(s.expected_cash)), line("Kas Fisik", rp(s.closing_cash)),
    line("Selisih", rp(s.difference)), "", "", "");
  return out.join("\n");
}

export async function printText(text) {
  if (ch) {
    const enc = new TextEncoder();
    const body = enc.encode(text.normalize("NFKD").replace(/[^\x00-\x7F]/g, "") + "\n");
    const bytes = new Uint8Array([0x1b, 0x40, ...body, 0x1d, 0x56, 0x42, 0x00]);
    await writeBytes(bytes);
    return "bluetooth";
  }
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(f);
  const w = paperWidth() === 80 ? "80mm" : "58mm";
  f.contentDocument.write(`<pre style="font:12px monospace;width:${w};margin:0;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`);
  f.contentDocument.close();
  f.contentWindow.focus();
  f.contentWindow.print();
  setTimeout(() => f.remove(), 2000);
  return "browser";
}
