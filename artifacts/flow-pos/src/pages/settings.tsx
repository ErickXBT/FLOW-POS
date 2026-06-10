import { useState, useEffect, useRef } from "react";
import { useGetTenant, useUpdateTenant, useGetTenantSubscription, getGetTenantQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CreditCard, Image, UploadCloud, Trash2 } from "lucide-react";

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
  
  const [form, setForm] = useState({
    name: "",
    businessType: "",
    address: "",
    phone: "",
    email: "",
    receiptFooter: "",
    primaryColor: "#1D4EF5",
    logoUrl: "",
    coverUrl: "",
    bio: "",
  });
  
  const [saved, setSaved] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [coverError, setCoverError] = useState("");

  useEffect(() => {
    if (tenant) setForm({
      name: tenant.name || "",
      businessType: tenant.businessType || "",
      address: tenant.address || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      receiptFooter: (tenant as any).receiptFooter || "",
      primaryColor: tenant.primaryColor || "#1D4EF5",
      logoUrl: tenant.logoUrl || "",
      coverUrl: (tenant as any).coverUrl || "",
      bio: (tenant as any).bio || "",
    });
  }, [tenant]);

  const handleFileUpload = async (file: File, type: "logo" | "cover") => {
    if (!file.type.startsWith("image/")) {
      if (type === "logo") setLogoError("File harus berupa gambar");
      else setCoverError("File harus berupa gambar");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (type === "logo") setLogoError("Ukuran gambar maksimal 5MB");
      else setCoverError("Ukuran gambar maksimal 5MB");
      return;
    }

    if (type === "logo") {
      setLogoUploading(true);
      setLogoError("");
    } else {
      setCoverUploading(true);
      setCoverError("");
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const token = localStorage.getItem("flow_token");
          const res = await fetch("/api/products/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              name: file.name,
              base64,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Gagal mengunggah gambar");
          }

          const data = await res.json();
          if (type === "logo") {
            setForm(p => ({ ...p, logoUrl: data.imageUrl }));
          } else {
            setForm(p => ({ ...p, coverUrl: data.imageUrl }));
          }
        } catch (err: any) {
          if (type === "logo") setLogoError(err.message || "Gagal mengunggah");
          else setCoverError(err.message || "Gagal mengunggah");
        } finally {
          if (type === "logo") setLogoUploading(false);
          else setCoverUploading(false);
        }
      };
      reader.onerror = () => {
        if (type === "logo") setLogoError("Gagal membaca file");
        else setCoverError("Gagal membaca file");
        if (type === "logo") setLogoUploading(false);
        else setCoverUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (type === "logo") setLogoError("Gagal memproses file");
      else setCoverError("Gagal memproses file");
      if (type === "logo") setLogoUploading(false);
      else setCoverUploading(false);
    }
  };

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

      {/* Branding & Tampilan */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Image size={18} className="text-primary" /> Branding & Tampilan
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">Bio / Deskripsi Singkat</label>
          <textarea
            value={form.bio}
            onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
            placeholder="Tulis bio singkat tentang brand/bisnis Anda untuk ditampilkan di halaman menu customer..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Logo & Cover Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Logo Brand / Foto Profil</label>
            <input
              type="file"
              ref={logoInputRef}
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "logo")}
              accept="image/*"
              className="hidden"
            />
            {form.logoUrl ? (
              <div className="relative group w-28 h-28 rounded-full overflow-hidden border border-border bg-muted/20 mx-auto flex items-center justify-center">
                <img
                  src={form.logoUrl}
                  alt="Logo brand"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="p-1 bg-amber-400 text-black rounded-full hover:bg-amber-500 transition-colors shadow"
                  >
                    <UploadCloud size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, logoUrl: "" }))}
                    className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-28 h-28 rounded-full border-2 border-dashed border-input flex flex-col items-center justify-center p-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all mx-auto text-center"
              >
                {logoUploading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UploadCloud size={16} className="text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground font-medium">Upload Logo</span>
                  </>
                )}
              </div>
            )}
            {logoError && <p className="text-[11px] text-red-500 text-center font-medium">{logoError}</p>}
          </div>

          {/* Cover Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Sampul Brand (Cover)</label>
            <input
              type="file"
              ref={coverInputRef}
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "cover")}
              accept="image/*"
              className="hidden"
            />
            {form.coverUrl ? (
              <div className="relative group w-full h-28 rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
                <img
                  src={form.coverUrl}
                  alt="Sampul brand"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="px-2.5 py-1 bg-amber-400 text-black text-xs font-semibold rounded hover:bg-amber-500 transition-colors shadow"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, coverUrl: "" }))}
                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors shadow"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-28 rounded-lg border-2 border-dashed border-input flex flex-col items-center justify-center p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                {coverUploading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UploadCloud size={20} className="text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground font-medium">Upload Sampul (Cover)</span>
                    <span className="text-[9px] text-muted-foreground/60 mt-0.5">Rekomendasi ratio 16:9</span>
                  </>
                )}
              </div>
            )}
            {coverError && <p className="text-[11px] text-red-500 text-center font-medium">{coverError}</p>}
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
