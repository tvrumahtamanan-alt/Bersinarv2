const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const qf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

export const rp = (n) => `Rp ${nf.format(Math.round(Number(n) || 0))}`;
export const fq = (n) => qf.format(Number(n) || 0);
export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fdt = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const priceFor = (tiers, qty) => {
  if (!tiers || !tiers.length) return { tier_name: "Eceran", price: 0, min_qty: 0 };
  let best = tiers[0];
  for (const t of tiers) if (qty >= t.min_qty) best = t;
  return best;
};

export const parseNum = (s) => Number(String(s ?? "").replace(/\./g, "").replace(",", ".")) || 0;
