import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  ShoppingCart, Plus, Minus, Trash2, X, ChevronRight, MapPin,
  Phone, User, FileText, CheckCircle2, Clock, ChefHat,
  Package, Truck, Star, Search, ArrowLeft, QrCode
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TenantInfo {
  id: number; name: string; slug: string; businessType: string;
  address: string | null; phone: string | null; logoUrl: string | null;
  primaryColor: string; bannerUrl: string | null;
  enableDineIn: boolean; enableTakeAway: boolean; enableDelivery: boolean;
  enableCash: boolean; enableQris: boolean; enableBankTransfer: boolean; enableEwallet: boolean;
}
interface Product { id: number; name: string; description: string | null; price: number; imageUrl: string | null; categoryId: number | null; stock: number; }
interface Category { id: number; name: string; description: string | null; }
interface CartItem { product: Product; quantity: number; notes: string; }

const STATUS_STEPS: Record<string, { label: string; icon: any; step: number }> = {
  pending:     { label: "Menunggu Konfirmasi", icon: Clock, step: 1 },
  confirmed:   { label: "Pesanan Dikonfirmasi", icon: CheckCircle2, step: 2 },
  preparing:   { label: "Sedang Diproses", icon: ChefHat, step: 3 },
  ready:       { label: "Siap Diambil", icon: Package, step: 4 },
  on_delivery: { label: "Dalam Pengiriman", icon: Truck, step: 5 },
  completed:   { label: "Selesai", icon: Star, step: 6 },
  cancelled:   { label: "Dibatalkan", icon: X, step: 0 },
};

const PAY_LABELS: Record<string, string> = {
  cash: "Tunai / Cash on Delivery", qris: "QRIS", bank_transfer: "Transfer Bank", ewallet: "E-Wallet",
};
const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Makan di Tempat", take_away: "Bawa Pulang", delivery: "Antar ke Alamat",
};

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

function TrackingView({ orderId, slug, primary, onBack }: { orderId: number; slug: string; primary: string; onBack: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/menu/${slug}/orders/${orderId}`);
      if (r.ok) setOrder(await r.json());
      else setError("Pesanan tidak ditemukan");
    } catch { setError("Gagal memuat pesanan"); }
  }, [slug, orderId]);

  useEffect(() => {
    fetchOrder();
    const iv = setInterval(fetchOrder, 5000);
    return () => clearInterval(iv);
  }, [fetchOrder]);

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <div className="text-gray-600 mb-4">{error}</div>
        <button onClick={onBack} className="text-sm font-medium" style={{ color: primary }}>← Kembali ke Menu</button>
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primary }} />
    </div>
  );

  const curr = STATUS_STEPS[order.status];
  const steps = ["confirmed", "preparing", "ready", order.orderType === "delivery" ? "on_delivery" : null, "completed"].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="p-1 text-gray-500"><ArrowLeft size={20} /></button>
        <div>
          <div className="font-bold text-sm text-gray-900">Status Pesanan</div>
          <div className="text-xs font-mono text-gray-400">{order.orderNumber}</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Status banner */}
        <div className="rounded-2xl p-5 text-white text-center shadow-lg" style={{ background: order.status === "cancelled" ? "#ef4444" : primary }}>
          {curr && <curr.icon className="mx-auto mb-2" size={36} />}
          <div className="text-xl font-bold">{curr?.label ?? order.status}</div>
          <div className="text-sm opacity-80 mt-1">{ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}</div>
        </div>

        {/* Progress */}
        {order.status !== "cancelled" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between">
              {steps.map((s, i) => {
                const step = STATUS_STEPS[s];
                const done = (curr?.step ?? 0) >= (step?.step ?? 0);
                return (
                  <div key={s} className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? "text-white" : "bg-gray-100 text-gray-300"}`}
                      style={done ? { backgroundColor: primary } : {}}>
                      {i + 1}
                    </div>
                    <div className={`text-[9px] text-center leading-tight ${done ? "text-gray-700 font-medium" : "text-gray-300"}`}>
                      {step?.label.split(" ")[0]}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="absolute" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order detail */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="font-semibold text-gray-900 text-sm">Detail Pesanan</div>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between"><span>Pelanggan</span><span className="font-medium text-gray-700">{order.customerName}</span></div>
            {order.tableNumber && <div className="flex justify-between"><span>Meja</span><span className="font-medium text-gray-700">#{order.tableNumber}</span></div>}
            {order.customerPhone && <div className="flex justify-between"><span>Telepon</span><span className="font-medium text-gray-700">{order.customerPhone}</span></div>}
            {order.deliveryAddress && <div className="flex justify-between"><span>Alamat</span><span className="font-medium text-gray-700 text-right max-w-[60%]">{order.deliveryAddress}</span></div>}
            <div className="flex justify-between"><span>Pembayaran</span><span className="font-medium text-gray-700">{PAY_LABELS[order.paymentMethod] ?? order.paymentMethod}</span></div>
          </div>
          <div className="border-t pt-3 space-y-2">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
                <span className="font-semibold text-gray-900">{formatRp(item.subtotal)}</span>
              </div>
            ))}
            {Number(order.deliveryFee) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ongkir</span>
                <span className="text-gray-700">{formatRp(Number(order.deliveryFee))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t">
              <span>Total</span>
              <span style={{ color: primary }}>{formatRp(Number(order.total))}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400">
          Status diperbarui otomatis setiap 5 detik
        </div>
      </div>
    </div>
  );
}

interface CustomerMenuProps { slug?: string; }
export default function CustomerMenuPage({ slug: slugProp }: CustomerMenuProps = {}) {
  const params = useParams<{ slug: string }>();
  const slug = slugProp ?? params.slug;
  const [menuData, setMenuData] = useState<{ tenant: TenantInfo; categories: Category[]; products: Product[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "order-type" | "form" | "success">("menu");
  const [trackingId, setTrackingId] = useState<number | null>(null);

  const [orderType, setOrderType] = useState("dine_in");
  const [form, setForm] = useState({ customerName: "", customerPhone: "", tableNumber: "", deliveryAddress: "", deliveryNotes: "" });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BASE}/api/menu/${slug}`);
        if (!r.ok) { setError("Menu tidak ditemukan atau tidak aktif"); setLoading(false); return; }
        const data = await r.json();
        setMenuData(data);
        if (data.tenant.primaryColor) {
          document.documentElement.style.setProperty("--menu-primary", data.tenant.primaryColor);
        }
      } catch { setError("Gagal memuat menu"); }
      setLoading(false);
    })();
  }, [slug]);

  const primary = menuData?.tenant.primaryColor ?? "#1D4EF5";

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.product.id === product.id);
      if (ex) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  };

  const removeFromCart = (productId: number) => setCart(prev => prev.filter(c => c.product.id !== productId));
  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
  };
  const updateItemNotes = (productId: number, notes: string) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, notes } : c));
  };

  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const filteredProducts = menuData?.products.filter(p => {
    const matchCat = !activeCat || p.categoryId === activeCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }) ?? [];

  const availablePayments = (() => {
    if (!menuData) return [];
    const t = menuData.tenant;
    const opts: { value: string; label: string }[] = [];
    if (t.enableCash) opts.push({ value: "cash", label: "Tunai / Cash" });
    if (t.enableQris) opts.push({ value: "qris", label: "QRIS" });
    if (t.enableBankTransfer) opts.push({ value: "bank_transfer", label: "Transfer Bank" });
    if (t.enableEwallet) opts.push({ value: "ewallet", label: "E-Wallet" });
    return opts;
  })();

  const handleSubmitOrder = async () => {
    if (!form.customerName.trim()) { setSubmitError("Nama pelanggan wajib diisi"); return; }
    if (orderType === "dine_in" && !form.tableNumber.trim()) { setSubmitError("Nomor meja wajib diisi"); return; }
    if (orderType === "delivery" && !form.deliveryAddress.trim()) { setSubmitError("Alamat pengiriman wajib diisi"); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const r = await fetch(`${BASE}/api/menu/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim() || null,
          tableNumber: form.tableNumber.trim() || null,
          deliveryAddress: form.deliveryAddress.trim() || null,
          deliveryNotes: form.deliveryNotes.trim() || null,
          paymentMethod,
          notes: orderNotes.trim() || null,
          items: cart.map(c => ({ productId: c.product.id, quantity: c.quantity, price: c.product.price, notes: c.notes || null })),
        }),
      });
      if (!r.ok) { const e = await r.json(); setSubmitError(e.error ?? "Gagal memesan"); setSubmitting(false); return; }
      const order = await r.json();
      setTrackingId(order.id);
      setCart([]);
      setStep("success");
    } catch { setSubmitError("Terjadi kesalahan, coba lagi"); }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#1D4EF5", borderTopColor: "transparent" }} />
        <div className="text-sm text-gray-500">Memuat menu...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <div className="text-xl font-bold text-gray-700 mb-2">Menu Tidak Ditemukan</div>
        <div className="text-gray-400 text-sm">{error}</div>
      </div>
    </div>
  );

  if (!menuData) return null;
  const { tenant, categories } = menuData;

  if (step === "success" && trackingId) {
    return <TrackingView orderId={trackingId} slug={slug!} primary={primary} onBack={() => { setStep("menu"); setTrackingId(null); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {/* Brand */}
        <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ background: primary }}>
          {tenant.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-full object-cover" />
            : <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">{tenant.name[0]}</div>
          }
          <div>
            <div className="text-white font-bold text-sm leading-none">{tenant.name}</div>
            {tenant.address && <div className="text-white/70 text-xs mt-0.5 flex items-center gap-1"><MapPin size={10} />{tenant.address}</div>}
          </div>
        </div>
        {/* Search */}
        <div className="px-4 py-2 bg-white">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari menu..."
              className="w-full pl-8 pr-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700 focus:outline-none"
            />
          </div>
        </div>
        {/* Category tabs */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-white border-t">
          <button
            onClick={() => setActiveCat(null)}
            className={`flex-none px-3 py-1 rounded-full text-xs font-medium transition-colors ${!activeCat ? "text-white" : "bg-gray-100 text-gray-600"}`}
            style={!activeCat ? { backgroundColor: primary } : {}}
          >Semua</button>
          {categories.map(c => (
            <button key={c.id}
              onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
              className={`flex-none px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCat === c.id ? "text-white" : "bg-gray-100 text-gray-600"}`}
              style={activeCat === c.id ? { backgroundColor: primary } : {}}
            >{c.name}</button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="p-4 pb-32">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">🍽️</div>
            <div className="text-sm">Tidak ada menu</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(p => {
              const inCart = cart.find(c => c.product.id === p.id);
              return (
                <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      : <span className="text-3xl">🍽️</span>
                    }
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: primary }}>
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-gray-900 text-sm leading-tight mb-0.5 line-clamp-2">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400 mb-2 line-clamp-1">{p.description}</div>}
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm" style={{ color: primary }}>{formatRp(p.price)}</div>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(p.id, inCart.quantity - 1)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{inCart.quantity}</span>
                          <button onClick={() => addToCart(p)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: primary }}>
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow" style={{ backgroundColor: primary }}>
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart fab */}
      {cartCount > 0 && step === "menu" && (
        <div className="fixed bottom-6 left-4 right-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white shadow-xl"
            style={{ backgroundColor: primary }}
          >
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-bold">{cartCount}</div>
              <span className="font-semibold text-sm">Lihat Pesanan</span>
            </div>
            <span className="font-bold text-sm">{formatRp(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="font-bold text-gray-900">Pesanan Saya ({cartCount} item)</div>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 p-1"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3">
              {cart.map(c => (
                <div key={c.product.id} className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.product.imageUrl ? <img src={c.product.imageUrl} className="w-full h-full object-cover" alt={c.product.name} /> : <span className="text-xl">🍽️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{c.product.name}</div>
                    <div className="text-xs text-gray-400">{formatRp(c.product.price)}</div>
                    <input
                      value={c.notes}
                      onChange={e => updateItemNotes(c.product.id, e.target.value)}
                      placeholder="Catatan (opsional)..."
                      className="mt-1 w-full text-xs bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => removeFromCart(c.product.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(c.product.id, c.quantity - 1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primary }}>
                        <Minus size={10} />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{c.quantity}</span>
                      <button onClick={() => updateQty(c.product.id, c.quantity + 1)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primary }}>
                        <Plus size={10} />
                      </button>
                    </div>
                    <div className="text-xs font-bold" style={{ color: primary }}>{formatRp(c.product.price * c.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t space-y-3">
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Total</span><span style={{ color: primary }}>{formatRp(cartTotal)}</span>
              </div>
              <button
                onClick={() => { setCartOpen(false); setStep("order-type"); }}
                className="w-full py-3.5 rounded-2xl text-white font-semibold flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}>
                Lanjut ke Pemesanan <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order type selection */}
      {step === "order-type" && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep("menu")} className="text-gray-500"><ArrowLeft size={20} /></button>
            <div className="font-bold text-gray-900">Pilih Jenis Pesanan</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tenant.enableDineIn && (
              <button
                onClick={() => { setOrderType("dine_in"); setStep("form"); }}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-colors ${orderType === "dine_in" ? "border-2 bg-blue-50" : "border-gray-100 bg-white"}`}
                style={orderType === "dine_in" ? { borderColor: primary } : {}}
              >
                <div className="text-2xl mb-2">🪑</div>
                <div className="font-bold text-gray-900">Makan di Tempat</div>
                <div className="text-sm text-gray-500">Pesan dan makan langsung di restoran</div>
              </button>
            )}
            {tenant.enableTakeAway && (
              <button
                onClick={() => { setOrderType("take_away"); setStep("form"); }}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-colors ${orderType === "take_away" ? "bg-blue-50" : "border-gray-100 bg-white"}`}
                style={orderType === "take_away" ? { borderColor: primary, borderWidth: 2 } : {}}
              >
                <div className="text-2xl mb-2">🛍️</div>
                <div className="font-bold text-gray-900">Bawa Pulang</div>
                <div className="text-sm text-gray-500">Pesan sekarang, ambil langsung di kasir</div>
              </button>
            )}
            {tenant.enableDelivery && (
              <button
                onClick={() => { setOrderType("delivery"); setStep("form"); }}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-colors ${orderType === "delivery" ? "bg-blue-50" : "border-gray-100 bg-white"}`}
                style={orderType === "delivery" ? { borderColor: primary, borderWidth: 2 } : {}}
              >
                <div className="text-2xl mb-2">🛵</div>
                <div className="font-bold text-gray-900">Antar ke Alamat</div>
                <div className="text-sm text-gray-500">Kami antar pesanan ke lokasi Anda</div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Order form */}
      {step === "form" && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
            <button onClick={() => setStep("order-type")} className="text-gray-500"><ArrowLeft size={20} /></button>
            <div>
              <div className="font-bold text-gray-900">Detail Pesanan</div>
              <div className="text-xs text-gray-400">{ORDER_TYPE_LABELS[orderType]}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Items summary */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-semibold text-sm text-gray-700 mb-3">Ringkasan Pesanan</div>
              {cart.map(c => (
                <div key={c.product.id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">{c.product.name} ×{c.quantity}</span>
                  <span className="font-medium text-gray-900">{formatRp(c.product.price * c.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t mt-2">
                <span>Total</span><span style={{ color: primary }}>{formatRp(cartTotal)}</span>
              </div>
            </div>

            {/* Customer info */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="font-semibold text-sm text-gray-700">Informasi Pelanggan</div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><User size={11} /> Nama Lengkap *</label>
                <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="Nama Anda"
                  className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Phone size={11} /> Nomor Telepon {orderType !== "dine_in" ? "*" : "(opsional)"}</label>
                <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                  placeholder="08xxxxxxxxxx" type="tel"
                  className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300" />
              </div>
              {orderType === "dine_in" && (
                <div>
                  <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><QrCode size={11} /> Nomor Meja *</label>
                  <input value={form.tableNumber} onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
                    placeholder="Contoh: 5"
                    className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300" />
                </div>
              )}
              {orderType === "delivery" && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin size={11} /> Alamat Lengkap *</label>
                    <textarea value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))}
                      placeholder="Jl. Contoh No. 1, RT/RW, Kelurahan, Kecamatan, Kota"
                      rows={3}
                      className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Catatan Pengiriman (opsional)</label>
                    <input value={form.deliveryNotes} onChange={e => setForm(f => ({ ...f, deliveryNotes: e.target.value }))}
                      placeholder="Patokan lokasi, instruksi pintu, dll."
                      className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><FileText size={11} /> Catatan Pesanan (opsional)</label>
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Alergi, permintaan khusus, dll."
                  className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-gray-300" />
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-semibold text-sm text-gray-700 mb-3">Metode Pembayaran</div>
              <div className="space-y-2">
                {availablePayments.map(pm => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${paymentMethod === pm.value ? "bg-blue-50" : "border-gray-100 bg-gray-50"}`}
                    style={paymentMethod === pm.value ? { borderColor: primary } : {}}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === pm.value ? "" : "border-gray-300"}`}
                      style={paymentMethod === pm.value ? { borderColor: primary } : {}}>
                      {paymentMethod === pm.value && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primary }} />}
                    </div>
                    <span className={`text-sm font-medium ${paymentMethod === pm.value ? "text-gray-900" : "text-gray-500"}`}>{pm.label}</span>
                  </button>
                ))}
                {availablePayments.length === 0 && <div className="text-sm text-gray-400 text-center py-2">Tidak ada metode pembayaran tersedia</div>}
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{submitError}</div>
            )}
          </div>

          <div className="p-4 bg-white border-t">
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || availablePayments.length === 0}
              className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Pesan Sekarang • {formatRp(cartTotal)}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
