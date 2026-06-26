import { useState, useEffect } from "react";
import { ArrowLeftRight, Calendar, Search, RefreshCw, Eye } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatRp(v: number) {
  const isNeg = v < 0;
  const absVal = Math.abs(v);
  return `${isNeg ? "-" : ""}Rp ${absVal.toLocaleString("id-ID")}`;
}

export default function MutasiKasPage() {
  const { branches } = useActiveBranch();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(25);
  
  const [shifts, setShifts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("flow_token") ?? "";
    try {
      // 1. Fetch shifts
      const shiftsRes = await fetch(`${BASE}/api/shifts/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let shiftsData = [];
      if (shiftsRes.ok) {
        shiftsData = await shiftsRes.json();
        setShifts(shiftsData || []);
      }

      // 2. Fetch expenses
      const expensesRes = await fetch(`${BASE}/api/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setExpenses(expensesData || []);
      }
    } catch (err) {
      console.error("Failed to fetch cash mutations:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSearch("");
    setLimit(25);
  };

  const handleQuickRange = (range: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (range === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (range === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split("T")[0]);
      setEndDate(today);
    } else if (range === "30days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split("T")[0]);
      setEndDate(today);
    }
  };

  // Compile mutations ledger from shifts and expenses
  const compileMutations = () => {
    const list: any[] = [];

    // Add shift movements
    shifts.forEach(s => {
      const branch = s.branchName || "Cabang Utama";
      const cashier = s.cashierName || "Kasir";

      // 1. Shift opening
      list.push({
        id: `shift-open-${s.id}`,
        date: new Date(s.openedAt),
        outlet: branch,
        cashier: cashier,
        type: "Modal Awal (Kas Masuk)",
        nominal: Number(s.openingCash || 0),
        notes: `Modal awal pembukaan laci kasir #${s.id}`,
        raw: s
      });

      // 2. Cash sales (if shift closed or has expected cash)
      const opening = Number(s.openingCash || 0);
      const expected = Number(s.expectedCash || opening);
      const sales = expected - opening;
      if (sales > 0) {
        list.push({
          id: `shift-sales-${s.id}`,
          date: s.closedAt ? new Date(s.closedAt) : new Date(s.openedAt),
          outlet: branch,
          cashier: cashier,
          type: "Penjualan Cash (Kas Masuk)",
          nominal: sales,
          notes: `Hasil penjualan tunai selama shift #${s.id}`,
          raw: s
        });
      }

      // 3. Shift closing discrepancy (if any)
      const disc = Number(s.discrepancy || 0);
      if (disc !== 0 && s.status === "closed") {
        list.push({
          id: `shift-disc-${s.id}`,
          date: new Date(s.closedAt || s.openedAt),
          outlet: branch,
          cashier: cashier,
          type: disc < 0 ? "Selisih Kurang (Kas Keluar)" : "Selisih Lebih (Kas Masuk)",
          nominal: disc,
          notes: `Selisih pemeriksaan laci uang fisik vs sistem. Catatan: ${s.notes || "-"}`,
          raw: s
        });
      }
    });

    // Add expenses
    expenses.forEach(e => {
      const dateVal = e.date ? new Date(e.date) : new Date(e.createdAt || Date.now());
      list.push({
        id: `expense-${e.id}`,
        date: dateVal,
        outlet: e.branchName || "Pusat / Kantor",
        cashier: "Manager/Owner",
        type: "Beban Operasional (Kas Keluar)",
        nominal: -Number(e.amount || 0),
        notes: `[${e.category}] ${e.desc}`,
        raw: e
      });
    });

    // Sort chronologically (newest first)
    list.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Apply filters
    return list.filter(m => {
      // Date range filter
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (m.date.getTime() < start.getTime()) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (m.date.getTime() > end.getTime()) return false;
      }

      // Search text filter
      if (search.trim()) {
        const sKeyword = search.toLowerCase();
        const matchType = m.type.toLowerCase().includes(sKeyword);
        const matchNotes = m.notes.toLowerCase().includes(sKeyword);
        const matchOutlet = m.outlet.toLowerCase().includes(sKeyword);
        const matchCashier = m.cashier.toLowerCase().includes(sKeyword);
        if (!matchType && !matchNotes && !matchOutlet && !matchCashier) return false;
      }

      return true;
    });
  };

  const filteredMutations = compileMutations();
  const paginatedMutations = filteredMutations.slice(0, limit);

  // Financial aggregates for metrics cards
  let totalKasMasuk = 0;
  let totalKasKeluar = 0;

  filteredMutations.forEach(m => {
    if (m.nominal > 0) {
      totalKasMasuk += m.nominal;
    } else {
      totalKasKeluar += Math.abs(m.nominal);
    }
  });

  const expectedCashOutlet = totalKasMasuk - totalKasKeluar;
  const selisih = expectedCashOutlet; // net balance

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          🔄 Mutasi Kas
        </h1>
        <p className="text-muted-foreground text-sm font-sans">Jurnal audit riwayat pergerakan uang tunai fisik dan kas keluar di outlet</p>
      </div>

      {/* Filter Row */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Dari */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Sampai */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cari */}
          <div className="space-y-1 flex-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Cari</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari kasir, tipe, keterangan..."
                className="w-full pl-8 pr-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Limit */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Tampilkan</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex-1 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all text-center"
            >
              Terapkan
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date presets block */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
          <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Rentan Waktu:</span>
          <button
            onClick={() => handleQuickRange("today")}
            className="px-3 py-1 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-semibold rounded-lg transition-all"
          >
            Hari Ini
          </button>
          <button
            onClick={() => handleQuickRange("7days")}
            className="px-3 py-1 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-semibold rounded-lg transition-all"
          >
            7 Hari
          </button>
          <button
            onClick={() => handleQuickRange("30days")}
            className="px-3 py-1 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-semibold rounded-lg transition-all"
          >
            30 Hari
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Expected Cash */}
        <div className="bg-card border-l-4 border-l-green-500 border border-card-border rounded-xl p-4.5 shadow-sm">
          <div className="text-muted-foreground text-[10px] font-semibold uppercase">Expected Cash Outlet</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{formatRp(expectedCashOutlet)}</div>
          <span className="text-[9px] text-muted-foreground">Uang fisik outlet seharusnya</span>
        </div>

        {/* Kas Masuk */}
        <div className="bg-card border-l-4 border-l-green-500 border border-card-border rounded-xl p-4.5 shadow-sm">
          <div className="text-muted-foreground text-[10px] font-semibold uppercase">Total Kas Masuk</div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{formatRp(totalKasMasuk)}</div>
          <span className="text-[9px] text-muted-foreground">Total modal awal & penjualan tunai</span>
        </div>

        {/* Kas Keluar */}
        <div className="bg-card border-l-4 border-l-red-500 border border-card-border rounded-xl p-4.5 shadow-sm">
          <div className="text-muted-foreground text-[10px] font-semibold uppercase">Total Kas Keluar</div>
          <div className="text-xl font-bold text-red-500 mt-1">{formatRp(totalKasKeluar)}</div>
          <span className="text-[9px] text-muted-foreground">Pengeluaran & minus selisih kas</span>
        </div>

        {/* Selisih */}
        <div className="bg-card border-l-4 border-l-slate-800 dark:border-l-slate-400 border border-card-border rounded-xl p-4.5 shadow-sm">
          <div className="text-muted-foreground text-[10px] font-semibold uppercase">Selisih Net (Saldo Kas)</div>
          <div className="text-xl font-bold text-foreground mt-1">{formatRp(selisih)}</div>
          <span className="text-[9px] text-muted-foreground">Arus kas bersih periode terpilih</span>
        </div>
      </div>

      {/* Mutations Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-semibold text-sm">Memuat log mutasi kas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5">Tanggal</th>
                  <th className="text-left px-5 py-3.5">Outlet</th>
                  <th className="text-left px-5 py-3.5">Kasir / Operator</th>
                  <th className="text-left px-5 py-3.5">Jenis Mutasi</th>
                  <th className="text-right px-5 py-3.5">Nominal</th>
                  <th className="text-left px-5 py-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {paginatedMutations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-16">
                      <ArrowLeftRight size={36} className="mx-auto mb-3 opacity-20" />
                      <div className="font-semibold text-base">Tidak ada transaksi mutasi kas</div>
                      <p className="text-xs text-muted-foreground mt-1">Selesaikan shift kasir atau catat pengeluaran baru untuk melihat mutasi</p>
                    </td>
                  </tr>
                ) : (
                  paginatedMutations.map((m: any, idx: number) => {
                    const formattedDate = m.date.toLocaleString("id-ID", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    });
                    const isOut = m.nominal < 0;

                    return (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-4 font-semibold text-muted-foreground text-[11px]">{formattedDate}</td>
                        <td className="px-5 py-4 font-bold text-foreground">{m.outlet}</td>
                        <td className="px-5 py-4 font-medium text-foreground">{m.cashier}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                            isOut
                              ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20"
                              : "bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/20"
                          }`}>
                            {m.type}
                          </span>
                        </td>
                        <td className={`px-5 py-4 text-right font-extrabold ${isOut ? "text-red-505" : "text-green-606"}`}>
                          {formatRp(m.nominal)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-medium max-w-[280px] truncate" title={m.notes}>
                          {m.notes}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
