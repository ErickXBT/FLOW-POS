import { useEffect, useState } from "react";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, type AuthUser, type UserRole, hasPermission } from "@/hooks/use-auth";
import { BranchProvider } from "@/hooks/use-active-branch";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import POSPage from "@/pages/pos";
import ProductsPage from "@/pages/products";
import CategoriesPage from "@/pages/categories";
import OrdersPage from "@/pages/orders";
import CustomersPage from "@/pages/customers";
import EmployeesPage from "@/pages/employees";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import CustomerMenuPage from "@/pages/customer-menu";
import CustomerOrdersPage from "@/pages/customer-orders";
import QrManagerPage from "@/pages/qr-manager";
import KitchenDisplayPage from "@/pages/kitchen-display";
import DeliveryOrdersPage from "@/pages/delivery-orders";
import ActivityLogsPage from "@/pages/activity-logs";
import FlowAIPage from "@/pages/flowai";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

import BranchesPage from "@/pages/branches";
import RolesPage from "@/pages/roles";
import RekapKasPage from "@/pages/rekap-kas";
import MutasiKasPage from "@/pages/mutasi-kas";
import RiwayatCetakStrukPage from "@/pages/riwayat-cetak-struk";
import AmbilStokPage from "@/pages/ambil-stok";
import PrinterSettingsPage from "@/pages/printer-settings";

// Default landing page per role after login
function defaultRoute(user: AuthUser): string {
  if (user.role === "super_admin") return "/admin";
  
  // Custom roles (or standard roles) route selection based on permissions
  if (hasPermission(user, "view_dashboard")) return "/dashboard";
  if (hasPermission(user, "view_pos")) return "/pos";
  if (hasPermission(user, "view_kitchen")) return "/kitchen";
  if (hasPermission(user, "view_delivery")) return "/delivery";
  if (hasPermission(user, "manage_orders")) return "/customer-orders";

  switch (user.role) {
    case "kitchen_staff": return "/kitchen";
    case "delivery_staff": return "/delivery";
    case "cashier": return "/pos";
    case "staff": return "/pos";
    default: return "/dashboard";
  }
}

function PublicMenu() {
  const [location] = useLocation();
  const slug = location.replace(/^\/menu\//, "").split("?")[0];
  return <CustomerMenuPage key={slug} slug={slug} />;
}

function AppRoutes() {
  const [location, setLocation] = useLocation();
  const { user, loading, login, logout, isImpersonating, exitImpersonate } = useAuth();

  const isMenuPage = location.startsWith("/menu/");

  useEffect(() => {
    if (isMenuPage || loading) return;
    const isAuthPage = location === "/login" || location === "/register" || location.startsWith("/reset-password");
    if (!user && !isAuthPage) {
      setLocation("/login");
    } else if (user && isAuthPage) {
      setLocation(defaultRoute(user));
    } else if (user && (location === "/" || location === "")) {
      setLocation(defaultRoute(user));
    }
  }, [user, loading, location, isMenuPage]);

  if (isMenuPage) return <PublicMenu />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">Memuat...</div>
        </div>
      </div>
    );
  }

  const isAuthPage = location === "/login" || location === "/register" || location.startsWith("/reset-password");
  if (!user || isAuthPage) {
    return (
      <Switch>
        <Route path="/login"><LoginPage onLogin={login} /></Route>
        <Route path="/register"><RegisterPage onLogin={login} /></Route>
        <Route path="/reset-password"><ResetPasswordPage /></Route>
        <Route><LoginPage onLogin={login} /></Route>
      </Switch>
    );
  }

  return (
    <BranchProvider user={user}>
      <Layout user={user} onLogout={logout} isImpersonating={isImpersonating} exitImpersonate={exitImpersonate}>
        <Switch>
          {/* Owner / Manager */}
          <Route path="/dashboard"><DashboardPage /></Route>
          <Route path="/flowai"><FlowAIPage /></Route>
          <Route path="/reports"><ReportsPage /></Route>
          <Route path="/employees"><EmployeesPage /></Route>
          <Route path="/branches"><BranchesPage /></Route>
          <Route path="/roles"><RolesPage /></Route>
          <Route path="/categories"><CategoriesPage /></Route>
          <Route path="/inventory"><InventoryPage /></Route>
          <Route path="/settings"><SettingsPage /></Route>
          <Route path="/qr-menu"><QrManagerPage /></Route>
          <Route path="/activity-logs"><ActivityLogsPage /></Route>
          <Route path="/rekap-kas"><RekapKasPage /></Route>
          <Route path="/mutasi-kas"><MutasiKasPage /></Route>
          <Route path="/riwayat-cetak-struk"><RiwayatCetakStrukPage /></Route>
          <Route path="/ambil-stok"><AmbilStokPage /></Route>
          <Route path="/printer-settings"><PrinterSettingsPage /></Route>

          {/* All operational roles */}
          <Route path="/pos"><POSPage /></Route>
          <Route path="/orders"><OrdersPage /></Route>
          <Route path="/customers"><CustomersPage /></Route>
          <Route path="/products"><ProductsPage /></Route>
          <Route path="/customer-orders"><CustomerOrdersPage /></Route>

          {/* Role-specific */}
          <Route path="/kitchen"><KitchenDisplayPage /></Route>
          <Route path="/delivery"><DeliveryOrdersPage /></Route>

          {/* Super admin */}
          <Route path="/admin"><AdminPage /></Route>

          {/* Default fallback */}
          <Route><DashboardFallback user={user} /></Route>
        </Switch>
      </Layout>
    </BranchProvider>
  );
}

function DashboardFallback({ user }: { user: AuthUser }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(defaultRoute(user)); }, [user, setLocation]);
  return null;
}

function GlobalSplashScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1800);

    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!showSplash) return null;

  return (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ zIndex: 99999 }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full bg-white/10 animate-ping duration-1000" />
          <img 
            src={flowLogo} 
            alt="Flow Logo" 
            className="h-12 relative z-10 brightness-0 invert" 
            style={{
              animation: "scaleUpLogo 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
            }}
          />
        </div>
        <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden mt-4 relative">
          <div 
            className="h-full bg-white rounded-full" 
            style={{
              width: "100%",
              animation: "loadProgress 1.6s ease-in-out infinite",
              transformOrigin: "left"
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes scaleUpLogo {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes loadProgress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalSplashScreen />
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}
