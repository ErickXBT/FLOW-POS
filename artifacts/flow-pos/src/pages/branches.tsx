import { useState, useEffect } from "react";
import { useListBranches, useCreateBranch, useUpdateBranch, useDeleteBranch, getListBranchesQueryKey, useGetTenant, useListEmployees } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Search, MapPin, Phone, Edit2, Trash2, X, Building2, Lock, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function BranchForm({ initial, onSubmit, onClose, loading, candidates }: any) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    address: initial?.address || "",
    phone: initial?.phone || "",
    franchiseeId: initial?.franchiseeId || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm font-sans">{initial ? "Edit Cabang" : "Tambah Cabang"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Nama Cabang *</label>
            <input
              type="text"
              required
              placeholder="Contoh: Jakarta Selatan, Bandung Cihampelas"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Alamat</label>
            <textarea
              placeholder="Alamat lengkap cabang"
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all h-20 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">No. Telepon</label>
            <input
              type="text"
              placeholder="08xx atau (021)xxxx"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Pemilik Cabang (Franchisee / Owner)</label>
            <select
              value={form.franchiseeId || ""}
              onChange={e => setForm(p => ({ ...p, franchiseeId: e.target.value ? Number(e.target.value) : "" }))}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
            >
              <option value="">-- Tanpa Franchisee (Pusat) --</option>
              {(candidates || []).map((cand: any) => (
                <option key={cand.id} value={cand.userId}>
                  {cand.name} ({cand.role === "owner" ? "Owner" : "Manager"})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors text-foreground font-sans">Batal</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim()}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all font-sans"
          >
            {loading ? "Menyimpan..." : "Simpan Cabang"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BranchSettingsForm({ branchId, onClose }: { branchId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    qrMenuEnabled: true,
    taxPercentage: 0,
    receiptFooter: "",
    printerSettings: { paperSize: "80mm", type: "IP", ip: "192.168.1.100" },
    paymentMethods: ["cash", "qris"],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["branchSettings", branchId],
    queryFn: async () => {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/branches/${branchId}/settings`, {
        headers: { "Authorization": `Bearer ${token || ""}` },
      });
      if (!res.ok) throw new Error("Gagal memuat pengaturan");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        qrMenuEnabled: data.qrMenuEnabled ?? true,
        taxPercentage: data.taxPercentage ?? 0,
        receiptFooter: data.receiptFooter ?? "",
        printerSettings: data.printerSettings ?? { paperSize: "80mm", type: "IP", ip: "192.168.1.100" },
        paymentMethods: data.paymentMethods ?? ["cash", "qris"],
      });
    }
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/branches/${branchId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Gagal menyimpan pengaturan");

      qc.invalidateQueries({ queryKey: ["branchSettings", branchId] });
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-card border border-card-border p-6 rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="text-xs text-muted-foreground animate-pulse font-sans">Memuat pengaturan...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">⚙️ Pengaturan Spesifik Cabang</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && <div className="p-3 text-xs bg-red-100 text-red-700 dark:bg-red-950/20 rounded-xl">{error}</div>}

          <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
            <div>
              <label className="text-xs font-bold text-foreground">Aktifkan QR Menu Mandiri</label>
              <p className="text-[10px] text-muted-foreground">Pelanggan bisa memesan sendiri di meja via QR</p>
            </div>
            <input
              type="checkbox"
              checked={form.qrMenuEnabled}
              onChange={e => setForm(p => ({ ...p, qrMenuEnabled: e.target.checked }))}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Pajak Cabang (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.taxPercentage}
              onChange={e => setForm(p => ({ ...p, taxPercentage: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Footer Struk Pembayaran</label>
            <textarea
              placeholder="Contoh: Terima kasih atas kunjungan Anda!"
              value={form.receiptFooter}
              onChange={e => setForm(p => ({ ...p, receiptFooter: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 h-16 resize-none"
            />
          </div>

          <div className="border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-foreground">Pengaturan Printer Kasir</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Ukuran Kertas</label>
                <select
                  value={form.printerSettings.paperSize}
                  onChange={e => setForm(p => ({ ...p, printerSettings: { ...p.printerSettings, paperSize: e.target.value } }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground"
                >
                  <option value="80mm">80 mm (Thermal)</option>
                  <option value="58mm">58 mm (Thermal)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Tipe Koneksi</label>
                <select
                  value={form.printerSettings.type}
                  onChange={e => setForm(p => ({ ...p, printerSettings: { ...p.printerSettings, type: e.target.value } }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground"
                >
                  <option value="IP">IP / Network</option>
                  <option value="Bluetooth">Bluetooth</option>
                  <option value="USB">USB</option>
                </select>
              </div>
            </div>
            {form.printerSettings.type === "IP" && (
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">Alamat IP Printer</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={form.printerSettings.ip || ""}
                  onChange={e => setForm(p => ({ ...p, printerSettings: { ...p.printerSettings, ip: e.target.value } }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground">Metode Pembayaran yang Diterima</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "cash", label: "Tunai (Cash)" },
                { id: "qris", label: "QRIS" },
                { id: "bank_transfer", label: "Transfer Bank" },
                { id: "ewallet", label: "E-Wallet" },
              ].map(m => {
                const checked = form.paymentMethods.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...form.paymentMethods, m.id]
                          : form.paymentMethods.filter(x => x !== m.id);
                        setForm(p => ({ ...p, paymentMethods: next }));
                      }}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary rounded"
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
        <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-border bg-muted/10">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted text-foreground font-sans">Batal</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 font-sans"
          >
            {loading ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradeSubscriptionModal({ plan, limit, onClose }: { plan: string; limit: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md p-6 text-center space-y-4 animate-scale-up">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-xl">⚠️</div>
        <div>
          <h2 className="font-bold text-base text-foreground font-sans">Batas Limit Outlet Tercapai!</h2>
          <p className="text-xs text-muted-foreground mt-2">
            Paket langganan Anda saat ini (**{plan.toUpperCase()}**) hanya mengizinkan maksimal **{limit} outlet**.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Silakan hubungi Super Admin untuk meng-upgrade paket langganan Anda agar dapat menambahkan cabang outlet baru.
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <div className="text-[10px] font-semibold text-muted-foreground">DAFTAR PILIHAN PAKET:</div>
          <div className="grid grid-cols-3 gap-2 text-[9px] text-left">
            <div className="p-2 border border-border rounded-lg bg-muted/20">
              <span className="font-bold text-foreground">FlowApp UMKM</span>
              <p className="text-[8px] text-muted-foreground">1 Outlet</p>
              <p className="text-primary font-bold mt-0.5 font-sans">Rp249.000/bln</p>
            </div>
            <div className="p-2 border border-border rounded-lg bg-muted/20">
              <span className="font-bold text-foreground">FlowApp Multi</span>
              <p className="text-[8px] text-muted-foreground">Maks 3 Outlet</p>
              <p className="text-primary font-bold mt-0.5 font-sans">Rp299.000/bln</p>
            </div>
            <div className="p-2 border border-border rounded-lg bg-muted/20">
              <span className="font-bold text-foreground">FlowApp Enterprise</span>
              <p className="text-[8px] text-muted-foreground">5-10+ Outlet</p>
              <p className="text-primary font-bold mt-0.5 font-sans">Hubungi Sales</p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all font-sans"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [configuringSettings, setConfiguringSettings] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: branches, isLoading } = useListBranches();
  const { data: tenant } = useGetTenant();
  const { data: employeesData } = useListEmployees();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();

  const candidates = (employeesData || []).filter((e: any) => (e.role === "owner" || e.role === "manager") && e.userId);

  const PLAN_LIMITS: Record<string, number> = {
    trial: 1,
    starter: 1,
    business: 3,
    pro: 5,
    enterprise: 999999,
  };

  const plan = tenant?.subscriptionPlan || "trial";
  const limit = PLAN_LIMITS[plan] || 1;
  const isLimitReached = ((branches || []) as any[]).length >= limit;

  const handleCreate = async (form: any) => {
    await createBranch.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
    setShowForm(false);
  };

  const handleUpdate = async (form: any) => {
    await updateBranch.mutateAsync({ id: editing.id, data: form });
    queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
    setEditing(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus cabang ini? Semua karyawan dan data transaksi yang ditautkan ke cabang ini akan kehilangan tautan cabang.")) return;
    await deleteBranch.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
  };

  const filtered = ((branches || []) as any[]).filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.address && b.address.toLowerCase().includes(search.toLowerCase()))
  );

  const isOwner = user?.role === "owner" || user?.role === "super_admin";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Manajemen Cabang (Branches)</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            Kelola outlet bisnis Anda. Paket aktif: 
            <span className="font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full text-xs uppercase">{plan}</span>
            ({((branches || []) as any[]).length} / {limit === 999999 ? "∞" : limit} Outlet)
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              if (isLimitReached) {
                setShowUpgradeModal(true);
              } else {
                setShowForm(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/95 transition-all shadow-md shadow-primary/10 font-sans"
          >
            <Plus size={16} /> Tambah Cabang
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="branch-search"
          autoComplete="off"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau alamat cabang..."
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
          <Building2 size={40} className="mx-auto mb-3 text-muted-foreground/30 font-sans" />
          <div className="text-muted-foreground text-sm font-medium font-sans">Belum ada cabang outlet</div>
          <div className="text-muted-foreground text-xs mt-1 font-sans">Gunakan tombol di atas untuk menambahkan cabang pertama Anda.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(b => (
            <div
              key={b.id}
              className={`bg-card border border-card-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                b.status === "locked" ? "opacity-75 bg-muted/40 border-dashed" : ""
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Building2 size={18} className="text-primary" /> {b.name}
                    {b.status === "locked" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase animate-pulse">
                        <Lock size={8} /> Terkunci (Limit)
                      </span>
                    )}
                  </h3>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
                  {b.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span>{b.address}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="flex-shrink-0 text-muted-foreground" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {(() => {
                    const candidate = (employeesData || []).find((e: any) => e.userId === b.franchiseeId);
                    return (
                      <div className="flex items-center gap-2 pt-1.5 border-t border-border/40 mt-1.5">
                        <span className="font-bold text-[10px] text-primary uppercase tracking-wider">Pemilik Cabang:</span>
                        <span className="font-semibold text-foreground text-[11px]">{candidate ? candidate.name : "Pusat"}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center justify-end gap-1.5 border-t border-border mt-5 pt-3">
                  {b.status !== "locked" && (
                    <button
                      onClick={() => setConfiguringSettings(b.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-sans"
                    >
                      <Settings size={12} /> Pengaturan
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(b)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-sans"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 dark:border-red-900/30 transition-all font-sans"
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
        <BranchForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
          loading={createBranch.isPending}
          candidates={candidates}
        />
      )}
      {editing && (
        <BranchForm
          initial={editing}
          onSubmit={handleUpdate}
          onClose={() => setEditing(null)}
          loading={updateBranch.isPending}
          candidates={candidates}
        />
      )}
      {showUpgradeModal && (
        <UpgradeSubscriptionModal
          plan={plan}
          limit={limit}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
      {configuringSettings !== null && (
        <BranchSettingsForm
          branchId={configuringSettings}
          onClose={() => setConfiguringSettings(null)}
        />
      )}
    </div>
  );
}
