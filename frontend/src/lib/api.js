import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("bs_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const shopApi = axios.create({ baseURL: API, timeout: 15000 });
shopApi.interceptors.request.use((c) => {
  const t = localStorage.getItem("bs_b2b_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (!e?.response) return "Tidak ada koneksi ke server";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e.message || "Terjadi kesalahan";
}
