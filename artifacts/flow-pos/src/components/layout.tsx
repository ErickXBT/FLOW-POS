import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Package, Tag, ClipboardList,
  Users, UserCheck, BarChart3, Warehouse, Settings,
  Shield, LogOut, Menu, X, Sun, Moon, Smartphone,
  ChefHat, Truck, Activity, MapPin, ShieldCheck, QrCode
} from "lucide-react";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import type { AuthUser } from "@/hooks/use-auth";
import { ROLE_LABELS, hasPermission } from "@/hooks/use-auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
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
  isImpersonating?: boolean;
  exitImpersonate?: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, isImpersonating, exitImpersonate, children }: LayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(d => !d);
  };

  const navItems: NavItem[] = [];

  if (user.role === "super_admin") {
    navItems.push({ href: "/admin", label: "Super Admin", icon: <Shield size={18} /> });
  } else {
    // Normal / Custom tenant users
    if (hasPermission(user, "view_dashboard")) {
      navItems.push({ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> });
    }
    if (hasPermission(user, "view_pos")) {
      navItems.push({ href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> });
    }
    if (hasPermission(user, "manage_orders")) {
      navItems.push({ href: "/customer-orders", label: "Pesanan Online", icon: <Smartphone size={18} /> });
    }
    if (hasPermission(user, "view_kitchen")) {
      navItems.push({ href: "/kitchen", label: "Display Dapur", icon: <ChefHat size={18} /> });
    }
    if (hasPermission(user, "view_delivery")) {
      navItems.push({ href: "/delivery", label: "Delivery", icon: <Truck size={18} /> });
    }
    if (hasPermission(user, "manage_orders")) {
      navItems.push({ href: "/orders", label: "Transaksi", icon: <ClipboardList size={18} /> });
    }
    if (hasPermission(user, "manage_products")) {
      navItems.push({ href: "/products", label: "Produk", icon: <Package size={18} /> });
      navItems.push({ href: "/categories", label: "Kategori", icon: <Tag size={18} /> });
    }
    if (hasPermission(user, "manage_inventory")) {
      navItems.push({ href: "/inventory", label: "Inventori", icon: <Warehouse size={18} /> });
    }
    if (hasPermission(user, "manage_customers")) {
      navItems.push({ href: "/customers", label: "Pelanggan", icon: <Users size={18} /> });
    }
    if (hasPermission(user, "manage_employees")) {
      navItems.push({ href: "/employees", label: "Karyawan", icon: <UserCheck size={18} /> });
    }
    // Only owners can manage branches and roles
    if (user.role === "owner") {
      navItems.push({ href: "/branches", label: "Cabang (Branch)", icon: <MapPin size={18} /> });
      navItems.push({ href: "/roles", label: "Role & Hak Akses", icon: <ShieldCheck size={18} /> });
    }
    if (hasPermission(user, "view_reports")) {
      navItems.push({ href: "/reports", label: "Laporan", icon: <BarChart3 size={18} /> });
    }
    if (hasPermission(user, "manage_qr_menu")) {
      navItems.push({ href: "/qr-menu", label: "QR Menu", icon: <QrCode size={18} /> });
    }
    if (hasPermission(user, "view_activity_logs")) {
      navItems.push({ href: "/activity-logs", label: "Log Aktivitas", icon: <Activity size={18} /> });
    }
    if (hasPermission(user, "manage_settings")) {
      navItems.push({ href: "/settings", label: "Pengaturan", icon: <Settings size={18} /> });
    }
  }

  // Kitchen/Delivery staff get full-screen layout (no sidebar)
  const isFullscreen = user.role === "kitchen_staff" || user.role === "delivery_staff";

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
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sm font-bold text-sidebar-primary-foreground flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sidebar-foreground text-sm font-medium truncate">{user.name}</div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${ROLE_COLORS[user.role] ?? ""}`}>
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
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
    <div className="flex flex-col h-screen overflow-hidden">
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 font-bold px-4 py-2.5 text-center text-xs flex items-center justify-center gap-3 select-none flex-shrink-0 shadow-md z-50 animate-bounce">
          <span>⚠️ Anda sedang menguji coba dasbor {user.branchName ? `Cabang ${user.branchName}` : "Tenant"} sebagai Super Admin</span>
          <button onClick={exitImpersonate} className="bg-amber-950 text-white rounded-lg px-3 py-1 font-semibold hover:bg-black transition-all">
            Keluar Preview
          </button>
        </div>
      )}
      
      {isFullscreen ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {user.role !== "kitchen_staff" && (
            <header className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
              <img src={flowLogo} alt="Flow" className="h-5 brightness-0 dark:invert opacity-60" />
              <div className="flex-1" />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
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
      ) : (
        <div className="flex flex-1 overflow-hidden">
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
              {user.branchName && (
                <div className="flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/25">
                  <MapPin size={12} /> Cabang: {user.branchName}
                </div>
              )}
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
      )}
    </div>
  );
}
