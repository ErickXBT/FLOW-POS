import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, ArrowRightLeft, Building2, Store } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { useListProducts } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AmbilStokPage() {
  const [, setLocation] = useLocation();
  const { branches } = useActiveBranch();
  const { data: productsResult, isLoading: productsLoading } = useListProducts({ limit: 100 });
  const products = productsResult?.data || [];

  const [type, setType] = useState<"ambil_pusat" | "kembali_pusat" | "kirim_cabang">("ambil_pusat");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Stock tracking states
  const [sourceStock, setSourceStock] = useState<number | null>(null);
  const [targetStock, setTargetStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  // Fetch stock levels when product or branches change
  const checkStockLevels = async () => {
    if (!selectedProductId) {
      setSourceStock(null);
      setTargetStock(null);
      return;
    }
    setCheckingStock(true);
    const token = localStorage.getItem("flow_token") ?? "";
    try {
      const selectedProduct = products.find((p: any) => String(p.id) === selectedProductId);
      
      // Determine Source Stock
      if (type === "ambil_pusat") {
        // Source is Pusat (Gudang/Global product)
        setSourceStock(selectedProduct ? Number(selectedProduct.stock) : 0);
      } else {
        // Source is a Branch
        if (sourceBranchId) {
          const res = await fetch(`${BASE}/api/inventory?branchId=${sourceBranchId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const match = data.find((i: any) => String(i.productId) === selectedProductId);
            setSourceStock(match ? Number(match.stock) : 0);
          }
        } else {
          setSourceStock(null);
        }
      }

      // Determine Target Stock
      if (type === "kembali_pusat") {
        // Target is Pusat
        setTargetStock(selectedProduct ? Number(selectedProduct.stock) : 0);
      } else {
        // Target is a Branch
        if (targetBranchId) {
          const res = await fetch(`${BASE}/api/inventory?branchId=${targetBranchId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const match = data.find((i: any) => String(i.productId) === selectedProductId);
            setTargetStock(match ? Number(match.stock) : 0);
          }
        } else {
          setTargetStock(null);
        }
      }
    } catch (err) {
      console.error("Failed to check stock levels:", err);
    }
    setCheckingStock(false);
  };

  useEffect(() => {
    checkStockLevels();
  }, [type, selectedProductId, sourceBranchId, targetBranchId, productsResult]);

  // Reset target or source selection when type changes to prevent matching
  useEffect(() => {
    setSourceBranchId("");
    setTargetBranchId("");
    setSourceStock(null);
    setTargetStock(null);
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || Number(quantity) <= 0) {
      alert("Silakan lengkapi produk dan jumlah Qty.");
      return;
    }

    if (type === "ambil_pusat" && !targetBranchId) {
      alert("Pilih outlet tujuan transfer.");
      return;
    }
    if (type === "kembali_pusat" && !sourceBranchId) {
      alert("Pilih cabang asal retur.");
      return;
    }
    if (type === "kirim_cabang" && (!sourceBranchId || !targetBranchId)) {
      alert("Pilih cabang asal dan cabang tujuan.");
      return;
    }

    if (sourceBranchId && targetBranchId && sourceBranchId === targetBranchId) {
      alert("Cabang asal dan cabang tujuan tidak boleh sama.");
      return;
    }

    const qty = Number(quantity);
    if (sourceStock !== null && sourceStock < qty) {
      alert(`Stok asal tidak mencukupi (Tersisa: ${sourceStock})`);
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem("flow_token") ?? "";
    try {
      const res = await fetch(`${BASE}/api/inventory/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          type,
          sourceBranchId: sourceBranchId ? Number(sourceBranchId) : null,
          targetBranchId: targetBranchId ? Number(targetBranchId) : null,
          quantity: qty,
          notes: notes.trim() || null
        })
      });

      if (res.ok) {
        alert("Stok berhasil dipindahkan!");
        setQuantity("");
        setNotes("");
        // Reload stock values
        await checkStockLevels();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal memindahkan stok");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menghubungi server.");
    } finally {
      setSubmitting(false);
    }
  };

  // UI labels based on transaction type
  const getHeaderInfo = () => {
    switch (type) {
      case "ambil_pusat":
        return {
          title: "Ambil Stok dari Pusat",
          sub: "Pindahkan stok barang dari Rumah Produksi ke Outlet Cabang."
        };
      case "kembali_pusat":
        return {
          title: "Kembalikan ke Pusat",
          sub: "Kirim balik (retur) stok berlebih dari Outlet Cabang ke Gudang Pusat."
        };
      case "kirim_cabang":
        return {
          title: "Kirim ke Cabang Lain",
          sub: "Salurkan atau pindahkan stok antar outlet cabang yang berbeda."
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="p-6 space-y-6">
      {/* Title with Back Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-10 h-10 border border-border bg-card hover:bg-muted text-foreground rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">📦 Ambil / Salurkan Stok</h1>
        </div>
      </div>

      {/* Dynamic Header Block */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <ArrowRightLeft size={24} />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">{headerInfo.title}</h2>
          <p className="text-xs text-muted-foreground">{headerInfo.sub}</p>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5 max-w-3xl">
        {/* Jenis Transaksi */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase">Jenis Transaksi</label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setType("ambil_pusat")}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all text-center ${
                type === "ambil_pusat"
                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              ↙ Ambil dari Pusat
            </button>
            <button
              type="button"
              onClick={() => setType("kembali_pusat")}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all text-center ${
                type === "kembali_pusat"
                  ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/10"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              ↗ Kembalikan ke Pusat
            </button>
            <button
              type="button"
              onClick={() => setType("kirim_cabang")}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition-all text-center ${
                type === "kirim_cabang"
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-650/10"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              ⇄ Kirim ke Cabang Lain
            </button>
          </div>
        </div>

        {/* Produk / Barang */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase block">Produk / Barang <span className="text-red-500">*</span></label>
          {productsLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
              <RefreshCw size={12} className="animate-spin" /> Memuat produk...
            </div>
          ) : (
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              <option value="">-- Cari / Pilih Produk --</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ""} - [Stok Pusat: {p.stock} Pcs]
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Source / Target Rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Asal */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase block">Asal (Gudang/Sumber)</label>
            {type === "ambil_pusat" ? (
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  readOnly
                  value="Rumah Produksi (Pusat)"
                  className="w-full pl-10 pr-3 py-2.5 border border-input bg-muted/30 rounded-xl text-xs text-muted-foreground font-semibold cursor-not-allowed"
                />
              </div>
            ) : (
              <div className="relative">
                <Store size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={sourceBranchId}
                  onChange={e => setSourceBranchId(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Cabang Asal --</option>
                  {(branches || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground pl-0.5 mt-1 font-semibold">
              {checkingStock ? (
                <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin text-primary" /> Memeriksa stok...</span>
              ) : selectedProductId ? (
                sourceStock !== null ? `Tersedia: ${sourceStock} Pcs` : "Pilih cabang asal untuk cek stok"
              ) : (
                "Pilih produk untuk cek stok"
              )}
            </div>
          </div>

          {/* Tujuan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase block">Ke Outlet (Tujuan) <span className="text-red-500">*</span></label>
            {type === "kembali_pusat" ? (
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  readOnly
                  value="Rumah Produksi (Pusat)"
                  className="w-full pl-10 pr-3 py-2.5 border border-input bg-muted/30 rounded-xl text-xs text-muted-foreground font-semibold cursor-not-allowed"
                />
              </div>
            ) : (
              <div className="relative">
                <Store size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={targetBranchId}
                  onChange={e => setTargetBranchId(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Tujuan --</option>
                  {(branches || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground pl-0.5 mt-1 font-semibold">
              {checkingStock ? (
                <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin text-primary" /> Memeriksa stok...</span>
              ) : selectedProductId ? (
                targetStock !== null ? `Stok Saat Ini: ${targetStock} Pcs` : ""
              ) : (
                ""
              )}
            </div>
          </div>
        </div>

        {/* Jumlah Qty */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase block">Jumlah (QTY) <span className="text-red-500">*</span></label>
          <input
            type="number"
            required
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Misal: 50"
            min="1"
            className="w-full px-3 py-2.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Keterangan / Catatan */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase block">Keterangan / Catatan</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Misal: Barang berlebih/rusak mau diretur, atau Restock outlet cabang bulanan"
            rows={3}
            className="w-full px-3 py-2.5 border border-input bg-background rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || checkingStock || !selectedProductId || !quantity}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 shadow-lg shadow-primary/10 cursor-pointer"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-1.5"><RefreshCw size={13} className="animate-spin" /> Memproses Pemindahan...</span>
          ) : (
            "Simpan & Pindahkan Stok"
          )}
        </button>
      </form>
    </div>
  );
}
