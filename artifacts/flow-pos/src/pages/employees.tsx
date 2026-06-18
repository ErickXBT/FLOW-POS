import { useState } from "react";
import { Link } from "wouter";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListBranches,
  useListRoles,
  getListEmployeesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, UserCheck, X, KeyRound, ChefHat, Truck, ShieldCheck, MapPin, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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

const getDisplayRoleLabel = (role: string, isFashion: boolean) => {
  if (isFashion) {
    if (role === "cashier") return "Kasir Retail";
    if (role === "kitchen_staff") return "Staff Packing";
    if (role === "delivery_staff") return "Kurir Toko";
  }
  return ROLE_LABELS[role] ?? role;
};

const getDisplayRolesList = (isFashion: boolean) => {
  if (!isFashion) return ALL_ROLES;
  return ALL_ROLES.map(r => {
    if (r.value === "cashier") {
      return { ...r, label: "Kasir Retail", desc: "POS dan transaksi ritel" };
    }
    if (r.value === "kitchen_staff") {
      return { ...r, label: "Staff Packing", icon: "📦", desc: "Packing display system" };
    }
    if (r.value === "delivery_staff") {
      return { ...r, label: "Kurir Toko", desc: "Pesanan kurir toko" };
    }
    return r;
  });
};

function EmployeeForm({ initial, onSubmit, onClose, loading }: any) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const { data: branches } = useListBranches();
  const { data: customRoles } = useListRoles();

  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    role: initial?.role || "cashier",
    isActive: initial?.isActive ?? true,
    branchId: initial?.branchId != null ? Number(initial.branchId) : "",
    customRoleId: initial?.customRoleId != null ? Number(initial.customRoleId) : "",
  });

  const [roleType, setRoleType] = useState(initial?.customRoleId ? "custom" : "standard");

  const handleSubmitForm = () => {
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role: roleType === "custom" 
        ? (customRoles?.find(r => r.id === Number(form.customRoleId))?.name || "staff")
        : form.role,
      isActive: form.isActive,
      branchId: form.branchId ? Number(form.branchId) : null,
      customRoleId: roleType === "custom" && form.customRoleId ? Number(form.customRoleId) : null,
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{initial ? "Edit Karyawan" : "Tambah Karyawan"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
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
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
            </div>
          ))}

          {/* Branch Assignment */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Penempatan Cabang (Branch)</label>
            <select
              value={form.branchId}
              onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            >
              <option value="">Semua Cabang / Pusat</option>
              {(branches || []).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Role Type Tabs */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Tipe Peran (Role Type)</label>
            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setRoleType("standard")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleType === "standard" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Role Standar
              </button>
              <button
                type="button"
                onClick={() => setRoleType("custom")}
                disabled={(customRoles || []).length === 0}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleType === "custom" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"} disabled:opacity-50`}
              >
                Role Custom ({ (customRoles || []).length })
              </button>
            </div>

            {roleType === "standard" ? (
              <div className="grid grid-cols-1 gap-2">
                {getDisplayRolesList(isFashion).map(r => (
                  <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, role: r.value }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${form.role === r.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                    <span className="text-xl">{r.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                    {form.role === r.value && <ShieldCheck size={16} className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Pilih Role Custom</label>
                <select
                  value={form.customRoleId}
                  onChange={e => setForm(p => ({ ...p, customRoleId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                >
                  <option value="">-- Pilih Role --</option>
                  {(customRoles || []).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
            <label htmlFor="isActive" className="text-sm font-medium text-foreground">Aktif</label>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 sticky bottom-0 bg-card pt-3 border-t border-border flex-shrink-0 z-10">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
          <button onClick={handleSubmitForm} disabled={loading || !form.name || (roleType === "custom" && !form.customRoleId)}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/10">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("flow_token") ?? "";
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleInvite(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><KeyRound size={16} className="text-primary" /> Buat Akun Login</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-foreground mb-1">Akun berhasil dibuat!</div>
            <div className="text-sm text-muted-foreground mb-1">Email: <strong>{employee.email}</strong></div>
            <div className="text-sm text-muted-foreground mb-4">Role: <strong>{getDisplayRoleLabel(employee.role, isFashion)}</strong></div>
            <div className="bg-muted rounded-xl px-4 py-3 text-xs text-muted-foreground mb-4">
              Karyawan dapat login dengan email dan password yang ditetapkan. Dashboard akan disesuaikan dengan role mereka.
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Selesai</button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="p-6 space-y-4">
            <input
              type="text"
              name="username"
              value={employee.email || ""}
              readOnly
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
            />
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <div className="text-sm font-medium text-foreground">{employee.name}</div>
              <div className="text-xs text-muted-foreground">{employee.email}</div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[employee.role] ?? "bg-primary/10 text-primary"}`}>
                {getDisplayRoleLabel(employee.role, isFashion)}
              </span>
            </div>
            {!employee.email && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                Tambahkan email karyawan terlebih dahulu sebelum membuat akun login.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Set Password</label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                disabled={!employee.email}
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
              />
            </div>
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
              <button type="submit" disabled={loading || !employee.email || !password}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? "..." : "Buat Akun"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isFashion = user?.businessType === "fashion";
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [inviting, setInviting] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const { data: branches } = useListBranches();
  const { data: customRoles } = useListRoles();

  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const remove = useDeleteEmployee();

  async function handleCreate(form: any) {
    await create.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    setShowForm(false);
  }

  async function handleUpdate(form: any) {
    await update.mutateAsync({ id: editing.id, data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    setEditing(null);
  }

  function handleDelete(id: number) {
    setDeletingId(id);
  }

  const canManage = user && ["owner", "manager"].includes(user.role);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Karyawan & Hak Akses</h1>
          <p className="text-muted-foreground text-sm">Kelola tim, atur cabang outlet dan delegasikan perizinan sistem</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "owner" && (
            <Link href="/roles">
              <a className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card text-foreground hover:bg-muted rounded-xl text-sm font-medium transition-all shadow-sm">
                <Shield size={16} className="text-primary" /> Atur Role Custom
              </a>
            </Link>
          )}
          {canManage && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/95 transition-all shadow-md shadow-primary/10">
              <Plus size={16} /> Tambah Karyawan
            </button>
          )}
        </div>
      </div>

      {/* Role guide */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        {ALL_ROLES.map(r => (
          <div key={r.value} className="bg-card border border-card-border rounded-2xl p-3 text-center shadow-sm">
            <div className="text-xl mb-1">{r.icon}</div>
            <div className="text-xs font-semibold text-foreground">{r.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</div>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="employee-search"
          autoComplete="off"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari karyawan berdasarkan nama..."
          className="w-full pl-10 pr-4 py-2.5 border border-input rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-card border border-card-border animate-pulse" />)}
        </div>
      ) : (employees || []).length === 0 ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-2xl">
          <UserCheck size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <div className="text-muted-foreground text-sm font-medium">Belum ada karyawan. Tambahkan anggota tim Anda.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {(employees || []).map((emp: any) => {
            const branchName = branches?.find(b => b.id === emp.branchId)?.name;
            const isCustomRole = !!emp.customRoleId;
            const customRoleName = customRoles?.find(r => r.id === emp.customRoleId)?.name;

            return (
              <div key={emp.id} className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0 text-lg">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm md:text-base">{emp.name}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isCustomRole ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : (ROLE_COLORS[emp.role] ?? "bg-muted text-muted-foreground")}`}>
                      {isCustomRole ? `Role Custom: ${customRoleName || emp.role}` : getDisplayRoleLabel(emp.role, isFashion)}
                    </span>
                    {branchName && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 flex items-center gap-1">
                        <MapPin size={10} /> {branchName}
                      </span>
                    )}
                    {emp.userId && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 flex items-center gap-1">
                        <ShieldCheck size={10} /> Login Aktif
                      </span>
                    )}
                    {!emp.isActive && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nonaktif</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {emp.email && <span>{emp.email}</span>}
                    {emp.phone && <span>{emp.phone}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {emp.email && (
                      <button onClick={() => setInviting(emp)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                        title="Buat akun login">
                        <KeyRound size={16} />
                      </button>
                    )}
                    <button onClick={() => setEditing(emp)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(emp.id)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <EmployeeForm onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={create.isPending} />}
      {editing && <EmployeeForm initial={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} loading={update.isPending} />}
      {inviting && <InviteModal employee={inviting} onClose={() => setInviting(null)} />}

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-scale-up">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-955/20 text-red-600 flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-foreground">Hapus Karyawan</h3>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus karyawan ini? Semua data login terkait juga akan dihapus secara permanen.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={remove.isPending}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await remove.mutateAsync({ id: deletingId });
                    toast({
                      title: "Karyawan dihapus",
                      description: "Data karyawan berhasil dihapus dari sistem.",
                    });
                    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
                    setDeletingId(null);
                  } catch (err: any) {
                    toast({
                      variant: "destructive",
                      title: "Gagal menghapus",
                      description: err.message || "Terjadi kesalahan saat menghapus karyawan.",
                    });
                  }
                }}
                disabled={remove.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-md shadow-red-500/10 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {remove.isPending ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
