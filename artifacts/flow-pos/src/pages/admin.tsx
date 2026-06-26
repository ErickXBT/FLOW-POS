import { useState } from "react";
import {
  useGetAdminStats,
  useListAdminTenants,
  useUpdateTenantStatus,
  useDeleteAdminTenant,
  getListAdminTenantsQueryKey,
  useImpersonateTenant,
  useListAnnouncements,
  useCreateAnnouncement,
  useListSupportTickets,
  useListTicketReplies,
  useCreateTicketReply,
  getListTicketRepliesQueryKey,
  useGetAdminSettings,
  useUpdateAdminSettings,
  useGetSecurityLogs
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield,
  Search,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  Ban,
  CheckCircle,
  Trash2,
  MessageSquare,
  Megaphone,
  Lock,
  Settings,
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Send,
  Eye,
  Server,
  Key,
  DollarSign,
  X
} from "lucide-react";

function formatRp(v: any) {
  if (v === undefined || v === null) return "Rp 0";
  const num = Number(v);
  if (isNaN(num)) return "Rp 0";
  return `Rp ${num.toLocaleString("id-ID")}`;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  trial: { label: "Trial", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  suspended: { label: "Ditangguhkan", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground" },
};

const BUSINESS_TYPE_ICONS: Record<string, string> = {
  fnb: "🍔",
  restaurant: "🍽️",
  cafe: "☕",
  fashion: "👗",
  salon: "✂️",
  minimarket: "🛒"
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  fnb: "F&B",
  restaurant: "Restoran",
  cafe: "Kafe",
  fashion: "Fashion Store",
  salon: "Salon",
  minimarket: "Minimarket"
};

const TABS = [
  { id: "overview", label: "Ringkasan", icon: Server },
  { id: "tenants", label: "Tenant & Bisnis", icon: Building2 },
  { id: "announcements", label: "Pengumuman", icon: Megaphone },
  { id: "tickets", label: "Tiket Dukungan", icon: MessageSquare },
  { id: "security", label: "Keamanan", icon: Lock },
  { id: "settings", label: "Pengaturan Platform", icon: Settings },
];

export default function AdminPage() {
  const { impersonate } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingSubscriptionTenant, setEditingSubscriptionTenant] = useState<any>(null);

  const qc = useQueryClient();
  const { data: stats, refetch: refetchStats } = useGetAdminStats();
  const { data: tenantsData, isLoading: isLoadingTenants, refetch: refetchTenants } = useListAdminTenants({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    limit: 10
  });

  const updateStatus = useUpdateTenantStatus();
  const deleteTenant = useDeleteAdminTenant();
  const impersonateTenant = useImpersonateTenant();

  const handleStatus = (id: number, status: string) => {
    updateStatus.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() });
        refetchStats();
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Hapus bisnis "${name}" secara permanen? Seluruh data penjualan, produk, dan karyawan akan hilang.`)) return;
    deleteTenant.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() });
        refetchStats();
      }
    });
  };

  const handleImpersonate = async (id: number) => {
    try {
      const res = await impersonateTenant.mutateAsync({ id });
      impersonate(res.token, res.user as any);
      window.location.href = "/dashboard";
    } catch {
      alert("Gagal memicu preview dashboard tenant.");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Shield size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Super Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Pusat kendali ekosistem SaaS FlowApp</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              refetchStats();
              refetchTenants();
            }}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-all text-foreground"
          >
            <RefreshCw size={15} /> Aktualkan Data
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="bg-card border border-card-border rounded-2xl p-3 shadow-sm space-y-1 lg:col-span-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === "overview" && <OverviewTab stats={stats} tenants={tenantsData?.data || []} />}
          {activeTab === "tenants" && (
            <TenantsTab
              tenants={tenantsData}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              page={page}
              setPage={setPage}
              handleStatus={handleStatus}
              handleDelete={handleDelete}
              handleImpersonate={handleImpersonate}
              onManageSubscription={(t: any) => setEditingSubscriptionTenant(t)}
              isLoading={isLoadingTenants}
            />
          )}
          {activeTab === "announcements" && <AnnouncementsTab />}
          {activeTab === "tickets" && <TicketsTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>

      {editingSubscriptionTenant && (
        <ManageSubscriptionModal
          tenant={editingSubscriptionTenant}
          onClose={() => setEditingSubscriptionTenant(null)}
          onSave={() => {
            qc.invalidateQueries({ queryKey: getListAdminTenantsQueryKey() });
            setEditingSubscriptionTenant(null);
            refetchStats();
          }}
        />
      )}
    </div>
  );
}

// ── 1. Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab({ stats, tenants }: { stats: any; tenants: any[] }) {
  const s = stats || {
    totalTenants: 0,
    activeTenants: 0,
    suspendedTenants: 0,
    trialUsers: 0,
    expiredSubscriptions: 0,
    monthlyRevenue: 0,
    annualRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalEmployees: 0,
    totalBranches: 0,
    totalTransactions: 0
  };

  return (
    <div className="space-y-6">
      {/* Metrics harmonious grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Tenant", value: s.totalTenants, icon: <Building2 size={16} />, detail: `${s.activeTenants} aktif, ${s.suspendedTenants} suspend` },
          { label: "Pengguna Trial", value: s.trialUsers, icon: <Users size={16} />, detail: "Dalam masa uji coba" },
          { label: "Pemasukan Bulanan (MRR)", value: formatRp(s.monthlyRevenue), icon: <DollarSign size={16} />, detail: "Estimasi pendapatan aktif" },
          { label: "Pemasukan Tahunan (ARR)", value: formatRp(s.annualRevenue), icon: <TrendingUp size={16} />, detail: "Proyeksi 12 bulan" },
          { label: "Total Transaksi POS", value: s.totalTransactions, icon: <Activity size={16} />, detail: `Dari ${s.totalOrders} total pesanan` },
          { label: "Platform Outlet", value: s.totalBranches, icon: <Server size={16} />, detail: `Rata-rata ${(s.totalBranches / (s.totalTenants || 1)).toFixed(1)} cabang/tenant` }
        ].map(item => (
          <div key={item.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="text-muted-foreground text-xs font-semibold">{item.label}</div>
              <div className="p-1.5 rounded-lg bg-accent text-accent-foreground">{item.icon}</div>
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{item.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Resource & AI Row */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* System Server Resources Load (Mock UI Widget) */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4 md:col-span-1">
          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Cpu size={16} className="text-primary" /> Penggunaan Server (Global)
          </div>
          <div className="space-y-3">
            {[
              { label: "CPU Load", val: 18, color: "bg-blue-600" },
              { label: "Memory (RAM)", val: 42, color: "bg-indigo-600" },
              { label: "Storage (Database)", val: 24, color: "bg-green-600" },
              { label: "API Rate limits", val: 8, color: "bg-amber-600" }
            ].map(r => (
              <div key={r.label} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="text-foreground">{r.val}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${r.color}`} style={{ width: `${r.val}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Analytics Recommendation widget */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-3 md:col-span-2">
          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
            <span className="text-lg">✨</span> Rekomendasi Pertumbuhan AI (SaaS Insights)
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            Sistem mendeteksi peningkatan sebesar <strong className="text-foreground">12.5%</strong> pada pendaftaran tenant baru minggu ini. Rata-rata retensi pengguna trial yang melakukan konversi ke plan PRO meningkat setelah mengaktifkan modul QR Menu.
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-primary font-medium flex items-center gap-2">
            <AlertTriangle size={14} /> Tips: Siapkan kupon promo upgrade ke plan PRO menyambut libur akhir tahun untuk memaksimalkan MRR.
          </div>
        </div>
      </div>

      {/* Tenant Preview Panel */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <div className="font-semibold text-foreground text-sm">Tenant Terbaru Terdaftar</div>
        </div>
        <div className="divide-y divide-border/50">
          {tenants.slice(0, 4).map(t => (
            <div key={t.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/10 transition-all">
              <div>
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.email || "No email"}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_MAP[t.status]?.cls}`}>
                  {STATUS_MAP[t.status]?.label}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{t.subscriptionPlan || "Trial"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManageSubscriptionModal({ tenant, onClose, onSave }: any) {
  const [plan, setPlan] = useState(tenant.subscriptionPlan || "trial");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/admin/tenants/${tenant.id}/subscription`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ subscriptionPlan: plan, expiresDays: days }),
      });

      if (!res.ok) throw new Error("Gagal memperbarui langganan");
      const updated = await res.json();
      onSave(updated);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm font-sans">Kelola Paket Langganan Tenant</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          {error && <div className="p-3 text-xs bg-red-100 text-red-700 dark:bg-red-950/20 rounded-xl">{error}</div>}
          
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Nama Tenant</label>
            <div className="text-xs font-bold text-foreground bg-muted/30 border border-border p-2.5 rounded-xl">{tenant.name}</div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Paket Langganan *</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="trial">Trial (Maks 1 Outlet - 7 Hari Gratis)</option>
              <option value="starter">FlowApp UMKM (Maks 1 Outlet - Rp169.000/bln)</option>
              <option value="business">FlowApp Multi (Maks 3 Outlet - Rp299.000/bln)</option>
              <option value="pro">FlowApp Pro (Maks 5 Outlet - Rp749k/bln)</option>
              <option value="enterprise">FlowApp Enterprise (Maks Unlimited - Hubungi Sales)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Durasi Aktif (Hari) *</label>
            <input
              type="number"
              min="1"
              required
              value={days}
              onChange={e => setDays(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none"
            />
          </div>
          
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted text-foreground font-sans">Batal</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 font-sans"
            >
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 2. Tenants Tab ────────────────────────────────────────────────────────────
function TenantsTab({
  tenants,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  handleStatus,
  handleDelete,
  handleImpersonate,
  onManageSubscription,
  isLoading
}: any) {
  return (
    <div className="space-y-4">
      {/* Filtering */}
      <div className="flex gap-3 flex-wrap bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama tenant atau email..."
            className="w-full pl-10 pr-4 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 border border-input rounded-xl bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tenants Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-muted-foreground text-sm font-medium animate-pulse">Memuat data tenant...</div>
        ) : (
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Tenant / Bisnis", "Metrik & Tipe", "Status", "Plan", "Aksi"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-muted-foreground font-semibold text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(tenants?.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-16">
                      <Building2 size={40} className="mx-auto mb-3 opacity-20" />
                      <div className="font-semibold text-sm">Tidak ada tenant ditemukan</div>
                    </td>
                  </tr>
                ) : (
                  (tenants.data || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.email || "—"}</div>
                        <div className="text-[10px] text-muted-foreground/80 mt-1">
                          Terdaftar: {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1.5 text-xs text-foreground font-medium mb-1">
                          <span>{BUSINESS_TYPE_ICONS[t.businessType] || "🏪"}</span>
                          <span className="capitalize">{BUSINESS_TYPE_LABELS[t.businessType] || t.businessType}</span>
                        </span>
                        <div className="text-[10px] text-muted-foreground">{t.phone || "No HP"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${STATUS_MAP[t.status]?.cls}`}>
                          {STATUS_MAP[t.status]?.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-primary uppercase">{t.subscriptionPlan || "TRIAL"}</div>
                        {t.subscriptionExpiresAt && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            Hingga: {new Date(t.subscriptionExpiresAt).toLocaleDateString("id-ID")}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleImpersonate(t.id)}
                            title="Preview Dasbor Tenant (Impersonasi)"
                            className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all shadow-sm"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => onManageSubscription(t)}
                            title="Kelola Paket Langganan"
                            className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/20 dark:text-indigo-400 rounded-xl transition-all animate-fade-in shadow-sm"
                          >
                            <Settings size={14} />
                          </button>
                          {t.status !== "active" ? (
                            <button
                              onClick={() => handleStatus(t.id, "active")}
                              title="Aktifkan Tenant"
                              className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-950/20 dark:text-green-400 rounded-xl transition-all"
                            >
                              <CheckCircle size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatus(t.id, "suspended")}
                              title="Suspend Tenant"
                              className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white dark:bg-amber-950/20 dark:text-amber-400 rounded-xl transition-all"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(t.id, t.name)}
                            title="Hapus Tenant"
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-950/20 dark:text-red-400 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {tenants && tenants.total > 10 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3.5 py-2 border border-border bg-card rounded-xl text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            Sebelumnya
          </button>
          <span className="text-xs text-muted-foreground font-medium">Halaman {page}</span>
          <button
            onClick={() => setPage((p: number) => p + 1)}
            disabled={page * 10 >= tenants.total}
            className="px-3.5 py-2 border border-border bg-card rounded-xl text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}

// ── 3. Announcements Tab ──────────────────────────────────────────────────────
function AnnouncementsTab() {
  const { data: list, refetch } = useListAnnouncements();
  const createAnn = useCreateAnnouncement();
  const [form, setForm] = useState({ title: "", content: "", type: "general" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setLoading(true);
    try {
      await createAnn.mutateAsync({ data: form });
      setForm({ title: "", content: "", type: "general" });
      refetch();
    } catch {
      alert("Gagal memposting pengumuman.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-5 gap-6">
      {/* Create Announcement Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-2">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Megaphone size={16} className="text-primary" /> Siarkan Pengumuman Baru
        </h3>
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Judul Pengumuman</label>
          <input
            type="text"
            required
            placeholder="Contoh: Pemeliharaan Server POS"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Tipe Kampanye</label>
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="general">Umum (Info)</option>
            <option value="maintenance">Pemeliharaan (Maintenance)</option>
            <option value="update">Pembaruan Fitur (Update)</option>
            <option value="promotion">Promo Platform (Promo)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Isi Pengumuman</label>
          <textarea
            required
            placeholder="Tulis pesan detail pengumuman di sini..."
            rows={4}
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !form.title.trim()}
          className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/10"
        >
          {loading ? "Memposting..." : <><Megaphone size={14} /> Siarkan Sekarang</>}
        </button>
      </form>

      {/* List Announcements */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 md:col-span-3">
        <h3 className="font-semibold text-foreground text-sm">Arsip Pengumuman Terkirim</h3>
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {(list || []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs font-medium">Belum ada pengumuman disiarkan.</div>
          ) : (
            (list || []).map(a => (
              <div key={a.id} className="bg-background border border-border p-4 rounded-xl space-y-2 hover:shadow-sm transition-all">
                <div className="flex justify-between items-start">
                  <div className="text-sm font-bold text-foreground">{a.title}</div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    a.type === "maintenance" ? "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400" :
                    a.type === "update" ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400" :
                    a.type === "promotion" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                  }`}>
                    {a.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{a.content}</p>
                <div className="text-[10px] text-muted-foreground/70 text-right">
                  {new Date(a.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── 4. Tickets Tab ────────────────────────────────────────────────────────────
function TicketsTab() {
  const { data: tickets, refetch: refetchTickets } = useListSupportTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const { data: replies, refetch: refetchReplies } = useListTicketReplies(selectedTicketId ?? 0, {
    query: {
      enabled: !!selectedTicketId,
      queryKey: getListTicketRepliesQueryKey(selectedTicketId ?? 0)
    }
  });
  const createReply = useCreateTicketReply();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const selectedTicket = (tickets || []).find(t => t.id === selectedTicketId);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;
    setSending(true);
    try {
      await createReply.mutateAsync({ id: selectedTicketId, data: { message: replyText } });
      setReplyText("");
      refetchReplies();
      refetchTickets();
    } catch {
      alert("Gagal mengirim balasan tiket.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* Tickets List */}
      <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm md:col-span-2 space-y-3">
        <h3 className="font-semibold text-foreground text-sm mb-3">Antrean Tiket Dukungan</h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {(tickets || []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs font-medium">Tidak ada tiket dukungan.</div>
          ) : (
            (tickets || []).map(t => {
              const active = selectedTicketId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 flex flex-col justify-between ${
                    active
                      ? "bg-primary/5 border-primary shadow-sm"
                      : "bg-background border-border hover:bg-muted/10"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-xs font-semibold text-primary truncate max-w-[120px]">{t.tenantName || `Tenant #${t.tenantId}`}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      t.status === "resolved" ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400" :
                      t.status === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {t.status === "resolved" ? "Selesai" : t.status === "in_progress" ? "Proses" : "Baru"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground truncate w-full">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate w-full">{t.description}</div>
                  <div className="text-[9px] text-muted-foreground/75 text-right w-full">
                    {new Date(t.createdAt).toLocaleDateString("id-ID")}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Ticket Conversation Box */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm md:col-span-3 min-h-[420px] flex flex-col justify-between">
        {!selectedTicket ? (
          <div className="flex flex-col items-center justify-center h-full text-center flex-1 py-16">
            <MessageSquare size={36} className="text-muted-foreground/30 mb-3" />
            <div className="text-muted-foreground text-sm font-medium">Pilih tiket dukungan dari daftar</div>
            <div className="text-muted-foreground text-xs mt-1">Untuk membuka utas pesan bantuan tenant.</div>
          </div>
        ) : (
          <div className="flex flex-col h-full flex-1">
            {/* Conversation Header */}
            <div className="border-b border-border pb-3 mb-4 flex justify-between items-start">
              <div>
                <h4 className="font-bold text-foreground text-sm">{selectedTicket.title}</h4>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Tenant: <span className="font-semibold text-primary">{selectedTicket.tenantName}</span> &bull; Kategori: {selectedTicket.category}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                selectedTicket.status === "resolved" ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400" :
                selectedTicket.status === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {selectedTicket.status === "resolved" ? "Selesai" : selectedTicket.status === "in_progress" ? "Proses" : "Baru"}
              </span>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-1 mb-4 scrollbar-thin">
              {/* Original ticket desc */}
              <div className="bg-muted/30 border border-border p-3 rounded-2xl space-y-1">
                <div className="text-xs font-semibold text-foreground flex justify-between">
                  <span>{selectedTicket.tenantName} (Deskripsi Asal)</span>
                  <span className="text-[10px] text-muted-foreground/80 font-normal">
                    {new Date(selectedTicket.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* Replies list */}
              {(replies || []).map((rep: any) => {
                const isAdmin = rep.senderRole === "admin";
                return (
                  <div key={rep.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"} space-y-1`}>
                    <div className="text-[10px] text-muted-foreground font-semibold px-1">
                      {rep.senderName} &bull; {isAdmin ? "Staf Flow" : "Tenant"}
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                      isAdmin
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground rounded-tl-none"
                    }`}>
                      {rep.message}
                    </div>
                    <div className="text-[8px] text-muted-foreground/60 px-1">
                      {new Date(rep.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="flex gap-2 items-center border-t border-border pt-4">
              <input
                type="text"
                placeholder="Ketik balasan Anda..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/95 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm shadow-primary/10"
              >
                {sending ? "..." : <><Send size={12} /> Balas</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 5. Security Tab ───────────────────────────────────────────────────────────
function SecurityTab() {
  const { data: logs, isLoading } = useGetSecurityLogs();

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Lock size={16} className="text-red-500" /> Log Audit & Keamanan Sistem
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Daftar kejadian sensitif, kegagalan otentikasi, login mencurigakan, dan logout akun.</p>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-xs animate-pulse font-medium">Memuat log audit...</div>
        ) : (
          <table className="w-full text-xs font-sans">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-semibold text-[10px]">
                {["Waktu", "User & Tenant ID", "Aktivitas", "Modul", "Alamat IP", "Keterangan"].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {(logs || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground font-medium">Tidak ada kejadian mencurigakan terdeteksi.</td>
                </tr>
              ) : (
                (logs || []).map(l => {
                  const isSuspicious = ["failed_login", "suspicious_login", "unauthorized_access"].includes(l.action);
                  return (
                    <tr key={l.id} className={`hover:bg-muted/10 transition-all ${isSuspicious ? "bg-red-50/20 dark:bg-red-950/5" : ""}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{l.userName}</div>
                        <div className="text-[10px] text-muted-foreground">Tenant ID: {l.tenantId || "Global"} &bull; {l.userRole}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          l.action === "suspicious_login" ? "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400" :
                          l.action === "failed_login" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                          l.action === "logout" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                        }`}>
                          {l.action.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-muted-foreground capitalize">{l.module || "—"}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{l.ipAddress || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={JSON.stringify(l.details || {})}>
                        {JSON.stringify(l.details || {})}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── 6. Settings Tab ───────────────────────────────────────────────────────────
function SettingsTab() {
  const { data: dbSettings, refetch } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  const [loading, setLoading] = useState(false);

  const value = (dbSettings?.value as any) || {
    branding: { title: "FlowApp Platform", primaryColor: "#1D4EF5" },
    gateways: { qrisActive: true, stripeActive: false, xenditActive: true },
    tax: { defaultRate: 11, active: true },
    email: { smtpHost: "smtp.mailtrap.io", smtpPort: 2525, active: true },
    sms: { provider: "twilio", active: false },
    storage: { provider: "supabase", active: true },
    cdn: { provider: "cloudflare", active: false }
  };

  const handleUpdate = async (updatedValue: any) => {
    setLoading(true);
    try {
      await updateSettings.mutateAsync({ data: { value: updatedValue } });
      refetch();
    } catch {
      alert("Gagal memperbarui konfigurasi platform.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGateway = (key: string) => {
    const newVal = {
      ...value,
      gateways: { ...value.gateways, [key]: !value.gateways[key] }
    };
    handleUpdate(newVal);
  };

  const toggleBranding = (field: string, val: string) => {
    const newVal = {
      ...value,
      branding: { ...value.branding, [field]: val }
    };
    handleUpdate(newVal);
  };

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-6">
      <div>
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Settings size={16} className="text-primary" /> Pengaturan Sistem POS SaaS (Global)
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Konfigurasikan gateway pembayaran, template email SMTP, integrasi CDN, dan pajak platform.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Branding & Payment Gateways */}
        <div className="space-y-5">
          <div className="border border-border p-4 rounded-xl space-y-3.5 bg-background">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Eye size={13} className="text-primary" /> Branding & Platform Label
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Nama Judul Platform</label>
                <input
                  type="text"
                  value={value.branding.title}
                  onChange={e => toggleBranding("title", e.target.value)}
                  className="w-full px-3 py-1.5 border border-input rounded-lg bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Warna Utama (Brand Color)</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={value.branding.primaryColor}
                    onChange={e => toggleBranding("primaryColor", e.target.value)}
                    className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={value.branding.primaryColor}
                    onChange={e => toggleBranding("primaryColor", e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-input rounded-lg bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border p-4 rounded-xl space-y-3 bg-background">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Key size={13} className="text-primary" /> Gateway Transaksi (Payments)
            </h4>
            <div className="space-y-2.5">
              {[
                { key: "qrisActive", label: "Dukungan QRIS Otomatis", sub: "Gunakan QRIS dinamis untuk tenant" },
                { key: "xenditActive", label: "Virtual Account (VA) Xendit", sub: "Integrasi VA transfer bank instan" },
                { key: "stripeActive", label: "Gerbang Kartu Kredit Stripe", sub: "Kartu kredit internasional & Apple Pay" }
              ].map(gw => (
                <div key={gw.key} className="flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-foreground">{gw.label}</div>
                    <div className="text-[10px] text-muted-foreground">{gw.sub}</div>
                  </div>
                  <button
                    onClick={() => toggleGateway(gw.key)}
                    disabled={loading}
                    className={`w-10 h-5 rounded-full p-0.5 transition-all flex ${
                      value.gateways[gw.key] ? "bg-primary justify-end" : "bg-muted justify-start"
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Third-Party Service Providers */}
        <div className="space-y-5">
          {/* SMTP Email Server */}
          <div className="border border-border p-4 rounded-xl space-y-3.5 bg-background">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Megaphone size={13} className="text-primary" /> Server Mailer (SMTP)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-0.5">SMTP Host</label>
                <input
                  type="text"
                  value={value.email.smtpHost}
                  onChange={e => {
                    const newVal = { ...value, email: { ...value.email, smtpHost: e.target.value } };
                    handleUpdate(newVal);
                  }}
                  className="w-full px-2.5 py-1.5 border border-input rounded-lg bg-card text-xs text-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Port</label>
                <input
                  type="number"
                  value={value.email.smtpPort}
                  onChange={e => {
                    const newVal = { ...value, email: { ...value.email, smtpPort: Number(e.target.value) } };
                    handleUpdate(newVal);
                  }}
                  className="w-full px-2.5 py-1.5 border border-input rounded-lg bg-card text-xs text-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Infrastructure Integration */}
          <div className="border border-border p-4 rounded-xl space-y-3.5 bg-background">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Server size={13} className="text-primary" /> Infrastruktur Penyimpanan Cloud
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-foreground">Cloud Storage Provider</div>
                  <div className="text-[10px] text-muted-foreground">Untuk unggah gambar produk & struk tenant</div>
                </div>
                <select
                  value={value.storage.provider}
                  onChange={e => {
                    const newVal = { ...value, storage: { ...value.storage, provider: e.target.value } };
                    handleUpdate(newVal);
                  }}
                  className="px-2.5 py-1 border border-border rounded-lg bg-card font-medium focus:outline-none"
                >
                  <option value="supabase">Supabase Bucket</option>
                  <option value="aws">Amazon S3 Bucket</option>
                  <option value="local">Penyimpanan Lokal</option>
                </select>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-border/60">
                <div>
                  <div className="font-semibold text-foreground">CDN Global & Caching</div>
                  <div className="text-[10px] text-muted-foreground">Aktifkan Cloudflare Edge Caching</div>
                </div>
                <button
                  onClick={() => {
                    const newVal = { ...value, cdn: { ...value.cdn, active: !value.cdn.active } };
                    handleUpdate(newVal);
                  }}
                  disabled={loading}
                  className={`w-10 h-5 rounded-full p-0.5 transition-all flex ${
                    value.cdn.active ? "bg-primary justify-end" : "bg-muted justify-start"
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
