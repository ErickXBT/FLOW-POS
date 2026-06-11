import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setStoredToken } from "@/hooks/use-auth";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";

export default function LoginPage({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("admin@flow.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const loginMutation = useLogin();
  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

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
      onError: () => setError("Email atau password salah"),
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[hsl(var(--sidebar))] p-12">
        <div>
          <img src={flowLogo} alt="Flow" className="h-10 brightness-0 invert" />
        </div>
        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Kelola bisnis Anda<br />lebih efisien dengan<br />Flow POS
          </h2>
          <p className="text-[hsl(var(--sidebar-foreground))] opacity-60 text-lg">
            Platform POS multi-tenant modern untuk restoran, kafe, fashion, salon, dan minimarket.
          </p>
        </div>
        <div className="flex gap-8">
          {[["10K+", "Bisnis"], ["1M+", "Transaksi"], ["99.9%", "Uptime"]].map(([num, label]) => (
            <div key={label}>
              <div className="text-white text-2xl font-bold">{num}</div>
              <div className="text-[hsl(var(--sidebar-foreground))] opacity-50 text-sm">{label}</div>
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

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Belum punya akun?{" "}
                <a href="/register" className="text-primary font-semibold hover:underline">
                  Daftar sekarang
                </a>
              </p>
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
    </div>
  );
}
