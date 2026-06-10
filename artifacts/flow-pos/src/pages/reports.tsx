import { useState } from "react";
import { useGetSalesReport, useGetSalesChartData, useListBranches, getListBranchesQueryKey } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, ShoppingCart, Package, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

const PERIODS = [
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
  { value: "year", label: "Tahun Ini" },
];

const CHART_COLORS = ["hsl(226, 90%, 55%)", "hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)", "hsl(0, 85%, 55%)"];

const PAY_LABELS: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", bank_transfer: "Transfer", ewallet: "E-Wallet", credit_card: "Kartu Kredit"
};

export default function ReportsPage() {
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "super_admin";
  const [period, setPeriod] = useState("month");
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);

  const { data: branches } = useListBranches({ query: { enabled: isOwnerOrAdmin, queryKey: getListBranchesQueryKey() } });
  const { data: report, isLoading } = useGetSalesReport({ period: period as any, branchId: selectedBranchId });
  const { data: chartData } = useGetSalesChartData({ period: period === "today" ? "week" : (period as any), branchId: selectedBranchId });

  const r = report || { totalRevenue: 0, totalOrders: 0, totalItems: 0, averageOrderValue: 0, topProducts: [], byPaymentMethod: [] };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Laporan Penjualan</h1>
          <p className="text-muted-foreground text-sm">Analisis performa bisnis Anda</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isOwnerOrAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Cabang:</label>
              <select
                value={selectedBranchId || ""}
                onChange={e => setSelectedBranchId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-3 py-1.5 border border-input rounded-xl bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium min-w-[160px]"
              >
                <option value="">Semua Cabang</option>
                {(branches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Pendapatan", value: formatRp(r.totalRevenue), icon: <TrendingUp size={18} /> },
          { label: "Total Transaksi", value: r.totalOrders.toString(), icon: <ShoppingCart size={18} /> },
          { label: "Total Item Terjual", value: r.totalItems.toString(), icon: <Package size={18} /> },
          { label: "Rata-rata Transaksi", value: formatRp(r.averageOrderValue), icon: <CreditCard size={18} /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="text-muted-foreground text-xs font-medium">{s.label}</div>
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">{s.icon}</div>
            </div>
            <div className="text-2xl font-bold text-foreground">{isLoading ? "..." : s.value}</div>
          </div>
        ))}
      </div>

      {/* Sales trend chart */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-foreground mb-4">Tren Penjualan</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData || []}>
            <defs>
              <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
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
            <Area type="monotone" dataKey="revenue" stroke="hsl(226, 90%, 55%)" strokeWidth={2} fill="url(#rGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Produk Terlaris</h2>
          {(r.topProducts ?? []).length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(r.topProducts ?? []).slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatRp(v), "Pendapatan"]} />
                <Bar dataKey="revenue" fill="hsl(226, 90%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By payment method */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Metode Pembayaran</h2>
          {(r.byPaymentMethod ?? []).length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Belum ada data</div>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={160} height={160}>
                <Pie data={r.byPaymentMethod ?? []} cx={75} cy={75} innerRadius={40} outerRadius={70} dataKey="total" paddingAngle={3}>
                  {(r.byPaymentMethod ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {(r.byPaymentMethod ?? []).map((pm, i) => (
                  <div key={pm.method} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{PAY_LABELS[pm.method] || pm.method}</span>
                    </div>
                    <div>
                      <span className="font-semibold">{pm.count}</span>
                      <span className="text-muted-foreground text-xs ml-1">transaksi</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
