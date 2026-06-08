import { useState } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, UserCheck, X, KeyRound, ChefHat, Truck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ALL_ROLES = [
  { value: "manager", label: "Manager", icon: "👔", desc: "Akses penuh operasional" },
  { value: "cashier", label: "Kasir", icon: "💳", desc: "POS dan transaksi" },
  { value: "kitchen_staff", label: "Staff Dapur", icon: "🍳", desc: "Kitchen display system" },
  { value: "delivery_staff", label: "Kurir", icon: "🛵", desc: "Pesanan delivery" },
  { value: "staff", label: "Staff", icon: "👤", desc: "Akses terbatas" },
];

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager", cashier: "Kasir", kitchen_staff: "Staff Dapur",
  delivery_staff: "Kurir", staff: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  kitchen_staff: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivery_staff: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  staff: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function EmployeeForm({ initial, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    role: initial?.role || "cashier",
    isActive: initial?.isActive ?? true,
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">{initial ? "Edit Karyawan" : "Tambah Karyawan"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "name", label: "Nama Lengkap *", type: "text", placeholder: "Nama karyawan" },
            { key: "email", label: "Email (untuk akun login)", type: "email", placeholder: "email@contoh.com" },
            { key: "phone", label: "No. Telepon", type: "text", placeholder: "08xx" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1 text-foreground">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Role</label>
            <div className="grid grid-cols-1 gap-2">
              {ALL_ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, role: r.value }))}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${form.role === r.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                  <span className="text-xl">{r.icon}</span>
                  <div>
                    <div className="font-medium text-sm text-foreground">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.desc}</div>
                  </div>
                  {form.role === r.value && <ShieldCheck size={16} className="ml-auto text-primary" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
            <label htmlFor="isActive" className="text-sm font-medium text-foreground">Aktif</label>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("flow_token") ?? "";

  async function handleInvite() {
    if (!password || password.length < 6) { setError("Password minimal 6 karakter"); return; }
    setLoading(true); setError("");
    const r = await fetch(`${BASE}/api/employees/${employee.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    if (r.ok) { setDone(true); }
    else { const e = await r.json(); setError(e.error ?? "Gagal mengundang"); }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound size={16} className="text-primary" /> Buat Akun Login</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-foreground mb-1">Akun berhasil dibuat!</div>
            <div className="text-sm text-muted-foreground mb-1">Email: <strong>{employee.email}</strong></div>
            <div className="text-sm text-muted-foreground mb-4">Role: <strong>{ROLE_LABELS[employee.role] ?? employee.role}</strong></div>
            <div className="bg-muted rounded-lg px-4 py-3 text-xs text-muted-foreground mb-4">
              Karyawan dapat login dengan email dan password yang ditetapkan. Dashboard akan disesuaikan dengan role mereka.
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Selesai</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <div className="text-sm font-medium text-foreground">{employee.name}</div>
              <div className="text-xs text-muted-foreground">{employee.email}</div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[employee.role] ?? ""}`}>
                {ROLE_LABELS[employee.role] ?? employee.role}
              </span>
            </div>
            {!employee.email && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                Tambahkan email karyawan terlebih dahulu sebelum membuat akun login.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Set Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter" disabled={!employee.email}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
            </div>
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Batal</button>
              <button onClick={handleInvite} disabled={loading || !employee.email || !password}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? "..." : "Buat Akun"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [inviting, setInviting] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const { mutateAsync: create, isPending: creating } = useCreateEmployee();
  const { mutateAsync: update, isPending: updating } = useUpdateEmployee();
  const { mutateAsync: remove } = useDeleteEmployee();

  async function handleCreate(form: any) {
    await create({ body: form });
    queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
    setShowForm(false);
  }
  async function handleUpdate(form: any) {
    await update({ params: { id: editing.id }, body: form });
    queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
    setEditing(null);
  }
  async function handleDelete(id: number) {
    if (!confirm("Hapus karyawan ini?")) return;
    await remove({ params: { id } });
    queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
  }

  const canManage = user && ["owner", "manager"].includes(user.role);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Karyawan</h1>
          <p className="text-muted-foreground text-sm">Kelola tim dan akses sistem</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Tambah Karyawan
          </button>
        )}
      </div>

      {/* Role guide */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        {ALL_ROLES.map(r => (
          <div key={r.value} className="bg-card border border-card-border rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{r.icon}</div>
            <div className="text-xs font-semibold text-foreground">{r.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari karyawan..."
          className="w-full pl-9 pr-4 py-2.5 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-card border border-card-border animate-pulse" />)}
        </div>
      ) : (employees || []).length === 0 ? (
        <div className="text-center py-16">
          <UserCheck size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <div className="text-muted-foreground text-sm">Belum ada karyawan. Tambahkan anggota tim Anda.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {(employees || []).map((emp: any) => (
            <div key={emp.id} className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0 text-lg">
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{emp.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[emp.role] ?? "bg-muted text-muted-foreground"}`}>
                    {ROLE_LABELS[emp.role] ?? emp.role}
                  </span>
                  {emp.userId && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                      <ShieldCheck size={10} /> Punya Akun
                    </span>
                  )}
                  {!emp.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Nonaktif</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {emp.email && <span>{emp.email}</span>}
                  {emp.phone && <span>{emp.phone}</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {emp.email && (
                    <button onClick={() => setInviting(emp)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Buat akun login">
                      <KeyRound size={16} />
                    </button>
                  )}
                  <button onClick={() => setEditing(emp)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(emp.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <EmployeeForm onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={creating} />}
      {editing && <EmployeeForm initial={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} loading={updating} />}
      {inviting && <InviteModal employee={inviting} onClose={() => setInviting(null)} />}
    </div>
  );
}
