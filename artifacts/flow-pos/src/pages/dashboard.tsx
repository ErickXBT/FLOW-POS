import { useGetDashboardStats, useGetRecentOrders, useGetTopProducts, useGetSalesChartData } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertTriangle, DollarSign, ChefHat, Truck, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
        {(recentOrders || []).slice(0, 5).map(o => (
          <div key={o.id} className="px-5 py-3 flex items-center justify-between border-b border-border/50">
            <div className="text-xs font-mono text-foreground">{o.orderNumber}</div>
            <div className="font-semibold text-foreground">{formatRp(o.total)}</div>
          </div>
        ))}
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
function OwnerDashboard({ stats }: { stats: any }) {
  const { data: recentOrders } = useGetRecentOrders({ limit: 5 });
  const { data: topProducts } = useGetTopProducts({ limit: 5 });
  const { data: chartData } = useGetSalesChartData({ period: "week" });
  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, monthlyRevenue: 0, weeklyRevenue: 0, revenueGrowth: 0 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Ringkasan performa bisnis Anda hari ini</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={18} />} sub={`${s.todayOrders} transaksi`} />
        <StatCard label="Pendapatan Bulan Ini" value={formatRp(s.monthlyRevenue)} icon={<TrendingUp size={18} />} trend={s.revenueGrowth} />
        <StatCard label="Total Produk" value={s.totalProducts.toString()} icon={<Package size={18} />} sub={s.lowStockCount > 0 ? `${s.lowStockCount} stok rendah` : "Semua stok aman"} />
        <StatCard label="Total Pelanggan" value={s.totalCustomers.toString()} icon={<Users size={18} />} sub="Terdaftar" />
      </div>
      {s.lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Peringatan Stok Rendah</div>
            <div className="text-xs text-amber-700 dark:text-amber-400">{s.lowStockCount} produk mendekati habis. Segera lakukan pengisian stok.</div>
          </div>
          <Link href="/inventory">
            <a className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline flex-shrink-0">Lihat inventori</a>
          </Link>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="font-semibold text-foreground">Penjualan Mingguan</div>
              <div className="text-xs text-muted-foreground">7 hari terakhir</div>
            </div>
            <div className="text-2xl font-bold text-primary">{formatRp(s.weeklyRevenue)}</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData || []}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(226, 90%, 55%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(226, 90%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatRp(v), "Pendapatan"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(226, 90%, 55%)" strokeWidth={2} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="font-semibold text-foreground mb-4">Produk Terlaris</div>
          <div className="space-y-3">
            {(topProducts || []).length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">Belum ada data penjualan</div>
            )}
            {(topProducts || []).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.totalSold} terjual</div>
                </div>
                <div className="text-sm font-semibold text-primary">{formatRp(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-foreground">Transaksi Terbaru</div>
          <Link href="/orders"><a className="text-sm text-primary hover:underline font-medium">Lihat semua</a></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["No. Order", "Total", "Metode", "Status", "Waktu"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders || []).length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Belum ada transaksi</td></tr>
              )}
              {(recentOrders || []).map(o => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-foreground">{o.orderNumber}</td>
                  <td className="px-5 py-3 font-semibold text-foreground">{formatRp(o.total)}</td>
                  <td className="px-5 py-3 text-muted-foreground capitalize">{o.paymentMethod?.replace("_", " ")}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.status === "completed" ? "bg-green-100 dark:bg-green-900/30 text-green-700" :
                      o.status === "pending" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" :
                      "bg-red-100 dark:bg-red-900/30 text-red-700"
                    }`}>
                      {o.status === "completed" ? "Selesai" : o.status === "pending" ? "Pending" : "Dibatalkan"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(o.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats();

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

  if (role === "cashier") return <CashierDashboard stats={stats} />;
  if (role === "manager") return <ManagerDashboard stats={stats} />;
  if (role === "staff") return <StaffDashboard />;
  return <OwnerDashboard stats={stats} />;
}
