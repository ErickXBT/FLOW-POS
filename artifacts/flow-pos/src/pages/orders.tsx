import { useState, useEffect, useRef } from "react";
import { Search, Eye, X, ClipboardList, Download, ArrowLeft, ArrowRight, Trash2, RefreshCw, FileText, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { useListEmployees } from "@workspace/api-client-react";

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

function OrderDetail({ id, onClose, onVoidSuccess }: { id: number; onClose: () => void; onVoidSuccess?: () => void }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("flow_token") ?? "";

  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const submitVoid = async () => {
    if (!voidReason.trim()) return;
    try {
      const res = await fetch(`${BASE}/api/orders/${id}/void`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ voidReason })
      });
      if (res.ok) {
        alert("Transaksi berhasil divalidasi sebagai Void!");
        setShowVoidDialog(false);
        setVoidReason("");
        const data = await res.json();
        setOrder(data);
        if (onVoidSuccess) onVoidSuccess();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal void transaksi");
      }
    } catch (err) {
      console.error("Failed to void order:", err);
      alert("Gagal menghubungi server untuk void transaksi");
    }
  };

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

    // Helper for word wrap
    const wordWrap = (str: string, maxLength: number): string[] => {
      const words = str.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).trim().length <= maxLength) {
          currentLine = (currentLine + " " + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const formattedDate = new Date(order.createdAt).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const isFashion = user?.businessType === "fashion";
    const getOrderTypeLabel = (type: string) => {
      if (isFashion) {
        switch (type) {
          case "dine_in": return "Fitting Room";
          case "take_away": return "Ambil di Toko";
          case "delivery": return "Kirim Kurir";
          default: return type || "-";
        }
      } else {
        switch (type) {
          case "dine_in": return "Dine In";
          case "take_away": return "Take Away";
          case "delivery": return "Delivery";
          default: return type || "-";
        }
      }
    };

    // 1. Prepare Metadata Rows
    const metaRows = [
      { label: "Tanggal", value: formattedDate },
      { label: "Tipe", value: getOrderTypeLabel(order.orderType) }
    ];
    if (order.orderType === "delivery" && order.deliveryAddress) {
      metaRows.push({ label: "Alamat", value: order.deliveryAddress });
    } else if (order.orderType === "dine_in" && order.tableNumber) {
      metaRows.push({ label: isFashion ? "Fitting Room" : "Meja", value: order.tableNumber });
    }
    metaRows.push({ label: "Nama", value: order.customerName || "-" });
    metaRows.push({ label: "Pembayaran", value: getPaymentDetails(order).label });
    if (order.paymentMethod === "cash") {
      metaRows.push({ label: "Uang Diterima", value: formatRp(Number(order.cashReceived || 0)) });
      const change = Number(order.cashReceived || 0) - Number(order.total);
      metaRows.push({ label: "Kembalian", value: formatRp(change > 0 ? change : 0) });
    }
    metaRows.push({ label: "Kasir", value: order.employeeName || "Kasir Utama" });

    // Format Metadata Lines
    const formattedMetaLines: string[] = [];
    metaRows.forEach(row => {
      const paddedLabel = row.label.padEnd(10, " ");
      const prefix = `${paddedLabel} : `;
      const valLines = wordWrap(row.value, 29);
      valLines.forEach((line, idx) => {
        if (idx === 0) {
          formattedMetaLines.push(prefix + line);
        } else {
          formattedMetaLines.push("".padEnd(13, " ") + line);
        }
      });
    });

    // 2. Prepare Items
    const processedItems = (order.items || []).map((item: any) => {
      const nameLines = wordWrap(item.productName, 27);
      const varLines = item.variantSelection ? wordWrap(item.variantSelection, 45) : [];
      return { item, nameLines, varLines };
    });

    // 3. Calculate dynamic canvas height
    const headerH = 135;
    const divider1H = 20;
    const metaH = formattedMetaLines.length * 22;
    const divider2H = 20;
    
    let itemsH = 0;
    processedItems.forEach((pi: any) => {
      itemsH += pi.nameLines.length * 22;
      itemsH += pi.varLines.length * 16;
      itemsH += 8; // spacing between items
    });
    
    const divider3H = 20;
    
    // Totals calculations
    let totalsCount = 1; // TOTAL
    if (Number(order.subtotal) > 0) totalsCount++;
    if ((Number(order.deliveryFee) || 0) > 0) totalsCount++;
    if ((Number(order.discount) || 0) > 0) totalsCount++;
    const totalsH = totalsCount * 22 + 25; // separator line spacing
    
    const divider4H = 20;
    const footerH = 80;

    canvas.width = 400;
    canvas.height = headerH + divider1H + metaH + divider2H + itemsH + divider3H + totalsH + divider4H + footerH;

    // Render receipt background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";

    // Store / Brand name
    const brandName = (user as any)?.tenantName || user?.branchName || "FreshMood";
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillText(brandName, canvas.width / 2, 35);

    // Branch location
    const branchNameStr = order.branchName ? `Cabang: ${order.branchName}` : "";
    if (branchNameStr) {
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText(branchNameStr, canvas.width / 2, 55);
    }

    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText("Struk Pembelian", canvas.width / 2, 75);
    
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`Order #${order.id}`, canvas.width / 2, 100);

    ctx.textAlign = "left";
    const divider = "------------------------------------------";
    
    let y = 125;
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(divider, 20, y);
    y += 20;

    // Draw Metadata Lines
    formattedMetaLines.forEach(line => {
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText(line, 20, y);
      y += 22;
    });

    ctx.fillText(divider, 20, y);
    y += 20;

    // Draw Items
    processedItems.forEach((pi: any) => {
      ctx.font = "14px 'Courier New', monospace";
      
      // Quantity (orange/brown highlight)
      ctx.fillStyle = "#d97706";
      ctx.fillText(`${pi.item.quantity}x`, 20, y);
      
      // First line of product name
      ctx.fillStyle = "#000000";
      ctx.fillText(pi.nameLines[0], 50, y);

      // Price (right aligned)
      ctx.textAlign = "right";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText(formatRp(Number(pi.item.subtotal)), canvas.width - 20, y);
      ctx.textAlign = "left";
      y += 22;

      // Other lines of product name
      ctx.font = "14px 'Courier New', monospace";
      for (let i = 1; i < pi.nameLines.length; i++) {
        ctx.fillText(pi.nameLines[i], 50, y);
        y += 22;
      }

      // Variant selections
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = "#555555";
      pi.varLines.forEach((line: string) => {
        ctx.fillText(line, 50, y);
        y += 16;
      });
      ctx.fillStyle = "#000000";
      
      y += 8; // small space after item
    });

    // Divider
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(divider, 20, y);
    y += 20;

    // Totals
    const drawTotalRow = (label: string, value: string, isBold = false) => {
      ctx.font = isBold ? "bold 16px 'Courier New', monospace" : "14px 'Courier New', monospace";
      ctx.fillText(label, 20, y);
      ctx.textAlign = "right";
      ctx.fillText(value, canvas.width - 20, y);
      ctx.textAlign = "left";
      y += 22;
    };

    drawTotalRow("Subtotal", formatRp(Number(order.subtotal)));
    if ((Number(order.discount) || 0) > 0) {
      drawTotalRow("Diskon", `-${formatRp(Number(order.discount))}`);
    }
    if (Number(order.serviceCharge || 0) > 0) {
      drawTotalRow("Biaya Servis", formatRp(Number(order.serviceCharge)));
    }
    if (Number(order.tax || 0) > 0) {
      drawTotalRow("Pajak (PB1)", formatRp(Number(order.tax)));
    }
    if ((Number(order.deliveryFee) || 0) > 0) {
      drawTotalRow("Delivery Fee", formatRp(Number(order.deliveryFee)));
    }

    // Horizontal Separator Line before TOTAL
    y += 5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(canvas.width - 20, y);
    ctx.stroke();
    y += 20; // safe spacing after the line

    drawTotalRow("TOTAL", formatRp(Number(order.total)), true);

    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(divider, 20, y);
    y += 20;

    // Footer
    ctx.textAlign = "center";
    ctx.font = "italic 13px 'Courier New', monospace";
    ctx.fillText(`Terima kasih telah memesan di ${brandName}!`, canvas.width / 2, y);
    y += 20;
    ctx.fillText("Selamat menikmati 🍽️", canvas.width / 2, y);

    // Trigger image download
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
                <div className="font-bold text-foreground text-base leading-snug flex items-center gap-1.5 flex-wrap">
                  <span>{order.customerName || "-"}</span>
                  {order.isClaimReward && (
                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide flex items-center gap-0.5 animate-pulse">
                      🎁 Claim Reward
                    </span>
                  )}
                </div>
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
              
              {order.branchName && (
                <div>
                  <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider">Cabang</div>
                  <div className="font-bold text-foreground text-sm">{order.branchName}</div>
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
                  <span className="font-bold text-foreground capitalize">{order.employeeName || "Kasir Utama"}</span>
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
            {(Number(order.discount) || 0) > 0 && (
              <div className="flex justify-between text-sm text-red-500 font-medium">
                <span>Diskon</span>
                <span>-{formatRp(Number(order.discount))}</span>
              </div>
            )}
            {Number(order.serviceCharge || 0) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Biaya Servis</span>
                <span>{formatRp(Number(order.serviceCharge))}</span>
              </div>
            )}
            {Number(order.tax || 0) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pajak (PB1)</span>
                <span>{formatRp(Number(order.tax))}</span>
              </div>
            )}
            {(Number(order.deliveryFee) || 0) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery Fee</span>
                <span>{formatRp(Number(order.deliveryFee))}</span>
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
          {(() => {
            const canVoid = user?.role === "owner" || user?.role === "manager" || (user as any)?.role === "super_admin";
            const isNotVoided = order.status !== "void" && order.status !== "cancelled" && order.status !== "refunded";
            if (canVoid && isNotVoided) {
              return (
                <button
                  onClick={() => setShowVoidDialog(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-sm rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  <Trash2 size={16} /> Void Transaksi
                </button>
              );
            }
            return null;
          })()}
        </div>

        {/* Confirm Void Dialog Overlay */}
        {showVoidDialog && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-6 z-50 rounded-2xl">
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                ⚠️ Konfirmasi Void Transaksi
              </h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Void transaksi ini akan menghapus omset dari sistem dan mencatat sebab pembatalan pada log aktivitas.
              </p>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  Sebab Void (Alasan Pembatalan)
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah input item, Pelanggan membatalkan pesanan, dll..."
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-xl text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowVoidDialog(false);
                    setVoidReason("");
                  }}
                  className="flex-1 py-2 border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={submitVoid}
                  disabled={!voidReason.trim()}
                  className="flex-1 py-2 bg-destructive text-destructive-foreground font-bold text-xs rounded-xl hover:opacity-90 transition-all disabled:opacity-40"
                >
                  Void Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { activeBranchId, branches } = useActiveBranch();
  const { data: employees } = useListEmployees();

  const [search, setSearch] = useState("");
  const [branchIdFilter, setBranchIdFilter] = useState("");
  const [cashierIdFilter, setCashierIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // Status Bayar
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(""); // Metode Bayar
  const [promoFilter, setPromoFilter] = useState(""); // Promo (semua, reward)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
    
    const targetBranch = branchIdFilter || activeBranchId || "";
    if (targetBranch) url += `&branchId=${targetBranch}`;

    if (cashierIdFilter) url += `&employeeId=${cashierIdFilter}`;
    if (paymentMethodFilter) url += `&paymentMethod=${paymentMethodFilter}`;
    if (promoFilter === "reward") url += `&isClaimReward=true`;
    if (promoFilter === "non_reward") url += `&isClaimReward=false`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    
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
    const handler = setTimeout(() => {
      fetchOrders();
    }, 250);
    return () => clearTimeout(handler);
  }, [page, statusFilter, search, branchIdFilter, cashierIdFilter, paymentMethodFilter, promoFilter, startDate, endDate, activeBranchId]);

  const handleReset = () => {
    setSearch("");
    setBranchIdFilter("");
    setCashierIdFilter("");
    setStatusFilter("");
    setPaymentMethodFilter("");
    setPromoFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleQuickRange = (range: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (range === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (range === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split("T")[0]);
      setEndDate(today);
    }
    setPage(1);
  };

  return (
    <div className="p-6">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders History</h1>
          <p className="text-muted-foreground text-sm">{total} total transaksi</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Cari Nota */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Cari Nota</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nomor Nota..."
                className="w-full pl-8 pr-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Outlet */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Outlet</label>
            <select
              value={branchIdFilter}
              onChange={e => {
                setBranchIdFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
            >
              <option value="">Semua Outlet</option>
              {(branches || []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Kasir */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Kasir</label>
            <select
              value={cashierIdFilter}
              onChange={e => {
                setCashierIdFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
            >
              <option value="">Semua Kasir</option>
              {(employees || []).filter((emp: any) => emp.role === "cashier" || emp.role === "owner" || emp.role === "manager").map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Status Bayar */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Status Bayar</label>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
            >
              <option value="">Semua Status</option>
              <option value="completed">Selesai (Lunas)</option>
              <option value="pending">Menunggu</option>
              <option value="preparing">Diproses</option>
              <option value="ready">Siap</option>
              <option value="on_delivery">Dikirim</option>
              <option value="cancelled">Dibatalkan</option>
              <option value="refunded">Refund</option>
              <option value="void">Void</option>
            </select>
          </div>

          {/* Metode Bayar */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Metode Bayar</label>
            <select
              value={paymentMethodFilter}
              onChange={e => {
                setPaymentMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
            >
              <option value="">Semua Metode</option>
              <option value="cash">Cash / Tunai</option>
              <option value="qris">QRIS</option>
              <option value="bank_transfer">Transfer Bank</option>
              <option value="ewallet">e-Wallet</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          {/* Rentang Tanggal */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Rentang Tanggal</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
                />
                <span className="text-xs text-muted-foreground">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
                />
              </div>
            </div>

            {/* Quick selectors */}
            <div className="flex items-center gap-1.5 mb-[1px]">
              <button
                type="button"
                onClick={() => handleQuickRange("today")}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-bold rounded-xl transition-all shadow-xs"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("7days")}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-bold rounded-xl transition-all shadow-xs"
              >
                7 Hari
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Promo Selector */}
            <div className="space-y-1 min-w-[130px]">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Promo</label>
              <select
                value={promoFilter}
                onChange={e => {
                  setPromoFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 border border-input bg-background rounded-xl text-xs focus:outline-none text-foreground"
              >
                <option value="">Semua Transaksi</option>
                <option value="reward">Klaim Reward POIN</option>
                <option value="non_reward">Biasa (Non-Reward)</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-[1px]">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={fetchOrders}
                className="p-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
                title="Muat Ulang Data"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-primary" : "text-foreground"} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-semibold text-sm">Memuat riwayat transaksi...</span>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{o.customerName || "-"}</span>
                                {o.isClaimReward && (
                                  <span className="text-[9px] font-black bg-amber-100 text-amber-805 px-1.5 py-0.2 rounded border border-amber-200 uppercase tracking-wide">
                                    REWARD
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <div className="font-semibold text-foreground text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{o.customerName || "-"}</span>
                                {o.isClaimReward && (
                                  <span className="text-[9px] font-black bg-amber-100 text-amber-805 px-1.5 py-0.2 rounded border border-amber-200 uppercase tracking-wide">
                                    REWARD
                                  </span>
                                )}
                              </div>
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

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-3 p-3">
              {orders.length === 0 && (
                <div className="text-center text-muted-foreground py-16 bg-card rounded-2xl">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
                  <div className="font-semibold text-base">Belum ada transaksi</div>
                  <p className="text-xs text-muted-foreground mt-1">Selesaikan pesanan dari POS atau Online untuk melihat riwayat</p>
                </div>
              )}
              {orders.map(o => {
                const { dateStr, relativeStr } = formatDateTime(o.createdAt);
                const paymentInfo = getPaymentDetails(o);
                
                return (
                  <div 
                    key={o.id}
                    onClick={() => setViewId(o.id)}
                    className="bg-card border border-card-border rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer space-y-3"
                  >
                    {/* Header: ID & Time */}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-foreground">#{o.id}</span>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-foreground block">{dateStr}</span>
                        <span className="text-[10px] text-muted-foreground">{relativeStr}</span>
                      </div>
                    </div>

                    {/* Middle: Customer & Type Info */}
                    <div className="flex justify-between items-center gap-2 pt-1">
                      <div className="min-w-0">
                        {o.orderType === "dine_in" && o.tableNumber ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded text-foreground">
                              {o.tableNumber}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{o.customerName || "-"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground truncate">{o.customerName || "-"}</span>
                            {o.isClaimReward && (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200 uppercase tracking-wide">
                                REWARD
                              </span>
                            )}
                          </div>
                        )}
                        {o.orderType === "delivery" && o.deliveryAddress && (
                          <p className="text-[10px] text-muted-foreground truncate mt-1 max-w-[200px]">{o.deliveryAddress}</p>
                        )}
                      </div>

                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_MAP[o.orderType]?.cls || "bg-gray-100"}`}>
                          {TYPE_MAP[o.orderType]?.label || o.orderType}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${paymentInfo.cls}`}>
                          {paymentInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Status & Total */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-border/40">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_MAP[o.status]?.cls || "bg-gray-100"}`}>
                        {STATUS_MAP[o.status]?.label || o.status}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-primary text-sm">{formatRp(Number(o.total))}</span>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
      {viewId && <OrderDetail id={viewId} onClose={() => setViewId(null)} onVoidSuccess={fetchOrders} />}
    </div>
  );
}
