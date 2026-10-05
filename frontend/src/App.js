import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import StaffLayout, { NAV } from "@/components/StaffLayout";
import LoginPage from "@/pages/LoginPage";

const POSPage = lazy(() => import("@/pages/pos/POSPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const ShiftsPage = lazy(() => import("@/pages/ShiftsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const StockPage = lazy(() => import("@/pages/StockPage"));
const ReceivePage = lazy(() => import("@/pages/ReceivePage"));
const LowStockPage = lazy(() => import("@/pages/LowStockPage"));
const WastePage = lazy(() => import("@/pages/WastePage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ShopPage = lazy(() => import("@/pages/shop/ShopPage"));
const TrackPage = lazy(() => import("@/pages/shop/TrackPage"));

const PAGES = {
  "/pos": POSPage, "/orders": OrdersPage, "/transactions": TransactionsPage, "/shifts": ShiftsPage,
  "/products": ProductsPage, "/stock": StockPage, "/receive": ReceivePage, "/low-stock": LowStockPage,
  "/waste": WastePage, "/customers": CustomersPage, "/reports": ReportsPage, "/settings": SettingsPage,
};

function Guard({ perms, children }) {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (perms && !can(...perms)) return <div className="page"><div className="card p-6 text-slate-600">Anda tidak memiliki akses ke halaman ini.</div></div>;
  return children;
}

function Home() {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const first = NAV.find(([, , p]) => can(...p));
  return first ? <Navigate to={first[0]} replace /> : <div className="page">Akun Anda belum memiliki hak akses.</div>;
}

const Loading = () => <div className="p-6 text-slate-400 text-sm">Memuat...</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/track/:no" element={<TrackPage />} />
            <Route path="/" element={<Home />} />
            <Route element={<Guard><StaffLayout /></Guard>}>
              {NAV.map(([path, , perms]) => {
                const C = PAGES[path];
                return <Route key={path} path={path} element={<Guard perms={perms}><C /></Guard>} />;
              })}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-center" richColors duration={2200} />
    </AuthProvider>
  );
}
