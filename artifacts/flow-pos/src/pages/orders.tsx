import { useState, useEffect, useRef } from "react";
import { Search, Eye, X, ClipboardList, Download, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatRp(v: number) {
  return `Rp ${v.toLocaleString("id-ID")}`;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" },
  confirmed: { label: "Dikonfirmasi", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" },
  preparing: { label: "Diproses", cls: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800" },
  ready: { label: "Siap", cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  on_delivery: { label: "Dikirim", cls: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800" },
  completed: { label: "Selesai", cls: "bg-gray-100 text-gray-650 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
  refunded: { label: "Refund", cls: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800" },
};

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  dine_in: { label: "Dine In", cls: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-850" },
  take_away: { label: "Take Away", cls: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-850" },
  delivery: { label: "Delivery", cls: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-850" },
};

function getPaymentDetails(order: any) {
  if (order.paymentMethod === "cash" && order.orderType === "delivery") {
    return { label: "Delivery Cash", cls: "bg-purple-50 text-purple-600 border-purple-250 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-850" };
  }
  switch (order.paymentMethod) {
    case "cash":
    case "cashier":
      return { label: "Cash at Cashier", cls: "bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-850" };
    case "qris":
    case "ewallet":
      return { label: "QRIS / e-Wallet", cls: "bg-blue-50 text-blue-600 border-blue-250 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-850" };
    case "bank_transfer":
      return { label: "Bank Transfer", cls: "bg-indigo-50 text-indigo-600 border-indigo-250 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-850" };
    default:
      return { label: order.paymentMethod, cls: "bg-gray-50 text-gray-600 border-gray-250 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" };
  }
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  
  const diff = (Date.now() - date.getTime()) / 1000;
  let relativeStr = "";
  if (diff < 60) relativeStr = "just now";
  else if (diff < 3600) relativeStr = `about ${Math.floor(diff / 60)} minutes ago`;
  else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    relativeStr = `about ${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(diff / 86400);
    relativeStr = `about ${days} day${days > 1 ? "s" : ""} ago`;
  }
  return { dateStr, relativeStr };
}

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("flow_token") ?? "";

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${BASE}/api/tenant/customer-orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        console.error("Failed to fetch order detail:", err);
      }
      setLoading(false);
    };
    fetchDetail();
  }, [id]);

  const handleDownloadReceipt = () => {
    if (!order) return;

    // Create dynamic canvas for print struk
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calculate receipt height dynamically
    const headerH = 135;
    const metaH = 150 + (order.orderType === "delivery" && order.deliveryAddress ? 25 : 0) + (order.orderType === "dine_in" && order.tableNumber ? 25 : 0);
    const itemsH = (order.items || []).length * 40 + (order.items || []).filter((i: any) => i.variantSelection).length * 18;
    const totalsH = 110;
    const footerH = 80;
    canvas.width = 400;
    canvas.height = headerH + metaH + itemsH + totalsH + footerH;

    // Render receipt background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";

    // Store / Brand name
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillText((user as any)?.tenantName || user?.branchName || "FreshMood", canvas.width / 2, 45);

    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText("Struk Pembelian", canvas.width / 2, 75);
    
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`Order #${order.id}`, canvas.width / 2, 98);

    ctx.textAlign = "left";
    const divider = "------------------------------------------";
    ctx.fillText(divider, 20, 125);

    // Metadata lines
    let y = 150;
    const drawRow = (label: string, value: string) => {
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText(label, 25, y);
      ctx.textAlign = "right";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText(value, canvas.width - 25, y);
      ctx.textAlign = "left";
      y += 25;
    };

    const formattedDate = new Date(order.createdAt).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    drawRow("Tanggal", formattedDate);
    drawRow("Tipe", order.orderType === "dine_in" ? "Dine In" : order.orderType === "take_away" ? "Take Away" : "Delivery");
    
    if (order.orderType === "delivery" && order.deliveryAddress) {
      drawRow("Alamat", order.deliveryAddress);
    } else if (order.orderType === "dine_in" && order.tableNumber) {
      drawRow("Meja", order.tableNumber);
    }
    
    drawRow("Nama", order.customerName || "-");
    drawRow("Pembayaran", getPaymentDetails(order).label);
    drawRow("Kasir", order.employeeName || "seren");

    ctx.fillStyle = "#000000";
    ctx.fillText(divider, 20, y);
    y += 25;

    // Items Section
    (order.items || []).forEach((item: any) => {
      ctx.font = "bold 14px 'Courier New', monospace";
      
      // Quantity highlight
      ctx.fillStyle = "#d97706"; 
      ctx.fillText(`${item.quantity}x`, 25, y);
      
      ctx.fillStyle = "#000000";
      ctx.fillText(`  ${item.productName}`, 25, y);

      ctx.textAlign = "right";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText(formatRp(Number(item.subtotal)), canvas.width - 25, y);
      
      ctx.textAlign = "left";
      y += 25;

      if (item.variantSelection) {
        ctx.font = "11px 'Courier New', monospace";
        ctx.fillStyle = "#555555";
        ctx.fillText(`   ${item.variantSelection}`, 25, y);
        y += 18;
      }
    });

    // Divider
    ctx.fillStyle = "#000000";
    ctx.fillText(divider, 20, y);
    y += 25;

    // Totals
    const drawTotalRow = (label: string, value: string, isBold = false) => {
      ctx.font = isBold ? "bold 16px 'Courier New', monospace" : "14px 'Courier New', monospace";
      ctx.fillText(label, 25, y);
      ctx.textAlign = "right";
      ctx.fillText(value, canvas.width - 25, y);
      ctx.textAlign = "left";
      y += 25;
    };

    drawTotalRow("Subtotal", formatRp(Number(order.subtotal)));
    if ((Number(order.deliveryFee) || 0) > 0) {
      drawTotalRow("Delivery Fee", formatRp(Number(order.deliveryFee)));
    }
    if ((Number(order.discount) || 0) > 0) {
      drawTotalRow("Diskon", `-${formatRp(Number(order.discount))}`);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(20, y - 5);
    ctx.lineTo(canvas.width - 20, y - 5);
    ctx.stroke();

    drawTotalRow("TOTAL", formatRp(Number(order.total)), true);

    ctx.fillText(divider, 20, y);
    y += 25;

    // Footer lines
    ctx.textAlign = "center";
    ctx.font = "italic 13px 'Courier New', monospace";
    ctx.fillText(`Terima kasih telah memesan di ${(user as any)?.tenantName || user?.branchName || "FreshMood"}!`, canvas.width / 2, y);
    y += 20;
    ctx.fillText("Selamat menikmati 🍽️", canvas.width / 2, y);

    // Trigger image download
    const brandName = (user as any)?.tenantName || user?.branchName || "FreshMood";
    let tenantCode = "FM";
    if (brandName) {
      const lower = brandName.toLowerCase();
      if (lower.includes("freshmood") || lower.includes("fresh mood")) {
        tenantCode = "FM";
      } else {
        const words = brandName.trim().split(/\s+/);
        if (words.length >= 2) {
          tenantCode = (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        } else {
          tenantCode = brandName.slice(0, 2).toUpperCase();
        }
      }
    }
    const filename = `${tenantCode}${order.id}.jpg`;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.style.display = "none";
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }, "image/jpeg", 0.95);
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-muted-foreground shadow-2xl">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span className="font-semibold text-sm">Memuat detail pesanan...</span>
      </div>
    </div>
  );

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-extrabold text-lg text-foreground">Order #{order.id}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm pb-5 border-b border-border/80">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Customer</div>
                <div className="font-bold text-foreground text-base leading-snug">{order.customerName || "-"}</div>
              </div>
              
              {order.orderType === "delivery" && order.deliveryAddress && (
                <div>
                  <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Alamat Pengiriman</div>
                  <div className="font-medium text-foreground leading-relaxed">{order.deliveryAddress}</div>
                </div>
              )}
              {order.orderType === "dine_in" && order.tableNumber && (
                <div>
                  <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Nomor Meja</div>
                  <div className="font-bold text-foreground text-sm">{order.tableNumber}</div>
                </div>
              )}
              
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Status</div>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_MAP[order.status]?.cls || "bg-gray-150 text-gray-700 border-gray-200"}`}>
                  {STATUS_MAP[order.status]?.label || order.status}
                </span>
              </div>
              
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Payment Method</div>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPaymentDetails(order).cls}`}>
                  {getPaymentDetails(order).label}
                </span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Tipe Pesanan</div>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TYPE_MAP[order.orderType]?.cls || "bg-gray-100 text-gray-650"}`}>
                  {TYPE_MAP[order.orderType]?.label || order.orderType}
                </span>
              </div>
              
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Date</div>
                <div className="font-semibold text-foreground leading-snug">
                  {new Date(order.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              
              <div>
                <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Kasir</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-bold text-foreground capitalize">{order.employeeName || "seren"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Order Items</div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {(order.items || []).map((item: any) => (
                <div key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-600 dark:text-amber-500">{item.quantity}x</span>
                      <span className="font-medium text-foreground">{item.productName}</span>
                    </div>
                    <span className="font-semibold text-foreground">{formatRp(Number(item.subtotal))}</span>
                  </div>
                  {item.variantSelection && (
                    <span className="text-[10px] text-muted-foreground pl-7 mt-0.5">{item.variantSelection}</span>
                  )}
                  {item.notes && (
                    <span className="text-xs text-amber-600 italic pl-7 mt-0.5">Catatan: {item.notes}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Section */}
          <div className="bg-muted/30 rounded-2xl p-4 space-y-2 border border-border/60">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRp(Number(order.subtotal))}</span>
            </div>
            {(Number(order.deliveryFee) || 0) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery Fee</span>
                <span>{formatRp(Number(order.deliveryFee))}</span>
              </div>
            )}
            {(Number(order.discount) || 0) > 0 && (
              <div className="flex justify-between text-sm text-red-500 font-medium">
                <span>Diskon</span>
                <span>-{formatRp(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary text-lg">{formatRp(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="p-4 border-t border-border bg-muted/20 flex gap-3">
          <button
            onClick={handleDownloadReceipt}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-card border border-border hover:bg-muted text-foreground hover:text-foreground font-bold text-sm rounded-xl active:scale-95 transition-all shadow-sm"
          >
            <Download size={16} /> Download Struk
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("flow_token") ?? "";

  const fetchOrders = async () => {
    setLoading(true);
    let url = `${BASE}/api/tenant/customer-orders?page=${page}&limit=20`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setOrders(d.data ?? []);
        setTotal(d.total ?? 0);
      }
    } catch (err) {
      console.error("Failed to load customer orders:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Debounce search a bit
    const handler = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(handler);
  }, [page, statusFilter, search]);

  return (
    <div className="p-6">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders History</h1>
          <p className="text-muted-foreground text-sm">{total} total transaksi</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by customer name or table..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground cursor-pointer"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-semibold text-sm">Memuat riwayat transaksi...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Order ID</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Tipe</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Payment</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Total</th>
                  <th className="text-center px-5 py-3.5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-16">
                      <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
                      <div className="font-semibold text-base">Belum ada transaksi</div>
                      <p className="text-xs text-muted-foreground mt-1">Selesaikan pesanan dari POS atau Online untuk melihat riwayat</p>
                    </td>
                  </tr>
                )}
                {orders.map(o => {
                  const { dateStr, relativeStr } = formatDateTime(o.createdAt);
                  return (
                    <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">#{o.id}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-sm">{dateStr}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">{relativeStr}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {o.orderType === "dine_in" && o.tableNumber ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground text-sm">{o.tableNumber}</span>
                            <span className="text-xs text-muted-foreground">{o.customerName || "-"}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">{o.customerName || "-"}</span>
                            {o.orderType === "delivery" && o.deliveryAddress && (
                              <span className="text-xs text-muted-foreground truncate max-w-[160px] mt-0.5">{o.deliveryAddress}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${TYPE_MAP[o.orderType]?.cls || "bg-gray-100"}`}>
                          {TYPE_MAP[o.orderType]?.label || o.orderType}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPaymentDetails(o).cls}`}>
                          {getPaymentDetails(o).label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_MAP[o.status]?.cls || "bg-gray-100"}`}>
                          {STATUS_MAP[o.status]?.label || o.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-extrabold text-foreground text-sm">{formatRp(Number(o.total))}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setViewId(o.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold active:scale-95 transition-all shadow-sm"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && total > 20 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowLeft size={16} /> Sebelumnya
          </button>
          <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            Halaman {page} dari {Math.ceil(total / 20) || 1}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= total}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            Selanjutnya <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Order Detail Modal */}
      {viewId && <OrderDetail id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}
