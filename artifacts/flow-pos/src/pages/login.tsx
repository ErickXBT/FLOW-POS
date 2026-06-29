import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setStoredToken } from "@/hooks/use-auth";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import { X } from "lucide-react";

export default function LoginPage({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginMutation = useLogin();
  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPricelistModal, setShowPricelistModal] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");


  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setForgotSuccess("");
    
    if (!forgotEmail) {
      setError("Email wajib diisi");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim email reset password");
      }

      setForgotSuccess("Tautan reset password telah dikirim ke email Anda! Silakan periksa inbox email Anda.");
      setForgotEmail("");
    } catch (err: any) {
      setError(err.message || "Gagal mengirim permintaan reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        setStoredToken(data.token);
        onLogin(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        setError(err.data?.error || err.data?.message || err.message || "Email atau password salah");
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary p-12">
        <div>
          <img src={flowLogo} alt="Flow" className="h-10 brightness-0 invert" />
        </div>
        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Kelola bisnis Anda<br />lebih efisien dengan<br />FlowApp
          </h2>
          <p className="text-white/80 text-lg font-medium leading-relaxed">
            Semua Fitur.<br />
            Tidak Ada yang Dikunci.<br />
            <span className="text-sm text-white/75 block mt-2.5 font-normal leading-normal">
              Semua pelanggan mendapatkan fitur lengkap sejak hari pertama. Harga ditentukan berdasarkan jumlah outlet, bukan fitur yang Anda gunakan.
            </span>
          </p>
        </div>
        <div className="flex gap-8">
          {[["10K+", "Bisnis"], ["1M+", "Transaksi"], ["99.9%", "Uptime"]].map(([num, label]) => (
            <div key={label}>
              <div className="text-white text-2xl font-bold">{num}</div>
              <div className="text-white/60 text-sm font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-center lg:hidden mb-8">
            <img src={flowLogo} alt="Flow" className="h-10" />
          </div>
          {!isForgot ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">Selamat datang kembali</h1>
              <p className="text-muted-foreground mb-8 text-sm">Masuk ke akun Flow Anda</p>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input
                    data-testid="input-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                    placeholder="nama@bisnis.com"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setError(""); }}
                      className="text-xs text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer font-medium"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <input
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  data-testid="button-login"
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {loginMutation.isPending ? "Masuk..." : "Masuk"}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center text-sm">
                <p className="text-muted-foreground">
                  Belum punya akun?{" "}
                  <a href="/register" className="text-primary font-semibold hover:underline">
                    Daftar sekarang
                  </a>
                </p>
                <p>
                  <button
                    type="button"
                    onClick={() => setShowPricelistModal(true)}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold underline bg-transparent border-0 cursor-pointer"
                  >
                    Lihat Info Pricelist Paket
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">Lupa Password</h1>
              <p className="text-muted-foreground mb-8 text-sm">Masukkan email Anda untuk menerima tautan ganti password baru</p>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4 font-medium">
                  {error}
                </div>
              )}

              {forgotSuccess ? (
                <div className="bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 text-sm rounded-lg p-3 mb-4 font-medium">
                  {forgotSuccess}
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5 font-semibold">Email Akun</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                      placeholder="nama@bisnis.com"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? "Mengirim..." : "Kirim Tautan Reset"}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-sm">
                <button
                  type="button"
                  onClick={() => { setIsForgot(false); setError(""); setForgotSuccess(""); }}
                  className="text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer font-medium"
                >
                  Kembali ke Halaman Masuk
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPricelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-bold text-foreground text-sm">Pricelist Paket FlowApp</h2>
              <button
                type="button"
                onClick={() => setShowPricelistModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-foreground">Pilih Paket yang Sesuai untuk Bisnis Anda</h3>
                <p className="text-xs text-muted-foreground">
                  Mulai dengan Uji Coba Gratis 7 hari, lalu pilih paket terbaik untuk tingkatkan produktivitas outlet Anda.
                </p>

                {/* Period Selector Tabs */}
                <div className="flex justify-center pt-2">
                  <div className="inline-flex p-1 bg-muted dark:bg-slate-900 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setBillingPeriod("monthly")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        billingPeriod === "monthly"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Bulanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingPeriod("yearly")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                        billingPeriod === "yearly"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tahunan
                      <span className="absolute -top-2 -right-2 bg-green-500 text-white font-bold text-[7px] px-1 py-0.5 rounded-full uppercase scale-90">
                        Diskon 50%
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* FlowApp UMKM */}
                <div className="border border-border rounded-2xl p-6 bg-card flex flex-col justify-between hover:border-primary/40 transition-colors relative">
                  <span className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
                    Rekomendasi
                  </span>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">FlowApp UMKM</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sangat cocok untuk bisnis kecil dan berkembang</p>
                    </div>
                    <div className="border-t border-b border-border/60 py-3 space-y-1">
                      <div className="text-[10px] text-muted-foreground line-through">Rp 349.000 /bulan</div>
                      {billingPeriod === "yearly" ? (
                        <>
                          <div className="text-lg font-extrabold text-foreground">Rp 170.000 <span className="text-[10px] text-muted-foreground font-normal">/bln</span></div>
                          <div className="text-[9px] text-green-600 font-semibold">Ditagih Tahunan: Rp 2.040.000</div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-extrabold text-foreground">Rp 249.000 <span className="text-[10px] text-muted-foreground font-normal">/bln</span></div>
                          <div className="text-[9px] text-amber-600 font-semibold">Hemat 50% dengan Paket Tahunan</div>
                        </>
                      )}
                    </div>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Maksimal 1 Outlet</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Fitur Kasir & Transaksi POS</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Kelola Inventaris & Stok</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Laporan Penjualan Dasar</li>
                    </ul>
                  </div>
                </div>

                {/* FlowApp Multi */}
                <div className="border border-border rounded-2xl p-6 bg-card flex flex-col justify-between hover:border-primary/40 transition-colors">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">FlowApp Multi</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Dirancang untuk bisnis multi-outlet</p>
                    </div>
                    <div className="border-t border-b border-border/60 py-3 space-y-1">
                      <div className="text-[10px] text-muted-foreground line-through">Rp 499.000 /bulan</div>
                      {billingPeriod === "yearly" ? (
                        <>
                          <div className="text-lg font-extrabold text-foreground">Rp 250.000 <span className="text-[10px] text-muted-foreground font-normal">/bln</span></div>
                          <div className="text-[9px] text-green-600 font-semibold">Ditagih Tahunan: Rp 3.000.000</div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-extrabold text-foreground">Rp 299.000 <span className="text-[10px] text-muted-foreground font-normal">/bln</span></div>
                          <div className="text-[9px] text-amber-600 font-semibold">Hemat 50% dengan Paket Tahunan</div>
                        </>
                      )}
                    </div>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Hingga 3 Outlet</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Semua Fitur FlowApp UMKM</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Manajemen Karyawan & Shift</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> QR Order Menu Pelanggan</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Laporan Konsolidasi Multi-Outlet</li>
                    </ul>
                  </div>
                </div>

                {/* FlowApp Enterprise */}
                <div className="border border-border rounded-2xl p-6 bg-card flex flex-col justify-between hover:border-primary/40 transition-colors">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">FlowApp Enterprise</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Solusi kustom skala besar & korporat</p>
                    </div>
                    <div className="border-t border-b border-border/60 py-3 space-y-1">
                      <div className="text-lg font-extrabold text-foreground">Kustom</div>
                      <div className="text-[10px] text-muted-foreground">Sesuai Kebutuhan Bisnis Anda</div>
                      <div className="text-[9px] text-primary font-semibold">Hubungi Hubungan Pelanggan (Sales)</div>
                    </div>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> 5 hingga 10+ Outlet</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Semua Fitur FlowApp Multi</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Integrasi API Kustom & POS Kustom</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> Account Manager Khusus</li>
                      <li className="flex items-center gap-1.5 leading-tight"><span className="text-primary font-bold">✓</span> SLA & Uptime Terjamin</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-border bg-muted/10">
              <button
                type="button"
                onClick={() => setShowPricelistModal(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted text-foreground bg-transparent cursor-pointer"
              >
                Tutup
              </button>
              <a
                href="/register"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 flex items-center justify-center border-0 cursor-pointer text-white no-underline"
              >
                Daftar Sekarang
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
