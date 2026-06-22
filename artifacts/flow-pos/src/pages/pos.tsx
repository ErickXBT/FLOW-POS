import { useState, useEffect, useMemo } from "react";
import { useListProducts, useListCategories, useCreateOrder, getListOrdersQueryKey, useGetTenant, useListEmployees } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, QrCode, X, Check, Package, Sparkles, Gift, Percent } from "lucide-react";
import { useActiveBranch } from "@/hooks/use-active-branch";

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
  const { activeBranchId } = useActiveBranch();
  const { data: tenant } = useGetTenant();
  const isFashion = tenant?.businessType === "fashion";
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);

  // Cashier shift state
  const { data: employeesData } = useListEmployees();
  const employees = employeesData || [];
  const activeEmployees = employees.filter((emp: any) => emp.isActive);

  const [shiftActive, setShiftActive] = useState(() => localStorage.getItem("flow_shift_active") === "true");
  const [activeCashierName, setActiveCashierName] = useState(() => localStorage.getItem("flow_active_cashier_name") || "");
  const [activeCashierId, setActiveCashierId] = useState<number | null>(() => {
    const val = localStorage.getItem("flow_active_cashier_id");
    return val ? Number(val) : null;
  });

  const [activeShift, setActiveShift] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState("100000");
  const [actualCash, setActualCash] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [customCashierName, setCustomCashierName] = useState("");
  const [isPriority, setIsPriority] = useState(false);

  const fetchActiveShift = async () => {
    if (!activeBranchId) return;
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/shifts/active?branchId=${activeBranchId}`, {
        headers: { "Authorization": `Bearer ${token || ""}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data);
        if (data) {
          setShiftActive(true);
          setActiveCashierName(data.cashierName);
          setActiveCashierId(data.userId);
          localStorage.setItem("flow_shift_active", "true");
          localStorage.setItem("flow_active_cashier_name", data.cashierName);
          localStorage.setItem("flow_active_cashier_id", String(data.userId));
          localStorage.setItem("flow_active_shift_id", String(data.id));
        } else {
          setShiftActive(false);
          setActiveCashierName("");
          setActiveCashierId(null);
          localStorage.removeItem("flow_shift_active");
          localStorage.removeItem("flow_active_cashier_name");
          localStorage.removeItem("flow_active_cashier_id");
          localStorage.removeItem("flow_active_shift_id");
        }
      }
    } catch (err) {
      console.error("Failed to fetch active shift:", err);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, [activeBranchId]);

  const handleStartShift = async (name: string, id: number | null) => {
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/shifts/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`
        },
        body: JSON.stringify({
          openingCash: Number(openingCash || 0),
          branchId: activeBranchId,
          cashierName: name
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Gagal memulai shift");
        return;
      }

      const data = await res.json();
      localStorage.setItem("flow_shift_active", "true");
      localStorage.setItem("flow_active_cashier_name", name);
      localStorage.setItem("flow_active_shift_id", String(data.id));
      if (id !== null) {
        localStorage.setItem("flow_active_cashier_id", String(id));
      } else {
        localStorage.removeItem("flow_active_cashier_id");
      }
      setShiftActive(true);
      setActiveCashierName(name);
      setActiveCashierId(id);
      setActiveShift(data);
      setShowShiftModal(false);
    } catch (err) {
      console.error("Failed to start shift:", err);
      alert("Gagal menghubungi server untuk memulai shift");
    }
  };

  const handleEndShift = () => {
    // Open the End Shift Modal instead of directly calling confirm
    if (activeShift) {
      setActualCash(String(activeShift.expectedCash || 0));
      setShiftNotes("");
      setShowEndShiftModal(true);
    } else {
      alert("Tidak ada shift aktif");
    }
  };

  const handleEndShiftSubmit = async () => {
    if (!activeShift) return;
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/shifts/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`
        },
        body: JSON.stringify({
          shiftId: activeShift.id,
          closingCash: Number(actualCash || 0),
          actualCash: Number(actualCash || 0),
          notes: shiftNotes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Gagal mengakhiri shift");
        return;
      }

      localStorage.removeItem("flow_shift_active");
      localStorage.removeItem("flow_active_cashier_name");
      localStorage.removeItem("flow_active_cashier_id");
      localStorage.removeItem("flow_active_shift_id");
      setShiftActive(false);
      setActiveCashierName("");
      setActiveCashierId(null);
      setActiveShift(null);
      setActualCash("");
      setShiftNotes("");
      setShowEndShiftModal(false);
      alert("Shift kasir berhasil diakhiri dan laporan disimpan!");
    } catch (err) {
      console.error("Failed to end shift:", err);
      alert("Gagal menghubungi server untuk mengakhiri shift");
    }
  };

  const [promoBanners, setPromoBanners] = useState<any[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<any[]>([]);
  const [selectedCouponCode, setSelectedCouponCode] = useState("");

  // Load promo banners and coupons on mount
  useEffect(() => {
    if (tenant?.id) {
      try {
        const banners = localStorage.getItem(`flow_marketing_banners_${tenant.id}`);
        if (banners) {
          setPromoBanners(JSON.parse(banners));
        } else {
          const oldBanners = localStorage.getItem("flow_marketing_banners");
          if (oldBanners) {
            setPromoBanners(JSON.parse(oldBanners));
          } else {
            setPromoBanners([]);
          }
        }
      } catch (e) {}

      try {
        const storedCoupons = localStorage.getItem(`flow_coupons_${tenant.id}`);
        if (storedCoupons) {
          const parsed = JSON.parse(storedCoupons);
          setActiveCoupons(parsed.filter((c: any) => c.status === "Aktif"));
        } else {
          const oldCoupons = localStorage.getItem("flow_coupons");
          if (oldCoupons) {
            const parsed = JSON.parse(oldCoupons);
            setActiveCoupons(parsed.filter((c: any) => c.status === "Aktif"));
          } else {
            setActiveCoupons([]);
          }
        }
      } catch (e) {}
    }
  }, [tenant]);

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
  const [taxPct, setTaxPct] = useState(0);

  // Load tax settings from tenant
  useEffect(() => {
    if (tenant) {
      if ((tenant as any).enableTax) {
        setTaxPct(Number((tenant as any).taxPercentage ?? 10));
      } else {
        setTaxPct(0);
      }
    }
  }, [tenant]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();



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

  const allBanners = useMemo(() => {
    const list = [...promoBanners];
    products.forEach((p: any) => {
      if (p.variantSettings) {
        try {
          const parsed = JSON.parse(p.variantSettings);
          if (parsed.isBundle && parsed.bannerImageUrl) {
            const exists = list.some(b => b.linkedProductId === p.id);
            if (!exists) {
              list.push({
                id: `bundle-banner-${p.id}`,
                title: p.name,
                imageUrl: parsed.bannerImageUrl,
                bgColor: "",
                textColor: "",
                linkedProductId: p.id
              });
            }
          }
        } catch (e) {}
      }
    });
    return list;
  }, [promoBanners, products]);

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
    
    let variants = isFashion ? [] : DEFAULT_VARIANTS;
    let toppings = isFashion ? [] : DEFAULT_TOPPINGS;

    if (product.variantSettings) {
      try {
        const parsed = JSON.parse(product.variantSettings);
        if (parsed.variants && Array.isArray(parsed.variants)) {
          variants = parsed.variants;
        } else {
          variants = isFashion ? [] : DEFAULT_VARIANTS;
        }
        if (parsed.toppings && Array.isArray(parsed.toppings)) {
          toppings = parsed.toppings;
        } else {
          toppings = isFashion ? [] : DEFAULT_TOPPINGS;
        }
      } catch (e) {
        variants = isFashion ? [] : DEFAULT_VARIANTS;
        toppings = isFashion ? [] : DEFAULT_TOPPINGS;
      }
    } else {
      variants = isFashion ? [] : DEFAULT_VARIANTS;
      toppings = isFashion ? [] : DEFAULT_TOPPINGS;
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
    const shiftIdVal = localStorage.getItem("flow_active_shift_id");
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
          deliveryAddress,
          branchId: activeBranchId,
          employeeId: activeCashierId,
          employeeName: activeCashierName || tenant?.defaultCashierName || "Kasir Utama",
          shiftId: shiftIdVal ? Number(shiftIdVal) : null,
          priority: isPriority ? "high" : "normal",
        } as any)
      }
    }, {
      onSuccess: () => {
        setCart([]);
        setDiscount(0);
        setSelectedCouponCode("");
        setOrderType("dine_in");
        setTableNumber("");
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setIsPriority(false);
        setSuccess(true);
        fetchActiveShift(); // Refresh shift calculations
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  };

  const handleCheckoutClick = () => {
    if (!shiftActive) {
      setShowShiftModal(true);
      return;
    }
    checkout();
  };

  const handleBannerClick = (pb: any) => {
    if (pb.linkedProductId) {
      const matched = products.find(p => p.id === pb.linkedProductId);
      if (matched) {
        addToCart(matched);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Products panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        {/* Promo Banners */}
        {allBanners.length > 0 && (
          <div className="px-4 py-2 bg-muted/10 border-b border-border flex-shrink-0">
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {allBanners.map(pb => (
                <div
                  key={pb.id}
                  onClick={() => handleBannerClick(pb)}
                  className={`flex-none h-16 sm:h-20 rounded-xl overflow-hidden shadow-sm border border-border relative group flex items-center justify-center bg-card cursor-pointer hover:border-primary/50 hover:shadow transition-all ${
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
              type="search"
              name="pos-search"
              autoComplete="off"
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
                    <div className="relative w-full aspect-square mb-2 rounded-lg overflow-hidden">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      {(() => {
                        if (product.variantSettings) {
                          try {
                            const parsed = JSON.parse(product.variantSettings);
                            if (parsed.isBundle) {
                              return (
                                <span className="absolute top-1.5 left-1.5 bg-green-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded shadow">
                                  🎁 PAKET PROMO
                                </span>
                              );
                            }
                          } catch (e) {}
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center relative">
                      <Package size={24} className="text-muted-foreground" />
                      {(() => {
                        if (product.variantSettings) {
                          try {
                            const parsed = JSON.parse(product.variantSettings);
                            if (parsed.isBundle) {
                              return (
                                <span className="absolute top-1.5 left-1.5 bg-green-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded shadow">
                                  🎁 PAKET PROMO
                                </span>
                              );
                            }
                          } catch (e) {}
                        }
                        return null;
                      })()}
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

        {/* Shift Management Banner */}
        <div className={`px-4 py-3 border-b flex items-center justify-between text-xs font-semibold ${
          shiftActive 
            ? "bg-green-500/10 border-green-500/25 text-green-700 dark:text-green-400" 
            : "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400"
        }`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${shiftActive ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="truncate">
              {shiftActive ? `Shift: ${activeCashierName}` : "Shift Kasir Nonaktif"}
            </span>
          </div>
          {shiftActive ? (
            <button
              onClick={handleEndShift}
              className="px-2.5 py-1 bg-destructive/10 hover:bg-destructive hover:text-white border border-destructive/20 text-destructive rounded-lg font-bold transition-all"
            >
              Akhiri Shift
            </button>
          ) : (
            <button
              onClick={() => setShowShiftModal(true)}
              className="px-2.5 py-1 bg-primary text-primary-foreground hover:opacity-90 rounded-lg font-bold transition-all shadow"
            >
              Mulai Shift
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
            {taxPct > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Pajak ({taxPct}%)</span>
                <span>{formatRp(taxAmount)}</span>
              </div>
            )}
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
                { value: "dine_in", label: isFashion ? "Fitting Room" : "Dine In", icon: isFashion ? "👚" : "🪑" },
                { value: "take_away", label: isFashion ? "Ambil di Toko" : "Bawa Pulang", icon: "🛍️" },
                { value: "delivery", label: isFashion ? "Kirim Kurir" : "Delivery", icon: "🛵" }
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

            {/* Priority Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-[10px] font-semibold text-destructive mt-2">
              <span className="flex items-center gap-1">
                <span className="animate-pulse text-xs">🚨</span> Prioritaskan Pesanan (KDS)
              </span>
              <input
                type="checkbox"
                checked={isPriority}
                onChange={e => setIsPriority(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-destructive focus:ring-destructive cursor-pointer bg-background border-input"
              />
            </div>

            {/* Nama Pelanggan (Selalu tampil di POS) */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Nama Pelanggan</label>
              <input
                type="text"
                placeholder="Nama pelanggan..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Dine-in inputs */}
            {orderType === "dine_in" && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{isFashion ? "Nomor Fitting Room" : "Nomor Meja"}</label>
                <input
                  type="text"
                  placeholder={isFashion ? "Contoh: Kabin #3" : "Contoh: Meja #5"}
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Delivery inputs */}
            {orderType === "delivery" && (
              <div className="space-y-2">
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
            onClick={handleCheckoutClick}
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
              {(() => {
                let displayImg = selectedProduct.imageUrl;
                if (selectedProduct.variantSettings) {
                  try {
                    const parsed = JSON.parse(selectedProduct.variantSettings);
                    if (parsed.isBundle && parsed.bannerImageUrl) {
                      displayImg = parsed.bannerImageUrl;
                    }
                  } catch (e) {}
                }
                return displayImg ? (
                  <img
                    src={displayImg}
                    alt={selectedProduct.name}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                ) : null;
              })()}

              {/* Bundling items list */}
              {(() => {
                if (selectedProduct.variantSettings) {
                  try {
                    const parsed = JSON.parse(selectedProduct.variantSettings);
                    if (parsed.isBundle && parsed.bundleProducts && parsed.bundleProducts.length > 0) {
                      return (
                        <div className="space-y-2 border-t pt-3 border-border">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Isi Paket Promo</label>
                          <div className="space-y-1.5">
                            {parsed.bundleProducts.map((bp: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-muted/30 border border-border/50 p-2.5 rounded-xl text-xs">
                                <span className="font-semibold text-foreground">{bp.name}</span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">x{bp.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {}
                }
                return null;
              })()}

              {/* Variants */}
              {(() => {
                const parsedSettings = (() => {
                  if (!selectedProduct?.variantSettings) return null;
                  try { return JSON.parse(selectedProduct.variantSettings); } catch (e) { return null; }
                })();
                if (parsedSettings?.isBundle) return null;
                return tenant?.showVariants !== false && modalVariantsList.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isFashion ? "Ukuran / Warna (Varian)" : "Pilihan Ukuran / Varian"}</label>
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
                );
              })()}

              {/* Toppings */}
              {(() => {
                const parsedSettings = (() => {
                  if (!selectedProduct?.variantSettings) return null;
                  try { return JSON.parse(selectedProduct.variantSettings); } catch (e) { return null; }
                })();
                if (parsedSettings?.isBundle) return null;
                return !isFashion && tenant?.showToppings !== false && modalToppingsList.length > 0 && (
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
                );
              })()}

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

      {/* Start Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                🟢 Mulai Shift Kerja Kasir
              </h3>
              <button
                onClick={() => setShowShiftModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Pilih atau masukkan nama kasir untuk memulai pencatatan shift hari ini.
              </p>
              
              {activeEmployees.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Pilih Karyawan Kasir
                    </label>
                    <select
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        if (e.target.value !== "custom") {
                          setCustomCashierName("");
                        }
                      }}
                      className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Pilih Kasir --</option>
                      {activeEmployees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                      <option value="custom">Ketik Nama Manual</option>
                    </select>
                  </div>
                  
                  {selectedEmpId === "custom" && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nama Kasir
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan nama kasir..."
                        value={customCashierName}
                        onChange={(e) => setCustomCashierName(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-[11px] text-amber-700 dark:text-amber-400">
                    ℹ️ Belum ada karyawan terdaftar. Silakan masukkan nama kasir secara manual.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Nama Kasir Manual
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama kasir..."
                      value={customCashierName}
                      onChange={(e) => setCustomCashierName(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Uang Kas Awal */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Uang Kas Awal (Modal Pembukaan)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="100000"
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-muted/10 flex gap-3">
              <button
                onClick={() => setShowShiftModal(false)}
                className="flex-1 py-2 border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                disabled={
                  (activeEmployees.length > 0 && !selectedEmpId) ||
                  ((selectedEmpId === "custom" || activeEmployees.length === 0) && !customCashierName.trim())
                }
                onClick={() => {
                  if (selectedEmpId && selectedEmpId !== "custom") {
                    const emp = activeEmployees.find((e: any) => e.id === Number(selectedEmpId));
                    if (emp) handleStartShift(emp.name, emp.id);
                  } else {
                    handleStartShift(customCashierName, null);
                  }
                }}
                className="flex-1 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
              >
                Mulai Kerja
              </button>
            </div>
          </div>
        </div>
      )}
      {/* End Shift Modal */}
      {showEndShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                🔴 Akhiri Shift Kerja Kasir
              </h3>
              <button
                onClick={() => setShowEndShiftModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Nama Kasir:</span>
                  <span className="font-bold text-foreground">{activeShift.cashierName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Mulai Shift:</span>
                  <span className="font-semibold text-foreground">
                    {activeShift.openedAt ? new Date(activeShift.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Kas Awal:</span>
                  <span className="font-semibold text-foreground">{formatRp(Number(activeShift.openingCash || 0))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Uang Kas Terhitung (Sistem):</span>
                  <span className="font-bold text-primary text-sm">{formatRp(Number(activeShift.expectedCash || 0))}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Uang Kas Fisik di Drawer (Actual Cash)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="Masukkan jumlah kas fisik..."
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-bold text-primary"
                  />
                </div>
              </div>

              {/* Cash Discrepancy Display */}
              {(() => {
                const diff = Number(actualCash || 0) - Number(activeShift.expectedCash || 0);
                return (
                  <div className={`p-3 rounded-xl border text-xs flex flex-col gap-1 ${
                    diff === 0 
                      ? "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400" 
                      : diff > 0 
                        ? "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400" 
                        : "bg-destructive/5 border-destructive/20 text-destructive"
                  }`}>
                    <div className="flex justify-between font-semibold">
                      <span>Selisih Kas (Discrepancy):</span>
                      <span className="font-bold">{diff === 0 ? "Pas" : diff > 0 ? `Lebih (+${formatRp(diff)})` : `Kurang (${formatRp(diff)})`}</span>
                    </div>
                    <span className="text-[10px] opacity-80 leading-normal">
                      {diff === 0 
                        ? "Jumlah kas fisik cocok dengan pencatatan sistem." 
                        : diff > 0 
                          ? "Terdapat kelebihan uang kas dibanding pencatatan transaksi." 
                          : "Terdapat kekurangan uang kas (selisih minus) dibanding pencatatan."}
                    </span>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Catatan Penutupan Shift
                </label>
                <textarea
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Ketik catatan jika ada selisih kas..."
                  rows={2.5}
                  className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-muted/10 flex gap-3">
              <button
                onClick={() => setShowEndShiftModal(false)}
                className="flex-1 py-2 border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleEndShiftSubmit}
                className="flex-1 py-2 bg-destructive text-destructive-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all shadow"
              >
                Tutup Shift & Simpan Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
