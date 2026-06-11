import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("token");
    if (tok) {
      setToken(tok);
    } else {
      setError("Token reset password tidak valid atau tidak ditemukan.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!token) {
      setError("Token tidak valid.");
      return;
    }

    if (password.length < 6) {
      setError("Password baru harus minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengatur ulang password");
      }

      setSuccess(true);
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
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

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-center lg:hidden mb-8">
            <img src={flowLogo} alt="Flow" className="h-10" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Ganti Password Baru</h1>
          <p className="text-muted-foreground mb-8 text-sm">Masukkan password baru Anda untuk memulihkan akses</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4 font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 text-sm rounded-lg p-3 mb-4 font-medium">
              Password berhasil diperbarui! Anda akan dialihkan ke halaman masuk dalam beberapa detik...
            </div>
          )}

          {!success && token && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 font-semibold">Password Baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                  placeholder="Minimal 6 karakter"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 font-semibold">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                  placeholder="Ulangi password baru"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Memperbarui..." : "Ubah Password"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <a href="/login" className="text-primary font-semibold hover:underline">
              Kembali ke Halaman Masuk
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
