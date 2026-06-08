import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Package, Tag, ClipboardList,
  Users, UserCheck, BarChart3, Warehouse, Settings,
  Shield, LogOut, Menu, X, Sun, Moon, QrCode, Smartphone,
  ChefHat, Truck, Activity
} from "lucide-react";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import type { AuthUser } from "@/hooks/use-auth";
import { ROLE_LABELS, hasPermission } from "@/hooks/use-auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Navigation per role
function getNavItems(role: string): NavItem[] {
  switch (role) {
    case "super_admin":
      return [
        { href: "/admin", label: "Super Admin", icon: <Shield size={18} /> },
      ];

    case "owner":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> },
        { href: "/customer-orders", label: "Pesanan Online", icon: <Smartphone size={18} /> },
        { href: "/kitchen", label: "Display Dapur", icon: <ChefHat size={18} /> },
        { href: "/delivery", label: "Delivery", icon: <Truck size={18} /> },
        { href: "/orders", label: "Transaksi", icon: <ClipboardList size={18} /> },
        { href: "/products", label: "Produk", icon: <Package size={18} /> },
        { href: "/categories", label: "Kategori", icon: <Tag size={18} /> },
        { href: "/inventory", label: "Inventori", icon: <Warehouse size={18} /> },
        { href: "/customers", label: "Pelanggan", icon: <Users size={18} /> },
        { href: "/employees", label: "Karyawan", icon: <UserCheck size={18} /> },
        { href: "/reports", label: "Laporan", icon: <BarChart3 size={18} /> },
        { href: "/qr-menu", label: "QR Menu", icon: <QrCode size={18} /> },
        { href: "/activity-logs", label: "Log Aktivitas", icon: <Activity size={18} /> },
        { href: "/settings", label: "Pengaturan", icon: <Settings size={18} /> },
      ];

    case "manager":
      return [
        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> },
        { href: "/customer-orders", label: "Pesanan Online", icon: <Smartphone size={18} /> },
        { href: "/kitchen", label: "Display Dapur", icon: <ChefHat size={18} /> },
        { href: "/delivery", label: "Delivery", icon: <Truck size={18} /> },
        { href: "/orders", label: "Transaksi", icon: <ClipboardList size={18} /> },
        { href: "/products", label: "Produk", icon: <Package size={18} /> },
        { href: "/inventory", label: "Inventori", icon: <Warehouse size={18} /> },
        { href: "/customers", label: "Pelanggan", icon: <Users size={18} /> },
        { href: "/employees", label: "Karyawan", icon: <UserCheck size={18} /> },
        { href: "/reports", label: "Laporan", icon: <BarChart3 size={18} /> },
        { href: "/activity-logs", label: "Log Aktivitas", icon: <Activity size={18} /> },
      ];

    case "cashier":
      return [
        { href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> },
        { href: "/customer-orders", label: "Pesanan Online", icon: <Smartphone size={18} /> },
        { href: "/orders", label: "Transaksi Hari Ini", icon: <ClipboardList size={18} /> },
        { href: "/customers", label: "Pelanggan", icon: <Users size={18} /> },
      ];

    case "kitchen_staff":
      return [
        { href: "/kitchen", label: "Display Dapur", icon: <ChefHat size={18} /> },
      ];

    case "delivery_staff":
      return [
        { href: "/delivery", label: "Pesanan Delivery", icon: <Truck size={18} /> },
      ];

    case "staff":
      return [
        { href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> },
        { href: "/orders", label: "Transaksi", icon: <ClipboardList size={18} /> },
      ];

    default:
      return [
        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      ];
  }
}

// Role color badges
const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  kitchen_staff: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivery_staff: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  staff: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

interface LayoutProps {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(d => !d);
  };

  const navItems = getNavItems(user.role);

  // Kitchen/Delivery staff get full-screen layout (no sidebar)
  const isFullscreen = user.role === "kitchen_staff" || user.role === "delivery_staff";

  if (isFullscreen) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {user.role !== "kitchen_staff" && (
          <header className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
            <img src={flowLogo} alt="Flow" className="h-5 brightness-0 dark:invert opacity-60" />
            <div className="flex-1" />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
            </span>
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <button onClick={onLogout} className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </header>
        )}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <img src={flowLogo} alt="Flow" className="h-8 brightness-0 invert" />
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(item => {
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sm font-bold text-sidebar-primary-foreground flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sidebar-foreground text-sm font-medium truncate">{user.name}</div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${ROLE_COLORS[user.role] ?? ""}`}>
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground opacity-70 hover:opacity-100 hover:bg-sidebar-accent transition-all"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar flex-shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-sidebar flex flex-col z-10">
            <button className="absolute top-4 right-4 text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
