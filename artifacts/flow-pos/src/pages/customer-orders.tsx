import { useState, useEffect, useRef } from "react";
import { Clock, ChefHat, Package, Truck, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_CONFIG: Record<string, { label: string; cls: string; next?: string; icon: any }> = {
  pending:     { label: "Menunggu",     cls: "bg-amber-100 text-amber-700 border-amber-200",   next: "confirmed",   icon: Clock },
  confirmed:   { label: "Dikonfirmasi", cls: "bg-blue-100 text-blue-700 border-blue-200",      next: "preparing",   icon: CheckCircle2 },
  preparing:   { label: "Diproses",     cls: "bg-purple-100 text-purple-700 border-purple-200", next: "ready",      icon: ChefHat },
  ready:       { label: "Siap",         cls: "bg-green-100 text-green-700 border-green-200",    next: "completed",  icon: Package },
  on_delivery: { label: "Dikirim",      cls: "bg-indigo-100 text-indigo-700 border-indigo-200", next: "completed",  icon: Truck },
  completed:   { label: "Selesai",      cls: "bg-gray-100 text-gray-600 border-gray-200",                          icon: CheckCircle2 },
  cancelled:   { label: "Dibatalkan",   cls: "bg-red-100 text-red-600 border-red-200",                             icon: XCircle },
};
const TYPE_LABEL: Record<string, string> = { dine_in: "Dine In", take_away: "Take Away", delivery: "Delivery" };
const TYPE_ICON: Record<string, string> = { dine_in: "🪑", take_away: "🛍️", delivery: "🛵" };
const PAY_LABEL: Record<string, string> = { cash: "Tunai", cashier: "Kasir", qris: "QRIS", bank_transfer: "Transfer", ewallet: "E-Wallet" };

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  return `${Math.floor(diff / 3600)}j lalu`;
}

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const isFashion = user?.businessType === "fashion";

  const getStatusConfig = (status: string) => {
    const defaultCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    if (!isFashion) return defaultCfg;

    if (status === "preparing") {
      return {
        ...defaultCfg,
        label: "Sedang Dipacking",
        icon: Package,
      };
    }
    if (status === "ready") {
      return {
        ...defaultCfg,
        label: "Siap Kirim/Ambil",
      };
    }
    return defaultCfg;
  };

  const displayTypeLabels = isFashion ? {
    dine_in: "Fitting Room",
    take_away: "Ambil di Toko",
    delivery: "Kirim Kurir",
  } : TYPE_LABEL;

  const displayTypeIcons = isFashion ? {
    dine_in: "👚",
    take_away: "🛍️",
    delivery: "🛵",
  } : TYPE_ICON;

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [connected, setConnected] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const tokenRef = useRef<string>(localStorage.getItem("flow_token") ?? "");

  function playAlert() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; gain.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => { osc.frequency.value = 1100; osc.start(ctx.currentTime + 0.2); osc.stop(ctx.currentTime + 0.35); }, 200);
    } catch {}
  }

  async function fetchOrders() {
    let url = `${BASE}/api/tenant/customer-orders`;
    const params: string[] = [];
    if (statusFilter) params.push(`status=${statusFilter}`);
    if (user?.branchId) params.push(`branchId=${user.branchId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
    if (r.ok) { const d = await r.json(); setOrders(d.data ?? []); }
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [statusFilter, user?.branchId]);

  useEffect(() => {
    const token = localStorage.getItem("flow_token") ?? "";
    tokenRef.current = token;
    const evtSrc = new EventSource(`${BASE}/api/tenant/orders/events?token=${encodeURIComponent(token)}`);
    sseRef.current = evtSrc;

    evtSrc.onopen = () => setConnected(true);
    evtSrc.onerror = () => setConnected(false);
    evtSrc.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "new_order") {
        if (!user?.branchId || data.order.branchId === user.branchId) {
          setOrders(prev => [data.order, ...prev]);
          playAlert();
        }
      } else if (data.type === "status_update") {
        setOrders(prev => prev.map(o => o.id === data.orderId ? { ...o, status: data.status } : o));
      }
    };
    return () => { evtSrc.close(); setConnected(false); };
  }, [user?.branchId]);

  async function updateStatus(orderId: number, status: string) {
    setUpdating(orderId);
    const r = await fetch(`${BASE}/api/tenant/customer-orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      const updated = await r.json();
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    }
    setUpdating(null);
  }

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pesanan Online</h1>
          <p className="text-muted-foreground text-sm">Pesanan dari QR Menu pelanggan {user?.branchName ? `(${user.branchName})` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Offline"}
          </div>
          {pendingCount > 0 && (
            <div className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
              {pendingCount} Pesanan Baru!
            </div>
          )}
          <button onClick={() => { setLoading(true); fetchOrders(); }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { v: "", label: "Semua" },
          { v: "pending", label: "Menunggu" },
          { v: "confirmed", label: "Dikonfirmasi" },
          { v: "preparing", label: isFashion ? "Sedang Dipacking" : "Diproses" },
          { v: "ready", label: isFashion ? "Siap Kirim/Ambil" : "Siap" },
          { v: "on_delivery", label: "Dikirim" },
          { v: "completed", label: "Selesai" },
          { v: "cancelled", label: "Dibatalkan" },
        ].map(f => (
          <button key={f.v} onClick={() => setStatusFilter(f.v)}
            className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === f.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">📋</div>
          <div className="text-muted-foreground text-sm">Belum ada pesanan online</div>
          <p className="text-xs text-muted-foreground mt-1">{isFashion ? "Bagikan link QR Katalog ke pelanggan Anda" : "Bagikan link QR Menu ke pelanggan Anda"}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map(order => {
            const cfg = getStatusConfig(order.status);
            const Icon = cfg.icon;
            const isNew = order.status === "pending";
            return (
              <div key={order.id} className={`bg-card border rounded-2xl shadow-sm overflow-hidden transition-all ${isNew ? "border-amber-300 ring-2 ring-amber-100" : "border-card-border"}`}>
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{order.orderNumber}</div>
                      <div className="font-bold text-foreground text-sm mt-0.5">{order.customerName}</div>
                      {order.customerPhone && <div className="text-xs text-muted-foreground">{order.customerPhone}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
                        <Icon size={10} />{cfg.label}
                      </span>
                      <div className="text-xs text-muted-foreground mt-1">{timeAgo(order.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{displayTypeIcons[order.orderType]} {displayTypeLabels[order.orderType] ?? order.orderType}</span>
                    {order.tableNumber && <span>• {isFashion ? "Fitting Room" : "Meja"} #{order.tableNumber}</span>}
                    <span>• {PAY_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-1.5">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.productName} <span className="text-muted-foreground text-xs">×{item.quantity}</span></span>
                      <span className="font-medium text-foreground">{formatRp(item.subtotal)}</span>
                    </div>
                  ))}
                  {order.deliveryAddress && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 flex items-center justify-between gap-2 border">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-foreground">Alamat Pengiriman:</span>
                        <div className="truncate">📍 {order.deliveryAddress}</div>
                        {order.deliveryNotes && <div className="text-[10px] text-muted-foreground mt-0.5">Catatan: {order.deliveryNotes}</div>}
                      </div>
                      <a
                        href={order.googleMapsLocation || `https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-bold"
                      >
                        <Navigation size={12} /> Maps
                      </a>
                    </div>
                  )}
                  {order.notes && (
                    <div className="mt-1 text-xs text-muted-foreground italic">"{order.notes}"</div>
                  )}
                </div>

                {/* Total */}
                <div className="px-4 pb-3 border-t border-border/50 pt-2.5">
                  <div className="flex justify-between items-center text-sm font-bold mb-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-primary text-base">{formatRp(Number(order.total))}</span>
                  </div>

                  {/* Action buttons */}
                  {order.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(order.id, "confirmed")}
                        disabled={updating === order.id}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                        {updating === order.id ? "..." : "✓ Konfirmasi"}
                      </button>
                      <button onClick={() => updateStatus(order.id, "cancelled")}
                        disabled={updating === order.id}
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60">
                        Tolak
                      </button>
                    </div>
                  )}
                  {order.status === "confirmed" && (
                    <button onClick={() => updateStatus(order.id, "preparing")}
                      disabled={updating === order.id}
                      className="w-full py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-60">
                      {updating === order.id ? "..." : isFashion ? "📦 Mulai Packing" : "🍳 Mulai Memasak"}
                    </button>
                  )}
                  {order.status === "preparing" && (
                    <button onClick={() => updateStatus(order.id, order.orderType === "delivery" ? "on_delivery" : "ready")}
                      disabled={updating === order.id}
                      className="w-full py-2 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60">
                      {updating === order.id ? "..." : (order.orderType === "delivery" ? "🛵 Kirim Sekarang" : (isFashion ? "✓ Siap Dikirim/Ambil" : "✓ Siap Diambil"))}
                    </button>
                  )}
                  {(order.status === "ready" || order.status === "on_delivery") && (
                    <button onClick={() => updateStatus(order.id, "completed")}
                      disabled={updating === order.id}
                      className="w-full py-2 rounded-xl text-xs font-semibold bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-60">
                      {updating === order.id ? "..." : "✓ Selesai"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
