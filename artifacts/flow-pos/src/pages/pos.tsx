import { useState, useEffect } from "react";
import { useListProducts, useListCategories, useCreateOrder, getListOrdersQueryKey, useGetTenant } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, QrCode, X, Check, Package, Sparkles, Gift, Percent } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Tunai", icon: <Banknote size={18} /> },
  { value: "qris", label: "QRIS", icon: <QrCode size={18} /> },
  { value: "bank_transfer", label: "Transfer", icon: <CreditCard size={18} /> },
  { value: "ewallet", label: "E-Wallet", icon: <Smartphone size={18} /> },
];

const DEFAULT_VARIANTS = [
  { name: "Regular", price: 0 },
  { name: "Large", price: 0 }
];

const DEFAULT_TOPPINGS = [
  { name: "Ekstra Sambal", price: 2000 },
  { name: "Telur Mata Sapi", price: 2000 },
  { name: "Keju Parut", price: 2000 },
  { name: "Kerupuk Bawang", price: 2000 }
];

function formatRp(val: number) {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);

  const [promoBanners, setPromoBanners] = useState<any[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<any[]>([]);
  const [selectedCouponCode, setSelectedCouponCode] = useState("");

  // Load promo banners and coupons on mount
  useEffect(() => {
    try {
      const banners = localStorage.getItem("flow_marketing_banners");
      if (banners) {
        setPromoBanners(JSON.parse(banners));
      }
    } catch (e) {}

    try {
      const storedCoupons = localStorage.getItem("flow_coupons");
      if (storedCoupons) {
        const parsed = JSON.parse(storedCoupons);
        setActiveCoupons(parsed.filter((c: any) => c.status === "Aktif"));
      }
    } catch (e) {}
  }, []);

  interface CartItem {
    id: string;
    productId: number;
    name: string;
    price: number;
    basePrice: number;
    quantity: number;
    notes?: string;
    selectedVariant?: string;
    selectedToppings?: string[];
  }

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPct, setTaxPct] = useState(11);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const { data: tenant } = useGetTenant();

  // Modal selection states
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [modalVariant, setModalVariant] = useState("");
  const [modalToppings, setModalToppings] = useState<string[]>([]);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState("");
  const [modalVariantsList, setModalVariantsList] = useState<{ name: string; price: number }[]>([]);
  const [modalToppingsList, setModalToppingsList] = useState<{ name: string; price: number }[]>([]);

  // Custom states for KDS and Delivery synchronization
  const [orderType, setOrderType] = useState("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const { data: productsData } = useListProducts({ search: search || undefined, categoryId: activeCat || undefined, limit: 100 });
  const { data: categories } = useListCategories();
  const createOrder = useCreateOrder();

  const products = productsData?.data || [];

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxAmount = (subtotal - discount) * (taxPct / 100);
  const total = subtotal - discount + taxAmount;

  // Recalculate discount if coupon is applied
  useEffect(() => {
    if (selectedCouponCode) {
      const coupon = activeCoupons.find(c => c.code === selectedCouponCode);
      if (coupon) {
        const calculated = Math.round((subtotal * coupon.discount) / 100);
        setDiscount(calculated);
      }
    }
  }, [subtotal, selectedCouponCode, activeCoupons]);

  const addToCartDirect = (product: any) => {
    const price = Number(product.price);
    const cartId = `${product.id}`;
    setCart(c => {
      const existing = c.find(i => i.id === cartId);
      if (existing) return c.map(i => i.id === cartId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, {
        id: cartId,
        productId: product.id,
        name: product.name,
        price,
        basePrice: price,
        quantity: 1,
        selectedVariant: "",
        selectedToppings: [],
        notes: ""
      }];
    });
  };

  const handleOpenDetailModal = (product: any) => {
    setSelectedProduct(product);
    setModalQty(1);
    setModalNotes("");
    
    let variants = DEFAULT_VARIANTS;
    let toppings = DEFAULT_TOPPINGS;

    if (product.variantSettings) {
      try {
        const parsed = JSON.parse(product.variantSettings);
        if (parsed.variants && Array.isArray(parsed.variants)) {
          variants = parsed.variants;
        }
        if (parsed.toppings && Array.isArray(parsed.toppings)) {
          toppings = parsed.toppings;
        }
      } catch (e) {
        variants = DEFAULT_VARIANTS;
        toppings = DEFAULT_TOPPINGS;
      }
    } else {
      variants = DEFAULT_VARIANTS;
      toppings = DEFAULT_TOPPINGS;
    }

    setModalVariantsList(variants);
    setModalToppingsList(toppings);

    if (tenant?.showVariants !== false && variants.length > 0) {
      setModalVariant(variants[0].name);
    } else {
      setModalVariant("");
    }
    setModalToppings([]);
  };

  const handleAddToCartFromModal = () => {
    if (!selectedProduct) return;
    
    const price = Number(selectedProduct.price);
    const toppings = tenant?.showToppings !== false ? modalToppings : [];
    const variant = tenant?.showVariants !== false ? modalVariant : "";

    let variantPrice = 0;
    const variantObj = modalVariantsList.find(v => v.name === variant);
    if (variantObj) variantPrice = variantObj.price;

    const toppingsPrice = toppings.reduce((sum, name) => {
      const t = modalToppingsList.find(x => x.name === name);
      return sum + (t ? t.price : 2000);
    }, 0);

    const itemUnitPrice = price + variantPrice + toppingsPrice;
    
    const cartId = `${selectedProduct.id}-${variant}-${toppings.sort().join(",")}-${modalNotes}`;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === cartId);
      if (existingIdx !== -1) {
        return prev.map((item, idx) => idx === existingIdx ? {
          ...item,
          quantity: item.quantity + modalQty,
        } : item);
      } else {
        return [...prev, {
          id: cartId,
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: itemUnitPrice,
          basePrice: price,
          quantity: modalQty,
          notes: modalNotes,
          selectedVariant: variant,
          selectedToppings: toppings
        }];
      }
    });

    setSelectedProduct(null);
  };

  const addToCart = (product: any) => {
    if (tenant?.showVariants !== false || tenant?.showToppings !== false) {
      handleOpenDetailModal(product);
    } else {
      addToCartDirect(product);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const checkout = () => {
    createOrder.mutate({
      data: {
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          variantSelection: i.selectedVariant
            ? `${i.selectedVariant}${i.selectedToppings && i.selectedToppings.length > 0 ? " " + i.selectedToppings.join(", ") : ""}`
            : (i.selectedToppings && i.selectedToppings.length > 0 ? i.selectedToppings.join(", ") : null),
          notes: i.notes || null,
        })),
        paymentMethod: paymentMethod as any,
        subtotal,
        discount,
        tax: taxAmount,
        total,
        // Pass custom fields inside request body (casted to any since not in OpenAPI schema)
        ...({
          orderType,
          tableNumber,
          customerName,
          customerPhone,
          deliveryAddress
        } as any)
      }
    }, {
      onSuccess: () => {
        setCart([]);
        setDiscount(0);
        setOrderType("dine_in");
        setTableNumber("");
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSuccess(true);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Products panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        {/* Promo Banners */}
        {promoBanners.length > 0 && (
          <div className="px-4 py-2 bg-muted/10 border-b border-border flex-shrink-0">
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {promoBanners.map(pb => (
                <div
                  key={pb.id}
                  className={`flex-none h-16 sm:h-20 rounded-xl overflow-hidden shadow-sm border border-border relative group flex items-center justify-center bg-card ${
                    pb.imageUrl ? "w-auto" : "w-56 sm:w-64"
                  }`}
                >
                  {pb.imageUrl ? (
                    <div className="relative h-full w-auto">
                      <img src={pb.imageUrl} alt={pb.title || "Promo"} className="h-full w-auto object-contain rounded-xl" />
                      {pb.title && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-2">
                          <div className="text-white font-bold text-[10px] sm:text-xs leading-snug line-clamp-2 drop-shadow">
                            {pb.title}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{ backgroundColor: pb.bgColor, color: pb.textColor }}
                      className="w-full h-full p-2.5 flex flex-col justify-between"
                    >
                      <div className="font-bold text-[10px] sm:text-xs leading-snug line-clamp-2">{pb.title}</div>
                      <div className="text-[8px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
                        <Sparkles size={8} className="text-amber-400" /> Promo Aktif
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-product-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk atau scan barcode..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 py-3 border-b border-border flex gap-2 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveCat(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCat === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >Semua</button>
          {(categories || []).map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeCat === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >{cat.name}</button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map(product => {
              const cartItems = cart.filter(i => i.productId === product.id);
              const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <button
                  key={product.id}
                  data-testid={`card-product-${product.id}`}
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  className={`relative text-left p-3 rounded-xl border bg-card transition-all hover:shadow-md active:scale-95 ${
                    totalQuantity > 0 ? "border-primary ring-1 ring-primary" : "border-card-border hover:border-primary/40"
                  } ${product.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {totalQuantity > 0 && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">
                      {totalQuantity}
                    </div>
                  )}
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                      <Package size={24} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="text-sm font-medium text-foreground leading-tight line-clamp-2">{product.name}</div>
                  <div className="text-sm font-bold text-primary mt-1">{formatRp(Number(product.price))}</div>
                  <div className="text-xs text-muted-foreground">Stok: {product.stock}</div>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                <Package size={36} className="mx-auto mb-3 opacity-30" />
                <div>Tidak ada produk ditemukan</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 xl:w-96 flex flex-col bg-card border-l border-border flex-shrink-0">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <span className="font-semibold text-foreground">Keranjang</span>
          <span className="ml-auto text-sm text-muted-foreground">{cart.length} item</span>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Keranjang kosong</div>
              <div className="text-xs opacity-70 mt-1">Klik produk untuk menambahkan</div>
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-background border border-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                {item.selectedVariant && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium bg-muted/40 px-1.5 py-0.5 rounded inline-block">
                    Varian: {item.selectedVariant}
                  </div>
                )}
                {item.selectedToppings && item.selectedToppings.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium bg-muted/40 px-1.5 py-0.5 rounded block">
                    Toppings: {item.selectedToppings.join(", ")}
                  </div>
                )}
                {item.notes && (
                  <div className="text-[10px] text-amber-600 italic mt-0.5">
                    "{item.notes}"
                  </div>
                )}
                <div className="text-xs text-primary font-semibold mt-1">{formatRp(item.price)}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary & Checkout */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatRp(subtotal)}</span>
            </div>
            
            {activeCoupons.length > 0 && (
              <div className="flex items-center justify-between text-muted-foreground py-1 border-b border-border/40">
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <Gift size={13} /> Kupon Promo
                </span>
                <select
                  value={selectedCouponCode}
                  onChange={e => {
                    const code = e.target.value;
                    setSelectedCouponCode(code);
                    if (!code) {
                      setDiscount(0);
                    }
                  }}
                  className="w-44 px-2 py-1 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-medium"
                >
                  <option value="">Pilih Kupon...</option>
                  {activeCoupons.map(cp => (
                    <option key={cp.id} value={cp.code}>
                      {cp.code} (Diskon {cp.discount}%)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Diskon (Rp)</span>
              <input
                type="number"
                value={discount}
                onChange={e => {
                  setSelectedCouponCode("");
                  setDiscount(Math.max(0, Number(e.target.value)));
                }}
                className="w-24 text-right px-2 py-0.5 border border-input rounded text-xs bg-background"
              />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Pajak ({taxPct}%)</span>
              <span>{formatRp(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border">
              <span>Total</span><span className="text-primary">{formatRp(total)}</span>
            </div>
          </div>

          {/* Order Type Selector */}
          <div className="space-y-2 py-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Jenis Pesanan</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "dine_in", label: "Dine In", icon: "🪑" },
                { value: "take_away", label: "Bawa Pulang", icon: "🛍️" },
                { value: "delivery", label: "Delivery", icon: "🛵" }
              ].map(ot => (
                <button
                  key={ot.value}
                  type="button"
                  onClick={() => {
                    setOrderType(ot.value);
                    if (ot.value !== "delivery") {
                      setDeliveryAddress("");
                      setCustomerPhone("");
                    }
                    if (ot.value !== "dine_in") {
                      setTableNumber("");
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-semibold transition-all ${
                    orderType === ot.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <span className="text-base mb-0.5">{ot.icon}</span>
                  {ot.label}
                </button>
              ))}
            </div>

            {/* Dine-in inputs */}
            {orderType === "dine_in" && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Nomor Meja</label>
                <input
                  type="text"
                  placeholder="Contoh: Meja #5"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Delivery inputs */}
            {orderType === "delivery" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Penerima</label>
                    <input
                      type="text"
                      placeholder="Nama..."
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">No. Telepon</label>
                    <input
                      type="text"
                      placeholder="0812..."
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Alamat Lengkap Pengiriman</label>
                  <textarea
                    placeholder="Alamat lengkap penerima..."
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.value}
                onClick={() => setPaymentMethod(pm.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  paymentMethod === pm.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {pm.icon}{pm.label}
              </button>
            ))}
          </div>

          {success && (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm font-medium">
              <Check size={16} /> Transaksi berhasil!
            </div>
          )}

          <button
            data-testid="button-checkout"
            onClick={checkout}
            disabled={cart.length === 0 || createOrder.isPending}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          >
            {createOrder.isPending ? "Memproses..." : `Bayar ${formatRp(total)}`}
          </button>
        </div>
      </div>

      {/* Product Detail / Option Selection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <div>
                <h2 className="font-bold text-foreground text-base leading-snug">{selectedProduct.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatRp(Number(selectedProduct.price))}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Product Image preview */}
              {selectedProduct.imageUrl && (
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}

              {/* Variants */}
              {tenant?.showVariants !== false && modalVariantsList.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pilihan Ukuran / Varian</label>
                  <div className="grid grid-cols-2 gap-2">
                    {modalVariantsList.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => setModalVariant(v.name)}
                        className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                          modalVariant === v.name
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/40 text-foreground"
                        }`}
                      >
                        <span className="text-xs font-semibold">{v.name}</span>
                        <span className="text-[10px] opacity-80 mt-0.5">
                          {v.price === 0 ? "Free" : `+ ${formatRp(v.price)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toppings */}
              {tenant?.showToppings !== false && modalToppingsList.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Topping / Tambahan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {modalToppingsList.map((t) => {
                      const active = modalToppings.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          onClick={() => {
                            setModalToppings((prev) =>
                              active ? prev.filter((x) => x !== t.name) : [...prev, t.name]
                            );
                          }}
                          className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/40 text-foreground"
                          }`}
                        >
                          <span className="text-xs font-semibold">{t.name}</span>
                          <span className="text-[10px] opacity-80 mt-0.5">
                            + {formatRp(t.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Catatan Pesanan</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Contoh: es dikit, gula 50%, dll..."
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jumlah</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{modalQty}</span>
                  <button
                    onClick={() => setModalQty((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/10 flex gap-3">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 py-2.5 border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleAddToCartFromModal}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all"
              >
                Tambah Ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
