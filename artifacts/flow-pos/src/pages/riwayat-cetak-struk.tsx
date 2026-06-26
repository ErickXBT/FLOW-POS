import { useState, useEffect } from "react";
import { Receipt, Search, RefreshCw, Eye, Download, Printer, CheckSquare, Square, Trash2 } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatRp(v: number) {
  return `Rp ${v.toLocaleString("id-ID")}`;
}

export default function RiwayatCetakStrukPage() {
  const { activeBranchId, branches } = useActiveBranch();
  
  const [search, setSearch] = useState("");
  const [printStatusFilter, setPrintStatusFilter] = useState(""); // all, printed, non_printed
  const [methodFilter, setMethodFilter] = useState(""); // all, cash, qris...
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(""); // all, completed...
  const [dateRange, setDateRange] = useState("all"); // all, today
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printHistory, setPrintHistory] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Load print history map from localStorage
  const loadPrintHistory = () => {
    try {
      const stored = localStorage.getItem("flow_print_history");
      if (stored) {
        setPrintHistory(JSON.parse(stored));
      }
    } catch (err) {}
  };

  const savePrintHistory = (newHistory: Record<string, any>) => {
    setPrintHistory(newHistory);
    localStorage.setItem("flow_print_history", JSON.stringify(newHistory));
  };

  const fetchOrders = async () => {
    setLoading(true);
    const token = localStorage.getItem("flow_token") ?? "";
    let url = `${BASE}/api/tenant/customer-orders?limit=100`;
    if (activeBranchId) url += `&branchId=${activeBranchId}`;
    
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setOrders(d.data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPrintHistory();
    fetchOrders();
  }, [activeBranchId]);

  const handleSimulatePrint = (orderId: number, orderNumber: string) => {
    const nextHistory = { ...printHistory };
    const prevPrint = nextHistory[orderId] || { count: 0, status: "Pending", time: "-", by: "-" };
    
    nextHistory[orderId] = {
      count: prevPrint.count + 1,
      status: "Sukses",
      time: new Date().toLocaleString("id-ID", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
      by: localStorage.getItem("flow_user_name") || "Kasir Utama"
    };

    savePrintHistory(nextHistory);
    alert(`Nota #${orderNumber} berhasil dicetak!`);
  };

  const handleClearSelected = () => {
    if (selectedIds.length === 0) return;
    const nextHistory = { ...printHistory };
    selectedIds.forEach(id => {
      delete nextHistory[id];
    });
    savePrintHistory(nextHistory);
    setSelectedIds([]);
    alert("Riwayat cetak terpilih berhasil dibersihkan!");
  };

  const handleClearAll = () => {
    if (window.confirm("Apakah Anda yakin ingin membersihkan semua riwayat cetak struk?")) {
      savePrintHistory({});
      setSelectedIds([]);
      alert("Seluruh riwayat cetak struk berhasil dibersihkan!");
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (visibleOrders: any[]) => {
    const visibleIds = visibleOrders.map(o => o.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Compile final rows
  const compiledRows = orders.map(o => {
    const hist = printHistory[o.id] || { count: 0, status: "Pending", time: "-", by: "-" };
    return {
      ...o,
      printCount: hist.count,
      printStatus: hist.status,
      printTime: hist.time,
      printBy: hist.by
    };
  });

  // Filter rows
  const filteredRows = compiledRows.filter(r => {
    // 1. Text Search
    if (search.trim()) {
      const kw = search.toLowerCase();
      const matchNo = r.orderNumber?.toLowerCase().includes(kw);
      const matchBranch = r.branchName?.toLowerCase().includes(kw);
      const matchEmployee = r.employeeName?.toLowerCase().includes(kw);
      const matchCust = r.customerName?.toLowerCase().includes(kw);
      if (!matchNo && !matchBranch && !matchEmployee && !matchCust) return false;
    }

    // 2. Print status
    if (printStatusFilter === "printed" && r.printCount === 0) return false;
    if (printStatusFilter === "non_printed" && r.printCount > 0) return false;

    // 3. Payment method
    if (methodFilter && r.paymentMethod !== methodFilter) return false;

    // 4. Payment status
    if (paymentStatusFilter && r.status !== paymentStatusFilter) return false;

    // 5. Date filter (today)
    if (dateRange === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      const createdStr = new Date(r.createdAt).toISOString().split("T")[0];
      if (todayStr !== createdStr) return false;
    }

    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          📄 Riwayat Cetak Struk
        </h1>
        <p className="text-muted-foreground text-sm font-sans">Pantau frekuensi cetak nota transaksi dan operator kasir pencetak struk</p>
      </div>

      {/* Filter Row */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Cari */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Pencarian</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari Nota / Kasir / Outlet..."
                className="w-full pl-8 pr-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status Cetak */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Status Cetak</label>
            <select
              value={printStatusFilter}
              onChange={e => setPrintStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="printed">Sudah Dicetak</option>
              <option value="non_printed">Belum Dicetak</option>
            </select>
          </div>

          {/* Metode */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Metode</label>
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="">Semua Metode</option>
              <option value="cash">Cash / Tunai</option>
              <option value="qris">QRIS</option>
              <option value="bank_transfer">Transfer Bank</option>
              <option value="ewallet">e-Wallet</option>
            </select>
          </div>

          {/* Pembayaran */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Pembayaran</label>
            <select
              value={paymentStatusFilter}
              onChange={e => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="completed">Lunas</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refund</option>
              <option value="void">Void</option>
            </select>
          </div>

          {/* Quick Dates */}
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange(prev => prev === "today" ? "all" : "today")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                dateRange === "today"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Transaksi Hari Ini
            </button>
            <button
              onClick={fetchOrders}
              className="p-2 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex gap-3">
        <button
          onClick={handleClearSelected}
          disabled={selectedIds.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40"
        >
          <Trash2 size={13} /> Bersihkan Terpilih
        </button>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1.5 px-4 py-2 border border-red-500 text-red-500 hover:bg-red-50 text-xs font-bold rounded-xl transition-all"
        >
          Bersihkan Semua
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-semibold text-sm">Memuat riwayat cetak struk...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-center w-12">
                    <button
                      onClick={() => toggleSelectAll(filteredRows)}
                      className="text-muted-foreground"
                    >
                      {filteredRows.length > 0 && filteredRows.every(r => selectedIds.includes(r.id)) ? (
                        <CheckSquare size={15} className="text-primary" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3.5">No Nota</th>
                  <th className="text-left px-5 py-3.5">Outlet</th>
                  <th className="text-left px-5 py-3.5">Kasir</th>
                  <th className="text-left px-5 py-3.5">Tanggal</th>
                  <th className="text-right px-5 py-3.5">Total</th>
                  <th className="text-left px-5 py-3.5">Metode Bayar</th>
                  <th className="text-left px-5 py-3.5">Status Bayar</th>
                  <th className="text-center px-5 py-3.5">Cetak Ke</th>
                  <th className="text-center px-5 py-3.5">Status</th>
                  <th className="text-left px-5 py-3.5">Waktu Cetak</th>
                  <th className="text-left px-5 py-3.5">Oleh</th>
                  <th className="text-center px-5 py-3.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center text-muted-foreground py-16">
                      <Receipt size={36} className="mx-auto mb-3 opacity-20" />
                      <div className="font-semibold text-base">Tidak ada riwayat cetak struk</div>
                      <p className="text-xs text-muted-foreground mt-1">Struk yang dicetak dari laci POS kasir akan tercatat di sini</p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r: any) => {
                    const dateStr = new Date(r.createdAt).toLocaleString("id-ID", {
                      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                    });
                    const isSelected = selectedIds.includes(r.id);

                    return (
                      <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => toggleSelect(r.id)}
                            className="text-muted-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare size={15} className="text-primary" />
                            ) : (
                              <Square size={15} />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4 font-bold text-primary hover:underline cursor-pointer">
                          {r.orderNumber}
                        </td>
                        <td className="px-5 py-4 font-semibold text-foreground">{r.branchName || "Utama"}</td>
                        <td className="px-5 py-4 text-foreground">{r.employeeName || "Kasir Utama"}</td>
                        <td className="px-5 py-4 text-muted-foreground">{dateStr}</td>
                        <td className="px-5 py-4 text-right font-extrabold text-foreground">{formatRp(Number(r.total))}</td>
                        <td className="px-5 py-4 capitalize">{r.paymentMethod}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-950/20" : "bg-red-100 text-red-700"
                          }`}>
                            {r.status === "completed" ? "Lunas" : r.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-foreground">
                          {r.printCount}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.printCount > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {r.printCount > 0 ? "Sukses" : "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{r.printTime}</td>
                        <td className="px-5 py-4 text-foreground">{r.printBy}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleSimulatePrint(r.id, r.orderNumber)}
                            className="p-1.5 border border-border bg-background hover:bg-muted text-primary hover:text-primary rounded-lg transition-all shadow-xs inline-flex items-center justify-center cursor-pointer"
                            title="Simulasi Cetak Nota"
                          >
                            <Printer size={13} />
                          </button>
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
