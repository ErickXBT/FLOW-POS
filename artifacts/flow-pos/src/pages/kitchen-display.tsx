import { useState, useEffect, useRef } from "react";
import { ChefHat, Clock, CheckCircle2, Package, RefreshCw, Wifi, WifiOff, Bell, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveBranch } from "@/hooks/use-active-branch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Menunggu", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  confirmed: { label: "Dikonfirmasi", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  preparing: { label: "Sedang Dimasak", cls: "bg-purple-100 text-purple-700 border-purple-300" },
  ready:     { label: "Siap", cls: "bg-green-100 text-green-700 border-green-300" },
};
const TYPE_ICON: Record<string, string> = { dine_in: "🪑", take_away: "🛍️", delivery: "🛵" };
const TYPE_LABEL: Record<string, string> = { dine_in: "Dine In", take_away: "Take Away", delivery: "Delivery" };

function elapsed(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}d`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}j ${Math.floor((secs % 3600) / 60)}m`;
}
const formatTableNumber = (num: string, isFashion: boolean) => {
  if (!num) return "";
  let clean = num.trim();
  const prefix = isFashion ? "Fitting Room" : "Meja";
  if (clean.toLowerCase().startsWith(prefix.toLowerCase())) {
    return clean;
  }
  if (clean.startsWith("#")) {
    return `${prefix} ${clean}`;
  }
  return `${prefix} #${clean}`;
};

export default function KitchenDisplayPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranchName } = useActiveBranch();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [newAlerts, setNewAlerts] = useState(0);
  const tokenRef = useRef(localStorage.getItem("flow_token") ?? "");

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
    let url = `${BASE}/api/tenant/customer-orders?status=pending,confirmed,preparing`;
    if (activeBranchId) url += `&branchId=${activeBranchId}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (r.ok) {
      const d = await r.json();
      const active = (d.data ?? []).filter((o: any) => ["pending", "confirmed", "preparing"].includes(o.status));
      setOrders(active);
    }
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [activeBranchId]);

  useEffect(() => {
    const token = tokenRef.current;
    const evtSrc = new EventSource(`${BASE}/api/tenant/orders/events?token=${encodeURIComponent(token)}`);
    evtSrc.onopen = () => setConnected(true);
    evtSrc.onerror = () => setConnected(false);
    evtSrc.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "new_order") {
        if (!activeBranchId || data.order.branchId === activeBranchId) {
          setOrders(prev => [data.order, ...prev]);
          setNewAlerts(n => n + 1);
          playAlert();
        }
      } else if (data.type === "status_update") {
        setOrders(prev => {
          const updated = prev.map(o => o.id === data.orderId ? { ...o, status: data.status, paymentStatus: data.paymentStatus ?? o.paymentStatus } : o);
          return updated.filter(o => ["pending", "confirmed", "preparing"].includes(o.status));
        });
      }
    };
    return () => evtSrc.close();
  }, [activeBranchId]);

  async function updateStatus(orderId: number, status: string) {
    setUpdating(orderId);
    const r = await fetch(`${BASE}/api/tenant/customer-orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      setOrders(prev => {
        if (status === "ready" || status === "completed") return prev.filter(o => o.id !== orderId);
        return prev.map(o => o.id === orderId ? { ...o, status } : o);
      });
    }
    setUpdating(null);
  }

  const sortOrders = (list: any[]) => {
    return [...list].sort((a, b) => {
      const aPri = a.priority === "high" ? 1 : 0;
      const bPri = b.priority === "high" ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri; // priority orders first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // oldest first
    });
  };

  const pendingOrders = sortOrders(orders.filter(o => o.status === "pending" || o.status === "confirmed"));
  const preparingOrders = sortOrders(orders.filter(o => o.status === "preparing"));

  const isFashion = user?.businessType === "fashion";

  return (
    <div className="min-h-screen bg-gray-955 text-white flex flex-col" style={{ backgroundColor: "#0b0f19" }}>
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isFashion ? <ShoppingBag size={22} className="text-blue-400" /> : <ChefHat size={22} className="text-orange-400" />}
          <div>
            <div className="font-bold text-white">{isFashion ? "Packing Display System" : "Kitchen Display System"}</div>
            <div className="text-xs text-gray-400">{isFashion ? "Tampilan Pengemasan" : "Tampilan Dapur"} {activeBranchName ? `(${activeBranchName})` : "(Semua Cabang)"}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {newAlerts > 0 && (
            <button onClick={() => setNewAlerts(0)} className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce">
              <Bell size={12} /> {newAlerts} Pesanan Baru
            </button>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${connected ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Offline"}
          </div>
          <button onClick={() => { setLoading(true); fetchOrders(); }} className="text-gray-400 hover:text-white p-1.5">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid md:grid-cols-2 divide-x divide-gray-800">
          {/* Pending column */}
          <div className="flex flex-col">
            <div className="px-4 py-3 bg-amber-900/20 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-400" />
                <span className="font-semibold text-amber-300 text-sm">Antrian Baru</span>
              </div>
              {pendingOrders.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16">
                  <Clock size={40} className="mb-3 opacity-30" />
                  <div className="text-sm">Tidak ada pesanan baru</div>
                </div>
              ) : pendingOrders.map(order => (
                <KitchenOrderCard key={order.id} order={order} updating={updating}
                  onConfirm={() => updateStatus(order.id, "confirmed")}
                  onPrepare={() => updateStatus(order.id, "preparing")}
                  onCancel={() => updateStatus(order.id, "cancelled")} />
              ))}
            </div>
          </div>

          {/* Preparing column */}
          <div className="flex flex-col">
            <div className="px-4 py-3 bg-purple-900/20 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isFashion ? <ShoppingBag size={16} className="text-purple-400" /> : <ChefHat size={16} className="text-purple-400" />}
                <span className="font-semibold text-purple-300 text-sm">{isFashion ? "Sedang Dipacking" : "Sedang Dimasak"}</span>
              </div>
              {preparingOrders.length > 0 && (
                <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{preparingOrders.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {preparingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16">
                  {isFashion ? <ShoppingBag size={40} className="mb-3 opacity-30" /> : <ChefHat size={40} className="mb-3 opacity-30" />}
                  <div className="text-sm">Tidak ada pesanan diproses</div>
                </div>
              ) : preparingOrders.map(order => (
                <KitchenOrderCard key={order.id} order={order} updating={updating}
                  onReady={() => updateStatus(order.id, "ready")} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimerAndProgress({ createdAt, estimatedTime }: { createdAt: string; estimatedTime: number }) {
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const update = () => {
      setElapsedSecs(Math.floor((Date.now() - start) / 1000));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [createdAt]);

  const formatTimer = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const mins = elapsedSecs / 60;
  
  let colorClass = "text-green-400";
  if (mins >= 10) {
    colorClass = "text-red-500";
  } else if (mins >= 5) {
    colorClass = "text-yellow-500";
  }

  const totalDuration = (estimatedTime || 5) * 60; 
  const pct = Math.min(100, (elapsedSecs / totalDuration) * 100);
  const remainingSecs = totalDuration - elapsedSecs;

  return (
    <div className="space-y-1.5 w-full mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold font-mono text-sm flex items-center gap-1 ${colorClass}`}>
          <Clock size={12} /> {formatTimer(elapsedSecs)}
        </span>
        {remainingSecs > 0 ? (
          <span className="text-gray-400 text-[10px] font-semibold">
            Estimasi: {Math.ceil(remainingSecs / 60)}m tersisa
          </span>
        ) : (
          <span className="text-red-400 text-[10px] font-bold animate-pulse">
            Terlambat {Math.floor(Math.abs(remainingSecs) / 60)}m
          </span>
        )}
      </div>
      
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div 
          style={{ width: `${pct}%` }} 
          className={`h-full transition-all duration-1000 ${
            pct >= 100 
              ? "bg-red-500" 
              : pct >= 80 
                ? "bg-yellow-500" 
                : "bg-green-500"
          }`}
        />
      </div>
    </div>
  );
}

function KitchenOrderCard({ order, updating, onConfirm, onPrepare, onReady, onCancel }: any) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const update = () => {
      setMins(Math.floor((Date.now() - start) / 60000));
    };
    update();
    const iv = setInterval(update, 10000);
    return () => clearInterval(iv);
  }, [order.createdAt]);

  const isUrgent = mins >= 10 && order.status !== "ready";
  const isPriority = order.priority === "high";

  let cardBorder = "border-gray-700";
  if (isUrgent) cardBorder = "border-red-500/60 ring-1 ring-red-500/20";
  else if (mins >= 5) cardBorder = "border-yellow-500/50";
  
  if (isPriority) {
    cardBorder = "border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-2 ring-red-500/30";
  }

  return (
    <div className={`rounded-xl border bg-gray-900 overflow-hidden transition-all ${cardBorder}`}>
      {/* Header */}
      <div className={`px-3 py-2.5 flex items-start justify-between ${isPriority ? "bg-red-950/20" : isUrgent ? "bg-red-900/30" : "bg-gray-800"}`}>
        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-white text-sm truncate">{order.customerName}</span>
            {isPriority && (
              <span className="inline-flex items-center bg-red-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow">
                🚨 PRIORITAS
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
            <span>{TYPE_ICON[order.orderType]} {TYPE_LABEL[order.orderType]}</span>
            {order.tableNumber && <span className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{formatTableNumber(order.tableNumber, isFashion)}</span>}
            {order.paymentStatus === "paid" ? (
              <span className="bg-green-950/60 text-green-400 border border-green-900/60 px-1.5 py-0.5 rounded text-[10px] font-bold">✓ Lunas</span>
            ) : (
              <span className="bg-red-950/60 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse">⏳ Belum Bayar</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end">
          <span className="text-[10px] text-gray-500 font-mono font-semibold">#{order.id}</span>
        </div>
      </div>

      {/* Timer and Progress Bar */}
      <div className="px-3 py-2 border-b border-gray-850 bg-gray-900/60">
        <TimerAndProgress createdAt={order.createdAt} estimatedTime={Number(order.estimatedTime || 5)} />
      </div>

      {/* Items */}
      <div className="px-3 py-2.5 border-b border-gray-800">
        <div className="grid grid-cols-2 gap-2">
          {order.items?.map((item: any) => (
            <div key={item.id} className="bg-gray-850 rounded-xl overflow-hidden border border-gray-800/80 p-2 flex flex-col justify-between" style={{ backgroundColor: "#141b2d" }}>
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-700">🍽️</span>
                )}
                <span className="absolute top-1 left-1 bg-gray-950/80 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-gray-800 shadow-sm">
                  {item.quantity}x
                </span>
              </div>
              <div className="mt-1.5 text-xs font-bold text-white line-clamp-1">
                {item.productName}
              </div>
              {item.variantSelection && (
                <span className="text-[9px] text-gray-400 mt-0.5 line-clamp-1">{item.variantSelection}</span>
              )}
              {item.notes && (
                <span className="text-[9px] text-amber-400 italic mt-0.5 line-clamp-1">Catatan: {item.notes}</span>
              )}
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="mt-2 text-xs text-amber-300 bg-amber-900/20 rounded px-2 py-1 border border-amber-800/40">
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 flex gap-2">
        {(order.status === "pending" || order.status === "confirmed") && (
          <>
            <button onClick={onPrepare} disabled={updating === order.id}
              className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors disabled:opacity-50">
              {updating === order.id ? "..." : isFashion ? "📦 Mulai Packing" : "🍳 Mulai Masak"}
            </button>
            {onCancel && (
              <button onClick={onCancel} disabled={updating === order.id}
                className="py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors disabled:opacity-50">
                Tolak
              </button>
            )}
          </>
        )}
        {order.status === "preparing" && (
          <button onClick={onReady} disabled={updating === order.id}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors disabled:opacity-50">
            {updating === order.id ? "..." : isFashion ? "✓ Siap Dikirim" : "✓ Siap Disajikan"}
          </button>
        )}
      </div>
    </div>
  );
}
