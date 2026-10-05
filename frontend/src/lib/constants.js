export const LOCATIONS = ["Gudang Utama", "Cabang 1", "Cabang 2"];
export const BRANCHES = ["Cabang 1", "Cabang 2"];
export const CATEGORIES = ["Sayur", "Buah", "Sembako", "Minuman", "Daging", "Lainnya"];
export const UNITS = ["Kg", "Gram", "PCS", "Liter", "Ikat", "Pack", "Sisir", "Butir", "Dus", "Karung", "Botol"];
export const WASTE_REASONS = ["Busuk", "Layu", "Pecah", "Kadaluarsa", "Lainnya"];
export const CAT_COLOR = {
  Sayur: "bg-emerald-500",
  Buah: "bg-orange-500",
  Sembako: "bg-amber-500",
  Minuman: "bg-sky-500",
  Daging: "bg-red-500",
  Lainnya: "bg-slate-400",
};
export const STATUS_COLOR = {
  Menunggu: "bg-amber-100 text-amber-800 border-amber-300",
  Diterima: "bg-sky-100 text-sky-800 border-sky-300",
  Dikemas: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Siap: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Selesai: "bg-slate-200 text-slate-700 border-slate-300",
  Dibatalkan: "bg-red-100 text-red-700 border-red-300",
};
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
