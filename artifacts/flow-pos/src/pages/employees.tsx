import { useState } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, UserCheck, X } from "lucide-react";

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Kasir" },
  { value: "staff", label: "Staff" },
];

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
        <div className="p-6 space-y-3">
          {[
            { key: "name", label: "Nama *", type: "text" },
            { key: "email", label: "Email", type: "email" },
            { key: "phone", label: "No. Telepon", type: "text" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
            <label htmlFor="isActive" className="text-sm font-medium">Aktif</label>
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

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const qc = useQueryClient();
  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });
  const roleLabel: Record<string, string> = { manager: "Manager", cashier: "Kasir", staff: "Staff" };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Karyawan</h1>
          <p className="text-muted-foreground text-sm">{(employees || []).length} karyawan terdaftar</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90">
          <Plus size={16} /> Tambah Karyawan
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari karyawan..."
          className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-sm w-full" />
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Memuat...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Karyawan", "Kontak", "Role", "Status", "Aksi"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(employees || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-12">
                    <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
                    <div>Belum ada karyawan</div>
                  </td></tr>
                )}
                {(employees || []).map((e: any) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{e.name.charAt(0)}</div>
                        <div className="font-medium text-foreground">{e.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{e.email || "-"}</div>
                      <div className="text-xs">{e.phone || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">{roleLabel[e.role] || e.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${e.isActive ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {e.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditEmp(e)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                        <button onClick={() => { if (confirm("Hapus karyawan?")) deleteEmployee.mutate({ id: e.id }, { onSuccess: invalidate }); }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <EmployeeForm onSubmit={(form: any) => createEmployee.mutate({ data: form }, { onSuccess: () => { setShowForm(false); invalidate(); } })} onClose={() => setShowForm(false)} loading={createEmployee.isPending} />}
      {editEmp && <EmployeeForm initial={editEmp} onSubmit={(form: any) => updateEmployee.mutate({ id: editEmp.id, data: form }, { onSuccess: () => { setEditEmp(null); invalidate(); } })} onClose={() => setEditEmp(null)} loading={updateEmployee.isPending} />}
    </div>
  );
}
