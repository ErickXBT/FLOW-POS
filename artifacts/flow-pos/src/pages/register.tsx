import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister, useListSubscriptionPlans } from "@workspace/api-client-react";
import { setStoredToken } from "@/hooks/use-auth";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import { ChevronRight, Building2, User, CreditCard, X, Check } from "lucide-react";

const BUSINESS_TYPES = [
  { value: "fnb", label: "F&B", icon: "🍽️" },
  { value: "fashion", label: "Fashion Store", icon: "👗" },
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
    plan: "business",
  });
  const [error, setError] = useState("");
  const registerMutation = useRegister();
  const { data: plans } = useListSubscriptionPlans();

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [installments, setInstallments] = useState(1);

  const handleRegisterSubmit = async (selectedCycle: "monthly" | "yearly", chosenInstallments: number) => {
    setError("");
    setShowPaymentModal(false);
    registerMutation.mutate({
      data: {
        name: form.name,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        businessType: form.businessType as any,
        phone: form.phone || undefined,
        address: form.address || undefined,
        plan: form.plan as any,
        billingInterval: selectedCycle,
        installments: chosenInstallments,
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

  const handleButtonClick = () => {
    setError("");
    if (form.plan === "starter" || form.plan === "business") {
      setInstallments(1);
      setShowPaymentModal(true);
    } else {
      handleRegisterSubmit("monthly", 1);
    }
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
              
              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-muted p-1 rounded-xl flex gap-1 items-center border border-border">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border-0 cursor-pointer ${
                      billingCycle === "monthly"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground bg-transparent"
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border-0 cursor-pointer ${
                      billingCycle === "yearly"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground bg-transparent"
                    }`}
                  >
                    Tahunan
                    <span className="px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-extrabold uppercase">
                      Hemat 15%
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {[
                  {
                    id: "trial",
                    name: "Uji Coba Gratis",
                    priceLabel: "Gratis",
                    periodLabel: "/7 hari",
                    features: ["Uji coba 7 hari gratis", "Maksimal 1 outlet"],
                  },
                  {
                    id: "starter",
                    name: "Paket FlowApp UMKM",
                    priceLabel: billingCycle === "monthly" ? "Rp169.000" : "Rp143.650",
                    periodLabel: "/bulan",
                    totalLabel: billingCycle === "yearly" ? "Total Rp1.723.800/tahun (Hemat 15%)" : "",
                    features: ["1 outlet"],
                    isPopular: true,
                  },
                  {
                    id: "business",
                    name: "FlowApp Multi",
                    priceLabel: billingCycle === "monthly" ? "Rp299.000" : "Rp254.150",
                    periodLabel: "/bulan",
                    totalLabel: billingCycle === "yearly" ? "Total Rp3.049.800/tahun (Hemat 15%)" : "",
                    features: ["Hingga 3 outlet"],
                  },
                  {
                    id: "custom",
                    name: "FlowApp Enterprise",
                    priceLabel: "Hubungi Sales",
                    periodLabel: "",
                    features: ["5-10+ outlet", "Hubungi sales"],
                  },
                ].map((planItem: any) => {
                  const selected = form.plan === planItem.id;
                  return (
                    <div
                      key={planItem.id}
                      onClick={() => setForm(f => ({ ...f, plan: planItem.id }))}
                      className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      {planItem.isPopular && (
                        <span className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
                          Rekomendasi
                        </span>
                      )}
                      
                      <div className="space-y-3">
                        <div>
                          <div className="font-bold text-foreground text-sm">{planItem.name}</div>
                          <div className="flex flex-col mt-1.5">
                            <div className="flex items-baseline">
                              <span className="text-lg font-extrabold text-foreground">{planItem.priceLabel}</span>
                              {planItem.periodLabel && <span className="text-[10px] text-muted-foreground ml-0.5">{planItem.periodLabel}</span>}
                            </div>
                            {planItem.totalLabel && (
                              <span className="text-[9px] text-green-600 font-semibold mt-0.5">
                                {planItem.totalLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="border-t border-border/80 pt-3">
                          <ul className="space-y-2">
                            {planItem.features.map((feat: string) => (
                              <li key={feat} className="text-xs text-muted-foreground flex items-center gap-1.5 leading-tight">
                                <span className="text-primary font-bold text-xs select-none">✓</span> {feat}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors border-0 cursor-pointer">
                  Kembali
                </button>
                <button
                  onClick={handleButtonClick}
                  disabled={registerMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 border-0 cursor-pointer"
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

      {showPaymentModal && (
        <PaymentModal
          billingCycle={billingCycle}
          plan={form.plan}
          installments={installments}
          setInstallments={setInstallments}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={() => handleRegisterSubmit(billingCycle, installments)}
          loading={registerMutation.isPending}
        />
      )}
    </div>
  );
}

function PaymentModal({
  billingCycle,
  plan,
  installments,
  setInstallments,
  onClose,
  onConfirm,
  loading
}: {
  billingCycle: "monthly" | "yearly";
  plan: string;
  installments: number;
  setInstallments: (n: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const isStarter = plan === "starter";
  const packageName = isStarter ? "Paket FlowApp UMKM" : "FlowApp Multi";
  
  // Pricing logic
  const monthlyPrice = isStarter ? 169000 : 299000;
  const yearlyPrice = isStarter ? 1723800 : 3049800;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground text-sm">Konfirmasi Pembayaran</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-1.5">
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Paket Pilihan</div>
            <div className="text-sm font-bold text-foreground">{packageName} ({billingCycle === "yearly" ? "Tahunan" : "Bulanan"})</div>
            <div className="text-xs text-muted-foreground">
              {billingCycle === "monthly" ? (
                <>Harga: <span className="font-semibold text-foreground">Rp {monthlyPrice.toLocaleString("id-ID")}/bulan</span></>
              ) : (
                <>Harga: <span className="font-semibold text-foreground">Rp {yearlyPrice.toLocaleString("id-ID")}/tahun</span> <span className="text-green-600 font-semibold">(Hemat 15%)</span></>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instruksi Transfer Bank</div>
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-bold text-foreground">BCA</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">No. Rekening</span>
                <span className="font-bold text-primary select-all">0374739634</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Atas Nama</span>
                <span className="font-bold text-foreground">Andri Jumawal Satria</span>
              </div>
            </div>
          </div>

          {billingCycle === "yearly" && (
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Metode Pembayaran (Cicilan)</div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 1, label: "Bayar Penuh (1x Lunas)", price: yearlyPrice },
                  { id: 2, label: "Cicilan 2x (2 Bulan)", price: Math.ceil(yearlyPrice / 2) },
                  { id: 3, label: "Cicilan 3x (3 Bulan)", price: Math.ceil(yearlyPrice / 3) },
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                      installments === opt.id
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-border hover:bg-muted/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="installments"
                        checked={installments === opt.id}
                        onChange={() => setInstallments(opt.id)}
                        className="w-4 h-4 text-primary border-border focus:ring-primary cursor-pointer"
                      />
                      <span className="text-xs text-foreground">{opt.label}</span>
                    </div>
                    <span className="text-xs text-foreground font-bold">
                      Rp {opt.price.toLocaleString("id-ID")}{opt.id > 1 && " / bayar"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {billingCycle === "monthly" && (
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground">Total Transfer</span>
              <span className="text-sm font-bold text-foreground">Rp {monthlyPrice.toLocaleString("id-ID")}</span>
            </div>
          )}

          {billingCycle === "yearly" && (
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground">Transfer Pertama</span>
              <span className="text-sm font-bold text-foreground">
                Rp {Math.ceil(yearlyPrice / installments).toLocaleString("id-ID")}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-border bg-muted/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-xl text-xs font-semibold hover:bg-muted text-foreground font-sans bg-transparent cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50 font-sans border-0 cursor-pointer"
          >
            {loading ? "Memproses..." : "Saya Sudah Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
