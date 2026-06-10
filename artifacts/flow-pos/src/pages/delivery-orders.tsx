import { useState, useEffect, useRef } from "react";
import { Truck, MapPin, Phone, Clock, CheckCircle2, RefreshCw, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PAY_LABEL: Record<string, string> = { cash: "COD (Tunai)", cashier: "Bayar di Kasir", qris: "QRIS", bank_transfer: "Transfer", ewallet: "E-Wallet" };

function elapsed(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}d`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}j ${Math.floor((secs % 3600) / 60)}m`;
}
function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

export default function DeliveryOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"queue" | "delivering" | "done">("queue");
  const [updating, setUpdating] = useState<number | null>(null);
  const tokenRef = useRef(localStorage.getItem("flow_token") ?? "");

  async function fetchOrders() {
    let url = `${BASE}/api/tenant/customer-orders`;
    if (user?.branchId) url += `?branchId=${user.branchId}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (r.ok) {
      const d = await r.json();
      setOrders((d.data ?? []).filter((o: any) => o.orderType === "delivery"));
    }
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [user?.branchId]);

  useEffect(() => {
    const iv = setInterval(fetchOrders, 30000);
    return () => clearInterval(iv);
  }, [user?.branchId]);

  async function updateStatus(orderId: number, status: string) {
    setUpdating(orderId);
    await fetch(`${BASE}/api/tenant/customer-orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ status }),
    });
    await fetchOrders();
    setUpdating(null);
  }

  const queueOrders = orders.filter(o => ["ready"].includes(o.status));
  const deliveringOrders = orders.filter(o => o.status === "on_delivery");
  const doneOrders = orders.filter(o => ["completed", "cancelled"].includes(o.status)).slice(0, 20);

  const activeTab = tab === "queue" ? queueOrders : tab === "delivering" ? deliveringOrders : doneOrders;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Truck size={22} className="text-primary" /> Pesanan Delivery
          </h1>
          <p className="text-muted-foreground text-sm">Kelola pengiriman ke pelanggan {user?.branchName ? `(${user.branchName})` : ""}</p>
        </div>
        <button onClick={() => { setLoading(true); fetchOrders(); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{queueOrders.length}</div>
          <div className="text-xs text-amber-600 dark:text-amber-500">Siap Dikirim</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{deliveringOrders.length}</div>
          <div className="text-xs text-blue-600 dark:text-blue-500">Dalam Pengiriman</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{doneOrders.length}</div>
          <div className="text-xs text-green-600 dark:text-green-500">Selesai Hari Ini</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {([
          { key: "queue", label: `Antrean (${queueOrders.length})` },
          { key: "delivering", label: `Dikirim (${deliveringOrders.length})` },
          { key: "done", label: "Selesai" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab.length === 0 ? (
        <div className="text-center py-20">
          <Truck size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <div className="text-muted-foreground text-sm">
            {tab === "queue" ? "Tidak ada pesanan siap dikirim" :
              tab === "delivering" ? "Tidak ada pesanan dalam pengiriman" :
                "Belum ada riwayat pengiriman"}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab.map(order => (
            <div key={order.id} className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-start justify-between">
                <div>
                  <div className="font-bold text-foreground">{order.customerName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{order.orderNumber}</div>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1 text-xs text-primary mt-0.5 hover:underline">
                      <Phone size={10} /> {order.customerPhone}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary text-lg">{formatRp(Number(order.total))}</div>
                  <div className="text-xs text-muted-foreground">{PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={10} /> {elapsed(order.createdAt)} lalu
                  </div>
                </div>
              </div>

              {/* Address */}
              {order.deliveryAddress && (
                <div className="px-4 py-2.5 bg-muted/20 flex items-start gap-2 border-b border-border/50">
                  <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-foreground font-medium">{order.deliveryAddress}</div>
                    {order.deliveryNotes && <div className="text-xs text-muted-foreground mt-0.5">{order.deliveryNotes}</div>}
                  </div>
                  <a
                    href={order.googleMapsLocation || `https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Navigation size={10} /> Maps
                  </a>
                </div>
              )}

              {/* Items */}
              <div className="px-4 py-2.5 border-b border-border/50 space-y-1">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="flex flex-col text-sm border-b border-border/20 last:border-b-0 pb-1 last:pb-0">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{item.productName} <span className="font-medium text-foreground">×{item.quantity}</span></span>
                      <span className="font-medium text-foreground">{formatRp(item.subtotal)}</span>
                    </div>
                    {item.variantSelection && (
                      <span className="text-[10px] text-gray-400 mt-0.5">{item.variantSelection}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-4 py-3">
                {order.status === "ready" && (
                  <button onClick={() => updateStatus(order.id, "on_delivery")} disabled={updating === order.id}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {updating === order.id ? "..." : "🛵 Mulai Pengiriman"}
                  </button>
                )}
                {order.status === "on_delivery" && (
                  <button onClick={() => updateStatus(order.id, "completed")} disabled={updating === order.id}
                    className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
                    {updating === order.id ? "..." : "✓ Pesanan Terkirim"}
                  </button>
                )}
                {(order.status === "completed" || order.status === "cancelled") && (
                  <div className={`text-center text-sm font-medium py-1 ${order.status === "completed" ? "text-green-600" : "text-red-500"}`}>
                    {order.status === "completed" ? "✓ Terkirim" : "✗ Dibatalkan"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
