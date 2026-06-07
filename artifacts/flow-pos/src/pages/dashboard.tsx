import { useGetDashboardStats, useGetRecentOrders, useGetTopProducts, useGetSalesChartData } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertTriangle, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentOrders } = useGetRecentOrders({ limit: 5 });
  const { data: topProducts } = useGetTopProducts({ limit: 5 });
  const { data: chartData } = useGetSalesChartData({ period: "week" });

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const s = stats || { todaySales: 0, todayOrders: 0, totalProducts: 0, totalCustomers: 0, lowStockCount: 0, monthlyRevenue: 0, weeklyRevenue: 0, revenueGrowth: 0 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Ringkasan performa bisnis Anda hari ini</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRp(s.todaySales)} icon={<DollarSign size={18} />} sub={`${s.todayOrders} transaksi`} />
        <StatCard label="Pendapatan Bulan Ini" value={formatRp(s.monthlyRevenue)} icon={<TrendingUp size={18} />} trend={s.revenueGrowth} />
        <StatCard label="Total Produk" value={s.totalProducts.toString()} icon={<Package size={18} />} sub={s.lowStockCount > 0 ? `${s.lowStockCount} stok rendah` : "Semua stok aman"} />
        <StatCard label="Total Pelanggan" value={s.totalCustomers.toString()} icon={<Users size={18} />} sub="Terdaftar" />
      </div>

      {/* Low stock alert */}
      {s.lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Peringatan Stok Rendah</div>
            <div className="text-xs text-amber-700 dark:text-amber-400">{s.lowStockCount} produk mendekati habis. Segera lakukan pengisian stok.</div>
          </div>
          <a href="/inventory" className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline flex-shrink-0">
            Lihat inventori
          </a>
        </div>
      )}

      {/* Chart + Top Products */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
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

        {/* Top Products */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="font-semibold text-foreground mb-4">Produk Terlaris</div>
          <div className="space-y-3">
            {(topProducts || []).length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">Belum ada data penjualan</div>
            )}
            {(topProducts || []).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
                  {i + 1}
                </div>
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

      {/* Recent Orders */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-foreground">Transaksi Terbaru</div>
          <a href="/orders" className="text-sm text-primary hover:underline font-medium">Lihat semua</a>
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
                  <td className="px-5 py-3 text-muted-foreground capitalize">{o.paymentMethod.replace("_", " ")}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.status === "completed" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                      o.status === "pending" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
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
