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
          <h1 className="text-2xl font-bold text-foreground mb-2">Selamat datang kembali</h1>
          <p className="text-muted-foreground mb-8 text-sm">Masuk ke akun Flow Anda</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
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
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
