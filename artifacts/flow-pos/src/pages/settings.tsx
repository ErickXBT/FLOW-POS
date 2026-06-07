import { useState, useEffect } from "react";
import { useGetTenant, useUpdateTenant, useGetTenantSubscription, getGetTenantQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CreditCard } from "lucide-react";

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restoran" },
  { value: "cafe", label: "Kafe" },
  { value: "fashion", label: "Fashion Store" },
  { value: "salon", label: "Salon" },
  { value: "minimarket", label: "Minimarket" },
];

const STATUS_MAP: Record<string, string> = { active: "Aktif", trial: "Uji Coba", suspended: "Ditangguhkan", expired: "Kadaluarsa" };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: tenant, isLoading } = useGetTenant();
  const { data: sub } = useGetTenantSubscription();
  const updateTenant = useUpdateTenant();
  const [form, setForm] = useState({ name: "", businessType: "", address: "", phone: "", email: "", receiptFooter: "", primaryColor: "#1D4EF5" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tenant) setForm({
      name: tenant.name || "",
      businessType: tenant.businessType || "",
      address: tenant.address || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      receiptFooter: "",
      primaryColor: tenant.primaryColor || "#1D4EF5",
    });
  }, [tenant]);

  const handleSave = () => {
    updateTenant.mutate({ data: form }, {
      onSuccess: () => {
        setSaved(true);
        qc.invalidateQueries({ queryKey: getGetTenantQueryKey() });
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Memuat...</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Pengaturan Bisnis</h1>
        <p className="text-muted-foreground text-sm">Kelola informasi bisnis Anda</p>
      </div>

      {/* Business info */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Building2 size={18} className="text-primary" /> Informasi Bisnis
        </div>
        {[
          { key: "name", label: "Nama Bisnis *" },
          { key: "phone", label: "No. Telepon" },
          { key: "email", label: "Email Bisnis", type: "email" },
          { key: "address", label: "Alamat" },
          { key: "receiptFooter", label: "Footer Struk" },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium mb-1 text-foreground">{f.label}</label>
            <input
              type={f.type || "text"}
              value={(form as any)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">Tipe Bisnis</label>
          <select value={form.businessType} onChange={e => setForm(p => ({ ...p, businessType: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">Warna Utama</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primaryColor} onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-input cursor-pointer" />
            <span className="text-sm text-muted-foreground">{form.primaryColor}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={updateTenant.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save size={16} />
            {updateTenant.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
          {saved && <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Tersimpan</span>}
        </div>
      </div>

      {/* Subscription */}
      {sub && (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
            <CreditCard size={18} className="text-primary" /> Langganan
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Paket</div>
              <div className="font-semibold capitalize">{sub.plan}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Status</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sub.status === "active" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"}`}>
                {STATUS_MAP[sub.status] || sub.status}
              </span>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Harga</div>
              <div className="font-semibold">{(sub.price ?? 0) === 0 ? "Gratis" : `Rp ${(sub.price ?? 0).toLocaleString("id-ID")}`}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Berakhir</div>
              <div className="font-semibold">{new Date(sub.expiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
