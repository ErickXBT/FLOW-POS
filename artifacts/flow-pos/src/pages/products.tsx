import { useState, useRef, useEffect } from "react";
import {
  useListProducts,
  useListCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
  useGetTenant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Package, X, Star, Tag, UploadCloud } from "lucide-react";
import { Barcode128 } from "@/components/barcode128";

function formatRp(v: number) {
  return `Rp ${v.toLocaleString("id-ID")}`;
}

interface ProductFormProps {
  initial?: any;
  categories: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
  loading: boolean;
  businessType?: string;
  products?: any[];
}

function ProductForm({ initial, categories, onSubmit, onClose, loading, businessType, products = [] }: ProductFormProps) {
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
    isBestSeller: initial?.isBestSeller ?? false,
  });

  const [variantsList, setVariantsList] = useState<{ name: string; price: number }[]>(() => {
    if (!initial?.variantSettings) return [];
    try {
      const parsed = JSON.parse(initial.variantSettings);
      if (parsed.isBundle) return [];
      return parsed.variants || [];
    } catch (e) {
      return [];
    }
  });

  const [toppingsList, setToppingsList] = useState<{ name: string; price: number }[]>(() => {
    if (!initial?.variantSettings) return [];
    try {
      const parsed = JSON.parse(initial.variantSettings);
      if (parsed.isBundle) return [];
      return parsed.toppings || [];
    } catch (e) {
      return [];
    }
  });

  const [hasSizes, setHasSizes] = useState(() => {
    if (businessType !== "fashion") return true;
    if (!initial?.variantSettings) return false;
    try {
      const parsed = JSON.parse(initial.variantSettings);
      if (parsed.isBundle) return false;
      return Array.isArray(parsed.variants) && parsed.variants.length > 0;
    } catch (e) {
      return false;
    }
  });

  const addPresetSize = (sizeName: string) => {
    setVariantsList(prev => {
      if (prev.some(v => v.name.toLowerCase() === sizeName.toLowerCase())) return prev;
      return [...prev, { name: sizeName, price: 0 }];
    });
  };

  // Bundle package states
  let initialIsBundle = false;
  let initialBundleProducts: any[] = [];
  let initialBundleBannerImageUrl = "";
  if (initial?.variantSettings) {
    try {
      const parsed = JSON.parse(initial.variantSettings);
      if (parsed.isBundle) {
        initialIsBundle = true;
        initialBundleProducts = parsed.bundleProducts || [];
        initialBundleBannerImageUrl = parsed.bannerImageUrl || "";
      }
    } catch (e) {}
  }

  const [isBundle, setIsBundle] = useState(initialIsBundle);
  const [bundleProducts, setBundleProducts] = useState<{ id: number; name: string; qty: number }[]>(initialBundleProducts);
  const [bundleBannerImageUrl, setBundleBannerImageUrl] = useState(initialBundleBannerImageUrl);
  const [selectedAddProdId, setSelectedAddProdId] = useState("");
  const [selectedAddProdQty, setSelectedAddProdQty] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState("");

  const selectableProducts = products.filter((p: any) => {
    if (p.id === initial?.id) return false;
    // Exclude other bundles to prevent bundle nesting
    if (p.variantSettings) {
      try {
        const parsed = JSON.parse(p.variantSettings);
        if (parsed.isBundle) return false;
      } catch (e) {}
    }
    return true;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File harus berupa gambar");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran gambar maksimal 5MB");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const token = localStorage.getItem("flow_token");
          const res = await fetch("/api/products/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              name: file.name,
              base64,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Gagal mengunggah gambar");
          }

          const data = await res.json();
          setForm(p => ({ ...p, imageUrl: data.imageUrl }));
        } catch (err: any) {
          setUploadError(err.message || "Gagal mengunggah gambar");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError("Gagal membaca file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError("Terjadi kesalahan saat memproses gambar");
      setUploading(false);
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBannerUploadError("File harus berupa gambar");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError("Ukuran gambar maksimal 5MB");
      return;
    }

    setBannerUploading(true);
    setBannerUploadError("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const token = localStorage.getItem("flow_token");
          const res = await fetch("/api/products/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token || ""}`,
            },
            body: JSON.stringify({
              name: file.name,
              base64,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Gagal mengunggah gambar");
          }

          const data = await res.json();
          setBundleBannerImageUrl(data.imageUrl);
        } catch (err: any) {
          setBannerUploadError(err.message || "Gagal mengunggah gambar");
        } finally {
          setBannerUploading(false);
        }
      };
      reader.onerror = () => {
        setBannerUploadError("Gagal membaca file");
        setBannerUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setBannerUploadError("Terjadi kesalahan saat memproses gambar");
      setBannerUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground text-lg">{initial ? "Edit Produk" : "Tambah Produk"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Nama Produk *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            {businessType === "fashion" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">SKU</label>
                  <input
                    type="text"
                    placeholder="Contoh: HCP-001"
                    value={form.sku}
                    onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Barcode</span>
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.floor(10000000 + Math.random() * 90000000).toString();
                        setForm(p => ({ ...p, barcode: `FS${rand}` }));
                      }}
                      className="text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-colors uppercase"
                    >
                      ⚡ Generate
                    </button>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: FS82736182"
                    value={form.barcode}
                    onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  />
                </div>
                {form.barcode && (
                  <div className="col-span-2 flex flex-col items-center p-4 bg-muted/20 border border-border/60 rounded-2xl gap-3 animate-fade-in">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground self-start">Visualisasi Barcode</span>
                    <Barcode128 value={form.barcode} />
                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (!printWindow) return;
                        const svgHtml = document.getElementById(`barcode-svg-${form.barcode}`)?.outerHTML || "";
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Cetak Barcode - ${form.barcode}</title>
                              <style>
                                body {
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  height: 100vh;
                                  margin: 0;
                                  font-family: monospace;
                                }
                                .print-box {
                                  text-align: center;
                                  padding: 20px;
                                  border: 1px solid #ccc;
                                  border-radius: 8px;
                                  background: white;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="print-box">
                                ${svgHtml}
                                <div style="margin-top: 8px; font-size: 14px; font-weight: bold; letter-spacing: 2px;">${form.barcode}</div>
                                <div style="font-size: 11px; margin-top: 2px;">${form.name || ""}</div>
                              </div>
                              <script>
                                window.onload = function() {
                                  window.print();
                                  setTimeout(function() { window.close(); }, 500);
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }}
                      className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow"
                    >
                      🖨️ Cetak Barcode
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Deskripsi</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Harga Jual *</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Harga Beli</label>
              <input
                type="number"
                value={form.costPrice}
                onChange={e => setForm(p => ({ ...p, costPrice: e.target.value === "" ? "" : Number(e.target.value) }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Stok *</label>
              <input
                type="number"
                value={form.stock}
                onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Stok Minimum</label>
              <input
                type="number"
                value={form.minStock}
                onChange={e => setForm(p => ({ ...p, minStock: Number(e.target.value) }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gambar Produk</label>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {form.imageUrl ? (
                <div className="relative group w-full h-40 rounded-2xl overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
                  <img
                    src={form.imageUrl}
                    alt="Preview produk"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-amber-400 text-black text-xs font-bold rounded-lg hover:bg-amber-500 transition-colors shadow"
                    >
                      Ubah Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, imageUrl: "" }))}
                      className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-input rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer hover:border-amber-400 hover:bg-amber-400/5 transition-all group"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-muted-foreground font-semibold">Mengunggah gambar...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                        <UploadCloud size={20} />
                      </div>
                      <span className="text-xs font-bold text-foreground text-center">Pilih gambar dari galeri HP atau PC</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">Maks. 5MB, format gambar (JPG, PNG, WEBP)</span>
                    </>
                  )}
                </div>
              )}

              {uploadError && (
                <p className="text-[11px] text-red-500 font-semibold">{uploadError}</p>
              )}

              <div className="pt-1.5">
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">Atau masukkan URL Gambar secara manual</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={form.imageUrl}
                  onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Kategori</label>
              <select
                value={form.categoryId}
                onChange={e => setForm(p => ({ ...p, categoryId: Number(e.target.value) || "" }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              >
                <option value="">Tanpa Kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Bundling Toggle */}
            <div className="col-span-2 pt-2">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isBundle}
                  onChange={e => {
                    setIsBundle(e.target.checked);
                    if (e.target.checked) {
                      setVariantsList([]);
                      setToppingsList([]);
                    }
                  }}
                />
                <div className="w-8 h-4 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-4"></div>
                <span className="ml-2 text-xs font-semibold text-muted-foreground select-none">Paket Promo / Bundling (Include &gt; 2 Produk)</span>
              </label>
            </div>

            {/* Bundled products editor */}
            {isBundle && (
              <div className="col-span-2 space-y-3 p-4 bg-muted/20 border border-border rounded-2xl animate-fade-in">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1.5 border-border">Daftar Produk dalam Paket</span>
                
                {bundleProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada produk ditambahkan ke dalam paket promo ini.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {bundleProducts.map((bp, index) => (
                      <div key={index} className="flex items-center justify-between bg-background border border-border p-2.5 rounded-xl text-xs">
                        <span className="font-semibold text-foreground">{bp.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={bp.qty}
                            onChange={e => {
                              const updated = [...bundleProducts];
                              updated[index].qty = Math.max(1, Number(e.target.value) || 1);
                              setBundleProducts(updated);
                            }}
                            className="w-16 px-2 py-1 border border-input bg-card text-center rounded-lg focus:outline-none text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setBundleProducts(prev => prev.filter((_, idx) => idx !== index))}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 pt-2 border-t border-border/60">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Pilih Produk</label>
                    <select
                      value={selectedAddProdId}
                      onChange={e => setSelectedAddProdId(e.target.value)}
                      className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
                    >
                      <option value="">Pilih produk...</option>
                      {selectableProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({formatRp(Number(p.price))})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Jumlah</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedAddProdQty}
                      onChange={e => setSelectedAddProdQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs text-center focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedAddProdId) return;
                      const matched = selectableProducts.find((p: any) => p.id === Number(selectedAddProdId));
                      if (!matched) return;
                      
                      const existingIdx = bundleProducts.findIndex(bp => bp.id === matched.id);
                      if (existingIdx !== -1) {
                        const updated = [...bundleProducts];
                        updated[existingIdx].qty += selectedAddProdQty;
                        setBundleProducts(updated);
                      } else {
                        setBundleProducts(prev => [...prev, { id: matched.id, name: matched.name, qty: selectedAddProdQty }]);
                      }
                      setSelectedAddProdId("");
                      setSelectedAddProdQty(1);
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold rounded-xl transition-colors shadow"
                  >
                    Tambah
                  </button>
                </div>

                {/* Promo Banner Image Upload */}
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Gambar Banner Promo (Opsional)</span>
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    onChange={handleBannerFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {bundleBannerImageUrl ? (
                    <div className="relative w-full h-24 rounded-xl overflow-hidden border border-border bg-muted">
                      <img
                        src={bundleBannerImageUrl}
                        alt="Promo Banner"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => bannerFileInputRef.current?.click()}
                          className="px-2 py-1 bg-amber-400 text-black text-[10px] font-bold rounded hover:bg-amber-500 transition-colors shadow"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => setBundleBannerImageUrl("")}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors shadow"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="w-full h-20 border border-dashed border-input rounded-xl flex flex-col items-center justify-center p-3 cursor-pointer hover:border-amber-400 hover:bg-amber-400/5 transition-all group"
                    >
                      {bannerUploading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-muted-foreground font-semibold">Mengunggah...</span>
                        </div>
                      ) : (
                        <>
                          <UploadCloud size={16} className="text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-foreground">Pilih gambar banner</span>
                        </>
                      )}
                    </div>
                  )}
                  {bannerUploadError && (
                    <p className="text-[10px] text-red-500 font-semibold">{bannerUploadError}</p>
                  )}
                  <input
                    type="url"
                    placeholder="Atau URL Gambar Banner (contoh: https://...)"
                    value={bundleBannerImageUrl}
                    onChange={e => setBundleBannerImageUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            )}

            {/* Varian Section */}
            {!isBundle && (
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilihan Ukuran / Varian</span>
                  <button
                    type="button"
                    onClick={() => setVariantsList(prev => [...prev, { name: "", price: 0 }])}
                    className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    + Tambah Varian
                  </button>
                </div>
                
                {variantsList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada varian ditambahkan.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {variantsList.map((variant, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nama Varian (misal: Large)"
                          value={variant.name}
                          onChange={e => {
                            const updated = [...variantsList];
                            updated[index].name = e.target.value;
                            setVariantsList(updated);
                          }}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <input
                          type="number"
                          placeholder="Tambahan Harga (Rp)"
                          value={variant.price || ""}
                          onChange={e => {
                            const updated = [...variantsList];
                            updated[index].price = Number(e.target.value) || 0;
                            setVariantsList(updated);
                          }}
                          className="w-32 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => setVariantsList(prev => prev.filter((_, idx) => idx !== index))}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Varian Section */}
            {!isBundle && (
              <div className="col-span-2 space-y-2">
                {businessType === "fashion" ? (
                  <div className="flex items-center justify-between border-b pb-1.5 border-border">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={hasSizes}
                        onChange={e => setHasSizes(e.target.checked)}
                      />
                      <div className="w-8 h-4 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-4"></div>
                      <span className="ml-2 text-xs font-bold text-muted-foreground select-none uppercase">Gunakan Pilihan Ukuran</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-b pb-1.5 border-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilihan Ukuran / Varian</span>
                    <button
                      type="button"
                      onClick={() => setVariantsList(prev => [...prev, { name: "", price: 0 }])}
                      className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors"
                    >
                      + Tambah Varian
                    </button>
                  </div>
                )}

                {/* Preset sizes for Fashion Store */}
                {businessType === "fashion" && hasSizes && (
                  <div className="space-y-1.5 bg-muted/10 p-3 rounded-xl border border-border/40">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Rekomendasi Ukuran (Klik untuk menambah)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {["S", "M", "L", "XL", "XXL"].map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => addPresetSize(sz)}
                          className="px-2.5 py-1 bg-background hover:bg-amber-400 hover:text-black border border-border rounded-lg text-xs font-bold transition-all text-foreground"
                        >
                          {sz}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => ["S", "M", "L", "XL", "XXL"].forEach(addPresetSize)}
                        className="px-2.5 py-1 bg-amber-400/10 text-amber-500 hover:bg-amber-400 hover:text-black border border-amber-400/20 rounded-lg text-xs font-bold transition-all"
                      >
                        Semua Ukuran
                      </button>
                    </div>
                  </div>
                )}
                
                {hasSizes && (
                  <>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daftar Ukuran / Varian Produk</span>
                      {businessType === "fashion" && (
                        <button
                          type="button"
                          onClick={() => setVariantsList(prev => [...prev, { name: "", price: 0 }])}
                          className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors"
                        >
                          + Tambah Ukuran Custom
                        </button>
                      )}
                    </div>
                    {variantsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Belum ada varian ditambahkan.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {variantsList.map((variant, index) => (
                          <div key={index} className="flex items-center gap-2 animate-fade-in">
                            <input
                              type="text"
                              placeholder={businessType === "fashion" ? "Nama Ukuran (misal: S, M, XL, dll)" : "Nama Varian (misal: Large)"}
                              value={variant.name}
                              onChange={e => {
                                const updated = [...variantsList];
                                updated[index].name = e.target.value;
                                setVariantsList(updated);
                              }}
                              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                            />
                            <input
                              type="number"
                              placeholder="Tambahan Harga (Rp)"
                              value={variant.price || ""}
                              onChange={e => {
                                const updated = [...variantsList];
                                updated[index].price = Number(e.target.value) || 0;
                                setVariantsList(updated);
                              }}
                              className="w-32 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => setVariantsList(prev => prev.filter((_, idx) => idx !== index))}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Topping Section */}
            {!isBundle && businessType !== "fashion" && (
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topping / Tambahan</span>
                  <button
                    type="button"
                    onClick={() => setToppingsList(prev => [...prev, { name: "", price: 0 }])}
                    className="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    + Tambah Topping
                  </button>
                </div>

                {toppingsList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada topping ditambahkan.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {toppingsList.map((topping, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nama Topping (misal: Boba)"
                          value={topping.name}
                          onChange={e => {
                            const updated = [...toppingsList];
                            updated[index].name = e.target.value;
                            setToppingsList(updated);
                          }}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <input
                          type="number"
                          placeholder="Harga Topping (Rp)"
                          value={topping.price || ""}
                          onChange={e => {
                            const updated = [...toppingsList];
                            updated[index].price = Number(e.target.value) || 0;
                            setToppingsList(updated);
                          }}
                          className="w-32 px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => setToppingsList(prev => prev.filter((_, idx) => idx !== index))}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="col-span-2 pt-2">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.isBestSeller}
                  onChange={e => setForm(p => ({ ...p, isBestSeller: e.target.checked }))}
                />
                <div className="w-8 h-4 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-4"></div>
                <span className="ml-2 text-xs font-semibold text-muted-foreground select-none">Tandai sebagai Best Seller</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Batal</button>
          <button onClick={() => {
            let variantSettingsStr = null;
            if (isBundle) {
              const cleanBundle = bundleProducts
                .map(bp => ({ id: Number(bp.id), name: bp.name, qty: Number(bp.qty) }))
                .filter(bp => bp.id > 0 && bp.qty > 0);
              variantSettingsStr = JSON.stringify({
                isBundle: true,
                bundleProducts: cleanBundle,
                bannerImageUrl: bundleBannerImageUrl || undefined
              });
            } else {
              const cleanVariants = (businessType === "fashion" && !hasSizes)
                ? []
                : variantsList
                    .map(v => ({ name: v.name.trim(), price: Number(v.price) }))
                    .filter(v => v.name !== "");

              const cleanToppings = businessType === "fashion"
                ? []
                : toppingsList
                    .map(t => ({ name: t.name.trim(), price: Number(t.price) }))
                    .filter(t => t.name !== "");

              if (cleanVariants.length > 0 || cleanToppings.length > 0) {
                variantSettingsStr = JSON.stringify({
                  variants: cleanVariants,
                  toppings: cleanToppings
                });
              }
            }

            onSubmit({
              ...form,
              variantSettings: variantSettingsStr
            });
          }} disabled={loading || !form.name || form.price === ""}
            className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryForm({ initial, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({ name: initial?.name || "", description: initial?.description || "" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground text-lg">{initial ? "Edit Kategori" : "Tambah Kategori"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Nama Kategori *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name}
            className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editCat, setEditCat] = useState<any>(null);
  const qc = useQueryClient();

  const { data: tenant } = useGetTenant();
  const isFashion = tenant?.businessType === "fashion";

  const { data: productsData, isLoading } = useListProducts({ search: search || undefined, limit: 50 });
  const { data: categories, isLoading: isCatLoading } = useListCategories();
  const products = productsData?.data || [];

  useEffect(() => {
    if (!isFashion) return;

    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = "";
      }

      if (e.key !== "Enter") {
        if (e.key.length === 1) {
          barcodeBuffer += e.key;
        }
      } else {
        if (barcodeBuffer.length >= 3) {
          if (!isInput || (currentTime - lastKeyTime < 50)) {
            e.preventDefault();
            e.stopPropagation();
            const scannedCode = barcodeBuffer.trim();
            barcodeBuffer = "";

            const matched = products.find(p => p.barcode === scannedCode || p.sku === scannedCode);
            if (matched) {
              setEditProduct(matched);
            } else {
              alert(`Produk dengan barcode atau SKU "${scannedCode}" tidak ditemukan.`);
            }
          }
        }
        barcodeBuffer = "";
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [products, isFashion]);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const invalidateProducts = () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
  const invalidateCategories = () => qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const handleCreateProduct = (form: any) => {
    createProduct.mutate({
      data: {
        ...form,
        price: Number(form.price),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        categoryId: form.categoryId || undefined,
      }
    }, {
      onSuccess: () => { setShowForm(false); invalidateProducts(); }
    });
  };

  const handleUpdateProduct = (form: any) => {
    updateProduct.mutate({
      id: editProduct.id,
      data: {
        ...form,
        price: Number(form.price),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        categoryId: form.categoryId || undefined,
      }
    }, {
      onSuccess: () => { setEditProduct(null); invalidateProducts(); }
    });
  };

  const handleDeleteProduct = (id: number) => {
    if (!confirm("Hapus produk ini?")) return;
    deleteProduct.mutate({ id }, { onSuccess: invalidateProducts });
  };

  const handleToggleActive = (id: number, checked: boolean) => {
    updateProduct.mutate({ id, data: { isActive: checked } }, { onSuccess: invalidateProducts });
  };

  const handleToggleBestSeller = (id: number, checked: boolean) => {
    updateProduct.mutate({ id, data: { isBestSeller: checked } }, { onSuccess: invalidateProducts });
  };

  const handleCreateCategory = (form: any) => {
    createCategory.mutate({ data: form }, {
      onSuccess: () => { setShowCatForm(false); invalidateCategories(); }
    });
  };

  const handleUpdateCategory = (form: any) => {
    updateCategory.mutate({ id: editCat.id, data: form }, {
      onSuccess: () => { setEditCat(null); invalidateCategories(); }
    });
  };

  const handleDeleteCategory = (id: number) => {
    if (!confirm("Hapus kategori ini?")) return;
    deleteCategory.mutate({ id }, { onSuccess: invalidateCategories });
  };

  const filteredCategories = (categories || []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isFashion ? "Katalog Produk" : "Menu Management"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isFashion ? "Kelola kategori dan katalog produk Anda" : "Manage your categories and menu items"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border/80 bg-card hover:bg-muted text-foreground rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <Plus size={16} /> Kategori
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-black rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            <Plus size={16} /> {isFashion ? "Tambah Produk" : "Add Item"}
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab("items"); setSearch(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "items"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isFashion ? "Daftar Produk" : "Menu Items"}
        </button>
        <button
          onClick={() => { setActiveTab("categories"); setSearch(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "categories"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isFashion ? "Kategori" : "Categories"}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid="input-product-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={isFashion ? "Cari produk atau scan barcode..." : "Search items..."}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
        />
      </div>

      {/* Content Area */}
      {activeTab === "items" ? (
        isLoading ? (
          <div className="p-12 text-center text-muted-foreground font-medium">Memuat produk...</div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 bg-card rounded-2xl border border-border/40">
            <Package size={48} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
            <div className="font-semibold text-lg">Belum ada produk</div>
            <p className="text-sm text-muted-foreground mt-1">Mulai dengan menambahkan produk baru</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map(p => (
              <div
                key={p.id}
                className="bg-card border border-card-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-400/20 transition-all duration-200 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Product Image */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border/40">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Package size={36} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground text-base truncate leading-snug" title={p.name}>
                        {p.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[11px] font-medium leading-none">
                        {p.categoryName || "FreshDrink"}
                      </span>
                      {(() => {
                        if (p.variantSettings) {
                          try {
                            const parsed = JSON.parse(p.variantSettings);
                            if (parsed.isBundle) {
                              return (
                                <span className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] font-bold flex items-center gap-0.5 leading-none shadow-sm">
                                  🎁 Paket Promo
                                </span>
                              );
                            }
                          } catch (e) {}
                        }
                        return null;
                      })()}
                      {p.isBestSeller && (
                        <span className="px-1.5 py-0.5 bg-amber-400 text-black rounded text-[10px] font-bold flex items-center gap-0.5 leading-none shadow-sm">
                          <Star size={10} fill="currentColor" /> Best
                        </span>
                      )}
                    </div>

                    {/* Bundle item list summary */}
                    {(() => {
                      if (p.variantSettings) {
                        try {
                          const parsed = JSON.parse(p.variantSettings);
                          if (parsed.isBundle && parsed.bundleProducts && parsed.bundleProducts.length > 0) {
                            return (
                              <div className="text-[11px] text-muted-foreground font-medium bg-muted/30 px-2.5 py-1.5 rounded-xl border border-border/40 mt-1 max-w-full">
                                <span className="font-bold text-foreground">Isi:</span> {parsed.bundleProducts.map((bp: any) => `${bp.qty}x ${bp.name}`).join(", ")}
                              </div>
                            );
                          }
                        } catch (e) {}
                      }
                      return null;
                    })()}

                    {/* Toggles */}
                    <div className="space-y-2 pt-1.5">
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={p.isActive !== false}
                            onChange={(e) => handleToggleActive(p.id, e.target.checked)}
                          />
                          <div className="w-8 h-4.5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2.5px] after:left-[2.5px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-3.5"></div>
                          <span className="ml-2 text-xs font-semibold text-muted-foreground select-none">Available</span>
                        </label>
                      </div>
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!p.isBestSeller}
                            onChange={(e) => handleToggleBestSeller(p.id, e.target.checked)}
                          />
                          <div className="w-8 h-4.5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2.5px] after:left-[2.5px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:after:translate-x-3.5"></div>
                          <span className="ml-2 text-xs font-semibold text-muted-foreground select-none">Best Seller</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Price and Edit/Delete */}
                <div className="flex flex-col items-end justify-between self-stretch py-0.5 flex-shrink-0">
                  <div className="font-bold text-foreground text-lg">{formatRp(Number(p.price))}</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditProduct(p)}
                      className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-amber-500 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : isCatLoading ? (
        <div className="p-12 text-center text-muted-foreground font-medium">Memuat kategori...</div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 bg-card rounded-2xl border border-border/40">
          <Tag size={48} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
          <div className="font-semibold text-lg">Belum ada kategori</div>
          <p className="text-sm text-muted-foreground mt-1">Mulai dengan menambahkan kategori baru</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map(c => (
            <div
              key={c.id}
              className="bg-card border border-card-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
                  <Tag size={18} className="text-amber-500" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditCat(c)}
                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-amber-500 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="font-bold text-foreground text-base">{c.name}</div>
              {c.description && (
                <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {c.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ProductForm
          products={products}
          categories={categories || []}
          onSubmit={handleCreateProduct}
          onClose={() => setShowForm(false)}
          loading={createProduct.isPending}
          businessType={tenant?.businessType}
        />
      )}
      {editProduct && (
        <ProductForm
          initial={editProduct}
          products={products}
          categories={categories || []}
          onSubmit={handleUpdateProduct}
          onClose={() => setEditProduct(null)}
          loading={updateProduct.isPending}
          businessType={tenant?.businessType}
        />
      )}
      {showCatForm && (
        <CategoryForm
          onSubmit={handleCreateCategory}
          onClose={() => setShowCatForm(false)}
          loading={createCategory.isPending}
        />
      )}
      {editCat && (
        <CategoryForm
          initial={editCat}
          onSubmit={handleUpdateCategory}
          onClose={() => setEditCat(null)}
          loading={updateCategory.isPending}
        />
      )}
    </div>
  );
}
