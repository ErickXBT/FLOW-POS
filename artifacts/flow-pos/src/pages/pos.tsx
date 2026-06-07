import { useState } from "react";
import { useListProducts, useListCategories, useCreateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, QrCode, X, Check, Package } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Tunai", icon: <Banknote size={18} /> },
  { value: "qris", label: "QRIS", icon: <QrCode size={18} /> },
  { value: "bank_transfer", label: "Transfer", icon: <CreditCard size={18} /> },
  { value: "ewallet", label: "E-Wallet", icon: <Smartphone size={18} /> },
];

function formatRp(val: number) {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function POSPage() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [cart, setCart] = useState<{ productId: number; name: string; price: number; quantity: number }[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPct, setTaxPct] = useState(11);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const { data: productsData } = useListProducts({ search: search || undefined, categoryId: activeCat || undefined, limit: 100 });
  const { data: categories } = useListCategories();
  const createOrder = useCreateOrder();

  const products = productsData?.data || [];

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxAmount = (subtotal - discount) * (taxPct / 100);
  const total = subtotal - discount + taxAmount;

  const addToCart = (product: any) => {
    setCart(c => {
      const existing = c.find(i => i.productId === product.id);
      if (existing) return c.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(c => c.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const checkout = () => {
    createOrder.mutate({
      data: {
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        paymentMethod: paymentMethod as any,
        subtotal,
        discount,
        tax: taxAmount,
        total,
      }
    }, {
      onSuccess: () => {
        setCart([]);
        setDiscount(0);
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
              const inCart = cart.find(i => i.productId === product.id);
              return (
                <button
                  key={product.id}
                  data-testid={`card-product-${product.id}`}
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  className={`relative text-left p-3 rounded-xl border bg-card transition-all hover:shadow-md active:scale-95 ${
                    inCart ? "border-primary ring-1 ring-primary" : "border-card-border hover:border-primary/40"
                  } ${product.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">
                      {inCart.quantity}
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
            <div key={item.productId} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-xs text-primary font-semibold">{formatRp(item.price)}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
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
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Diskon (Rp)</span>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
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

          {/* Payment method */}
          <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
}
