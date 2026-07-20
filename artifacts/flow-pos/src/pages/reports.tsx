import { useState, useEffect, useMemo } from "react";
import { useGetSalesReport, useGetSalesChartData, useListBranches } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, ShoppingCart, Package, CreditCard, Award, Users, RefreshCw, BarChart3, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveBranch } from "@/hooks/use-active-branch";

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
  const [reportTab, setReportTab] = useState("single"); // "single" or "multi"
  const [period, setPeriod] = useState("month");
  const [customDate, setCustomDate] = useState("");
  const { activeBranchId, setActiveBranchId, branches } = useActiveBranch();

  const queryParams = useMemo(() => {
    if (period === "custom" && customDate) {
      return { period: "custom" as any, dateFrom: customDate, dateTo: customDate, branchId: activeBranchId };
    }
    return { period: period as any, branchId: activeBranchId };
  }, [period, customDate, activeBranchId]);

  const { data: report, isLoading } = useGetSalesReport(queryParams);
  const { data: chartData } = useGetSalesChartData(queryParams);

  // Multi-branch ranking states
  const [rankingsData, setRankingsData] = useState<any>(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);

  const fetchMultiBranchRankings = async () => {
    setRankingsLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/reports/multi-branch", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRankingsData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setRankingsLoading(false);
  };

  useEffect(() => {
    if (reportTab === "multi" && isOwnerOrAdmin) {
      fetchMultiBranchRankings();
    }
  }, [reportTab, isOwnerOrAdmin]);

  const r = report || { totalRevenue: 0, totalOrders: 0, totalItems: 0, averageOrderValue: 0, topProducts: [], byPaymentMethod: [], byCategory: [] };

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Laporan Penjualan</h1>
          <p className="text-muted-foreground text-sm">Analisis performa bisnis Anda secara realtime</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {reportTab === "single" && (
            <>
              {isOwnerOrAdmin && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Cabang:</label>
                  <select
                    value={activeBranchId || ""}
                    onChange={e => setActiveBranchId(e.target.value ? Number(e.target.value) : undefined)}
                    className="px-3 py-1.5 border border-input rounded-xl bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold min-w-[160px]"
                  >
                    <option value="">Semua Cabang</option>
                    {(branches || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 bg-muted rounded-xl p-1 border border-border/40">
                {PERIODS.map(p => (
                  <button key={p.value} onClick={() => { setPeriod(p.value); setCustomDate(""); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === p.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}>
                    {p.label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-border/60">
                  <Calendar size={13} className="text-muted-foreground" />
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => {
                      setCustomDate(e.target.value);
                      if (e.target.value) setPeriod("custom");
                    }}
                    className={`px-2 py-1 text-xs rounded-lg border border-input bg-card font-medium focus:outline-none focus:ring-1 focus:ring-primary ${
                      period === "custom" ? "ring-2 ring-primary text-foreground font-bold" : "text-muted-foreground"
                    }`}
                  />
                </div>
              </div>
            </>
          )}

          {reportTab === "multi" && (
            <button
              onClick={fetchMultiBranchRankings}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm"
            >
              <RefreshCw size={13} /> Muat Ulang
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      {isOwnerOrAdmin && (
        <div className="flex gap-2 border-b border-border pb-px">
          {[
            { id: "single", label: "📊 Laporan Outlet" },
            { id: "multi", label: "🏆 Peringkat Multi-Cabang" }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setReportTab(t.id)}
              className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
                reportTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {reportTab === "single" || !isOwnerOrAdmin ? (
        /* Single Branch Sales Report View */
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Pendapatan", value: formatRp(r.totalRevenue), icon: <TrendingUp size={18} /> },
              { label: "Total Transaksi", value: r.totalOrders.toString(), icon: <ShoppingCart size={18} /> },
              { label: "Total Item Terjual", value: r.totalItems.toString(), icon: <Package size={18} /> },
              { label: "Rata-rata Transaksi", value: formatRp(r.averageOrderValue), icon: <CreditCard size={18} /> },
            ].map(s => (
              <div key={s.label} className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-muted-foreground text-xs font-semibold">{s.label}</div>
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">{s.icon}</div>
                </div>
                <div className="text-xl font-extrabold text-foreground">{isLoading ? "..." : s.value}</div>
              </div>
            ))}
          </div>

          {/* Sales trend chart */}
          <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-sm text-foreground mb-4">Tren Grafik Penjualan</h2>
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
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid border", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [formatRp(v), "Pendapatan"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(226, 90%, 55%)" strokeWidth={2} fill="url(#rGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Top products */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm text-foreground mb-4">Produk Terlaris</h2>
              {(r.topProducts ?? []).length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">Belum ada data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(r.topProducts ?? []).slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => formatRp(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid border", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatRp(v), "Pendapatan"]} />
                    <Bar dataKey="revenue" fill="hsl(226, 90%, 55%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By product category */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm text-foreground mb-4">Kategori Terlaris</h2>
              {(r.byCategory ?? []).length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">Belum ada data</div>
              ) : (
                <div className="flex items-center gap-4">
                  <PieChart width={160} height={160} className="flex-shrink-0">
                    <Pie data={r.byCategory ?? []} cx={75} cy={75} innerRadius={40} outerRadius={70} dataKey="revenue" paddingAngle={3}>
                      {(r.byCategory ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div className="flex-1 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {(r.byCategory ?? []).map((cat, i) => (
                      <div key={cat.categoryId ?? `cat-${i}`} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground font-semibold truncate" title={cat.name}>{cat.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-1.5">
                          <span className="font-bold text-foreground block">{formatRp(cat.revenue)}</span>
                          <span className="text-muted-foreground text-[9px] block font-medium">{cat.totalSold} pcs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* By payment method */}
            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm text-foreground mb-4">Metode Pembayaran</h2>
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
                      <div key={pm.method} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground font-semibold">{PAY_LABELS[pm.method] || pm.method}</span>
                        </div>
                        <div>
                          <span className="font-bold text-foreground">{pm.count}</span>
                          <span className="text-muted-foreground text-[10px] ml-1 font-medium">transaksi</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Multi-branch rankings tab */
        <div className="space-y-6">
          {rankingsLoading ? (
            <div className="py-20 text-center text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <span>Memuat peringkat multi-cabang...</span>
            </div>
          ) : !rankingsData ? (
            <div className="text-center py-10">Gagal memuat ranking multi-cabang</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Branch rankings */}
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="text-primary" size={16} /> Peringkat Cabang
                  </h2>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Pendapatan bulanan terbaik per outlet.</p>
                </div>
                <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {rankingsData.branchRanking.map((branch: any, idx: number) => (
                    <div key={branch.branchId} className="p-3.5 rounded-xl border border-border bg-muted/10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-extrabold text-[11px] text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-xs text-foreground truncate">{branch.name}</h3>
                          <span className="text-[9px] text-muted-foreground mt-0.5 block font-medium">{branch.ordersCount} transaksi selesai</span>
                        </div>
                      </div>
                      <span className="font-extrabold text-xs text-primary flex-shrink-0">{formatRp(branch.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cashier rankings */}
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users className="text-blue-500" size={16} /> Peringkat Kasir Terbaik
                  </h2>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Penjualan bulanan terbesar per karyawan.</p>
                </div>
                <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {rankingsData.cashierRanking.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Belum ada data kasir</div>
                  ) : (
                    rankingsData.cashierRanking.map((cashier: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-border bg-muted/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-extrabold text-[11px] text-blue-500 bg-blue-500/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-foreground truncate">{cashier.name}</h3>
                            <span className="text-[9px] text-muted-foreground mt-0.5 block font-medium">{cashier.ordersCount} transaksi selesai</span>
                          </div>
                        </div>
                        <span className="font-extrabold text-xs text-primary flex-shrink-0">{formatRp(cashier.revenue)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Product rankings */}
              <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="text-amber-500" size={16} /> Menu Terlaris Bulanan
                  </h2>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Produk dengan total volume terjual terbanyak.</p>
                </div>
                <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {rankingsData.productRanking.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Belum ada data produk</div>
                  ) : (
                    rankingsData.productRanking.map((prod: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-border bg-muted/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-extrabold text-[11px] text-amber-500 bg-amber-500/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-foreground truncate">{prod.name}</h3>
                            <span className="text-[9px] text-muted-foreground mt-0.5 block font-medium">Terjual {prod.soldQty} unit</span>
                          </div>
                        </div>
                        <span className="font-extrabold text-xs text-primary flex-shrink-0">{formatRp(prod.revenue)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
