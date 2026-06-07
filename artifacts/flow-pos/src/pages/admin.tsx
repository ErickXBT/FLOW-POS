import { useState } from "react";
import { useGetAdminStats, useListAdminTenants, useUpdateTenantStatus, useDeleteAdminTenant, getListAdminTenantsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Search, Building2, Users, TrendingUp, AlertTriangle, Ban, CheckCircle, Trash2 } from "lucide-react";

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  trial: { label: "Trial", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  suspended: { label: "Ditangguhkan", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground" },
};

const BUSINESS_TYPE_ICONS: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", fashion: "👗", salon: "✂️", minimarket: "🛒"
};

export default function AdminPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data: stats } = useGetAdminStats();
  const { data: tenantsData, isLoading } = useListAdminTenants({ search: search || undefined, status: statusFilter || undefined, page, limit: 20 });
  const updateStatus = useUpdateTenantStatus();
  const deleteTenant = useDeleteAdminTenant();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() });

  const handleStatus = (id: number, status: string) => {
    updateStatus.mutate({ id, data: { status: status as any } }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Hapus bisnis "${name}" secara permanen?`)) return;
    deleteTenant.mutate({ id }, { onSuccess: invalidate });
  };

  const s = stats;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Kelola semua bisnis dan tenant</p>
        </div>
      </div>

      {/* Stats */}
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Bisnis", value: s.totalTenants, icon: <Building2 size={18} />, sub: `${s.activeTenants} aktif` },
            { label: "Total Pengguna", value: s.totalUsers, icon: <Users size={18} /> },
            { label: "Total Transaksi", value: s.totalTransactions, icon: <TrendingUp size={18} /> },
            { label: "Langganan Kadaluarsa", value: s.expiredSubscriptions, icon: <AlertTriangle size={18} /> },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="text-muted-foreground text-xs font-medium">{stat.label}</div>
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">{stat.icon}</div>
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              {stat.sub && <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Tenant list */}
      <div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari bisnis..."
              className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Semua Status</option>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Memuat...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Bisnis", "Tipe", "Status", "Langganan", "Terdaftar", "Aksi"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(tenantsData?.data || []).length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-12">
                      <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                      <div>Tidak ada bisnis ditemukan</div>
                    </td></tr>
                  )}
                  {(tenantsData?.data || []).map((t: any) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{t.name}</div>
                        {t.email && <div className="text-xs text-muted-foreground">{t.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{BUSINESS_TYPE_ICONS[t.businessType] || "🏪"}</span>
                          <span className="text-muted-foreground capitalize">{t.businessType}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[t.status]?.cls}`}>
                          {STATUS_MAP[t.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{t.subscriptionPlan || "trial"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(t.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {t.status !== "active" && (
                            <button onClick={() => handleStatus(t.id, "active")} title="Aktifkan"
                              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-muted-foreground hover:text-green-600">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {t.status === "active" && (
                            <button onClick={() => handleStatus(t.id, "suspended")} title="Tangguhkan"
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded text-muted-foreground hover:text-amber-600">
                              <Ban size={14} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(t.id, t.name)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {tenantsData && tenantsData.total > 20 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Sebelumnya</button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">Hal. {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= tenantsData.total}
              className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
}
