import { useState, useEffect, useRef } from "react";
import { useGetDashboardStats, useGetRecentOrders, useGetTopProducts, useGetSalesChartData, useListBranches, useGetTenant } from "@workspace/api-client-react";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertTriangle, DollarSign, ChefHat, Truck, Clock,
  Bell, FileText, Download, BarChart2, Users2, ShieldAlert, Award, Calendar, Layers, MapPin, Percent,
  MessageSquare, Plus, Trash2, Check, RefreshCw, Smartphone, Clipboard, QrCode, Sparkles, LogIn, Laptop, Globe, Gift,
  Building2, Activity, Lock, UploadCloud
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
function CashierDashboard({ stats }: { stats: any }) {
  const { data: recentOrders } = useGetRecentOrders({ limit: 10 });
  const s = stats || { todaySales: 0, todayOrders: 0 };
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Selamat Bekerja!</h1>
        <p className="text-muted-foreground text-sm">Transaksi kasir hari ini</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={18} />} sub={`${s.todayOrders} transaksi`} />
        <StatCard label="Total Transaksi" value={s.todayOrders.toString()} icon={<ShoppingCart size={18} />} sub="Hari ini" />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
            <div className="text-sm text-muted-foreground">Dari QR Menu</div>
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
function ManagerDashboard({ stats }: { stats: any }) {
  const { data: recentOrders } = useGetRecentOrders({ limit: 5 });
  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, weeklyRevenue: 0, revenueGrowth: 0 };
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard Operasional</h1>
        <p className="text-muted-foreground text-sm">Pantau operasional bisnis harian</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/pos", icon: <ShoppingCart size={20} />, label: "Kasir", sub: "Buka POS" },
          { href: "/customer-orders", icon: <div className="text-xl">📱</div>, label: "Pesanan Online", sub: "QR Menu" },
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
function StaffDashboard() {
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
  const { data: recentOrders } = useGetRecentOrders({ limit: 5, branchId: selectedBranchId });
  const { data: topProducts } = useGetTopProducts({ limit: 5, branchId: selectedBranchId });
  const { data: chartData } = useGetSalesChartData({ period: "week", branchId: selectedBranchId });
  const { data: tenant } = useGetTenant();
  const plan = tenant?.subscriptionPlan || "trial";

  // Tab switching state
  const [activeTab, setActiveTab] = useState("overview");

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, title: "Stok Rendah", body: "Espresso Blend tersisa 5 unit.", time: "5 mnt lalu", type: "stock", read: false },
    { id: 2, title: "Pesanan Baru", body: "Order #FLW-9281 baru masuk via QR Menu.", time: "12 mnt lalu", type: "order", read: false },
    { id: 3, title: "Refund Diajukan", body: "Kasir meminta persetujuan refund Rp 45.000.", time: "1 jam lalu", type: "refund", read: false },
    { id: 4, title: "Sesi Berakhir", body: "Langganan Anda berakhir dalam 7 hari.", time: "3 jam lalu", type: "subscription", read: false },
  ]);

  // Expenses State (Finance)
  const [expenses, setExpenses] = useState<any[]>([
    { id: 1, desc: "Sewa Tempat (Bulanan)", category: "Operasional", amount: 4500000, date: "2026-06-01" },
    { id: 2, desc: "Gaji Karyawan (Grup)", category: "Gaji", amount: 7800000, date: "2026-06-05" },
    { id: 3, desc: "Biji Kopi & Bahan Baku", category: "Bahan Baku", amount: 3200000, date: "2026-06-07" },
    { id: 4, desc: "Listrik & Internet", category: "Utilitas", amount: 1150000, date: "2026-06-08" },
  ]);
  const [newExpense, setNewExpense] = useState({ desc: "", category: "Operasional", amount: "" });

  // Attendance State (Employees)
  const [attendance, setAttendance] = useState<any[]>([
    { id: 1, name: "Budi Santoso", role: "Kasir", checkIn: "07:55", status: "Tepat Waktu", sales: 1250000 },
    { id: 2, name: "Siti Rahma", role: "Kasir", checkIn: "08:12", status: "Terlambat", sales: 980000 },
    { id: 3, name: "Andi Wijaya", role: "Dapur", checkIn: "07:48", status: "Tepat Waktu", sales: 0 },
    { id: 4, name: "Rian Hidayat", role: "Dapur", checkIn: "08:02", status: "Terlambat", sales: 0 },
    { id: 5, name: "Eko Prasetyo", role: "Kurir", checkIn: "08:00", status: "Tepat Waktu", sales: 450000 },
  ]);

  // Marketing Tools State
  const [coupons, setCoupons] = useState<any[]>([
    { id: 1, code: "KOPIASIK", discount: 15, desc: "Diskon menu kopi khusus akhir pekan", status: "Aktif" },
    { id: 2, code: "FLOWBARU", discount: 20, desc: "Promo pengguna baru QR Menu", status: "Aktif" },
    { id: 3, code: "HEBATSENIN", discount: 10, desc: "Diskon weekday Senin pagi", status: "Expired" },
  ]);
  const [newCoupon, setNewCoupon] = useState({ code: "", discount: "", desc: "" });

  const [marketingBanners, setMarketingBanners] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("flow_marketing_banners");
      if (stored) return JSON.parse(stored);
    } catch (err) {}
    return [
      { id: 1, title: "Spesial Weekend: Beli 1 Gratis 1 Latte", bgColor: "#1D4EF5", textColor: "#FFFFFF" },
      { id: 2, title: "Diskon 20% bagi Pelanggan Setia POS", bgColor: "#10B981", textColor: "#FFFFFF" },
    ];
  });
  const [newBanner, setNewBanner] = useState({ title: "", bgColor: "#1D4EF5", textColor: "#FFFFFF", imageUrl: "" });
  const [bannerType, setBannerType] = useState<"text" | "image">("text");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState("");
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  
  // WhatsApp Mock Promotion Dispatcher State
  const [waPromo, setWaPromo] = useState({ segment: "all", couponCode: "KOPIASIK", message: "Halo Kawan Flow! Dapatkan promo diskon spesial 15% khusus hari ini dengan kode kupon" });
  const [waSending, setWaSending] = useState(false);
  const [waSentCount, setWaSentCount] = useState<number | null>(null);

  // Live Operations Simulator State
  const [simulationActive, setSimulationActive] = useState(false);
  const [liveOrders, setLiveOrders] = useState<any[]>([
    { id: 1, number: "FLW-9279", customer: "Amir", total: 42000, time: "1 mnt lalu", type: "delivery", status: "Siap Kirim" },
    { id: 2, number: "FLW-9280", customer: "Cynthia", total: 68000, time: "3 mnt lalu", type: "dine_in", status: "Sedang Dimasak" },
    { id: 3, number: "FLW-9281", customer: "Dewi", total: 27000, time: "5 mnt lalu", type: "take_away", status: "Menunggu Kasir" },
  ]);
  const [kitchenQueue, setKitchenQueue] = useState<any[]>([
    { id: 101, name: "Iced Cappuccino", table: "Meja 4", qty: 2, notes: "Kurang manis", status: "Antre" },
    { id: 102, name: "Nasi Goreng Spesial", table: "Meja 12", qty: 1, notes: "Ekstra pedas", status: "Dimasak" },
    { id: 103, name: "Croissant Almond", table: "Meja 2", qty: 3, notes: "Hangatkan", status: "Siap Saji" },
  ]);

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

  // Realtime customer orders loading for Owner Dashboard
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
                    o.status === "preparing" ? "Dimasak" :
                    o.status === "ready" ? "Siap" :
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
                table: o.tableNumber ? `Meja ${o.tableNumber}` : o.orderType === "delivery" ? "Delivery" : "Take Away",
                qty: item.quantity,
                notes: item.notes || "",
                status: o.status === "pending" ? "Antre" : o.status === "confirmed" ? "Antre" : "Dimasak"
              });
            });
          });
          setKitchenQueue(mappedKitchen);
        }
      } catch (err) {}
    }
    
    loadRealtimeData();
    const iv = setInterval(loadRealtimeData, 10000);
    return () => clearInterval(iv);
  }, [selectedBranchId]);

  // Simulation timer for dynamic orders incoming
  useEffect(() => {
    if (!simulationActive) return;
    const interval = setInterval(() => {
      const names = ["Erick", "Roni", "Bella", "Gabriella", "Kevin", "Farhan", "Jessica"];
      const randName = names[Math.floor(Math.random() * names.length)];
      const randTotal = Math.floor(Math.random() * 8) * 15000 + 20000;
      const orderNum = `FLW-${Math.floor(Math.random() * 9000 + 1000)}`;

      // Add to live orders
      const newOrd = {
        id: Date.now(),
        number: orderNum,
        customer: randName,
        total: randTotal,
        time: "Baru Saja",
        type: Math.random() > 0.5 ? "delivery" : "dine_in",
        status: "Baru"
      };
      setLiveOrders(prev => [newOrd, ...prev.slice(0, 7)]);

      // Add to kitchen queue
      const items = ["Kopi Susu Gula Aren", "Americano", "Chicken Rice Bowl", "French Fries", "Waffle Matcha"];
      const randItem = items[Math.floor(Math.random() * items.length)];
      const newKit = {
        id: Date.now() + 1,
        name: randItem,
        table: `Meja ${Math.floor(Math.random() * 15 + 1)}`,
        qty: Math.floor(Math.random() * 2) + 1,
        notes: Math.random() > 0.7 ? "Es dikurangi" : "",
        status: "Antre"
      };
      setKitchenQueue(prev => [newKit, ...prev]);

      // Add to notifications
      const newNotif = {
        id: Date.now() + 2,
        title: "Pesanan Baru Masuk",
        body: `Pesanan ${orderNum} oleh ${randName} masuk senilai ${formatRp(randTotal)}.`,
        time: "Baru Saja",
        type: "order",
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);

    }, 15000);

    return () => clearInterval(interval);
  }, [simulationActive]);

  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, monthlyRevenue: 0, weeklyRevenue: 0, revenueGrowth: 0 };
  const isFreshTenant = stats ? (stats.totalProducts === 0 && stats.todayOrders === 0) : false;

  // Clear mock data if this is a fresh new tenant and simulation is off
  useEffect(() => {
    if (stats && isFreshTenant && !simulationActive) {
      setExpenses([]);
      setAttendance([]);
      setCoupons([]);
      if (!localStorage.getItem("flow_marketing_banners")) {
        setMarketingBanners([]);
      }
      setLiveOrders([]);
      setKitchenQueue([]);
      setNotifications([]);
    }
  }, [stats, isFreshTenant, simulationActive]);

  // Financial calculations
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const estimatedGrossProfit = isFreshTenant ? 0 : (s.monthlyRevenue || 14850000);
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
    setCoupons(prev => [coupObj, ...prev]);
    setNewCoupon({ code: "", discount: "", desc: "" });
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
      title: bannerType === "text" ? newBanner.title : "",
      bgColor: bannerType === "text" ? newBanner.bgColor : "",
      textColor: bannerType === "text" ? newBanner.textColor : "",
      imageUrl: bannerType === "image" ? newBanner.imageUrl : ""
    };

    setMarketingBanners(prev => {
      const next = [banObj, ...prev];
      localStorage.setItem("flow_marketing_banners", JSON.stringify(next));
      return next;
    });
    setNewBanner({ title: "", bgColor: "#1D4EF5", textColor: "#FFFFFF", imageUrl: "" });
  };

  const handleDeleteBanner = (id: number) => {
    setMarketingBanners(prev => {
      const next = prev.filter(b => b.id !== id);
      localStorage.setItem("flow_marketing_banners", JSON.stringify(next));
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

  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Dashboard */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-lg">F</div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Dasbor Bisnis <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">PRO</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">Monitoring operasional multi-cabang secara realtime</p>
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
                  {notifications.map(n => (
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
        <aside className="bg-card border border-card-border rounded-2xl p-4 shadow-sm h-fit space-y-1 md:col-span-1">
          {[
            { id: "overview", label: "Ringkasan", icon: BarChart2 },
            { id: "realtime", label: "Operasi Live", icon: Clock },
            { id: "multibranch", label: "Multi-Cabang", icon: Building2 },
            { id: "customers", label: "Pelanggan", icon: Users2 },
            { id: "finance", label: "Keuangan", icon: DollarSign },
            { id: "employees", label: "Karyawan", icon: Users },
            { id: "marketing", label: "Pemasaran", icon: Gift },
            { id: "qrmenu", label: "QR Menu", icon: QrCode },
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all text-left ${
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
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{formatRp(isFreshTenant ? 0 : (s.weeklyRevenue || 3450000))} / Mgg</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData || []}>
                      <defs>
                        <linearGradient id="ownerSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1D4EF5" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#1D4EF5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v), "Pendapatan"]} />
                      <Area type="monotone" dataKey="revenue" stroke="#1D4EF5" strokeWidth={2} fill="url(#ownerSalesGrad)" />
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
                    {s.lowStockCount === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        {isFreshTenant ? "Belum ada produk terdaftar" : "Semua stok produk aman"}
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground">Espresso Roast Arabica</span>
                            <p className="text-[10px] text-muted-foreground">Sisa 2 Kg (Min: 5 Kg)</p>
                          </div>
                          <Link href="/inventory"><a className="text-[10px] font-bold text-amber-600 hover:underline">Restock →</a></Link>
                        </div>
                        <div className="flex justify-between items-center text-xs p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground">Susu Fresh Milk UHT</span>
                            <p className="text-[10px] text-muted-foreground">Sisa 8 Pcs (Min: 12 Pcs)</p>
                          </div>
                          <Link href="/inventory"><a className="text-[10px] font-bold text-amber-600 hover:underline">Restock →</a></Link>
                        </div>
                      </>
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
                  <p className="text-xs text-muted-foreground">Pantau antrean pesanan masuk, status dapur, dan kurir aktif.</p>
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
                    {liveOrders.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada pesanan masuk
                      </div>
                    ) : (
                      liveOrders.map(lo => (
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
                    <ChefHat size={13} className="text-primary" /> Antrean Dapur (Kitchen Display)
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {kitchenQueue.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada antrean di dapur
                      </div>
                    ) : (
                      kitchenQueue.map(kq => (
                        <div key={kq.id} className="border border-border rounded-xl p-3 bg-background flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex justify-between items-start text-xs">
                              <span className="font-bold text-foreground">{kq.name}</span>
                              <span className="font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">x{kq.qty}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                              <span>{kq.table}</span>
                              <span className={`font-semibold uppercase text-[8px] ${kq.status === "Dimasak" ? "text-amber-500" : kq.status === "Siap Saji" ? "text-green-500" : "text-muted-foreground"}`}>{kq.status}</span>
                            </div>
                            {kq.notes && <div className="text-[9px] text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md mt-1.5 italic">Catatan: {kq.notes}</div>}
                          </div>
                          <div className="flex gap-1.5 border-t border-border/60 pt-2">
                            {kq.status === "Antre" && (
                              <button
                                onClick={() => {
                                  setKitchenQueue(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Dimasak" } : k));
                                }}
                                className="flex-1 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[9px] font-bold transition-all"
                              >
                                Masak
                              </button>
                            )}
                            {kq.status === "Dimasak" && (
                              <button
                                onClick={() => {
                                  setKitchenQueue(prev => prev.map(k => k.id === kq.id ? { ...k, status: "Siap Saji" } : k));
                                }}
                                className="flex-1 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[9px] font-bold transition-all"
                              >
                                Siap Saji
                              </button>
                            )}
                            <button
                              onClick={() => {
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
                        { name: "Eko Prasetyo", order: "FLW-9275", dest: "Margonda Raya No. 42", status: "Mengirim" },
                        { name: "Gojek Instant", order: "FLW-9279", dest: "Apartemen Saladin, Tower B", status: "Mencari Driver" }
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
                      isFreshTenant
                        ? (branches || []).map((b: any) => ({ name: b.name, omzet: 0, transaksi: 0 }))
                        : [
                            { name: "Depok (Margonda)", omzet: 14850000, transaksi: 320 },
                            { name: "Jakarta (Sudirman)", omzet: 28400000, transaksi: 540 },
                            { name: "Bandung (Dago)", omzet: 18200000, transaksi: 410 }
                          ]
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v), "Omzet"]} />
                      <Bar dataKey="omzet" fill="#1D4EF5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <h4 className="font-bold text-xs text-foreground">Outlet Terbaik</h4>
                  {isFreshTenant ? (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                      Belum ada penjualan di outlet manapun
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-1">
                        <span className="text-2xl">🏆</span>
                        <div className="font-bold text-sm text-foreground">Jakarta (Sudirman)</div>
                        <p className="text-xs text-muted-foreground">Pencapaian: <strong className="text-primary">191%</strong> dari target bulanan.</p>
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <div>Omzet: <strong className="text-foreground">Rp 28.400.000</strong></div>
                        <div>Transaksi: <strong className="text-foreground">540 Order</strong></div>
                        <div>Staf Bertugas: <strong className="text-foreground">6 Orang</strong></div>
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
                      {isFreshTenant ? (
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
                        [
                          { name: "Depok (Margonda)", sales: 14850000, staff: 5, stockAlerts: 2, status: "Aktif" },
                          { name: "Jakarta (Sudirman)", sales: 28400000, staff: 6, stockAlerts: 0, status: "Aktif" },
                          { name: "Bandung (Dago)", sales: 18200000, staff: 4, stockAlerts: 1, status: "Aktif" }
                        ].map((b, i) => (
                          <tr key={i} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3.5 font-bold">{b.name}</td>
                            <td className="px-4 py-3.5 font-semibold text-primary">{formatRp(b.sales)}</td>
                            <td className="px-4 py-3.5 font-medium">{b.staff} Karyawan</td>
                            <td className="px-4 py-3.5 text-amber-600 font-bold">{b.stockAlerts > 0 ? `⚠️ ${b.stockAlerts} Item` : "Aman"}</td>
                            <td className="px-4 py-3.5">
                              <span className="bg-green-100 text-green-700 dark:bg-green-950/20 px-2 py-0.5 rounded-full font-bold text-[9px]">
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
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Tingkat Repeat Order</div>
                  <div className="text-2xl font-bold text-primary mt-1">{isFreshTenant ? "0.0%" : "68.2%"}</div>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    {isFreshTenant ? "Belum ada data" : "+2.1% bulan lalu"}
                  </span>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Rata-rata Pengeluaran</div>
                  <div className="text-2xl font-bold text-primary mt-1">{isFreshTenant ? "Rp 0" : formatRp(42000)}</div>
                  <span className="text-[9px] text-muted-foreground">Per transaksi pelanggan</span>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm text-center">
                  <div className="text-muted-foreground text-[10px] font-semibold uppercase">Pelanggan Aktif</div>
                  <div className="text-2xl font-bold text-primary mt-1">{isFreshTenant ? "0" : "1,240"}</div>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    {isFreshTenant ? "0 terdaftar baru" : "+82 terdaftar baru"}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-2">
                  <h4 className="font-bold text-xs text-foreground">Pertumbuhan Jumlah Pelanggan (Bulan ke Bulan)</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={
                      isFreshTenant
                        ? [
                            { label: "Jan", count: 0 },
                            { label: "Feb", count: 0 },
                            { label: "Mar", count: 0 },
                            { label: "Apr", count: 0 },
                            { label: "Mei", count: 0 },
                            { label: "Jun", count: 0 }
                          ]
                        : [
                            { label: "Jan", count: 820 },
                            { label: "Feb", count: 910 },
                            { label: "Mar", count: 980 },
                            { label: "Apr", count: 1040 },
                            { label: "Mei", count: 1150 },
                            { label: "Jun", count: 1240 }
                          ]
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="count" stroke="#1D4EF5" strokeWidth={2} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <h4 className="font-bold text-xs text-foreground">Paling Disukai Pelanggan</h4>
                  {isFreshTenant ? (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                      Belum ada data pesanan
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {[
                        { name: "Kopi Gula Aren", pct: 45, color: "bg-blue-600" },
                        { name: "Ice Cafe Latte", pct: 28, color: "bg-indigo-600" },
                        { name: "Chocolate Ice", pct: 15, color: "bg-green-600" },
                        { name: "Camilan Croissant", pct: 12, color: "bg-amber-600" }
                      ].map((f, i) => (
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
                      {isFreshTenant ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                            Belum ada pelanggan terdaftar
                          </td>
                        </tr>
                      ) : (
                        [
                          { name: "Farhan Maulana", level: "Platinum", count: 42, points: 840, spent: 1850000 },
                          { name: "Siska Amelia", level: "Gold", count: 29, points: 580, spent: 1240000 },
                          { name: "Rian Pratama", level: "Silver", count: 18, points: 360, spent: 780000 }
                        ].map((l, i) => (
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <LineChart data={
                      isFreshTenant
                        ? [
                            { label: "W1", masuk: 0, keluar: 0 },
                            { label: "W2", masuk: 0, keluar: 0 },
                            { label: "W3", masuk: 0, keluar: 0 },
                            { label: "W4", masuk: 0, keluar: 0 }
                          ]
                        : [
                            { label: "W1", masuk: 3200000, keluar: 1800000 },
                            { label: "W2", masuk: 4500000, keluar: 2100000 },
                            { label: "W3", masuk: 3800000, keluar: 1200000 },
                            { label: "W4", masuk: estimatedGrossProfit - 11500000, keluar: totalExpenses - 5100000 }
                          ]
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => formatRp(v)} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [formatRp(v)]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="masuk" name="Kas Masuk" stroke="#1D4EF5" strokeWidth={2} />
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
                    {isFreshTenant ? (
                      <div className="text-center py-8 text-xs text-muted-foreground bg-muted/10 border border-border rounded-xl">
                        Belum ada transaksi refund
                      </div>
                    ) : (
                      <>
                        <div className="p-2.5 border border-border rounded-xl bg-background flex justify-between items-center">
                          <div>
                            <span className="font-bold text-foreground">Refund #FLW-9182</span>
                            <p className="text-[9px] text-muted-foreground">Salah input menu &bull; Oleh Kasir Budi</p>
                          </div>
                          <span className="font-bold text-red-500">-Rp 45.000</span>
                        </div>
                        <div className="p-2.5 border border-border rounded-xl bg-background flex justify-between items-center">
                          <div>
                            <span className="font-bold text-foreground">Refund #FLW-9140</span>
                            <p className="text-[9px] text-muted-foreground">Stok bahan kosong &bull; Oleh Manager</p>
                          </div>
                          <span className="font-bold text-red-500">-Rp 28.000</span>
                        </div>
                      </>
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
                        <option value="Bahan Baku">Bahan Baku</option>
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
                          <div className="text-[10px] text-muted-foreground mt-0.5">{exp.category} &bull; {exp.date}</div>
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
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${cp.status === "Aktif" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {cp.status}
                          </span>
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
                    )}
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
                              <img src={mb.imageUrl} alt="Promo banner" className="w-full h-20 object-cover" />
                            ) : (
                              <div
                                style={{ backgroundColor: mb.bgColor, color: mb.textColor }}
                                className="p-3 text-center text-xs font-bold min-h-[50px] flex items-center justify-center leading-snug"
                              >
                                {mb.title}
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

          {/* Tab 8: QR Menu Settings */}
          {activeTab === "qrmenu" && (
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-6 animate-fade-in">
              <div>
                <h3 className="font-bold text-foreground text-sm">Tema & Kustomisasi QR Menu</h3>
                <p className="text-xs text-muted-foreground">Sesuaikan tampilan visual menu pesanan pelanggan untuk publik.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4 text-xs">
                  <div className="border border-border p-4 rounded-xl space-y-3 bg-background">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <Globe size={13} className="text-primary" /> Visual & Tema
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Warna Utama</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={qrSettings.themeColor}
                            onChange={e => setQrSettings(p => ({ ...p, themeColor: e.target.value }))}
                            className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={qrSettings.themeColor}
                            onChange={e => setQrSettings(p => ({ ...p, themeColor: e.target.value }))}
                            className="flex-1 px-2.5 py-1 border border-input rounded-lg bg-card text-xs text-foreground focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Tipografi / Font</label>
                        <select
                          value={qrSettings.typography}
                          onChange={e => setQrSettings(p => ({ ...p, typography: e.target.value }))}
                          className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-card font-medium focus:outline-none"
                        >
                          <option value="Inter">Inter Sans</option>
                          <option value="Outfit">Outfit Modern</option>
                          <option value="Roboto">Roboto Classic</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border p-4 rounded-xl space-y-3 bg-background">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <Truck size={13} className="text-primary" /> Pengantaran (Delivery)
                    </h4>
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-foreground">Aktifkan Fitur Delivery</div>
                        <div className="text-[9px] text-muted-foreground">Pelanggan bisa memesan dari rumah</div>
                      </div>
                      <button
                        onClick={() => setQrSettings(p => ({ ...p, enableDelivery: !p.enableDelivery }))}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all flex ${
                          qrSettings.enableDelivery ? "bg-primary justify-end" : "bg-muted justify-start"
                        }`}
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                      </button>
                    </div>
                    {qrSettings.enableDelivery && (
                      <div className="pt-2 border-t border-border/60">
                        <label className="block text-[10px] text-muted-foreground mb-1 uppercase font-semibold">Tarif Kirim Flat (Rp)</label>
                        <input
                          type="number"
                          value={qrSettings.deliveryFee}
                          onChange={e => setQrSettings(p => ({ ...p, deliveryFee: Number(e.target.value) }))}
                          className="w-full px-3 py-1.5 border border-input rounded-lg bg-card text-xs focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* QR preview mockup */}
                <div className="border border-border p-5 rounded-2xl bg-muted/10 space-y-4 flex flex-col items-center justify-between text-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Mockup Tema Menu di Smartphone:</span>
                  <div className="w-44 h-72 border-4 border-foreground rounded-[24px] bg-background shadow-lg overflow-hidden flex flex-col justify-between">
                    <div style={{ backgroundColor: qrSettings.themeColor }} className="py-3 px-2 text-white">
                      <div className="text-[10px] font-bold">Demo Kafe Menu</div>
                      <div className="text-[7px] opacity-80 mt-0.5">Pesan online cepat & mudah</div>
                    </div>
                    <div className="p-3 space-y-1.5 flex-1 bg-muted/10">
                      <div className="h-2 w-16 bg-muted rounded-full" />
                      <div className="h-6 w-full bg-card border border-border rounded flex justify-between items-center px-1.5">
                        <span className="text-[7px] font-semibold text-foreground">Americano Coffee</span>
                        <span style={{ color: qrSettings.themeColor }} className="text-[7px] font-bold">Rp 22k</span>
                      </div>
                      <div className="h-6 w-full bg-card border border-border rounded flex justify-between items-center px-1.5">
                        <span className="text-[7px] font-semibold text-foreground">Cafe Latte Double</span>
                        <span style={{ color: qrSettings.themeColor }} className="text-[7px] font-bold">Rp 28k</span>
                      </div>
                    </div>
                    <div className="p-2 border-t border-border bg-card">
                      <button style={{ backgroundColor: qrSettings.themeColor }} className="w-full py-1 text-white text-[7px] font-bold rounded">
                        Keranjang (0 Item)
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      alert("Pengaturan tema QR Menu berhasil disimpan dan dipublikasikan.");
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/95 transition-all shadow-sm"
                  >
                    Simpan & Terapkan Tema
                  </button>
                </div>
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
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: branches } = useListBranches();

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

  // Enforce lock checking for cashier/manager
  if (user?.branchId) {
    const assignedBranch = ((branches || []) as any[]).find(b => b.id === user.branchId);
    if (assignedBranch && assignedBranch.status === "locked") {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="bg-card border border-card-border p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-xl">🔒</div>
            <h2 className="font-bold text-base text-foreground">Cabang Anda Terkunci</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cabang **{assignedBranch.name}** saat ini dinonaktifkan (terkunci) karena melampaui batas paket langganan bisnis Anda.
            </p>
            <p className="text-xs text-muted-foreground">
              Silakan hubungi pemilik bisnis untuk meng-upgrade paket langganan agar dapat mengaktifkan kembali cabang ini.
            </p>
          </div>
        </div>
      );
    }
  }

  if (role === "cashier") return <CashierDashboard stats={stats} />;
  if (role === "manager") return <ManagerDashboard stats={stats} />;
  if (role === "staff") return <StaffDashboard />;
  return <OwnerDashboard />;
}
