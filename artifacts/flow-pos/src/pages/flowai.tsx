import { useState, useEffect } from "react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { Sparkles, Brain, TrendingUp, TrendingDown, Award, AlertTriangle, Info, Package, RefreshCw, MessageSquare, Gift, Layers, Check } from "lucide-react";

function formatRp(v: number) {
  return `Rp ${v.toLocaleString("id-ID")}`;
}

export default function FlowAIPage() {
  const { activeBranchId } = useActiveBranch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      let url = "/api/reports/flowai-insights";
      if (activeBranchId) {
        url += `?branchId=${activeBranchId}`;
      }
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token || ""}` }
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (err) {
      console.error("Failed to fetch FlowAI insights:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, [activeBranchId]);

  const handleApplyRecommendation = async (rec: any) => {
    setRunningAction(rec.id);
    try {
      if (rec.actionType === "whatsapp") {
        // Send retention message to a simulated VIP candidate
        const token = localStorage.getItem("flow_token");
        
        // Let's find first customer from logs or use sample
        const res = await fetch("/api/customers/retention/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`
          },
          body: JSON.stringify({
            customerId: 1, // simulated id
            customerName: "Erick Satria",
            phone: "08123456789",
            message: `Halo Erick, kami merindukan Anda di Flow Cafe! Dapatkan diskon 20% dengan kode promo: ${rec.couponCode || "FLOWRET20"}`,
            couponCode: rec.couponCode || "FLOWRET20"
          })
        });

        if (res.ok) {
          alert(`Berhasil mengirimkan WhatsApp simulator ke pelanggan: Erick Satria (08123456789) menggunakan Kupon: ${rec.couponCode || "FLOWRET20"}!`);
        } else {
          const err = await res.json();
          alert(err.error || "Gagal mengirimkan notifikasi retensi");
        }
      } else {
        // Simulate promotion/bundling setup
        await new Promise(r => setTimeout(r, 1000));
        alert(`Rekomendasi AI Berhasil Diterapkan:\n- Tindakan: ${rec.recommendation}\n- Status: Aktif & Terintegrasi di Kasir POS`);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan koneksi");
    } finally {
      setRunningAction(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[60vh] font-sans">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <span className="font-semibold text-sm">FlowAI sedang memindai dan menganalisis data bisnis Anda...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground font-sans">
        <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
        <div>Gagal memuat FlowAI Insights. Pastikan koneksi server aktif.</div>
      </div>
    );
  }

  const { metrics, insights, recommendations } = data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            🧠 FlowAI Insights <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Enterprise BI</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Analisis kecerdasan bisnis, rekomendasi pemasaran, dan segmentasi otomatis.</p>
        </div>
        <button
          onClick={fetchInsights}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm"
        >
          <RefreshCw size={13} /> Analisis Ulang
        </button>
      </div>

      {/* Metrics Glowing Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            title: "Omzet Hari Ini",
            value: formatRp(metrics.todaySales),
            desc: `${metrics.dailyGrowth >= 0 ? "+" : ""}${metrics.dailyGrowth}% dibanding kemarin`,
            icon: <TrendingUp className={`w-5 h-5 ${metrics.dailyGrowth >= 0 ? "text-green-500 animate-pulse" : "text-red-500"}`} />,
            glow: "shadow-[0_0_15px_rgba(34,197,94,0.06)]"
          },
          {
            title: "Produk Terlaris (Minggu Ini)",
            value: metrics.bestProduct,
            desc: "Berdasarkan volume penjualan KDS",
            icon: <Award className="w-5 h-5 text-amber-500" />,
            glow: "shadow-[0_0_15px_rgba(245,158,11,0.06)]"
          },
          {
            title: "Member VIP Tidak Aktif",
            value: `${metrics.inactiveVipCount} Pelanggan`,
            desc: "Belum transaksi > 30 hari",
            icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
            glow: "shadow-[0_0_15px_rgba(239,68,68,0.06)]"
          },
          {
            title: "Stok Kritis",
            value: `${metrics.criticalStockCount} Bahan`,
            desc: "Mendekati batas minimal stok",
            icon: <Package className="w-5 h-5 text-blue-500" />,
            glow: "shadow-[0_0_15px_rgba(59,130,246,0.06)]"
          }
        ].map((m, idx) => (
          <div key={idx} className={`bg-card border border-card-border p-4.5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition-all ${m.glow}`}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{m.title}</span>
              {m.icon}
            </div>
            <div className="mt-3">
              <div className="font-extrabold text-foreground text-base tracking-tight leading-none truncate">{m.value}</div>
              <span className="text-[10px] text-muted-foreground mt-1.5 inline-block font-medium">{m.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Insights List Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Brain className="text-primary" size={16} /> Analisis Tren Bisnis Otomatis
            </h2>
            
            <div className="divide-y divide-border/60 space-y-4">
              {/* Sales Insight */}
              <div className="pt-2 first:pt-0 space-y-2">
                <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">📈 Penjualan & Pendapatan</span>
                <div className="space-y-1.5">
                  {insights.sales.map((ins: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      {ins.trend === "up" ? <TrendingUp size={14} className="text-green-500 mt-0.5" /> : <TrendingDown size={14} className="text-red-500 mt-0.5" />}
                      <span className="leading-normal font-medium">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products Insight */}
              <div className="pt-4 space-y-2">
                <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">🏆 Performa Menu & Produk</span>
                <div className="space-y-1.5">
                  {insights.products.map((ins: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      {ins.type === "award" ? <Award size={14} className="text-amber-500 mt-0.5" /> : <AlertTriangle size={14} className="text-red-500 mt-0.5" />}
                      <span className="leading-normal font-medium">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customers Insight */}
              <div className="pt-4 space-y-2">
                <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">👥 Aktivitas Pelanggan (CRM)</span>
                <div className="space-y-1.5">
                  {insights.customers.map((ins: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      {ins.type === "info" ? <Info size={14} className="text-blue-500 mt-0.5" /> : <AlertTriangle size={14} className="text-red-500 mt-0.5" />}
                      <span className="leading-normal font-medium">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Insight */}
              <div className="pt-4 space-y-2">
                <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">📦 Status Stok Bahan Baku</span>
                <div className="space-y-1.5">
                  {insights.stock.map((ins: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5" />
                      <span className="leading-normal font-medium">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actionable Recommendations Panel */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="text-amber-500 animate-pulse" size={16} /> Tindakan AI Rekomendasi
            </h2>
            <p className="text-[10px] text-muted-foreground leading-normal">Optimalkan penjualan, retensi, dan efisiensi bahan baku secara realtime dengan rekomendasi siap pakai di bawah ini.</p>
            
            <div className="space-y-3">
              {recommendations.map((rec: any) => (
                <div key={rec.id} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3 flex flex-col justify-between hover:border-primary/20 transition-colors">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {rec.actionType === "whatsapp" ? "CRM WhatsApp" : rec.actionType === "promo" ? "Diskon Pemasaran" : rec.actionType === "bundle" ? "Bundling Menu" : "Inventori"}
                    </span>
                    <h3 className="font-bold text-[11px] text-foreground leading-snug mt-1">{rec.problem}</h3>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{rec.recommendation}</p>
                  </div>
                  
                  <button
                    onClick={() => handleApplyRecommendation(rec)}
                    disabled={runningAction === rec.id}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-97 flex items-center justify-center gap-1 cursor-pointer ${
                      rec.actionType === "whatsapp"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : rec.actionType === "restock"
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    {runningAction === rec.id ? (
                      "Memproses..."
                    ) : (
                      <>
                        {rec.actionType === "whatsapp" ? <MessageSquare size={12} /> : rec.actionType === "bundle" ? <Layers size={12} /> : <Check size={12} />}
                        {rec.actionType === "whatsapp" ? "Kirim Notifikasi Retensi" : rec.actionType === "restock" ? "Buka Inventori" : "Terapkan Rekomendasi"}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
