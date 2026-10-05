import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/offline";

export function useCatalog(location) {
  const key = `bs_cat_${location}`;
  const [items, setItems] = useState(() => cacheGet(key, []));
  const reload = useCallback(async () => {
    if (!location) return;
    try {
      const { data } = await api.get("/catalog", { params: { location } });
      cacheSet(key, data);
      setItems(data);
    } catch {
      /* offline: keep cache */
    }
  }, [location, key]);
  useEffect(() => {
    setItems(cacheGet(key, []));
    reload();
  }, [key, reload]);
  const adjustLocal = useCallback(
    (deltas) =>
      setItems((prev) => {
        const n = prev.map((p) => (deltas[p.id] ? { ...p, stock: p.stock + deltas[p.id] } : p));
        cacheSet(key, n);
        return n;
      }),
    [key]
  );
  return { items, reload, adjustLocal };
}

export function useDebounced(value, ms = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

export function useFullscreen() {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const f = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  return fs;
}

export const toggleFullscreen = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();

const skey = (u) => `bs_shift_${u?.id}`;
export const getShift = (u) => cacheGet(skey(u));
export const setShiftLocal = (u, s) => (s ? cacheSet(skey(u), s) : localStorage.removeItem(skey(u)));

export function useFetch(fn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fn());
    } catch {
      /* handled by caller toasts */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, reload: load, setData };
}
