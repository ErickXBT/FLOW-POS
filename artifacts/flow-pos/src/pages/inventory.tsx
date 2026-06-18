import { useState } from "react";
import { useListInventory, useListInventoryAdjustments, useCreateInventoryAdjustment, getListInventoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Package, X, Plus } from "lucide-react";

function AdjustForm({ products, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({ productId: "", type: "stock_in", quantity: 1, notes: "" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Penyesuaian Stok</h2>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Produk *</label>
            <select value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Pilih produk...</option>
              {(products || []).map((p: any) => <option key={p.productId} value={p.productId}>{p.productName} (stok: {p.stock})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="stock_in">Stok Masuk</option>
              <option value="stock_out">Stok Keluar</option>
              <option value="adjustment">Penyesuaian</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah *</label>
            <input type="number" min={1} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catatan</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Batal</button>
          <button onClick={() => onSubmit({ ...form, productId: Number(form.productId), quantity: Number(form.quantity) })}
            disabled={loading || !form.productId}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const qc = useQueryClient();
  const { data: inventory, isLoading } = useListInventory({ search: search || undefined });
  const { data: adjustments } = useListInventoryAdjustments({});
  const createAdjustment = useCreateInventoryAdjustment();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });

  const items = (inventory || []).filter(i => !lowStockOnly || i.isLowStock);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Inventori</h1>
          <p className="text-muted-foreground text-sm">Kelola stok produk Anda</p>
        </div>
        <button onClick={() => setShowAdjust(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90">
          <Plus size={16} /> Penyesuaian Stok
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="inventory-search"
            autoComplete="off"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
        </div>
        <button onClick={() => setLowStockOnly(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            lowStockOnly ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:border-amber-400"
          }`}>
          <AlertTriangle size={15} />
          Stok Rendah
          {(inventory || []).filter(i => i.isLowStock).length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${lowStockOnly ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
              {(inventory || []).filter(i => i.isLowStock).length}
            </span>
          )}
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden mb-6">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Memuat...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Produk", "SKU", "Stok Saat Ini", "Stok Min.", "Kategori", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-12">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <div>Tidak ada produk</div>
                  </td></tr>
                )}
                {items.map(i => (
                  <tr key={i.productId} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i.isLowStock ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {i.isLowStock && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
                        <span className="font-medium text-foreground">{i.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i.sku || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-base ${i.isLowStock ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{i.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.minStock}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.categoryName || "-"}</td>
                    <td className="px-4 py-3">
                      {i.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          <AlertTriangle size={10} /> Stok Rendah
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Tersedia
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent adjustments */}
      <div>
        <h2 className="font-semibold text-foreground mb-3">Riwayat Penyesuaian</h2>
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Produk", "Tipe", "Jumlah", "Catatan", "Waktu"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(adjustments || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Belum ada riwayat penyesuaian</td></tr>
                )}
                {(adjustments || []).map((a: any) => (
                  <tr key={a.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{a.productName || a.productId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.type === "stock_in" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                        a.type === "stock_out" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {a.type === "stock_in" ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                        {a.type === "stock_in" ? "Masuk" : a.type === "stock_out" ? "Keluar" : "Penyesuaian"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{a.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.notes || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(a.createdAt).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdjust && (
        <AdjustForm
          products={inventory || []}
          onSubmit={(form: any) => createAdjustment.mutate({ data: form }, { onSuccess: () => { setShowAdjust(false); invalidate(); } })}
          onClose={() => setShowAdjust(false)}
          loading={createAdjustment.isPending}
        />
      )}
    </div>
  );
}
