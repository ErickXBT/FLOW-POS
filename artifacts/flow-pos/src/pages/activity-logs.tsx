import { useState, useEffect, useRef } from "react";
import { Activity, RefreshCw, Filter, Shield, User, ShoppingCart, Package, LogIn, LogOut, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTION_ICONS: Record<string, any> = {
  login: LogIn, logout: LogOut, failed_login: AlertTriangle,
  create_order: ShoppingCart, cancel_order: ShoppingCart,
  edit_product: Package, adjust_stock: Package, create_employee: User,
};
const ACTION_LABELS: Record<string, string> = {
  login: "Login", logout: "Logout", failed_login: "Login Gagal",
  create_order: "Buat Pesanan", cancel_order: "Batalkan Pesanan",
  edit_product: "Edit Produk", adjust_stock: "Sesuaikan Stok",
  create_employee: "Tambah Karyawan", invite_employee: "Undang Karyawan",
};
const ACTION_COLORS: Record<string, string> = {
  login: "text-green-500 bg-green-50 dark:bg-green-900/20",
  logout: "text-gray-500 bg-gray-50 dark:bg-gray-900/20",
  failed_login: "text-red-500 bg-red-50 dark:bg-red-900/20",
  create_order: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  cancel_order: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  edit_product: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
  adjust_stock: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20",
};
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", manager: "Manager", cashier: "Kasir",
  kitchen_staff: "Dapur", delivery_staff: "Kurir", staff: "Staff", super_admin: "Super Admin",
};

function timeStr(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"activity" | "sessions">("activity");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const tokenRef = useRef(localStorage.getItem("flow_token") ?? "");

  async function fetchLogs() {
    const params = new URLSearchParams({ limit: "100" });
    if (moduleFilter) params.set("module", moduleFilter);
    if (actionFilter) params.set("action", actionFilter);
    const r = await fetch(`${BASE}/api/activity-logs?${params}`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (r.ok) { const d = await r.json(); setLogs(d.data ?? []); }
    setLoading(false);
  }

  async function fetchSessions() {
    const r = await fetch(`${BASE}/api/sessions`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (r.ok) setSessions(await r.json());
  }

  useEffect(() => { fetchLogs(); fetchSessions(); }, [moduleFilter, actionFilter]);

  const modules = [...new Set(logs.map(l => l.module).filter(Boolean))];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity size={20} className="text-primary" /> Log Aktivitas
          </h1>
          <p className="text-muted-foreground text-sm">Pantau aktivitas semua karyawan</p>
        </div>
        <button onClick={() => { setLoading(true); fetchLogs(); fetchSessions(); }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {[
          { key: "activity", label: "Aktivitas" },
          { key: "sessions", label: `Sesi Aktif (${sessions.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "activity" ? (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none">
              <option value="">Semua Aksi</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none">
              <option value="">Semua Modul</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(actionFilter || moduleFilter) && (
              <button onClick={() => { setActionFilter(""); setModuleFilter(""); }}
                className="text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                Reset
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20">
              <Activity size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <div className="text-muted-foreground text-sm">Belum ada aktivitas tercatat</div>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Waktu", "Pengguna", "Role", "Aksi", "Modul", "Detail", "IP"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const Icon = ACTION_ICONS[log.action] ?? Activity;
                      const color = ACTION_COLORS[log.action] ?? "text-gray-500 bg-gray-50";
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeStr(log.createdAt)}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-foreground text-xs">{log.userName}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              {ROLE_LABELS[log.userRole] ?? log.userRole}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                              <Icon size={10} />
                              {ACTION_LABELS[log.action] ?? log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.module ?? "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ipAddress ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Sessions */
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-20">
              <Shield size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <div className="text-muted-foreground text-sm">Tidak ada sesi aktif</div>
            </div>
          ) : sessions.map(s => (
            <div key={s.id} className="bg-card border border-card-border rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">User #{s.userId}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {ROLE_LABELS[s.userRole] ?? s.userRole}
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">● Online</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{s.device ?? "Unknown Device"}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>IP: {s.ipAddress ?? "—"}</span>
                  <span>Login: {timeStr(s.createdAt)}</span>
                  <span>Terakhir: {timeStr(s.lastSeenAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
