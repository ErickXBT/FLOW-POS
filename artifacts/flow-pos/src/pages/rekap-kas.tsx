import { useState, useEffect } from "react";
import { Coins, MapPin, Calendar, RefreshCw, Eye, ArrowLeft } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatRp(v: number) {
  return `Rp ${v.toLocaleString("id-ID")}`;
}

export default function RekapKasPage() {
  const { branches } = useActiveBranch();
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`; // e.g. "2026-06"
  });
  const [selectedBranch, setSelectedBranch] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<any | null>(null);

  const fetchShifts = async () => {
    setLoading(true);
    const token = localStorage.getItem("flow_token") ?? "";
    try {
      const res = await fetch(`${BASE}/api/shifts/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShifts(data || []);
      }
    } catch (err) {
      console.error("Failed to load shifts report:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleReset = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    setPeriod(`${d.getFullYear()}-${mm}`);
    setSelectedBranch("");
  };

  // Filter shifts based on selected period (YYYY-MM) and branch
  const filteredShifts = shifts.filter(s => {
    const openedDate = new Date(s.openedAt);
    const yyyymm = `${openedDate.getFullYear()}-${String(openedDate.getMonth() + 1).padStart(2, "0")}`;
    const matchPeriod = yyyymm === period;
    const matchBranch = selectedBranch ? String(s.branchName).toLowerCase().includes(selectedBranch.toLowerCase()) : true;
    return matchPeriod && matchBranch;
  });

  // Calculate aggregated stats
  let totalKasMasuk = 0; // Sum of openingCash + Cash Sales
  let totalKasKeluar = 0; // Sum of negative discrepancy (if actual is less than expected) or general expenses
  let totalSaldoAkhir = 0; // Sum of actualCash (for closed) or expectedCash (for open)

  filteredShifts.forEach(s => {
    const opening = Number(s.openingCash || 0);
    const expected = Number(s.expectedCash || opening);
    const actual = s.actualCash !== null ? Number(s.actualCash) : expected;
    const disc = Number(s.discrepancy || 0);

    totalKasMasuk += expected; // Expected cash is opening cash + sales
    if (disc < 0) {
      totalKasKeluar += Math.abs(disc);
    }
    totalSaldoAkhir += actual;
  });

  // Group by branch for the table
  const branchGroups = filteredShifts.reduce((acc: Record<string, any>, shift) => {
    const bName = shift.branchName || "Cabang Utama";
    if (!acc[bName]) {
      acc[bName] = {
        name: bName,
        openingCash: 0,
        cashSales: 0,
        expectedCash: 0,
        actualCash: 0,
        kasKeluar: 0,
        activeDays: new Set(),
        shiftsList: []
      };
    }

    const opening = Number(shift.openingCash || 0);
    const expected = Number(shift.expectedCash || opening);
    const actual = shift.actualCash !== null ? Number(shift.actualCash) : expected;
    const sales = expected - opening;
    const disc = Number(shift.discrepancy || 0);

    acc[bName].openingCash += opening;
    acc[bName].cashSales += sales;
    acc[bName].expectedCash += expected;
    acc[bName].actualCash += actual;
    if (disc < 0) {
      acc[bName].kasKeluar += Math.abs(disc);
    }
    
    // Add date for active days count
    const dateStr = new Date(shift.openedAt).toISOString().split("T")[0];
    acc[bName].activeDays.add(dateStr);
    acc[bName].shiftsList.push(shift);

    return acc;
  }, {});

  const aggregatedBranches = Object.values(branchGroups);

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          📊 Rekap Kas Bulanan
        </h1>
        <p className="text-muted-foreground text-sm">Rekap bulanan pemasukan dan pengeluaran laci kasir per cabang</p>
      </div>

      {/* Filter Row */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          {/* Periode */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Periode (YYYY-MM)</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-[180px]"
              />
            </div>
          </div>

          {/* Outlet */}
          <div className="space-y-1 flex-1 max-w-xs">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Outlet</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-xl text-sm text-foreground focus:outline-none text-foreground"
            >
              <option value="">Semua Outlet</option>
              {(branches || []).map((b: any) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Reset
          </button>
          <button
            onClick={fetchShifts}
            className="p-2 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-primary" : "text-foreground"} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Kas Masuk */}
        <div className="bg-card border-l-4 border-l-green-500 border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-muted-foreground text-xs font-semibold uppercase">Total Kas Masuk (Outlet)</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{formatRp(totalKasMasuk)}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Uang modal awal + hasil penjualan cash</p>
        </div>

        {/* Kas Keluar */}
        <div className="bg-card border-l-4 border-l-red-500 border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-muted-foreground text-xs font-semibold uppercase">Total Kas Keluar (Outlet)</div>
          <div className="text-2xl font-bold text-red-500 mt-2">{formatRp(totalKasKeluar)}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Selisih minus / kas keluar laci</p>
        </div>

        {/* Saldo Akhir */}
        <div className="bg-card border-l-4 border-l-blue-500 border border-card-border rounded-xl p-5 shadow-sm">
          <div className="text-muted-foreground text-xs font-semibold uppercase">Saldo Akhir (Outlet)</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{formatRp(totalSaldoAkhir)}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Estimasi uang fisik di laci kasir</p>
        </div>
      </div>

      {/* Rekap Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-semibold text-sm">Memuat rekap kas bulanan...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-6 py-3.5">Outlet</th>
                  <th className="text-right px-6 py-3.5">Kas Masuk</th>
                  <th className="text-right px-6 py-3.5">Kas Keluar</th>
                  <th className="text-right px-6 py-3.5">Penjualan Cash</th>
                  <th className="text-right px-6 py-3.5">Saldo Akhir</th>
                  <th className="text-center px-6 py-3.5">Hari Aktif</th>
                  <th className="text-center px-6 py-3.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {aggregatedBranches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-16">
                      <Coins size={36} className="mx-auto mb-3 opacity-20" />
                      <div className="font-semibold text-base">Tidak ada data rekap kas</div>
                      <p className="text-xs text-muted-foreground mt-1">Buka dan selesaikan shift kasir untuk mencatat kas</p>
                    </td>
                  </tr>
                ) : (
                  aggregatedBranches.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground flex items-center gap-1.5">
                        <MapPin size={12} className="text-primary" />
                        {b.name}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">{formatRp(b.expectedCash)}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-500">-{formatRp(b.kasKeluar)}</td>
                      <td className="px-6 py-4 text-right font-medium text-green-600 dark:text-green-400">{formatRp(b.cashSales)}</td>
                      <td className="px-6 py-4 text-right font-extrabold text-primary">{formatRp(b.actualCash)}</td>
                      <td className="px-6 py-4 text-center font-bold text-foreground">
                        <span className="bg-muted px-2.5 py-1 rounded-md text-[11px]">{b.activeDays.size} Hari</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedBranchDetail(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-[10px] font-bold active:scale-95 transition-all shadow-xs"
                        >
                          <Eye size={12} /> Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shifts Detail Modal */}
      {selectedBranchDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in animate-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  📂 Riwayat Shift - {selectedBranchDetail.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Periode {period}</p>
              </div>
              <button
                onClick={() => setSelectedBranchDetail(null)}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                    <th className="px-4 py-3">Kasir</th>
                    <th className="px-4 py-3 text-right">Modal Awal</th>
                    <th className="px-4 py-3 text-right">Sistem Cash</th>
                    <th className="px-4 py-3 text-right">Fisik Laci</th>
                    <th className="px-4 py-3 text-right">Selisih</th>
                    <th className="px-4 py-3 text-right">Omset (EOD)</th>
                    <th className="px-4 py-3 text-right">Rata-rata Belanja</th>
                    <th className="px-4 py-3 text-center">Jam Terlaris</th>
                    <th className="px-4 py-3 text-center">Waktu Shift</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-foreground">
                  {selectedBranchDetail.shiftsList.map((s: any) => {
                    const openedStr = new Date(s.openedAt).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                    const closedStr = s.closedAt ? new Date(s.closedAt).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
                    const discrepancy = Number(s.discrepancy || 0);

                    return (
                      <tr key={s.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3.5 font-bold">{s.cashierName}</td>
                        <td className="px-4 py-3.5 text-right font-medium">{formatRp(s.openingCash)}</td>
                        <td className="px-4 py-3.5 text-right font-medium">{formatRp(s.expectedCash ?? s.openingCash)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-primary">{s.actualCash !== null ? formatRp(s.actualCash) : "-"}</td>
                        <td className={`px-4 py-3.5 text-right font-bold ${discrepancy < 0 ? "text-red-500" : discrepancy > 0 ? "text-green-600" : "text-foreground"}`}>
                          {discrepancy > 0 ? "+" : ""}{formatRp(discrepancy)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-green-600 dark:text-green-400">
                          {formatRp(Number(s.totalRevenue || 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium">
                          {formatRp(Number(s.avgOrderValue || 0))}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-primary">
                          {s.busiestHour || "-"}
                        </td>
                        <td className="px-4 py-3.5 text-center text-muted-foreground text-[10px]">
                          <div>Buka: {openedStr}</div>
                          {s.closedAt && <div className="mt-0.5">Tutup: {closedStr}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                            s.status === "open"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/20"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {s.status === "open" ? "Aktif" : "Selesai"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
