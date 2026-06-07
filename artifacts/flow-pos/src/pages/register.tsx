import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister, useListSubscriptionPlans } from "@workspace/api-client-react";
import { setStoredToken } from "@/hooks/use-auth";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import { ChevronRight, Building2, User, CreditCard } from "lucide-react";

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restoran", icon: "🍽️" },
  { value: "cafe", label: "Kafe", icon: "☕" },
  { value: "fashion", label: "Fashion Store", icon: "👗" },
  { value: "salon", label: "Salon", icon: "✂️" },
  { value: "minimarket", label: "Minimarket", icon: "🛒" },
];

export default function RegisterPage({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    businessType: "",
    businessName: "",
    address: "",
    phone: "",
    name: "",
    email: "",
    password: "",
    plan: "trial",
  });
  const [error, setError] = useState("");
  const registerMutation = useRegister();
  const { data: plans } = useListSubscriptionPlans();

  const handleSubmit = async () => {
    setError("");
    registerMutation.mutate({
      data: {
        name: form.name,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        businessType: form.businessType as any,
        phone: form.phone || undefined,
        address: form.address || undefined,
      }
    }, {
      onSuccess: (data) => {
        setStoredToken(data.token);
        onLogin(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (err: any) => setError(err?.data?.error || "Pendaftaran gagal"),
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={flowLogo} alt="Flow" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Buat akun baru</h1>
          <p className="text-muted-foreground text-sm mt-1">Mulai uji coba gratis 14 hari</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-card-border p-6 shadow-sm">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-primary" /> Pilih Tipe Bisnis
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    onClick={() => setForm(f => ({ ...f, businessType: bt.value }))}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.businessType === bt.value
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="text-2xl mb-1">{bt.icon}</div>
                    <div className="text-sm font-medium">{bt.label}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => form.businessType && setStep(2)}
                disabled={!form.businessType}
                className="mt-6 w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Lanjut <ChevronRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User size={18} className="text-primary" /> Informasi Bisnis & Akun
              </h2>
              <div className="space-y-3">
                {[
                  { key: "businessName", label: "Nama Bisnis", placeholder: "Kafe Senja" },
                  { key: "phone", label: "No. Telepon", placeholder: "08xxxxxxxxxx" },
                  { key: "address", label: "Alamat", placeholder: "Jl. Contoh No. 1" },
                  { key: "name", label: "Nama Anda", placeholder: "John Doe" },
                  { key: "email", label: "Email", placeholder: "john@example.com", type: "email" },
                  { key: "password", label: "Password", placeholder: "Min. 6 karakter", type: "password" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-1">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={(form as any)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  Kembali
                </button>
                <button
                  onClick={() => form.businessName && form.name && form.email && form.password && setStep(3)}
                  disabled={!form.businessName || !form.name || !form.email || !form.password}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Lanjut
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-primary" /> Pilih Paket
              </h2>
              <div className="space-y-3 mb-6">
                {(plans || [
                  { id: 1, name: "Trial", price: 0, durationDays: 14, features: ["1 Kasir", "Produk tak terbatas", "Laporan dasar"] },
                  { id: 2, name: "Basic", price: 149000, durationDays: 30, features: ["3 Kasir", "Manajemen stok", "Laporan lengkap"] },
                  { id: 3, name: "Pro", price: 399000, durationDays: 30, features: ["Unlimited kasir", "Multi cabang", "API access"] },
                ]).map((plan: any) => (
                  <div key={plan.name} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.plan === plan.name.toLowerCase()
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/40"
                  }`} onClick={() => setForm(f => ({ ...f, plan: plan.name.toLowerCase() }))}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{plan.name}</div>
                        <div className="text-sm text-muted-foreground">{plan.durationDays} hari</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {plan.price === 0 ? "Gratis" : `Rp ${plan.price.toLocaleString("id-ID")}`}
                        </div>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {(plan.features || []).map((f: string) => (
                        <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="text-primary">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  Kembali
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={registerMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {registerMutation.isPending ? "Mendaftar..." : "Daftar Sekarang"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Sudah punya akun?{" "}
          <a href="/login" className="text-primary font-semibold hover:underline">Masuk</a>
        </p>
      </div>
    </div>
  );
}
