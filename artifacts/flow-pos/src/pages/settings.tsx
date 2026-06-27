import { useState, useEffect, useRef } from "react";
import { useGetTenant, useUpdateTenant, useGetTenantSubscription, getGetTenantQueryKey, useCreateSubscriptionUpgradeRequest, getGetTenantSubscriptionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CreditCard, Image, UploadCloud, Trash2, Lock, User, Printer, Clock, ArrowUpCircle, Check, X } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { Link } from "wouter";

const ALL_BUSINESS_TYPES = [
  { value: "fnb", label: "F&B" },
  { value: "fashion", label: "Fashion Store" },
];

const STATUS_MAP: Record<string, string> = { active: "Aktif", trial: "Uji Coba", suspended: "Ditangguhkan", expired: "Kadaluarsa" };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: tenant, isLoading } = useGetTenant();
  const { data: sub } = useGetTenantSubscription();
  const updateTenant = useUpdateTenant();
  const { user, refetch } = useAuth();
  
  const createUpgradeRequest = useCreateSubscriptionUpgradeRequest();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<"starter" | "business" | "pro">("business");
  const [upgradeCycle, setUpgradeCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword.trim()) {
      setResetError("Password wajib diisi");
      return;
    }
    setResetLoading(true);
    setResetError("");
    setResetSuccess(false);

    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/tenant/reset-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ password: resetPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal meriset data");
      }

      setResetSuccess(true);
      qc.invalidateQueries(); // Invalidate all React Query caches
      setTimeout(() => {
        setShowResetModal(false);
        setResetPassword("");
        setResetSuccess(false);
      }, 2000);
    } catch (err: any) {
      setResetError(err.message || "Terjadi kesalahan");
    } finally {
      setResetLoading(false);
    }
  };

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [profileName, setProfileName] = useState(user?.name || "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || "");
      setProfileName(user.name || "");
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 2MB");
      return;
    }

    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const token = localStorage.getItem("flow_token");
        const res = await fetch("/api/products/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`,
          },
          body: JSON.stringify({ name: file.name, base64 }),
        });

        if (!res.ok) throw new Error("Gagal mengunggah avatar");
        const data = await res.json();
        setAvatarUrl(data.imageUrl);
      }
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah foto profil");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert("Nama lengkap tidak boleh kosong");
      return;
    }
    setProfileSaving(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ name: profileName, avatarUrl }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan profil");
      
      await refetch();
      alert("Profil berhasil diperbarui!");
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan profil");
    } finally {
      setProfileSaving(false);
    }
  };
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPassError("Semua field wajib diisi");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPassError("Password baru minimal 6 karakter");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPassError("Konfirmasi password baru tidak cocok");
      return;
    }

    setPassLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah password");
      }

      setPassSuccess("Password berhasil diubah!");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setPassError(err.message || "Gagal mengubah password");
    } finally {
      setPassLoading(false);
    }
  };
  
  const [form, setForm] = useState({
    name: "",
    businessType: "",
    address: "",
    phone: "",
    email: "",
    receiptFooter: "",
    defaultCashierName: "",
    primaryColor: "#1D4EF5",
    logoUrl: "",
    coverUrl: "",
    bio: "",
    enableCustomerLogin: false,
    pointSystemConfig: {
      pointsPerItem: 10,
      minClaimPoints: 1000,
      rewardDescription: "Diskon 10% setiap kelipatan 100 poin, Grand Reward pada 1000 Poin",
    },
    enableTax: false,
    taxPercentage: 10,
    enableServiceCharge: false,
    serviceChargePercentage: 10,
    qrisId: "",
    qrisImageUrl: "",
    enableOpsHours: false,
    opsOpeningTime: "10:00",
    opsClosingTime: "22:00",
  });
  
  const [saved, setSaved] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const qrisInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [qrisUploading, setQrisUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [coverError, setCoverError] = useState("");
  const [qrisError, setQrisError] = useState("");

  useEffect(() => {
    if (tenant) {
      const rawType = tenant.businessType || "";
      const validTypes = ["fnb", "fashion"];
      const businessType = validTypes.includes(rawType) ? rawType : "fnb";

      setForm({
        name: tenant.name || "",
        businessType,
        address: tenant.address || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        receiptFooter: (tenant as any).receiptFooter || "",
        defaultCashierName: (tenant as any).defaultCashierName || "",
        primaryColor: tenant.primaryColor || "#1D4EF5",
        logoUrl: tenant.logoUrl || "",
        coverUrl: (tenant as any).coverUrl || "",
        bio: (tenant as any).bio || "",
        enableCustomerLogin: (tenant as any).enableCustomerLogin ?? false,
        pointSystemConfig: (tenant as any).pointSystemConfig || {
          pointsPerItem: 10,
          minClaimPoints: 1000,
          rewardDescription: "Diskon 10% setiap kelipatan 100 poin, Grand Reward pada 1000 Poin",
        },
        enableTax: (tenant as any).enableTax ?? false,
        taxPercentage: (tenant as any).taxPercentage !== undefined ? Number((tenant as any).taxPercentage) : 10,
        enableServiceCharge: (tenant as any).enableServiceCharge ?? false,
        serviceChargePercentage: (tenant as any).serviceChargePercentage !== undefined ? Number((tenant as any).serviceChargePercentage) : 10,
        qrisId: (tenant as any).qrisId || "",
        qrisImageUrl: (tenant as any).qrisImageUrl || "",
        enableOpsHours: (tenant as any).enableOpsHours ?? false,
        opsOpeningTime: (tenant as any).opsOpeningTime || "10:00",
        opsClosingTime: (tenant as any).opsClosingTime || "22:00",
      });
    }
  }, [tenant]);

  const handleFileUpload = async (file: File, type: "logo" | "cover" | "qris") => {
    if (!file.type.startsWith("image/")) {
      if (type === "logo") setLogoError("File harus berupa gambar");
      else if (type === "cover") setCoverError("File harus berupa gambar");
      else setQrisError("File harus berupa gambar");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (type === "logo") setLogoError("Ukuran gambar maksimal 5MB");
      else if (type === "cover") setCoverError("Ukuran gambar maksimal 5MB");
      else setQrisError("Ukuran gambar maksimal 5MB");
      return;
    }

    if (type === "logo") {
      setLogoUploading(true);
      setLogoError("");
    } else if (type === "cover") {
      setCoverUploading(true);
      setCoverError("");
    } else {
      setQrisUploading(true);
      setQrisError("");
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
          } else if (type === "cover") {
            setForm(p => ({ ...p, coverUrl: data.imageUrl }));
          } else {
            setForm(p => ({ ...p, qrisImageUrl: data.imageUrl }));
          }
        } catch (err: any) {
          if (type === "logo") setLogoError(err.message || "Gagal mengunggah");
          else if (type === "cover") setCoverError(err.message || "Gagal mengunggah");
          else setQrisError(err.message || "Gagal mengunggah");
        } finally {
          if (type === "logo") setLogoUploading(false);
          else if (type === "cover") setCoverUploading(false);
          else setQrisUploading(false);
        }
      };
      reader.onerror = () => {
        if (type === "logo") setLogoError("Gagal membaca file");
        else if (type === "cover") setCoverError("Gagal membaca file");
        else setQrisError("Gagal membaca file");
        if (type === "logo") setLogoUploading(false);
        else if (type === "cover") setCoverUploading(false);
        else setQrisUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (type === "logo") setLogoError("Gagal memproses file");
      else if (type === "cover") setCoverError("Gagal memproses file");
      else setQrisError("Gagal memproses file");
      if (type === "logo") setLogoUploading(false);
      else if (type === "cover") setCoverUploading(false);
      else setQrisUploading(false);
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
          { key: "email", label: "Email Bisnis", type: "email", disabled: true },
          { key: "address", label: "Alamat" },
          { key: "receiptFooter", label: "Footer Struk" },
          { key: "defaultCashierName", label: "Nama Kasir Default" },
        ].map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-foreground">{f.label}</label>
              {f.disabled && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  <Lock size={10} /> Terkunci
                </span>
              )}
            </div>
            <input
              type={f.type || "text"}
              value={(form as any)[f.key]}
              disabled={f.disabled}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${
                f.disabled
                  ? "border-border bg-muted/50 cursor-not-allowed opacity-75 text-muted-foreground select-none"
                  : "border-input bg-background text-foreground focus:ring-2 focus:ring-ring"
              }`}
            />
          </div>
        ))}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-foreground">Tipe Bisnis</label>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <Lock size={10} /> Terkunci
            </span>
          </div>
          <select value={form.businessType} disabled
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-muted/50 text-sm focus:outline-none cursor-not-allowed opacity-75 text-muted-foreground select-none">
            {ALL_BUSINESS_TYPES.map(bt => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
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

      {/* Printer settings link */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Printer size={18} className="text-primary" /> Koneksi Printer &amp; Struk
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Hubungkan mesin printer thermal kasir Anda lewat Bluetooth, WebUSB nirkabel, maupun jaringan nirkabel LAN (Ethernet/Wi-Fi).
        </p>
        <Link href="/printer-settings">
          <a className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs rounded-xl transition-all text-primary hover:underline cursor-pointer">
            Buka Pengaturan Printer →
          </a>
        </Link>
      </div>

      {/* Profil Pengguna */}
      {user && (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
            <User size={18} className="text-primary" /> Profil Pengguna (Pemilik)
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6 pb-4 border-b border-border/50">
            {/* Avatar upload */}
            <div className="relative group w-20 h-20 rounded-full overflow-hidden border border-border bg-muted/20 flex items-center justify-center cursor-pointer flex-shrink-0" onClick={() => avatarInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">{user.name.charAt(0).toUpperCase()}</span>
              )}
              {avatarUploading ? (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <UploadCloud size={16} className="text-white" />
                </div>
              )}
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse-subtle"
              >
                <Save size={13} /> {profileSaving ? "Menyimpan..." : "Simpan Profil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Informasi Login & Keamanan */}
      {user && (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
            <Lock size={18} className="text-primary" /> Informasi Login & Keamanan
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email Login</label>
              <input
                type="text"
                value={user.email}
                disabled
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-75 text-muted-foreground select-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Peran / Role</label>
              <input
                type="text"
                value={ROLE_LABELS[user.role] || user.role}
                disabled
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-muted/50 cursor-not-allowed opacity-75 text-muted-foreground select-none text-sm"
              />
            </div>
          </div>

          <hr className="border-card-border my-4" />

          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Ganti Password</h3>
            
            {passError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg p-3 font-medium">
                {passError}
              </div>
            )}
            
            {passSuccess && (
              <div className="bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 text-xs rounded-lg p-3 font-medium">
                {passSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Masukkan password saat ini"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Password Baru</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Ulangi password baru"
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                <Save size={16} />
                {passLoading ? "Mengubah..." : "Ganti Password"}
              </button>
            </div>
          </form>
        </div>
      )}

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

      {/* Pengaturan Jam Operasional */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Clock size={18} className="text-primary" /> Pengaturan Jam Operasional Brand
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div>
            <div className="text-sm font-semibold">Aktifkan Jam Operasional</div>
            <div className="text-xs text-muted-foreground">Aktifkan jam operasional brand untuk membatasi pemesanan pelanggan di luar jam buka.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.enableOpsHours}
              onChange={e => setForm(p => ({ ...p, enableOpsHours: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {form.enableOpsHours && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Jam Buka *</label>
              <input
                type="time"
                value={form.opsOpeningTime}
                onChange={e => setForm(p => ({ ...p, opsOpeningTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Jam Tutup *</label>
              <input
                type="time"
                value={form.opsClosingTime}
                onChange={e => setForm(p => ({ ...p, opsClosingTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={updateTenant.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save size={16} />
            {updateTenant.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
          {saved && <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Tersimpan</span>}
        </div>
      </div>

      {/* Pengaturan Pajak */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Building2 size={18} className="text-primary" /> Pengaturan Pajak
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div>
            <div className="text-sm font-semibold">Aktifkan Pajak untuk Customer</div>
            <div className="text-xs text-muted-foreground">Aktifkan jika ingin mengenakan pajak pada setiap transaksi pelanggan (F&B dan Fashion).</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.enableTax}
              onChange={e => setForm(p => ({ ...p, enableTax: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {form.enableTax && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Persentase Pajak (%) *</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxPercentage}
                onChange={e => setForm(p => ({
                  ...p,
                  taxPercentage: Math.max(0, parseFloat(e.target.value) || 0)
                }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={updateTenant.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save size={16} />
            {updateTenant.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
          {saved && <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Tersimpan</span>}
        </div>
      </div>

      {/* Pengaturan Biaya Servis */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Building2 size={18} className="text-primary" /> Pengaturan Biaya Servis
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div>
            <div className="text-sm font-semibold">Aktifkan Biaya Servis (Service Charge) untuk Customer</div>
            <div className="text-xs text-muted-foreground">Aktifkan jika ingin mengenakan biaya servis pada setiap transaksi pelanggan (F&B dan Fashion).</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.enableServiceCharge}
              onChange={e => setForm(p => ({ ...p, enableServiceCharge: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {form.enableServiceCharge && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Persentase Biaya Servis (%) *</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.serviceChargePercentage}
                onChange={e => setForm(p => ({
                  ...p,
                  serviceChargePercentage: Math.max(0, parseFloat(e.target.value) || 0)
                }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={updateTenant.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save size={16} />
            {updateTenant.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
          {saved && <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Tersimpan</span>}
        </div>
      </div>

      {/* Pengaturan QRIS Mandiri */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Building2 size={18} className="text-primary" /> Pengaturan QRIS Mandiri
        </div>
        <p className="text-xs text-muted-foreground leading-normal">
          Konfigurasikan QRIS toko Anda agar pelanggan dapat memindai kode pembayaran langsung di menu digital E-Katalog saat checkout pesanan.
        </p>

        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">Payload QRIS String (Format EMVCo / NMID)</label>
          <input
            type="text"
            value={form.qrisId}
            onChange={e => setForm(p => ({ ...p, qrisId: e.target.value }))}
            placeholder="Masukkan string payload QRIS static Anda (misal: 000201...)"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground">Upload Manual Gambar QRIS Toko</label>
          <input
            type="file"
            ref={qrisInputRef}
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "qris")}
            accept="image/*"
            className="hidden"
          />
          {form.qrisImageUrl ? (
            <div className="relative group w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center mx-auto">
              <img
                src={form.qrisImageUrl}
                alt="Gambar QRIS Toko"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => qrisInputRef.current?.click()}
                  className="px-2.5 py-1 bg-amber-400 text-black text-xs font-semibold rounded hover:bg-amber-500 transition-colors shadow"
                >
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, qrisImageUrl: "" }))}
                  className="p-1 bg-red-500 text-white rounded hover:bg-red-650 transition-colors shadow"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => qrisInputRef.current?.click()}
              className="w-full h-28 rounded-lg border-2 border-dashed border-input flex flex-col items-center justify-center p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-center"
            >
              {qrisUploading ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <UploadCloud size={20} className="text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground font-medium">Upload Gambar QRIS Toko</span>
                  <span className="text-[9px] text-muted-foreground/60 mt-0.5">Format JPG/PNG, Maksimal 5MB</span>
                </>
              )}
            </div>
          )}
          {qrisError && <p className="text-[11px] text-red-500 text-center font-medium">{qrisError}</p>}
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

      {/* Fitur Loyalitas & Login Pelanggan */}
      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-4">
          <Building2 size={18} className="text-primary" /> Fitur Loyalitas & Login Pelanggan
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-lg">
          <div>
            <div className="text-sm font-semibold">Aktifkan Fitur Login Pelanggan</div>
            <div className="text-xs text-muted-foreground">Pelanggan harus login menggunakan nomor HP & password pada menu online untuk mendapatkan poin.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.enableCustomerLogin}
              onChange={e => setForm(p => ({ ...p, enableCustomerLogin: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {form.enableCustomerLogin && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">Poin per Item Menu *</label>
                <input
                  type="number"
                  value={form.pointSystemConfig.pointsPerItem}
                  onChange={e => setForm(p => ({
                    ...p,
                    pointSystemConfig: { ...p.pointSystemConfig, pointsPerItem: Math.max(1, Number(e.target.value)) }
                  }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">Minimal Poin Klaim Reward *</label>
                <input
                  type="number"
                  value={form.pointSystemConfig.minClaimPoints}
                  onChange={e => setForm(p => ({
                    ...p,
                    pointSystemConfig: { ...p.pointSystemConfig, minClaimPoints: Math.max(1, Number(e.target.value)) }
                  }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Deskripsi Sistem Reward & Tiering</label>
              <textarea
                value={form.pointSystemConfig.rewardDescription}
                onChange={e => setForm(p => ({
                  ...p,
                  pointSystemConfig: { ...p.pointSystemConfig, rewardDescription: e.target.value }
                }))}
                rows={2}
                placeholder="Misal: Diskon 10% setiap kelipatan 100 poin, Grand Reward pada 1000 Poin"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
        )}

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

            {sub.pendingUpgradeRequest && (
              <div className="col-span-2 mt-4 p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                <ArrowUpCircle className="text-primary animate-pulse shrink-0 mt-0.5" size={18} />
                <div className="text-xs">
                  <div className="font-bold text-foreground">Permintaan Upgrade Pending</div>
                  <div className="text-muted-foreground mt-1">
                    Menunggu persetujuan Super Admin untuk paket <span className="font-semibold capitalize text-foreground">{(sub.pendingUpgradeRequest as any).requestedPlan}</span> ({ (sub.pendingUpgradeRequest as any).billingCycle === "yearly" ? "Tahunan" : "Bulanan"}).
                  </div>
                </div>
              </div>
            )}

            {!sub.pendingUpgradeRequest && sub.plan !== "enterprise" && (
              <div className="col-span-2 mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <ArrowUpCircle size={15} /> Upgrade Paket Langganan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-lg animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm font-sans flex items-center gap-2">
                <ArrowUpCircle className="text-primary animate-pulse" size={18} /> Upgrade Paket Langganan
              </h2>
              <button type="button" onClick={() => { setShowUpgradeModal(false); setUpgradeError(""); }} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {upgradeError && <div className="p-3 text-xs bg-red-100 text-red-700 dark:bg-red-950/20 rounded-xl">{upgradeError}</div>}
              {upgradeSuccess && <div className="p-3 text-xs bg-green-100 text-green-700 dark:bg-green-950/20 rounded-xl">Permintaan upgrade berhasil diajukan! Silakan hubungi Super Admin untuk persetujuan.</div>}
              
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-2">Pilih Siklus Tagihan</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUpgradeCycle("monthly")}
                    className={`flex-1 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      upgradeCycle === "monthly"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted text-muted-foreground bg-transparent"
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpgradeCycle("yearly")}
                    className={`flex-1 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      upgradeCycle === "yearly"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted text-muted-foreground bg-transparent"
                    }`}
                  >
                    Tahunan
                    <span className="px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-extrabold uppercase">Hemat 15%</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-2">Pilih Paket</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: "starter", name: "FlowApp UMKM", branches: "Maks 1 Outlet", monthly: "Rp 169.000", yearly: "Rp 1.723.800" },
                    { id: "business", name: "FlowApp Multi", branches: "Maks 3 Outlet", monthly: "Rp 299.000", yearly: "Rp 3.049.800" },
                    { id: "pro", name: "FlowApp Pro", branches: "Maks 5 Outlet", monthly: "Rp 749.000", yearly: "Rp 6.741.000" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setUpgradePlan(p.id as any)}
                      className={`flex flex-col text-left p-3.5 border rounded-xl cursor-pointer transition-all ${
                        upgradePlan === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted text-foreground bg-transparent"
                      }`}
                    >
                      <span className="font-bold text-xs">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{p.branches}</span>
                      <span className="text-xs font-semibold text-primary mt-2">
                        {upgradeCycle === "yearly" ? p.yearly : p.monthly}
                        <span className="text-[9px] text-muted-foreground font-normal">/{upgradeCycle === "yearly" ? "thn" : "bln"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/30 border border-border p-4 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-foreground">Detail Upgrade:</div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Paket Baru:</span>
                  <span className="font-medium text-foreground capitalize">{upgradePlan} ({upgradeCycle === "yearly" ? "Tahunan" : "Bulanan"})</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Estimasi Biaya:</span>
                  <span className="font-bold text-primary">
                    {upgradePlan === "starter" ? (upgradeCycle === "yearly" ? "Rp 1.723.800" : "Rp 169.000") :
                     upgradePlan === "business" ? (upgradeCycle === "yearly" ? "Rp 3.049.800" : "Rp 299.000") :
                     (upgradeCycle === "yearly" ? "Rp 6.741.000" : "Rp 749.000")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10">
              <button
                type="button"
                onClick={() => { setShowUpgradeModal(false); setUpgradeError(""); }}
                className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted text-foreground font-sans cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={createUpgradeRequest.isPending || upgradeSuccess}
                onClick={async () => {
                  setUpgradeError("");
                  try {
                    await createUpgradeRequest.mutateAsync({
                      data: {
                        requestedPlan: upgradePlan,
                        billingCycle: upgradeCycle,
                      }
                    });
                    setUpgradeSuccess(true);
                    qc.invalidateQueries({ queryKey: getGetTenantSubscriptionQueryKey() });
                    setTimeout(() => {
                      setShowUpgradeModal(false);
                      setUpgradeSuccess(false);
                    }, 2000);
                  } catch (err: any) {
                    setUpgradeError(err.response?.data?.error || err.message || "Gagal mengajukan upgrade");
                  }
                }}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 font-sans cursor-pointer"
              >
                {createUpgradeRequest.isPending ? "Mengajukan..." : "Ajukan Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Data Usaha - Khusus Owner */}
      {user?.role === "owner" && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-destructive">
            <Trash2 size={18} /> Reset Data Usaha (Mulai Baru)
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Gunakan fitur ini untuk membersihkan seluruh data penjualan (riwayat transaksi, pesanan online, rekap kas/shift, log aktivitas, dan absensi) agar toko Anda kembali bersih. 
            <strong> Data produk, kategori, cabang, dan karyawan tetap dipertahankan</strong> sehingga Anda tidak perlu mengaturnya kembali.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setResetError("");
                setResetPassword("");
                setResetSuccess(false);
                setShowResetModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-bold transition-all cursor-pointer shadow"
            >
              <Trash2 size={14} /> Bersihkan Data Penjualan & Log
            </button>
          </div>
        </div>
      )}

      {/* Reset Data Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/10">
              <h2 className="font-bold text-destructive text-sm font-sans flex items-center gap-2">
                🚨 Konfirmasi Reset Data Usaha
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetPassword("");
                  setResetError("");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleResetData} className="p-6 space-y-5">
              <div className="text-xs text-muted-foreground leading-normal space-y-2">
                <p className="font-bold text-foreground">Peringatan: Tindakan ini tidak dapat dibatalkan!</p>
                <p>Seluruh riwayat transaksi (POS & Online), sesi kasir, pengeluaran, log aktivitas, dan absensi karyawan akan dihapus secara permanen dari server.</p>
                <p>Data produk, kategori, cabang, dan karyawan Anda tetap tersimpan.</p>
              </div>

              {resetError && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl font-medium">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="p-3 text-xs bg-green-100 text-green-700 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl font-medium">
                  Sukses! Seluruh data transaksi dan aktivitas berhasil dibersihkan. Memuat ulang halaman...
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Konfirmasi Password Owner *
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Masukkan password akun Owner Anda"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  disabled={resetLoading || resetSuccess}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetPassword("");
                    setResetError("");
                  }}
                  className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted text-foreground font-sans cursor-pointer"
                  disabled={resetLoading || resetSuccess}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || resetSuccess || !resetPassword.trim()}
                  className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 font-sans cursor-pointer shadow-sm flex items-center justify-center gap-1"
                >
                  {resetLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Trash2 size={13} /> Reset Sekarang
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
