import { useEffect, useState } from "react";
import { api } from "./api";

const QKEY = "bs_outbox";
const FKEY = "bs_failed";

export const cacheGet = (k, d = null) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
export const cacheSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full */
  }
};

const ENDPOINT = {
  transaction: () => "/transactions",
  shift_open: () => "/shifts/open",
  shift_close: (p) => `/shifts/${p.shift_id}/close`,
  expense: () => "/expenses",
  receipt: () => "/receipts",
};

const emit = () => window.dispatchEvent(new Event("bs-queue"));
export const getQueue = () => cacheGet(QKEY, []);
export const getFailed = () => cacheGet(FKEY, []);

export function enqueue(type, payload) {
  cacheSet(QKEY, [...getQueue(), { id: payload.id || `${Date.now()}`, type, payload: { ...payload, offline: true } }]);
  emit();
}

export async function submitOrQueue(type, payload) {
  if (navigator.onLine) {
    try {
      const { data } = await api.post(ENDPOINT[type](payload), payload);
      return { ok: true, data };
    } catch (e) {
      if (e.response) throw e;
    }
  }
  enqueue(type, payload);
  return { ok: true, queued: true };
}

let syncing = false;
export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    let q = getQueue();
    while (q.length) {
      const item = q[0];
      try {
        await api.post(ENDPOINT[item.type](item.payload), item.payload);
      } catch (e) {
        if (!e.response || e.response.status >= 500 || e.response.status === 401) break;
        cacheSet(FKEY, [...getFailed(), { ...item, error: e.response?.data?.detail || "Gagal" }]);
      }
      q = getQueue().filter((x) => x !== item && x.id !== item.id);
      cacheSet(QKEY, q);
      emit();
    }
  } finally {
    syncing = false;
  }
}

export function useNetwork() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(getQueue().length);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      syncQueue();
    };
    const off = () => setOnline(false);
    const q = () => setPending(getQueue().length);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("bs-queue", q);
    const t = setInterval(syncQueue, 15000);
    syncQueue();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("bs-queue", q);
      clearInterval(t);
    };
  }, []);
  return { online, pending };
}
