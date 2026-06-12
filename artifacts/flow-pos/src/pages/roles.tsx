import { useState } from "react";
import { useListRoles, useCreateRole, useUpdateRole, useDeleteRole, getListRolesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldAlert, CheckSquare, Square, Edit2, Trash2, X, Shield, Lock, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ALL_PERMISSIONS = [
  { key: "view_dashboard", label: "Lihat Dashboard", desc: "Melihat grafik ringkasan penjualan & analitik bisnis", category: "Analitik" },
  { key: "view_reports", label: "Laporan Keuangan", desc: "Akses laporan penjualan bulanan, tahunan dan metode pembayaran", category: "Analitik" },
  { key: "view_activity_logs", label: "Log Aktivitas Karyawan", desc: "Akses log login, logout, stock adjustment, dan edit produk", category: "Sistem & Audit" },
  { key: "view_sessions", label: "Daftar Sesi Aktif", desc: "Melihat perangkat login aktif, IP address, dan logout paksa", category: "Sistem & Audit" },
  { key: "view_pos", label: "Akses Layar POS (Kasir)", desc: "Melakukan transaksi pembelian pelanggan langsung", category: "Operasional" },
  { key: "manage_orders", label: "Kelola Transaksi", desc: "Melihat pesanan, membatalkan, melakukan refund, dan print struk", category: "Operasional" },
  { key: "view_kitchen", label: "Display Dapur (KDS)", desc: "Melihat pesanan masuk dan mengubah status pengerjaan makanan", category: "Operasional" },
  { key: "view_delivery", label: "Display Kurir (Delivery)", desc: "Melihat detail alamat kirim dan mengubah status pengiriman", category: "Operasional" },
  { key: "manage_inventory", label: "Kelola Stok & Inventori", desc: "Menambah, mengedit stok produk, and stock adjustment", category: "Inventori & Produk" },
  { key: "manage_products", label: "Kelola Katalog Produk", desc: "Menambah, mengubah informasi harga/gambar dan menghapus produk", category: "Inventori & Produk" },
  { key: "manage_customers", label: "Kelola Data Pelanggan", desc: "Mencatat poin loyalitas, membership level dan catatan pelanggan", category: "Pelanggan" },
  { key: "manage_employees", label: "Kelola Karyawan", desc: "Menambah karyawan, assign role, atur cabang dan buat akun login", category: "Karyawan & Akses" },
];

const getDisplayPermissions = (isFashion: boolean) => {
  return ALL_PERMISSIONS.map(p => {
    if (p.key === "view_kitchen") {
      return {
        ...p,
        label: isFashion ? "Display Packing (PDS)" : "Display Dapur (KDS)",
        desc: isFashion
          ? "Melihat pesanan masuk dan mengubah status packing/pengemasan produk"
          : "Melihat pesanan masuk dan mengubah status pengerjaan makanan",
      };
    }
    return p;
  });
};

function RoleForm({ initial, onSubmit, onClose, loading }: any) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const [name, setName] = useState(initial?.name || "");
  const [selected, setSelected] = useState<string[]>(initial?.permissions || []);

  const togglePermission = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const categories = Array.from(new Set(getDisplayPermissions(isFashion).map(p => p.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            {initial ? "Edit Role & Hak Akses" : "Tambah Role Custom"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">Nama Role *</label>
            <input
              type="text"
              required
              placeholder="Contoh: Supervisor Toko, Admin Inventori"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-3 text-foreground">Hak Akses Modul (Module Access Control)</label>
            <div className="space-y-6">
              {categories.map(cat => (
                <div key={cat} className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border pb-1.5">{cat}</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {getDisplayPermissions(isFashion).filter(p => p.category === cat).map(p => {
                      const checked = selected.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePermission(p.key)}
                          className={`flex items-start text-left gap-3 p-3.5 rounded-xl border-2 transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-border/80 bg-background"}`}
                        >
                          <div className={`mt-0.5 ${checked ? "text-primary" : "text-muted-foreground"}`}>
                            {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">{p.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors text-foreground">Batal</button>
          <button
            onClick={() => onSubmit({ name, permissions: selected })}
            disabled={loading || !name.trim() || selected.length === 0}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-primary/10"
          >
            {loading ? "Menyimpan..." : "Simpan Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useListRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const handleCreate = async (form: any) => {
    await createRole.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
    setShowForm(false);
  };

  const handleUpdate = async (form: any) => {
    await updateRole.mutateAsync({ id: editing.id, data: form });
    queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus role custom ini? Anggota tim dengan role ini tidak akan memiliki hak akses custom lagi dan fallback ke default staff.")) return;
    await deleteRole.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
  };

  const filtered = (roles || []).filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const isOwner = user?.role === "owner" || user?.role === "super_admin";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Hak Akses & Role Custom</h1>
          <p className="text-muted-foreground text-sm">Buat role custom dan delegasikan izin modul operasional untuk karyawan Anda</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/95 transition-all shadow-md shadow-primary/10"
          >
            <Plus size={16} /> Tambah Role Custom
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama role..."
          className="w-full pl-10 pr-4 py-2.5 border border-input rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-card border border-card-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-card-border rounded-2xl shadow-sm">
          <ShieldAlert size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <div className="text-muted-foreground text-sm font-medium">Belum ada role custom</div>
          <div className="text-muted-foreground text-xs mt-1">Gunakan tombol di atas untuk membuat role custom pertama Anda.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(r => (
            <div
              key={r.id}
              className="bg-card border border-card-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                    <Shield size={18} className="text-primary" /> {r.name}
                  </h3>
                  <span className="text-xs bg-muted text-muted-foreground font-semibold px-2.5 py-1 rounded-full">
                    {r.permissions.length} Hak Akses
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {r.permissions.map((p: string) => {
                    const label = getDisplayPermissions(isFashion).find(ap => ap.key === p)?.label || p;
                    return (
                      <span key={p} className="text-[10px] font-medium bg-muted text-foreground px-2 py-0.5 rounded">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center justify-end gap-1.5 border-t border-border mt-5 pt-3 flex-shrink-0">
                  <button
                    onClick={() => setEditing(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <Edit2 size={12} /> Edit Role
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-955/20 dark:border-red-900/30 transition-all"
                  >
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RoleForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          loading={createRole.isPending}
        />
      )}
      {editing && (
        <RoleForm
          initial={editing}
          onSubmit={handleUpdate}
          onClose={() => setEditing(null)}
          loading={updateRole.isPending}
        />
      )}
    </div>
  );
}
