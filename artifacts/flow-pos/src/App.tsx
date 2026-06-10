import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, type AuthUser, type UserRole } from "@/hooks/use-auth";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

import BranchesPage from "@/pages/branches";
import RolesPage from "@/pages/roles";

// Default landing page per role after login
function defaultRoute(role: UserRole): string {
  switch (role) {
    case "super_admin": return "/admin";
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
    const isAuthPage = location === "/login" || location === "/register";
    if (!user && !isAuthPage) {
      setLocation("/login");
    } else if (user && isAuthPage) {
      setLocation(defaultRoute(user.role));
    } else if (user && (location === "/" || location === "")) {
      setLocation(defaultRoute(user.role));
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

  const isAuthPage = location === "/login" || location === "/register";
  if (!user || isAuthPage) {
    return (
      <Switch>
        <Route path="/login"><LoginPage onLogin={login} /></Route>
        <Route path="/register"><RegisterPage onLogin={login} /></Route>
        <Route><LoginPage onLogin={login} /></Route>
      </Switch>
    );
  }

  return (
    <Layout user={user} onLogout={logout} isImpersonating={isImpersonating} exitImpersonate={exitImpersonate}>
      <Switch>
        {/* Owner / Manager */}
        <Route path="/dashboard"><DashboardPage /></Route>
        <Route path="/reports"><ReportsPage /></Route>
        <Route path="/employees"><EmployeesPage /></Route>
        <Route path="/branches"><BranchesPage /></Route>
        <Route path="/roles"><RolesPage /></Route>
        <Route path="/categories"><CategoriesPage /></Route>
        <Route path="/inventory"><InventoryPage /></Route>
        <Route path="/settings"><SettingsPage /></Route>
        <Route path="/qr-menu"><QrManagerPage /></Route>
        <Route path="/activity-logs"><ActivityLogsPage /></Route>

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
  );
}

function DashboardFallback({ user }: { user: AuthUser }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(defaultRoute(user.role)); }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}
