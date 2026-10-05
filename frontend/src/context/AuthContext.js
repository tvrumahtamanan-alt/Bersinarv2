import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/offline";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (localStorage.getItem("bs_token") ? cacheGet("bs_user") : false) || false);
  const [location, setLoc] = useState(() => localStorage.getItem("bs_loc") || "");
  const [store, setStore] = useState(() => cacheGet("bs_store", {}));

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("bs_token")) return setUser(false);
    try {
      const { data } = await api.get("/auth/me");
      cacheSet("bs_user", data);
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.removeItem("bs_token");
        setUser(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    api.get("/settings").then(({ data }) => { setStore(data); cacheSet("bs_store", data); }).catch(() => {});
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (user && !user.allowed_locations.includes(location)) {
      const l = user.allowed_locations.find((x) => x !== "Gudang Utama") || user.allowed_locations[0];
      setLoc(l);
      localStorage.setItem("bs_loc", l);
    }
  }, [user, location]);

  const value = useMemo(() => ({
    user,
    store,
    setStore,
    location,
    setLocation: (l) => { setLoc(l); localStorage.setItem("bs_loc", l); },
    can: (...p) => !!user && p.some((x) => user.permissions.includes(x)),
    login: async (token) => { localStorage.setItem("bs_token", token); await refresh(); },
    logout: () => { localStorage.removeItem("bs_token"); localStorage.removeItem("bs_user"); setUser(false); },
    refresh,
  }), [user, store, location, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
