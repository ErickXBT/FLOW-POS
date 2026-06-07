import { useState } from "react";
import { useListProducts, useListCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Package, X } from "lucide-react";

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

interface ProductFormProps {
  initial?: any;
  categories: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
  loading: boolean;
}

function ProductForm({ initial, categories, onSubmit, onClose, loading }: ProductFormProps) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    sku: initial?.sku || "",
    barcode: initial?.barcode || "",
    description: initial?.description || "",
    price: initial?.price || 0,
    costPrice: initial?.costPrice || "",
    stock: initial?.stock ?? 0,
    minStock: initial?.minStock ?? 5,
    categoryId: initial?.categoryId || "",
    imageUrl: initial?.imageUrl || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{initial ? "Edit Produk" : "Tambah Produk"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "name", label: "Nama Produk *", type: "text" },
            { key: "sku", label: "SKU", type: "text" },
            { key: "barcode", label: "Barcode", type: "text" },
            { key: "description", label: "Deskripsi", type: "text" },
            { key: "price", label: "Harga Jual *", type: "number" },
            { key: "costPrice", label: "Harga Beli", type: "number" },
            { key: "stock", label: "Stok *", type: "number" },
            { key: "minStock", label: "Stok Minimum", type: "number" },
            { key: "imageUrl", label: "URL Gambar", type: "url" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Kategori</label>
            <select
              value={form.categoryId}
              onChange={e => setForm(p => ({ ...p, categoryId: Number(e.target.value) || "" }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Tanpa Kategori</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name || !form.price}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const qc = useQueryClient();
  const { data: productsData, isLoading } = useListProducts({ search: search || undefined, limit: 50 });
  const { data: categories } = useListCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() });

  const handleCreate = (form: any) => {
    createProduct.mutate({ data: { ...form, price: Number(form.price), costPrice: form.costPrice ? Number(form.costPrice) : undefined, categoryId: form.categoryId || undefined } }, {
      onSuccess: () => { setShowForm(false); invalidate(); }
    });
  };

  const handleUpdate = (form: any) => {
    updateProduct.mutate({ id: editProduct.id, data: { ...form, price: Number(form.price), costPrice: form.costPrice ? Number(form.costPrice) : undefined, categoryId: form.categoryId || undefined } }, {
      onSuccess: () => { setEditProduct(null); invalidate(); }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Hapus produk ini?")) return;
    deleteProduct.mutate({ id }, { onSuccess: invalidate });
  };

  const products = productsData?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Produk</h1>
          <p className="text-muted-foreground text-sm">{productsData?.total || 0} produk terdaftar</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={16} /> Tambah Produk
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid="input-product-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari produk..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-sm"
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Produk", "SKU", "Harga", "Stok", "Kategori", "Status", "Aksi"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-12">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <div>Belum ada produk</div>
                  </td></tr>
                )}
                {products.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                            <Package size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">{p.name}</div>
                          {p.barcode && <div className="text-xs text-muted-foreground">{p.barcode}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.sku || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatRp(Number(p.price))}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p.stock <= (p.minStock ?? 0) ? "text-red-500" : "text-foreground"}`}>{p.stock}</span>
                      {p.stock <= (p.minStock ?? 0) && <span className="ml-1 text-xs text-red-500">(rendah)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.categoryName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditProduct(p)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ProductForm categories={categories || []} onSubmit={handleCreate} onClose={() => setShowForm(false)} loading={createProduct.isPending} />
      )}
      {editProduct && (
        <ProductForm initial={editProduct} categories={categories || []} onSubmit={handleUpdate} onClose={() => setEditProduct(null)} loading={updateProduct.isPending} />
      )}
    </div>
  );
}
