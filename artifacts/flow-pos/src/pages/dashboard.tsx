import { useState, useEffect, useRef } from "react";
import { useGetDashboardStats, useGetRecentOrders, useGetTopProducts, useGetSalesChartData, useListBranches, useGetTenant, useListEmployees, useListProducts, useListCustomers } from "@workspace/api-client-react";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertTriangle, DollarSign, ChefHat, Truck, Clock,
  Bell, FileText, Download, BarChart2, Users2, ShieldAlert, Award, Calendar, Layers, MapPin, Percent,
  MessageSquare, Plus, Trash2, Check, RefreshCw, Smartphone, Clipboard, QrCode, Sparkles, LogIn, Laptop, Globe, Gift,
  Building2, Activity, Lock, UploadCloud, Shirt, ShoppingBag
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

function StatCard({ label, value, sub, icon, trend }: { label: string; value: string; sub?: string; icon: React.ReactNode; trend?: number }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="text-muted-foreground text-sm font-medium">{label}</div>
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend).toFixed(1)}% vs bulan lalu
        </div>
      )}
    </div>
  );
}

function formatRp(val: number) {
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}k`;
  return `Rp ${val.toFixed(0)}`;
}

// ── Cashier Dashboard ─────────────────────────────────────────────────────────
function CashierDashboard({ stats, businessType }: { stats: any; businessType?: string }) {
  const { data: recentOrders } = useGetRecentOrders({ limit: 10 });
  const s = stats || { todaySales: 0, todayOrders: 0 };
  const isFashion = businessType === "fashion";
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Selamat Bekerja!</h1>
        <p className="text-muted-foreground text-sm">Transaksi kasir hari ini</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={18} />} sub={`${s.todayOrders} transaksi`} />
        <StatCard label="Total Transaksi" value={s.todayOrders.toString()} icon={<ShoppingCart size={18} />} sub="Hari ini" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/pos">
          <a className="flex flex-col items-center gap-3 p-6 bg-primary text-primary-foreground rounded-2xl shadow-lg hover:bg-primary/90 transition-colors cursor-pointer">
            <ShoppingCart size={32} />
            <div className="font-bold text-lg">Buka Kasir</div>
            <div className="text-sm opacity-80">Mulai transaksi baru</div>
          </a>
        </Link>
        <Link href="/customer-orders">
          <a className="flex flex-col items-center gap-3 p-6 bg-card border border-card-border rounded-2xl shadow-sm hover:bg-muted transition-colors cursor-pointer">
            <div className="text-3xl">📱</div>
            <div className="font-bold text-foreground">Pesanan Online</div>
            <div className="text-sm text-muted-foreground">{isFashion ? "Dari QR Katalog" : "Dari QR Menu"}</div>
          </a>
        </Link>
      </div>
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-semibold text-foreground">Transaksi Terbaru</div>
        </div>
        <div className="divide-y divide-border/50">
          {(recentOrders || []).length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">Belum ada transaksi hari ini</div>
          ) : (recentOrders || []).slice(0, 8).map(o => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-foreground">{o.orderNumber}</div>
                <div className="text-xs text-muted-foreground capitalize">{o.paymentMethod?.replace("_", " ")}</div>
              </div>
              <div className="font-semibold text-foreground">{formatRp(o.total)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Manager Dashboard ─────────────────────────────────────────────────────────
function ManagerDashboard({ stats, businessType }: { stats: any; businessType?: string }) {
  const { data: recentOrders } = useGetRecentOrders({ limit: 5 });
  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, weeklyRevenue: 0, revenueGrowth: 0 };
  const isFashion = businessType === "fashion";
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard Operasional</h1>
        <p className="text-muted-foreground text-sm">Pantau operasional bisnis harian</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={18} />} sub={`${s.todayOrders} transaksi`} />
        <StatCard label="Revenue Mingguan" value={formatRp(s.weeklyRevenue)} icon={<TrendingUp size={18} />} trend={s.revenueGrowth} />
        <StatCard label="Total Produk" value={s.totalProducts.toString()} icon={<Package size={18} />} sub={s.lowStockCount > 0 ? `⚠️ ${s.lowStockCount} stok rendah` : "Stok aman"} />
        <StatCard label="Pelanggan" value={s.totalCustomers.toString()} icon={<Users size={18} />} />
      </div>
      {s.lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300 font-medium">{s.lowStockCount} produk stok rendah</div>
          <Link href="/inventory">
            <a className="ml-auto text-xs font-semibold text-amber-700 hover:underline">Lihat inventori →</a>
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/pos", icon: <ShoppingCart size={20} />, label: "Kasir", sub: "Buka POS" },
          { href: "/customer-orders", icon: <div className="text-xl">📱</div>, label: "Pesanan Online", sub: isFashion ? "QR Katalog" : "QR Menu" },
          { href: "/inventory", icon: <Package size={20} />, label: "Inventori", sub: "Kelola stok" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <a className="flex flex-col items-center gap-2 p-4 bg-card border border-card-border rounded-xl shadow-sm hover:bg-muted transition-colors cursor-pointer text-center">
              <div className="text-primary">{item.icon}</div>
              <div className="font-semibold text-foreground text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.sub}</div>
            </a>
          </Link>
        ))}
      </div>
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <div className="font-semibold text-foreground">Transaksi Terbaru</div>
          <Link href="/orders"><a className="text-sm text-primary hover:underline">Lihat semua</a></Link>
        </div>
        {(recentOrders || []).length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
            Belum ada transaksi terbaru
          </div>
        ) : (
          (recentOrders || []).slice(0, 5).map(o => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between border-b border-border/50">
              <div className="text-xs font-mono text-foreground">{o.orderNumber}</div>
              <div className="font-semibold text-foreground">{formatRp(o.total)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard({ businessType }: { businessType?: string }) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Selamat Bekerja!</h1>
        <p className="text-muted-foreground text-sm">Menu yang tersedia untuk Anda</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/pos">
          <a className="flex flex-col items-center gap-3 p-8 bg-primary text-primary-foreground rounded-2xl shadow-lg hover:bg-primary/90 transition-colors cursor-pointer">
            <ShoppingCart size={36} />
            <div className="font-bold text-xl">Kasir</div>
          </a>
        </Link>
        <Link href="/orders">
          <a className="flex flex-col items-center gap-3 p-8 bg-card border border-card-border rounded-2xl shadow-sm hover:bg-muted transition-colors cursor-pointer">
            <ClipboardListIcon />
            <div className="font-bold text-xl text-foreground">Transaksi</div>
          </a>
        </Link>
      </div>
    </div>
  );
}

function ClipboardListIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>;
}

// ── Full Owner Dashboard ──────────────────────────────────────────────────────
function OwnerDashboard() {
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);
  const { data: branches } = useListBranches();
  const { data: stats } = useGetDashboardStats({ branchId: selectedBranchId });
  const { data: recentOrders } = useGetRecentOrders({ limit: 10, branchId: selectedBranchId });
  const { data: topProducts } = useGetTopProducts({ limit: 5, branchId: selectedBranchId });
  const { data: chartData } = useGetSalesChartData({ period: "week", branchId: selectedBranchId });
  const { data: tenant } = useGetTenant();
  const plan = tenant?.subscriptionPlan || "trial";
  const isFashion = tenant?.businessType === "fashion";

  // Real-time fetched resources
  const { data: realEmployees } = useListEmployees();
  const { data: productsResult } = useListProducts({ limit: 100 });
  const { data: customersResult } = useListCustomers({ limit: 10 });

  // Tab switching state
  const [activeTab, setActiveTab] = useState("overview");

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Expenses State (Finance) with LocalStorage persistence
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    if (tenant?.id) {
      try {
        const stored = localStorage.getItem(`flow_expenses_${tenant.id}`);
        if (stored) {
          setExpenses(JSON.parse(stored));
          return;
        }
      } catch (err) {}
      setExpenses([]);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (tenant?.id) {
      localStorage.setItem(`flow_expenses_${tenant.id}`, JSON.stringify(expenses));
    }
  }, [expenses, tenant?.id]);

  const [newExpense, setNewExpense] = useState({ desc: "", category: "Operasional", amount: "" });

  // Attendance State (Employees) - dynamically updated
  const [attendance, setAttendance] = useState<any[]>([]);

  // Branch Comparison state
  const [branchComparison, setBranchComparison] = useState<any[]>([]);

  // Marketing Tools State
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    if (tenant?.id) {
      try {
        const stored = localStorage.getItem(`flow_coupons_${tenant.id}`);
        if (stored) {
          setCoupons(JSON.parse(stored));
          return;
        }
      } catch (err) {}
      setCoupons([]);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (tenant?.id) {
      localStorage.setItem(`flow_coupons_${tenant.id}`, JSON.stringify(coupons));
    }
  }, [coupons, tenant?.id]);

  const [newCoupon, setNewCoupon] = useState({ code: "", discount: "", desc: "" });

  const [marketingBanners, setMarketingBanners] = useState<any[]>([]);

  useEffect(() => {
    if (tenant?.id) {
      try {
        const stored = localStorage.getItem(`flow_marketing_banners_${tenant.id}`);
        if (stored) {
          setMarketingBanners(JSON.parse(stored));
          return;
        }
      } catch (err) {}
      
      const defaults = isFashion ? [
        { id: 1, title: "Spesial Weekend: Diskon 20% Koleksi Denim", bgColor: "#8B5CF6", textColor: "#FFFFFF" },
        { id: 2, title: "Promo Member Baru: Cashback Rp 50.000", bgColor: "#10B981", textColor: "#FFFFFF" },
      ] : [
        { id: 1, title: "Spesial Weekend: Beli 1 Gratis 1 Latte", bgColor: "#1D4EF5", textColor: "#FFFFFF" },
        { id: 2, title: "Diskon 20% bagi Pelanggan Setia POS", bgColor: "#10B981", textColor: "#FFFFFF" },
      ];
      setMarketingBanners(defaults);
      localStorage.setItem(`flow_marketing_banners_${tenant.id}`, JSON.stringify(defaults));
    }
  }, [tenant?.id, isFashion]);

  useEffect(() => {
    if (tenant?.id) {
      localStorage.setItem(`flow_marketing_banners_${tenant.id}`, JSON.stringify(marketingBanners));
    }
  }, [marketingBanners, tenant?.id]);

  const [newBanner, setNewBanner] = useState({ title: "", bgColor: "#1D4EF5", textColor: "#FFFFFF", imageUrl: "", linkedProductId: "" });
  const [bannerType, setBannerType] = useState<"text" | "image">("text");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState("");
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  
  // WhatsApp Mock Promotion Dispatcher State
  const [waPromo, setWaPromo] = useState({ segment: "all", couponCode: "KOPIASIK", message: "Halo Kawan Flow! Dapatkan promo diskon spesial 15% khusus hari ini dengan kode kupon" });
  const [waSending, setWaSending] = useState(false);
  const [waSentCount, setWaSentCount] = useState<number | null>(null);

  // Live Operations Simulator State (Separate simulated list from database list)
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedOrders, setSimulatedOrders] = useState<any[]>([]);
  const [simulatedKitchen, setSimulatedKitchen] = useState<any[]>([]);
  const [simulatedNotifs, setSimulatedNotifs] = useState<any[]>([]);

  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [kitchenQueue, setKitchenQueue] = useState<any[]>([]);

  // QR Menu Settings State
  const [qrSettings, setQrSettings] = useState({
    themeColor: "#1D4EF5",
    typography: "Inter",
    enableDelivery: true,
    deliveryFee: 12000,
    cashActive: true,
    qrisActive: true,
    vaActive: false
  });

  // Report Export Loaders State
  const [exportLoading, setExportLoading] = useState<Record<string, number>>({});

  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, monthlyRevenue: 0, weeklyRevenue: 0, revenueGrowth: 0 };
  const isDemo = tenant?.slug === "budi-resto" || tenant?.slug === "freshmood";
  const isFreshTenant = isDemo ? (stats ? (stats.totalProducts === 0 && stats.todayOrders === 0) : false) : (!simulationActive);

  // Sync attendance with real employees dynamically
  useEffect(() => {
    if (realEmployees) {
      const mapped = realEmployees.map((emp: any) => {
        const roleLabels: Record<string, string> = {
          manager: "Manager",
          cashier: isFashion ? "Kasir Retail" : "Kasir",
          kitchen_staff: isFashion ? "Stylist" : "Dapur",
          delivery_staff: isFashion ? "Kurir Toko" : "Kurir",
          staff: "Staff",
        };
        return {
          id: emp.id,
          name: emp.name,
          role: roleLabels[emp.role] || emp.role,
          checkIn: emp.isActive ? "08:00" : null,
          status: emp.isActive ? "Tepat Waktu" : "Tidak Aktif",
          sales: emp.role === "cashier" ? (isFreshTenant ? 0 : 500000) : 0,
        };
      });
      setAttendance(mapped);
    } else {
      setAttendance([]);
    }
  }, [realEmployees, isFashion, isFreshTenant]);

  // Sync Coupons based on defaults & business type (only for demo tenants)
  useEffect(() => {
    if (isDemo && tenant?.id) {
      const stored = localStorage.getItem(`flow_coupons_${tenant.id}`);
      if (!stored || JSON.parse(stored).length === 0) {
        let defaults = [];
        if (isFashion) {
          defaults = [
            { id: 1, code: "FASHION20", discount: 20, desc: "Diskon pakaian khusus akhir pekan", status: "Aktif" },
            { id: 2, code: "DENIMWEEKEND", discount: 15, desc: "Promo produk denim di QR Katalog", status: "Aktif" },
            { id: 3, code: "HEBATSENIN", discount: 10, desc: "Diskon weekday Senin pagi", status: "Expired" },
          ];
        } else {
          defaults = [
            { id: 1, code: "KOPIASIK", discount: 15, desc: "Diskon menu kopi khusus akhir pekan", status: "Aktif" },
            { id: 2, code: "FLOWBARU", discount: 20, desc: "Promo pengguna baru QR Menu", status: "Aktif" },
            { id: 3, code: "HEBATSENIN", discount: 10, desc: "Diskon weekday Senin pagi", status: "Expired" },
          ];
        }
        setCoupons(defaults);
        localStorage.setItem(`flow_coupons_${tenant.id}`, JSON.stringify(defaults));
      }
    }
  }, [isFashion, isDemo, tenant?.id]);

  // Initialize mock expenses for demo tenants if none exist
  useEffect(() => {
    if (isDemo && tenant?.id) {
      const stored = localStorage.getItem(`flow_expenses_${tenant.id}`);
      if (!stored || JSON.parse(stored).length === 0) {
        const demoExpenses = [
          { id: 1, desc: "Sewa Tempat (Bulanan)", category: "Operasional", amount: 4500000, date: "2026-06-01" },
          { id: 2, desc: "Gaji Karyawan (Grup)", category: "Gaji", amount: 7800000, date: "2026-06-05" },
          { id: 3, desc: "Biji Kopi & Bahan Baku", category: "Bahan Baku", amount: 3200000, date: "2026-06-07" },
          { id: 4, desc: "Listrik & Internet", category: "Utilitas", amount: 1150000, date: "2026-06-08" },
        ];
        setExpenses(demoExpenses);
        localStorage.setItem(`flow_expenses_${tenant.id}`, JSON.stringify(demoExpenses));
      }
    }
  }, [isDemo, tenant?.id]);

  // Fetch Activity Logs
  useEffect(() => {
    const token = localStorage.getItem("flow_token") ?? "";
    const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
    async function fetchLogs() {
      try {
        const res = await fetch(`${BASE_PATH}/api/activity-logs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          setActivityLogs(d.data || []);
        }
      } catch (err) {}
    }
    fetchLogs();
    const iv = setInterval(fetchLogs, 15000);
    return () => clearInterval(iv);
  }, []);

  // Fetch Realtime customer orders & branches comparison
  useEffect(() => {
    const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
    const token = localStorage.getItem("flow_token") ?? "";
    
    function calculateElapsed(iso: string) {
      const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (secs < 60) return "Baru saja";
      if (secs < 3600) return `${Math.floor(secs / 60)} mnt lalu`;
      return `${Math.floor(secs / 3600)} jam lalu`;
    }

    async function loadRealtimeData() {
      try {
        let url = `${BASE_PATH}/api/tenant/customer-orders?limit=20`;
        if (selectedBranchId) url += `&branchId=${selectedBranchId}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          const allOrders = d.data ?? [];
          
          // Map to liveOrders
          const mappedLive = allOrders.map((o: any) => ({
            id: o.id,
            number: o.orderNumber,
            customer: o.customerName,
            total: Number(o.total),
            time: calculateElapsed(o.createdAt),
            type: o.orderType,
            status: o.status === "pending" ? "Menunggu" :
                    o.status === "confirmed" ? "Dikonfirmasi" :
                    o.status === "preparing" ? (isFashion ? "Sedang Dipacking" : "Dimasak") :
                    o.status === "ready" ? (isFashion ? "Siap Kirim" : "Siap") :
                    o.status === "on_delivery" ? "Dikirim" :
                    o.status === "completed" ? "Selesai" : "Dibatalkan"
          }));
          setLiveOrders(mappedLive.slice(0, 10));

          // Map active orders to kitchenQueue
          const activeOrders = allOrders.filter((o: any) => ["pending", "confirmed", "preparing"].includes(o.status));
          const mappedKitchen: any[] = [];
          activeOrders.forEach((o: any) => {
            o.items?.forEach((item: any) => {
              mappedKitchen.push({
                id: item.id,
                name: item.productName,
                table: o.tableNumber ? (isFashion ? `Fitting Room ${o.tableNumber}` : `Meja ${o.tableNumber}`) : o.orderType === "delivery" ? "Delivery" : "Take Away",
                qty: item.quantity,
                notes: item.notes || "",
                status: o.status === "pending" ? "Antre" : o.status === "confirmed" ? "Antre" : "Dimasak"
              });
            });
          });
          setKitchenQueue(mappedKitchen);
        }

        // Also fetch branch comparison
        const compRes = await fetch(`${BASE_PATH}/api/reports/branches-comparison`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (compRes.ok) {
          const compData = await compRes.json();
          setBranchComparison(compData);
        }
      } catch (err) {}
    }
    
    loadRealtimeData();
    const iv = setInterval(loadRealtimeData, 10000);
    return () => clearInterval(iv);
  }, [selectedBranchId, isFashion]);

  // Generate real-time notifications from low-stock, recent orders, and activity logs
  useEffect(() => {
    const list: any[] = [];
    
    // 1. Low stock alerts
    const lowStockProducts = (productsResult?.data || []).filter((p: any) => p.stock <= p.minStock);
    if (lowStockProducts.length > 0) {
      lowStockProducts.forEach((p: any) => {
        list.push({
          id: `stock-${p.id}`,
          title: "Stok Rendah",
          body: `${p.name} tersisa ${p.stock} unit.`,
          time: "Sekarang",
          type: "stock",
          read: false
        });
      });
    }

    // 2. Recent orders
    if (recentOrders && recentOrders.length > 0) {
      recentOrders.forEach((o: any) => {
        list.push({
          id: `order-${o.id}`,
          title: o.status === "completed" ? "Pesanan Selesai" : "Pesanan Baru",
          body: `Order ${o.orderNumber} oleh ${o.customerName || "Pelanggan"} senilai ${formatRp(Number(o.total))}.`,
          time: "Baru saja",
          type: "order",
          read: false
        });
      });
    }

    // 3. Activity logs
    if (activityLogs && activityLogs.length > 0) {
      activityLogs.forEach((log: any) => {
        list.push({
          id: `log-${log.id}`,
          title: log.action,
          body: `${log.userName} (${log.userRole}): ${log.action}`,
          time: "Aktivitas",
          type: "activity",
          read: false
        });
      });
    }

    setNotifications(list.slice(0, 10));
  }, [recentOrders, productsResult, activityLogs]);

  // Simulation timer for dynamic orders incoming
  useEffect(() => {
    if (!simulationActive) {
      setSimulatedOrders([]);
      setSimulatedKitchen([]);
      setSimulatedNotifs([]);
      return;
    }
    const interval = setInterval(() => {
      const names = ["Erick", "Roni", "Bella", "Gabriella", "Kevin", "Farhan", "Jessica"];
      const randName = names[Math.floor(Math.random() * names.length)];
      const randTotal = isFashion
        ? Math.floor(Math.random() * 4) * 50000 + 99000
        : Math.floor(Math.random() * 8) * 15000 + 20000;
      const orderNum = `FLW-${Math.floor(Math.random() * 9000 + 1000)}`;

      // Add to simulated live orders
      const newOrd = {
        id: Date.now(),
        number: orderNum,
        customer: randName,
        total: randTotal,
        time: "Baru Saja",
        type: Math.random() > 0.5 ? "delivery" : "take_away",
        status: "Baru"
      };
      setSimulatedOrders(prev => [newOrd, ...prev.slice(0, 5)]);

      // Add to simulated kitchen queue
      const items = isFashion
        ? ["Oversized Black Tee (M)", "Slim Fit Denim Jeans (Size 32)", "Linen Summer Dress (S)", "Cotton Socks 3-Pack", "Canvas Tote Bag"]
        : ["Kopi Susu Gula Aren", "Americano", "Chicken Rice Bowl", "French Fries", "Waffle Matcha"];
      const randItem = items[Math.floor(Math.random() * items.length)];

      const notes = isFashion
        ? ["Minta bungkus kado", "Pasang hangtag baru", "Setrika uap dulu", "Tolong periksa jahitan"]
        : ["Es dikurangi", "Kurang manis", "Ekstra pedas", "Hangatkan"];
      const randNotes = Math.random() > 0.7 ? notes[Math.floor(Math.random() * notes.length)] : "";

      const newKit = {
        id: Date.now() + 1,
        name: randItem,
        table: isFashion
          ? (Math.random() > 0.5 ? `Fitting Room ${Math.floor(Math.random() * 5 + 1)}` : "Delivery")
          : `Meja ${Math.floor(Math.random() * 15 + 1)}`,
        qty: Math.floor(Math.random() * 2) + 1,
        notes: randNotes,
        status: "Antre"
      };
      setSimulatedKitchen(prev => [newKit, ...prev]);

      // Add to simulated notifications
      const newNotif = {
        id: Date.now() + 2,
        title: "Pesanan Baru Masuk (Simulasi)",
        body: `Pesanan ${orderNum} oleh ${randName} masuk senilai ${formatRp(randTotal)}.`,
        time: "Baru Saja",
        type: "order",
        read: false
      };
      setSimulatedNotifs(prev => [newNotif, ...prev]);

    }, 15000);

    return () => clearInterval(interval);
  }, [simulationActive, isFashion]);

  // Clear mock/simulated data if simulation is toggled off
  useEffect(() => {
    if (isFreshTenant && !simulationActive && tenant?.id) {
      if (isDemo) {
        setExpenses([
          { id: 1, desc: "Sewa Tempat (Bulanan)", category: "Operasional", amount: 4500000, date: "2026-06-01" },
          { id: 2, desc: "Gaji Karyawan (Grup)", category: "Gaji", amount: 7800000, date: "2026-06-05" },
          { id: 3, desc: "Biji Kopi & Bahan Baku", category: "Bahan Baku", amount: 3200000, date: "2026-06-07" },
          { id: 4, desc: "Listrik & Internet", category: "Utilitas", amount: 1150000, date: "2026-06-08" },
        ]);
        let defaults = [];
        if (isFashion) {
          defaults = [
            { id: 1, code: "FASHION20", discount: 20, desc: "Diskon pakaian khusus akhir pekan", status: "Aktif" },
            { id: 2, code: "DENIMWEEKEND", discount: 15, desc: "Promo produk denim di QR Katalog", status: "Aktif" },
            { id: 3, code: "HEBATSENIN", discount: 10, desc: "Diskon weekday Senin pagi", status: "Expired" },
          ];
        } else {
          defaults = [
            { id: 1, code: "KOPIASIK", discount: 15, desc: "Diskon menu kopi khusus akhir pekan", status: "Aktif" },
            { id: 2, code: "FLOWBARU", discount: 20, desc: "Promo pengguna baru QR Menu", status: "Aktif" },
            { id: 3, code: "HEBATSENIN", discount: 10, desc: "Diskon weekday Senin pagi", status: "Expired" },
          ];
        }
        setCoupons(defaults);
        localStorage.setItem(`flow_coupons_${tenant.id}`, JSON.stringify(defaults));
      }
      setLiveOrders([]);
      setKitchenQueue([]);
      setNotifications([]);
    }
  }, [isFreshTenant, simulationActive, isDemo, isFashion, tenant?.id]);

  // Financial calculations
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const estimatedGrossProfit = isDemo ? (s.monthlyRevenue || 14850000) : (s.monthlyRevenue || 0);
  const estimatedNetProfit = estimatedGrossProfit - totalExpenses;

  // Add Expense function
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.desc.trim() || !newExpense.amount) return;
    const expObj = {
      id: Date.now(),
      desc: newExpense.desc,
      category: newExpense.category,
      amount: Number(newExpense.amount),
      date: new Date().toISOString().split("T")[0]
    };
    setExpenses(prev => [expObj, ...prev]);
    setNewExpense({ desc: "", category: "Operasional", amount: "" });
  };

  // Add Coupon function
  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code.trim() || !newCoupon.discount) return;
    const coupObj = {
      id: Date.now(),
      code: newCoupon.code.toUpperCase().replace(/\s+/g, ""),
      discount: Number(newCoupon.discount),
      desc: newCoupon.desc || "Kupon baru",
      status: "Aktif"
    };
    setCoupons(prev => {
      const next = [coupObj, ...prev];
      if (tenant?.id) {
        localStorage.setItem(`flow_coupons_${tenant.id}`, JSON.stringify(next));
      }
      return next;
    });
    setNewCoupon({ code: "", discount: "", desc: "" });
  };

  // Delete Coupon function
  const handleDeleteCoupon = (id: number) => {
    setCoupons(prev => {
      const next = prev.filter(c => c.id !== id);
      if (tenant?.id) {
        localStorage.setItem(`flow_coupons_${tenant.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Add Banner function and delete banner function
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBannerUploadError("File harus berupa gambar");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError("Ukuran gambar maksimal 5MB");
      return;
    }

    setBannerUploading(true);
    setBannerUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const token = localStorage.getItem("flow_token");
          const res = await fetch("/api/products/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              name: file.name,
              base64,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Gagal mengunggah gambar");
          }

          const data = await res.json();
          setNewBanner(p => ({ ...p, imageUrl: data.imageUrl }));
        } catch (err: any) {
          setBannerUploadError(err.message || "Gagal mengunggah gambar");
        } finally {
          setBannerUploading(false);
        }
      };
      reader.onerror = () => {
        setBannerUploadError("Gagal membaca file");
        setBannerUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setBannerUploadError("Terjadi kesalahan saat memproses gambar");
      setBannerUploading(false);
    }
  };

  const handleAddBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (bannerType === "text" && !newBanner.title.trim()) return;
    if (bannerType === "image" && !newBanner.imageUrl) {
      setBannerUploadError("Silakan unggah gambar terlebih dahulu");
      return;
    }

    const banObj = {
      id: Date.now(),
      title: newBanner.title,
      bgColor: bannerType === "text" ? newBanner.bgColor : "",
      textColor: bannerType === "text" ? newBanner.textColor : "",
      imageUrl: bannerType === "image" ? newBanner.imageUrl : "",
      linkedProductId: newBanner.linkedProductId ? Number(newBanner.linkedProductId) : null
    };

    setMarketingBanners(prev => {
      const next = [banObj, ...prev];
      if (tenant?.id) {
        localStorage.setItem(`flow_marketing_banners_${tenant.id}`, JSON.stringify(next));
      }
      return next;
    });
    setNewBanner({ title: "", bgColor: "#1D4EF5", textColor: "#FFFFFF", imageUrl: "", linkedProductId: "" });
  };

  const handleDeleteBanner = (id: number) => {
    setMarketingBanners(prev => {
      const next = prev.filter(b => b.id !== id);
      if (tenant?.id) {
        localStorage.setItem(`flow_marketing_banners_${tenant.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Dispatch WA promotions
  const handleSendWa = (e: React.FormEvent) => {
    e.preventDefault();
    setWaSending(true);
    setWaSentCount(null);
    setTimeout(() => {
      setWaSending(false);
      const counts: Record<string, number> = { all: 182, loyal: 54, inactive: 48 };
      setWaSentCount(counts[waPromo.segment] || 120);
    }, 2000);
  };

  // Export report animation handler
  const handleExport = (type: string) => {
    setExportLoading(prev => ({ ...prev, [type]: 0 }));
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setExportLoading(prev => ({ ...prev, [type]: progress }));
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setExportLoading(prev => {
            const copy = { ...prev };
            delete copy[type];
            return copy;
          });
          alert(`Laporan ${type.toUpperCase()} berhasil diunduh!`);
        }, 800);
      }
    }, 200);
  };

  // Derived state calculations
  const lowStockProducts = (productsResult?.data || []).filter((p: any) => p.stock <= p.minStock);
  const realCustomers = customersResult?.data || [];
  
  const loyaltyLeaderboard = realCustomers.map((cust: any) => ({
    name: cust.name,
    level: cust.membershipLevel ? (cust.membershipLevel.charAt(0).toUpperCase() + cust.membershipLevel.slice(1)) : "Regular",
    count: cust.totalOrders ?? 0,
    points: cust.loyaltyPoints ?? 0,
    spent: Number(cust.totalSpent) || 0
  })).sort((a, b) => b.points - a.points);

  const totalSoldTop = (topProducts || []).reduce((acc, p) => acc + (p.totalSold || 0), 0);
  const favoriteProducts = (topProducts || []).map((p, idx) => {
    const colors = ["bg-blue-600", "bg-indigo-600", "bg-green-600", "bg-amber-600", "bg-pink-600"];
    const pct = totalSoldTop > 0 ? Math.round((p.totalSold / totalSoldTop) * 100) : 0;
    return {
      name: p.name,
      pct,
      color: colors[idx % colors.length]
    };
  });

  const totalCust = stats?.totalCustomers || 0;
  const customerChartData = [
    { label: "Jan", count: Math.round(totalCust * 0.6) },
    { label: "Feb", count: Math.round(totalCust * 0.7) },
    { label: "Mar", count: Math.round(totalCust * 0.8) },
    { label: "Apr", count: Math.round(totalCust * 0.9) },
    { label: "Mei", count: Math.round(totalCust * 0.95) },
    { label: "Jun", count: totalCust }
  ];

  const w1_masuk = Math.round(estimatedGrossProfit * 0.2);
  const w2_masuk = Math.round(estimatedGrossProfit * 0.3);
  const w3_masuk = Math.round(estimatedGrossProfit * 0.25);
  const w4_masuk = estimatedGrossProfit - (w1_masuk + w2_masuk + w3_masuk);

  const w1_keluar = Math.round(totalExpenses * 0.3);
  const w2_keluar = Math.round(totalExpenses * 0.2);
  const w3_keluar = Math.round(totalExpenses * 0.2);
  const w4_keluar = totalExpenses - (w1_keluar + w2_keluar + w3_keluar);

  const cashFlowData = [
    { label: "W1", masuk: w1_masuk, keluar: w1_keluar },
    { label: "W2", masuk: w2_masuk, keluar: w2_keluar },
    { label: "W3", masuk: w3_masuk, keluar: w3_keluar },
    { label: "W4", masuk: w4_masuk, keluar: w4_keluar }
  ];

  const sortedBranches = [...branchComparison].sort((a, b) => b.sales - a.sales);
  const bestBranch = sortedBranches[0];

  const refundedOrders = (recentOrders || []).filter((o: any) => o.status === "refunded");

  const combinedLiveOrders = [...simulatedOrders, ...liveOrders].slice(0, 10);
  const combinedKitchenQueue = [...simulatedKitchen, ...kitchenQueue];
  const combinedNotifications = [...simulatedNotifs, ...notifications].slice(0, 10);
  const unreadNotifs = combinedNotifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Dashboard */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-lg font-mono">
            {isFashion ? <Shirt size={20} className="text-primary animate-pulse" /> : "F"}
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              {isFashion ? "Dasbor Toko Fashion" : "Dasbor Bisnis"} <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">PRO</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {isFashion ? "Monitoring operasional ritel & butik secara realtime" : "Monitoring operasional multi-cabang secara realtime"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Branch filter quick selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Outlet:</span>
            <select
              value={selectedBranchId || ""}
              onChange={e => setSelectedBranchId(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold min-w-[140px]"
            >
              <option value="">Semua Cabang</option>
              {((branches || []) as any[]).map((b: any) => (
                <option key={b.id} value={b.id} className={b.status === "locked" ? "text-red-500 font-bold" : ""}>
                  {b.status === "locked" ? `🔒 [TERKUNCI] ${b.name}` : b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Toggle */}
          <button
            onClick={() => setSimulationActive(!simulationActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              simulationActive
                ? "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400"
                : "border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            <Sparkles size={12} className={simulationActive ? "animate-pulse" : ""} />
            <span>{simulationActive ? "Simulasi ON" : "Simulasi OFF"}</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all relative shadow-sm"
            >
              <Bell size={16} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">
                  {unreadNotifs}
                </span>
              )}
            </button>

            {/* Notification Center Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-card border border-card-border rounded-2xl shadow-xl p-4 z-50 space-y-3 animate-fade-in max-h-[420px] overflow-y-auto">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Bell size={14} className="text-primary" /> Pusat Notifikasi
                  </span>
                  <button
                    onClick={() => {
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    }}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    Tandai dibaca
                  </button>
                </div>
                <div className="space-y-2.5">
                  {combinedNotifications.map(n => (
                    <div key={n.id} className={`p-2.5 rounded-xl text-xs space-y-1 transition-all ${n.read ? "bg-muted/10" : "bg-primary/5 border-l-2 border-primary"}`}>
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-foreground">{n.title}</span>
                        <span className="text-[9px] text-muted-foreground">{n.time}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Navigation Panel */}
        <aside className="bg-card border border-card-border rounded-2xl p-3 md:p-4 shadow-sm h-fit flex flex-row overflow-x-auto md:flex-col gap-1.5 md:space-y-1 md:col-span-1 no-scrollbar">
          {[
            { id: "overview", label: "Ringkasan", icon: BarChart2 },
            { id: "realtime", label: "Operasi Live", icon: Clock },
            { id: "multibranch", label: "Multi-Cabang", icon: Building2 },
            { id: "customers", label: "Pelanggan", icon: Users2 },
            { id: "finance", label: "Keuangan", icon: DollarSign },
            { id: "employees", label: "Karyawan", icon: Users },
            { id: "marketing", label: "Pemasaran", icon: Gift },
            { id: "export", label: "Ekspor", icon: Download },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowNotifications(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 md:px-4 md:py-3 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap flex-shrink-0 md:w-full md:gap-3 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content View Container */}
        <main className="md:col-span-4 space-y-6">
          {selectedBranchId && ((branches || []) as any[]).find(b => b.id === selectedBranchId)?.status === "locked" && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-pulse">
              <Lock size={14} className="flex-shrink-0" />
              <div className="text-xs font-semibold">
                Cabang <strong>{((branches || []) as any[]).find(b => b.id === selectedBranchId)?.name}</strong> saat ini terkunci karena melampaui batas limit paket langganan Anda ({plan.toUpperCase()}).
                Silakan tingkatkan paket langganan Anda melalui Super Admin untuk mengaktifkannya kembali.
              </div>
            </div>
          )}
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={16} />} sub={`${s.todayOrders} transaksi`} />
                <StatCard label="Revenue Bulanan" value={formatRp(estimatedGrossProfit)} icon={<TrendingUp size={16} />} trend={isFreshTenant ? undefined : (s.revenueGrowth || 8.4)} />
                <StatCard label="Barang Stok Rendah" value={s.lowStockCount.toString()} icon={<Package size={16} />} sub={s.lowStockCount > 0 ? "⚠️ Butuh Restock" : "Stok aman"} />
                <StatCard label="Kehadiran Staf" value={attendance.length > 0 ? `${attendance.filter(a => a.checkIn).length}/${attendance.length}` : "0"} icon={<Users size={16} />} sub={attendance.length > 0 ? "Shift Pagi Aktif" : "Belum ada staf"} />
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">Tren Pendapatan Mingguan</h3>
                      <p className="text-xs text-muted-foreground">7 hari terakhir penjualan</p>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{formatRp(isDemo ? (s.weeklyRevenue || 3450000) : (s.weeklyRevenue || 0))} / Mgg</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData || []}>
                      <defs>
                        <linearGradient id="ownerSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isFashion ? "#8B5CF6" : "#1D4EF5"} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={isFashion ? "#8B5CF6" : "#1D4EF5"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v), "Pendapatan"]} />
                      <Area type="monotone" dataKey="revenue" stroke={isFashion ? "#8B5CF6" : "#1D4EF5"} strokeWidth={2} fill="url(#ownerSalesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-foreground text-sm">Produk Terlaris</h3>
                  <div className="space-y-3">
                    {(topProducts || []).length === 0 ? (
                      <div className="text-center py-12 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada transaksi
                      </div>
                    ) : (topProducts || []).map((p, i) => (
                      <div key={p.productId} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.totalSold} terjual</div>
                        </div>
                        <div className="text-xs font-semibold text-primary">{formatRp(p.revenue)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warnings and Quick actions */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-500" /> Peringatan Stok & Inventori
                  </h4>
                  <div className="space-y-2">
                    {lowStockProducts.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Semua stok produk aman
                      </div>
                    ) : (
                      lowStockProducts.slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center text-xs p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground">{p.name}</span>
                            <p className="text-[10px] text-muted-foreground">Sisa {p.stock} Pcs (Min: {p.minStock} Pcs)</p>
                          </div>
                          <Link href="/inventory"><a className="text-[10px] font-bold text-amber-600 hover:underline">Restock →</a></Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Pantauan Staf Kehadiran</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Staf shift aktif yang bertugas hari ini.</p>
                  </div>
                  {attendance.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl mt-4 flex-1 flex items-center justify-center">
                      {isFreshTenant ? "Belum ada karyawan terdaftar" : "Tidak ada staf shift aktif hari ini"}
                    </div>
                  ) : (
                    <div className="flex gap-2.5 mt-4 overflow-x-auto">
                      {attendance.map(a => (
                        <div key={a.id} className="flex flex-col items-center p-2 border border-border rounded-xl min-w-[70px]">
                          <span className="text-base">👤</span>
                          <span className="text-[10px] font-bold text-foreground truncate max-w-[60px]">{a.name.split(" ")[0]}</span>
                          <span className="text-[8px] text-muted-foreground mt-0.5">{a.role}</span>
                          <span className={`text-[7px] font-bold uppercase mt-1 px-1 py-0.5 rounded ${a.status === "Tepat Waktu" ? "bg-green-100 text-green-700 dark:bg-green-950/20" : "bg-red-100 text-red-700 dark:bg-red-950/20"}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Live Operations */}
          {activeTab === "realtime" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Activity size={16} className="text-red-500 animate-pulse" /> Operasional Realtime Toko
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isFashion ? "Pantau antrean pesanan masuk, status pengemasan (packing), dan kurir aktif." : "Pantau antrean pesanan masuk, status dapur, dan kurir aktif."}
                  </p>
                </div>
                {simulationActive && (
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Simulasi Order Aktif
                  </span>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Realtime incoming orders */}
                <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm space-y-3 md:col-span-1">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <ShoppingCart size={13} className="text-primary" /> Pesanan Masuk
                  </h4>
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {combinedLiveOrders.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada pesanan masuk
                      </div>
                    ) : (
                      combinedLiveOrders.map(lo => (
                        <div key={lo.id} className="bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-mono font-bold text-primary">{lo.number}</span>
                            <span className="text-muted-foreground">{lo.time}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-foreground capitalize">{lo.customer}</span>
                              <p className="text-[9px] text-muted-foreground capitalize">{lo.type.replace("_", " ")}</p>
                            </div>
                            <span className="font-bold text-foreground">{formatRp(lo.total)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] border-t border-border/50 pt-1.5">
                            <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              lo.status === "Siap Kirim" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/20" :
                              lo.status === "Sedang Dimasak" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20" :
                              "bg-green-100 text-green-700 dark:bg-green-950/20"
                            }`}>
                              {lo.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Kitchen Queue */}
                <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm space-y-3 md:col-span-2">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    {isFashion ? <ShoppingBag size={13} className="text-primary" /> : <ChefHat size={13} className="text-primary" />}
                    {isFashion ? "Antrean Pengemasan (Packing Display)" : "Antrean Dapur (Kitchen Display)"}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {combinedKitchenQueue.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        {isFashion ? "Belum ada antrean pengemasan" : "Belum ada antrean di dapur"}
                      </div>
                    ) : (
                      combinedKitchenQueue.map(kq => (
                        <div key={kq.id} className="border border-border rounded-xl p-3 bg-background flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex justify-between items-start text-xs">
                              <span className="font-bold text-foreground">{kq.name}</span>
                              <span className="font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">x{kq.qty}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                              <span>{kq.table}</span>
                              <span className={`font-semibold uppercase text-[8px] ${kq.status === "Dimasak" ? "text-amber-500" : kq.status === "Siap Saji" ? "text-green-500" : "text-muted-foreground"}`}>
                                {isFashion
                                  ? (kq.status === "Antre" ? "Menunggu" : kq.status === "Dimasak" ? "Dipacking" : "Siap Kirim")
                                  : kq.status
                                }
                              </span>
                            </div>
                            {kq.notes && <div className="text-[9px] text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md mt-1.5 italic">Catatan: {kq.notes}</div>}
                          </div>
                          <div className="flex gap-1.5 border-t border-border/60 pt-2">
                            {kq.status === "Antre" && (
                              <button
                                onClick={() => {
                                  setSimulatedKitchen(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Dimasak" } : k));
                                  setKitchenQueue(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Dimasak" } : k));
                                }}
                                className="flex-1 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-bold transition-all"
                              >
                                {isFashion ? "Mulai Packing" : "Masak"}
                              </button>
                            )}
                            {kq.status === "Dimasak" && (
                              <button
                                onClick={() => {
                                  setSimulatedKitchen(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Siap Saji" } : k));
                                  setKitchenQueue(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Siap Saji" } : k));
                                }}
                                className="flex-1 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[9px] font-bold transition-all"
                              >
                                {isFashion ? "Selesaikan Packing" : "Siap Saji"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSimulatedKitchen(prev => prev.filter(k => k.id !== kq.id));
                                setKitchenQueue(prev => prev.filter(k => k.id !== kq.id));
                              }}
                              className="px-2 py-1 border border-border hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 rounded-lg text-[9px] transition-all"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Cashiers & Delivery Tracking */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm space-y-3">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Laptop size={13} className="text-primary" /> Kasir Aktif & Laci Uang (Drawer)
                  </h4>
                  <div className="space-y-2 text-xs font-sans">
                    {isFreshTenant ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada kasir aktif hari ini
                      </div>
                    ) : (
                      [
                        { id: 1, name: "Budi Santoso", shift: "Shift Pagi (08:00 - 16:00)", total: 1250000 },
                        { id: 2, name: "Siti Rahma", shift: "Shift Siang (12:00 - 20:00)", total: 980000 }
                      ].map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 border border-border rounded-xl bg-background/50">
                          <div>
                            <div className="font-bold text-foreground">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.shift}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-primary">{formatRp(c.total)}</span>
                            <p className="text-[8px] text-green-500 font-bold uppercase mt-0.5">Kasir Buka</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm space-y-3">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Truck size={13} className="text-primary" /> Pelacakan Kurir (Delivery)
                  </h4>
                  <div className="space-y-2 text-xs font-sans">
                    {isFreshTenant ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada pengiriman aktif hari ini
                      </div>
                    ) : (
                      [
                        { name: isFashion ? "J&T Express" : "Eko Prasetyo", order: "FLW-9275", dest: "Margonda Raya No. 42", status: "Mengirim" },
                        { name: isFashion ? "Sicepat" : "Gojek Instant", order: "FLW-9279", dest: "Apartemen Saladin, Tower B", status: "Mencari Driver" }
                      ].map((d, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border border-border rounded-xl bg-background/50">
                          <div>
                            <div className="font-bold text-foreground">{d.name} <span className="font-mono text-[10px] text-primary">[{d.order}]</span></div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{d.dest}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${d.status === "Mengirim" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/20" : "bg-amber-100 text-amber-700 dark:bg-amber-950/20"}`}>
                            {d.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Multi-Branch Monitoring */}
          {activeTab === "multibranch" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="font-bold text-foreground text-sm">Pemantauan Multi-Cabang</h3>
                <p className="text-xs text-muted-foreground">Bandingkan penjualan, staf, dan stok antar outlet cabang.</p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-xs text-foreground">Perbandingan Omzet Cabang (Bulan Ini)</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={
                      branchComparison.length > 0
                        ? branchComparison.map((bc: any) => ({ name: bc.name, omzet: bc.sales, transaksi: bc.transaksi }))
                        : (branches || []).map((b: any) => ({ name: b.name, omzet: 0, transaksi: 0 }))
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v), "Omzet"]} />
                      <Bar dataKey="omzet" fill={isFashion ? "#8B5CF6" : "#1D4EF5"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <h4 className="font-bold text-xs text-foreground">Outlet Terbaik</h4>
                  {!bestBranch || bestBranch.sales === 0 ? (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                      Belum ada penjualan di outlet manapun
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-1">
                        <span className="text-2xl">🏆</span>
                        <div className="font-bold text-sm text-foreground">{bestBranch.name}</div>
                        <p className="text-xs text-muted-foreground">Pencapaian: <strong className="text-primary">Terbaik</strong> bulan ini.</p>
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <div>Omzet: <strong className="text-foreground">{formatRp(bestBranch.sales)}</strong></div>
                        <div>Transaksi: <strong className="text-foreground">{bestBranch.transaksi} Order</strong></div>
                        <div>Staf Bertugas: <strong className="text-foreground">{bestBranch.staff} Orang</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Branch listing details */}
              <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                        {["Nama Cabang", "Total Sales", "Jumlah Staf", "Stok Kritis", "Status"].map(h => (
                          <th key={h} className="px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground">
                      {branchComparison.length === 0 ? (
                        (branches || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                              Belum ada cabang terdaftar
                            </td>
                          </tr>
                        ) : (
                          (branches || []).map((b: any) => (
                            <tr key={b.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-3.5 font-bold">{b.name}</td>
                              <td className="px-4 py-3.5 font-semibold text-primary">Rp 0</td>
                              <td className="px-4 py-3.5 font-medium">0 Karyawan</td>
                              <td className="px-4 py-3.5 text-muted-foreground font-medium">Aman</td>
                              <td className="px-4 py-3.5">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                  b.status === "locked"
                                    ? "bg-red-100 text-red-700 dark:bg-red-950/20"
                                    : "bg-green-100 text-green-700 dark:bg-green-950/20"
                                }`}>
                                  {b.status === "locked" ? "Terkunci" : "Aktif"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )
                      ) : (
                        branchComparison.map((b: any) => (
                          <tr key={b.id} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3.5 font-bold">{b.name}</td>
                            <td className="px-4 py-3.5 font-semibold text-primary">{formatRp(b.sales)}</td>
                            <td className="px-4 py-3.5 font-medium">{b.staff} Karyawan</td>
                            <td className="px-4 py-3.5 text-amber-600 font-bold">{b.stockAlerts > 0 ? `⚠️ ${b.stockAlerts} Item` : "Aman"}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                b.status === "Terkunci"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/20"
                                  : "bg-green-100 text-green-700 dark:bg-green-950/20"
                              }`}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Customer Analytics */}
          {activeTab === "customers" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Tingkat Repeat Order</div>
                  <div className="text-2xl font-bold text-primary mt-1">{isFreshTenant ? "0.0%" : "68.2%"}</div>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    {isFreshTenant ? "Belum ada data" : "+2.1% bulan lalu"}
                  </span>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Rata-rata Pengeluaran</div>
                  <div className="text-2xl font-bold text-primary mt-1">{formatRp(stats && stats.totalCustomers > 0 ? (estimatedGrossProfit / stats.totalCustomers) : 0)}</div>
                  <span className="text-[9px] text-muted-foreground">Per transaksi pelanggan</span>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Pelanggan Aktif</div>
                  <div className="text-2xl font-bold text-primary mt-1">{totalCust}</div>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    {totalCust === 0 ? "0 terdaftar baru" : `+${totalCust} terdaftar`}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-2">
                  <h4 className="font-bold text-xs text-foreground">Pertumbuhan Jumlah Pelanggan (Bulan ke Bulan)</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={customerChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="count" stroke={isFashion ? "#8B5CF6" : "#1D4EF5"} strokeWidth={2} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <h4 className="font-bold text-xs text-foreground">Paling Disukai Pelanggan</h4>
                  {favoriteProducts.length === 0 ? (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                      Belum ada data pesanan
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {favoriteProducts.map((f, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                            <span>{f.name}</span>
                            <span>{f.pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full ${f.color}`} style={{ width: `${f.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Loyalty Leaderboard */}
              <div className="bg-card border border-card-border rounded-2xl shadow-sm p-4 space-y-3">
                <h4 className="font-bold text-xs text-foreground">Pelanggan Paling Loyal (Leaderboard)</h4>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold text-[10px]">
                        {["Pelanggan", "Membership", "Total Transaksi", "Poin Loyalitas", "Total Belanja"].map(h => (
                          <th key={h} className="px-4 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground">
                      {loyaltyLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                            Belum ada pelanggan terdaftar
                          </td>
                        </tr>
                      ) : (
                        loyaltyLeaderboard.map((l, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="px-4 py-2.5 font-bold">{l.name}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                l.level === "Platinum" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20" :
                                l.level === "Gold" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20" :
                                "bg-slate-100 text-slate-700 dark:bg-slate-800"
                              }`}>
                                {l.level}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">{l.count} Transaksi</td>
                            <td className="px-4 py-2.5 text-primary font-bold">{l.points} Pts</td>
                            <td className="px-4 py-2.5 font-semibold">{formatRp(l.spent)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Financial Analytics */}
          {activeTab === "finance" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase">Omzet Kotor (Gross)</span>
                  <div className="text-xl font-bold text-foreground mt-1">{formatRp(estimatedGrossProfit)}</div>
                  <p className="text-[9px] text-muted-foreground mt-1">Total pendapatan masuk</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase">Pengeluaran (Expenses)</span>
                  <div className="text-xl font-bold text-red-500 mt-1">{formatRp(totalExpenses)}</div>
                  <p className="text-[9px] text-muted-foreground mt-1">Bahan baku & operasional</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm bg-primary/5 border-primary/20">
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase">Laba Bersih (Net)</span>
                  <div className="text-xl font-bold text-primary mt-1">{formatRp(estimatedNetProfit)}</div>
                  <p className="text-[9px] text-green-600 font-bold mt-1">Margin: {estimatedGrossProfit > 0 ? Math.round((estimatedNetProfit / estimatedGrossProfit) * 100) : 0}%</p>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase">Pajak Dikumpulkan</span>
                  <div className="text-xl font-bold text-foreground mt-1">{formatRp(estimatedGrossProfit * 0.11)}</div>
                  <p className="text-[9px] text-muted-foreground mt-1">PPN 11% Terakumulasi</p>
                </div>
              </div>

              {/* Financial chart */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm md:col-span-2 space-y-4">
                  <h4 className="font-bold text-xs text-foreground">Grafik Aliran Kas Bulanan (Cash Flow)</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v)]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="masuk" name="Kas Masuk" stroke={isFashion ? "#8B5CF6" : "#1D4EF5"} strokeWidth={2} />
                      <Line type="monotone" dataKey="keluar" name="Kas Keluar" stroke="#EF4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Refund & Reports */}
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-foreground">Laporan Refund</h4>
                    <p className="text-[10px] text-muted-foreground">Log aktivitas pembatalan & pengembalian transaksi.</p>
                  </div>
                  <div className="space-y-2 text-xs flex-1 flex flex-col justify-center">
                    {refundedOrders.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada transaksi refund
                      </div>
                    ) : (
                      refundedOrders.map((o: any) => (
                        <div key={o.id} className="p-2.5 border border-border rounded-xl bg-background flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-foreground">Refund {o.orderNumber}</span>
                            <p className="text-[9px] text-muted-foreground">{o.notes || "Pengembalian dana"} &bull; Oleh {o.employeeName || "Kasir"}</p>
                          </div>
                          <span className="font-bold text-red-500">-{formatRp(Number(o.total))}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Expense Logger Form */}
              <div className="grid md:grid-cols-3 gap-6">
                <form onSubmit={handleAddExpense} className="bg-card border border-card-border rounded-2xl p-4 shadow-sm space-y-3.5 md:col-span-1">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Plus size={14} className="text-primary" /> Catat Pengeluaran Baru
                  </h4>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Deskripsi Pengeluaran</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Beli sabun pembersih"
                      value={newExpense.desc}
                      onChange={e => setNewExpense(p => ({ ...p, desc: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Kategori</label>
                      <select
                        value={newExpense.category}
                        onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none"
                      >
                        <option value="Operasional">Operasional</option>
                        <option value="Bahan Baku">{isFashion ? "Inventori Baju" : "Bahan Baku"}</option>
                        <option value="Gaji">Gaji</option>
                        <option value="Utilitas">Utilitas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Jumlah (Rp)</label>
                      <input
                        type="number"
                        required
                        placeholder="Contoh: 120000"
                        value={newExpense.amount}
                        onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-md shadow-primary/10"
                  >
                    Tambah Pengeluaran
                  </button>
                </form>

                {/* Expenses Log List */}
                <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm md:col-span-2 space-y-3">
                  <h4 className="font-bold text-xs text-foreground">Log Pengeluaran Terdaftar (Bulan Ini)</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {expenses.map(exp => (
                      <div key={exp.id} className="bg-background border border-border p-3 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-foreground">{exp.desc}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{exp.category === "Bahan Baku" && isFashion ? "Inventori Baju" : exp.category} &bull; {exp.date}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-500">{formatRp(exp.amount)}</span>
                          <button
                            onClick={() => {
                              setExpenses(prev => prev.filter(e => e.id !== exp.id));
                            }}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Employee Monitoring */}
          {activeTab === "employees" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="font-bold text-foreground text-sm">Pemantauan & Absensi Karyawan</h3>
                <p className="text-xs text-muted-foreground">Lacak kehadiran harian staf, performa transaksi kasir, dan produktivitas harian.</p>
              </div>

              <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                        {["Nama Karyawan", "Role", "Waktu Check-In", "Status Presensi", "Omzet Kasir Hari Ini"].map(h => (
                          <th key={h} className="px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground">
                      {attendance.map(a => (
                        <tr key={a.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3.5 font-bold">{a.name}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{a.role}</td>
                          <td className="px-4 py-3.5 font-mono">{a.checkIn || "—"}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                              a.status === "Tepat Waktu" ? "bg-green-100 text-green-700 dark:bg-green-950/20" :
                              a.status === "Terlambat" ? "bg-red-100 text-red-700 dark:bg-red-950/20" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-primary">{a.sales > 0 ? formatRp(a.sales) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attendance and Shift Simulator Logger */}
              <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" /> Logger Simulasi Aktivitas Staf
                </h4>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      alert("Tingkat produktivitas rata-rata staf hari ini adalah 92%. Semua pesanan selesai di bawah 8 menit.");
                    }}
                    className="px-4 py-2 border border-border hover:bg-muted text-xs font-semibold rounded-xl text-foreground transition-all"
                  >
                    💡 Cek Produktivitas Staf
                  </button>
                  <button
                    onClick={() => {
                      alert("Shift Pagi ditutup. Seluruh laci kasir (drawer) telah sesuai dengan nominal fisik.");
                    }}
                    className="px-4 py-2 border border-border hover:bg-muted text-xs font-semibold rounded-xl text-foreground transition-all"
                  >
                    📋 Cetak Laporan Shift
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 7: Marketing Tools */}
          {activeTab === "marketing" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Coupon Code Manager */}
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Percent size={14} className="text-primary" /> Pembuat Kode Kupon (Diskon)
                  </h4>
                  <form onSubmit={handleAddCoupon} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Kode Kupon</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: MERDEKA20"
                          value={newCoupon.code}
                          onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-input rounded-lg bg-background text-xs text-foreground focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Diskon (%)</label>
                        <input
                          type="number"
                          required
                          placeholder="Diskon persen"
                          value={newCoupon.discount}
                          onChange={e => setNewCoupon(p => ({ ...p, discount: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-input rounded-lg bg-background text-xs text-foreground focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Keterangan Kupon</label>
                      <input
                        type="text"
                        placeholder="Deskripsi singkat promo..."
                        value={newCoupon.desc}
                        onChange={e => setNewCoupon(p => ({ ...p, desc: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-input rounded-lg bg-background text-xs text-foreground focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all"
                    >
                      Buat Kupon
                    </button>
                  </form>

                  {/* Coupon Lists */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 border-t border-border pt-3">
                    {coupons.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada kupon diskon aktif
                      </div>
                    ) : (
                      coupons.map(cp => (
                        <div key={cp.id} className="flex justify-between items-center text-xs p-2 border border-border rounded-xl bg-background/50">
                          <div>
                            <span className="font-mono font-bold text-primary">{cp.code}</span>
                            <span className="ml-2 font-bold text-foreground">({cp.discount}% Off)</span>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{cp.desc}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${cp.status === "Aktif" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                              {cp.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(cp.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Promo Banners Builder */}
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Layers size={14} className="text-primary" /> Pembuat Banner Promo QR Menu
                  </h4>
                  
                  {/* Banner Type Toggle */}
                  <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-full">
                    <button
                      type="button"
                      onClick={() => { setBannerType("text"); setBannerUploadError(""); }}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        bannerType === "text" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Teks & Warna
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBannerType("image"); setBannerUploadError(""); }}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        bannerType === "image" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Upload Gambar
                    </button>
                  </div>

                  <form onSubmit={handleAddBanner} className="space-y-3 text-xs">
                    {bannerType === "text" ? (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Judul / Teks Banner</label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: Diskon Kopi 10% setiap Senin!"
                            value={newBanner.title}
                            onChange={e => setNewBanner(p => ({ ...p, title: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-input rounded-lg bg-background text-xs text-foreground focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Warna Background</label>
                            <input
                              type="color"
                              value={newBanner.bgColor}
                              onChange={e => setNewBanner(p => ({ ...p, bgColor: e.target.value }))}
                              className="w-full h-8 rounded border border-border bg-transparent cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Warna Teks</label>
                            <input
                              type="color"
                              value={newBanner.textColor}
                              onChange={e => setNewBanner(p => ({ ...p, textColor: e.target.value }))}
                              className="w-full h-8 rounded border border-border bg-transparent cursor-pointer"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Judul / Teks Banner (Opsional)</label>
                          <input
                            type="text"
                            placeholder="Contoh: Promo Spesial Akhir Pekan!"
                            value={newBanner.title}
                            onChange={e => setNewBanner(p => ({ ...p, title: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-input rounded-lg bg-background text-xs text-foreground focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase">File Gambar Banner</label>
                          <input
                            type="file"
                            ref={bannerFileInputRef}
                            onChange={handleBannerFileChange}
                            accept="image/*"
                            className="hidden"
                          />
                          {newBanner.imageUrl ? (
                          <div className="relative group w-full h-24 rounded-xl overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
                            <img
                              src={newBanner.imageUrl}
                              alt="Banner Preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => bannerFileInputRef.current?.click()}
                                className="px-2.5 py-1 bg-amber-400 text-black text-[10px] font-bold rounded-lg hover:bg-amber-500 transition-colors shadow"
                              >
                                Ganti
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewBanner(p => ({ ...p, imageUrl: "" }))}
                                className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => bannerFileInputRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed border-input rounded-xl flex flex-col items-center justify-center p-3 cursor-pointer hover:border-amber-400 hover:bg-amber-400/5 transition-all group text-center"
                          >
                            {bannerUploading ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[9px] text-muted-foreground font-semibold font-sans">Uploading...</span>
                              </div>
                            ) : (
                              <>
                                <UploadCloud size={18} className="text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold text-foreground">Upload gambar promo</span>
                                <span className="text-[8px] text-muted-foreground mt-0.5">Maks. 5MB (JPG, PNG, WEBP)</span>
                              </>
                            )}
                          </div>
                        )}
                        {bannerUploadError && (
                          <p className="text-[10px] text-red-500 font-semibold">{bannerUploadError}</p>
                        )}
                      </div>
                    </div>
                  )}

                    {/* Link to product select input */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase">Tautkan ke Produk / Paket Promo</label>
                      <select
                        value={newBanner.linkedProductId || ""}
                        onChange={e => setNewBanner(p => ({ ...p, linkedProductId: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      >
                        <option value="">Tidak ditautkan</option>
                        {(productsResult?.data || []).map((p: any) => {
                          let prefix = "";
                          if (p.variantSettings) {
                            try {
                              const parsed = JSON.parse(p.variantSettings);
                              if (parsed.isBundle) {
                                prefix = "[🎁 Promo/Bundling] ";
                              }
                            } catch (e) {}
                          }
                          return (
                            <option key={p.id} value={p.id}>
                              {prefix}{p.name} (Rp {p.price.toLocaleString("id-ID")})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={bannerUploading}
                      className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/95 transition-all disabled:opacity-50"
                    >
                      Tambahkan Banner
                    </button>
                  </form>

                  {/* Banners Preview */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Mockup Tampilan Banner:</span>
                    {marketingBanners.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl font-normal">
                        Belum ada banner promo dibuat
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {marketingBanners.map(mb => (
                          <div key={mb.id} className="relative group rounded-xl overflow-hidden shadow-sm border border-border bg-card">
                            {mb.imageUrl ? (
                              <div className="relative w-full h-20">
                                <img src={mb.imageUrl} alt="Promo banner" className="w-full h-full object-cover" />
                                {mb.title && (
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-2.5">
                                    <div className="text-white font-bold text-[10px] sm:text-xs leading-snug drop-shadow">
                                      {mb.title}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                style={{ backgroundColor: mb.bgColor, color: mb.textColor }}
                                className="p-3 text-center text-xs font-bold min-h-[50px] flex items-center justify-center leading-snug"
                              >
                                {mb.title}
                              </div>
                            )}
                            {mb.linkedProductId && (
                              <div className="absolute bottom-1 left-2 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold z-10 max-w-[80%] truncate">
                                🔗 {(productsResult?.data || []).find((p: any) => p.id === mb.linkedProductId)?.name || "Produk"}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteBanner(mb.id)}
                              className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* WhatsApp Promotions Dispatcher */}
              <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-primary" /> Penyiaran Promosi WhatsApp (Simulated Broadcast)
                </h4>
                <form onSubmit={handleSendWa} className="grid md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Segmentasi Pelanggan</label>
                      <select
                        value={waPromo.segment}
                        onChange={e => setWaPromo(p => ({ ...p, segment: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none"
                      >
                        <option value="all">Semua Pelanggan Terdaftar</option>
                        <option value="loyal">Pelanggan Loyal (Gold & Platinum)</option>
                        <option value="inactive">Pelanggan Pasif (&gt;30 hari absen)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Pilih Kupon Lampiran</label>
                      <select
                        value={waPromo.couponCode}
                        onChange={e => setWaPromo(p => ({ ...p, couponCode: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none"
                      >
                        {coupons.map(cp => (
                          <option key={cp.id} value={cp.code}>{cp.code} ({cp.discount}%)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Pesan Promosi WhatsApp</label>
                      <textarea
                        required
                        rows={2}
                        value={waPromo.message}
                        onChange={e => setWaPromo(p => ({ ...p, message: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-3 items-center">
                      <button
                        type="submit"
                        disabled={waSending}
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 disabled:opacity-50 transition-all flex-shrink-0"
                      >
                        {waSending ? "Mengirim..." : "Siarkan Promosi WA"}
                      </button>
                      {waSentCount !== null && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg">
                          Terkirim ke {waSentCount} nomor pelanggan!
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tab 9: Export Reports */}
          {activeTab === "export" && (
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-6 animate-fade-in">
              <div>
                <h3 className="font-bold text-foreground text-sm">Ekspor Laporan Transaksi & Keuangan</h3>
                <p className="text-xs text-muted-foreground">Unduh rangkuman seluruh penjualan bisnis Anda ke dalam berbagai format file.</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  { type: "pdf", label: "Dokumen PDF", color: "bg-red-500", desc: "Format dokumen siap cetak untuk pelaporan atau arsip fisik." },
                  { type: "excel", label: "Spreadsheet Excel", color: "bg-green-600", desc: "Format tabel interaktif lengkap dengan rumus analisis data." },
                  { type: "csv", label: "Raw Data CSV", color: "bg-blue-600", desc: "Format baris data terpisah koma untuk integrasi database pihak ketiga." }
                ].map(exp => {
                  const loadingProgress = exportLoading[exp.type];
                  const isLoading = loadingProgress !== undefined;

                  return (
                    <div key={exp.type} className="border border-border rounded-2xl p-5 flex flex-col justify-between items-center text-center bg-muted/10 space-y-4 shadow-sm hover:shadow transition-all">
                      <div className={`w-12 h-12 ${exp.color} text-white rounded-2xl flex items-center justify-center font-bold text-sm uppercase shadow-sm`}>
                        {exp.type}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{exp.label}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{exp.desc}</p>
                      </div>

                      {isLoading ? (
                        <div className="w-full space-y-1">
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${loadingProgress}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground">{loadingProgress}% Mengunduh...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleExport(exp.type)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-muted text-xs font-semibold rounded-xl text-foreground transition-all shadow-sm"
                        >
                          <Download size={13} /> Unduh Laporan
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: branches } = useListBranches();
  const { data: tenant, isLoading: tenantLoading } = useGetTenant();

  const isLoading = statsLoading || tenantLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const role = user?.role ?? "staff";
  const businessType = tenant?.businessType || "fnb";

  // Enforce lock checking for cashier/manager
  if (user?.branchId) {
    const assignedBranch = ((branches || []) as any[]).find(b => b.id === user.branchId);
    if (assignedBranch && assignedBranch.status === "locked") {
      const plan = tenant?.subscriptionPlan || "trial";
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="bg-card border border-card-border p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-xl">🔒</div>
            <h2 className="font-bold text-base text-foreground">Cabang Anda Terkunci</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cabang **{assignedBranch.name}** saat ini dinonaktifkan (terkunci) karena melampaui batas paket langganan bisnis Anda ({plan.toUpperCase()}).
            </p>
            <p className="text-xs text-muted-foreground">
              Silakan hubungi pemilik bisnis untuk meng-upgrade paket langganan agar dapat mengaktifkan kembali cabang ini.
            </p>
          </div>
        </div>
      );
    }
  }

  if (role === "cashier") return <CashierDashboard stats={stats} businessType={businessType} />;
  if (role === "manager") return <ManagerDashboard stats={stats} businessType={businessType} />;
  if (role === "staff") return <StaffDashboard businessType={businessType} />;
  return <OwnerDashboard />;
}
