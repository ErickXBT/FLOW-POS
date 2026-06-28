import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "wouter";
import {
  ShoppingCart, Plus, Minus, Trash2, X, ChevronRight, MapPin,
  Phone, User, FileText, CheckCircle2, Clock, ChefHat,
  Package, Truck, Star, Search, ArrowLeft, QrCode, Sparkles,
  Map, DollarSign, CreditCard, Bell, Info, Download, ClipboardList, LogOut
} from "lucide-react";
import QRCode from "qrcode";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TenantInfo {
  id: number; name: string; slug: string; businessType: string;
  address: string | null; phone: string | null; logoUrl: string | null;
  primaryColor: string; bannerUrl: string | null;
  coverUrl: string | null; bio: string | null;
  enableDineIn: boolean; enableTakeAway: boolean; enableDelivery: boolean;
  enableCash: boolean; enableQris: boolean; enableBankTransfer: boolean; enableEwallet: boolean;
  deliveryFeeNear?: number; deliveryFeeFar?: number;
  showVariants?: boolean; showToppings?: boolean;
  enableCustomerLogin?: boolean;
  pointSystemConfig?: any;
  enableTax?: boolean;
  taxPercentage?: number;
  qrisId?: string | null;
  qrisImageUrl?: string | null;
  showDeliveryInfo?: boolean;
  estimatedDeliveryTime?: string | null;
  enableOpsHours?: boolean;
  opsOpeningTime?: string | null;
  opsClosingTime?: string | null;
}

interface BranchInfo {
  id: number;
  name: string;
}

interface PublicMenuInfo {
  id: number;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  themeSettings: string | null;
  enableDineIn: boolean;
  enableTakeAway: boolean;
  enableDelivery: boolean;
  estimatedDeliveryTime: string | null;
  isActive: boolean;
}

interface Product {
  id: number;
  productId: number;
  name: string;
  description: string | null;
  price: number;
  promoPrice: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  stock: number;
  variantSettings: string | null;
  publicMenuCategoryId: number | null;
  isBestSeller?: boolean;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface CartItem {
  id: string; // unique cart item id (productId + variants hash)
  product: Product;
  quantity: number;
  notes: string;
  selectedVariant: string;
  selectedToppings: string[];
  totalPrice: number;
}

const STATUS_STEPS: Record<string, { label: string; icon: any; step: number }> = {
  pending:     { label: "Menunggu Konfirmasi", icon: Clock, step: 1 },
  confirmed:   { label: "Pesanan Dikonfirmasi", icon: CheckCircle2, step: 2 },
  preparing:   { label: "Sedang Diproses Dapur", icon: ChefHat, step: 3 },
  ready:       { label: "Siap Diambil/Disajikan", icon: Package, step: 4 },
  on_delivery: { label: "Dalam Pengiriman", icon: Truck, step: 5 },
  completed:   { label: "Pesanan Selesai", icon: Star, step: 6 },
  cancelled:   { label: "Pesanan Dibatalkan", icon: X, step: 0 },
};

const PAY_LABELS: Record<string, string> = {
  cash: "Tunai / Cash on Delivery",
  cashier: "Bayar di Kasir",
  qris: "QRIS",
  bank_transfer: "Transfer Bank",
  ewallet: "E-Wallet",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Makan di Tempat (Dine In)",
  take_away: "Bawa Pulang (Take Away)",
  delivery: "Antar ke Alamat (Delivery)",
};

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

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

const loadLeaflet = (cb: () => void) => {
  if ((window as any).L) {
    cb();
    return;
  }
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload = () => {
    cb();
  };
  document.body.appendChild(script);
};

function QrisCanvas({ payload, primary }: { payload: string; primary: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && payload) {
      QRCode.toCanvas(
        canvasRef.current,
        payload,
        {
          width: 192,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation failed:", error);
        }
      );
    }
  }, [payload]);

  return (
    <div className="w-48 h-48 border rounded-2xl overflow-hidden bg-white p-2 flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
}

// ── Tracking View Component ──────────────────────────────────────────────────
function TrackingView({
  orderId,
  slug,
  primary,
  onBack,
  isFashion,
  tenantName,
  branchName,
  qrisId,
  qrisImageUrl
}: {
  orderId: number;
  slug: string;
  primary: string;
  onBack: () => void;
  isFashion: boolean;
  tenantName: string;
  branchName: string;
  qrisId?: string | null;
  qrisImageUrl?: string | null;
}) {
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
    
    // Get Payment Method Label
    let paymentLabel = order.paymentMethod;
    if (order.paymentMethod === "cash" && order.orderType === "delivery") {
      paymentLabel = "Delivery Cash";
    } else {
      switch (order.paymentMethod) {
        case "cash":
        case "cashier":
          paymentLabel = "Cash at Cashier";
          break;
        case "qris":
        case "ewallet":
          paymentLabel = "QRIS / e-Wallet";
          break;
        case "bank_transfer":
          paymentLabel = "Bank Transfer";
          break;
      }
    }
    
    metaRows.push({ label: "Pembayaran", value: paymentLabel });
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
    const brandName = tenantName || "FreshMood";
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillText(brandName, canvas.width / 2, 35);

    // Branch location
    const branchNameStr = order.branchName || branchName || "";
    if (branchNameStr) {
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText(`Cabang: ${branchNameStr}`, canvas.width / 2, 55);
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
    if ((Number(order.deliveryFee) || 0) > 0) {
      drawTotalRow("Delivery Fee", formatRp(Number(order.deliveryFee)));
    }
    if ((Number(order.discount) || 0) > 0) {
      drawTotalRow("Diskon", `-${formatRp(Number(order.discount))}`);
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

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center bg-white p-6 rounded-3xl shadow-sm border max-w-sm">
        <div className="text-5xl mb-4">😕</div>
        <div className="text-gray-800 font-bold mb-2">Error</div>
        <div className="text-gray-500 text-sm mb-6">{error}</div>
        <button onClick={onBack} className="w-full py-3 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: primary }}>
          Kembali ke Menu
        </button>
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: primary }} />
    </div>
  );

  const statusSteps = isFashion ? {
    pending:     { label: "Menunggu Konfirmasi", icon: Clock, step: 1 },
    confirmed:   { label: "Pesanan Dikonfirmasi", icon: CheckCircle2, step: 2 },
    preparing:   { label: "Sedang Dipacking", icon: Package, step: 3 },
    ready:       { label: "Siap Dikirim/Diambil", icon: Package, step: 4 },
    on_delivery: { label: "Dalam Pengiriman", icon: Truck, step: 5 },
    completed:   { label: "Pesanan Selesai", icon: Star, step: 6 },
    cancelled:   { label: "Pesanan Dibatalkan", icon: X, step: 0 },
  } : STATUS_STEPS;

  const displayOrderTypeLabels = isFashion ? {
    dine_in: "Coba di Fitting Room (Dine In)",
    take_away: "Ambil di Toko (Pick Up)",
    delivery: "Antar ke Alamat (Delivery)",
  } : ORDER_TYPE_LABELS;

  const curr = (statusSteps as any)[order.status];
  const steps = ["confirmed", "preparing", "ready", order.orderType === "delivery" ? "on_delivery" : null, "completed"].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="p-1 text-gray-500 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
        <div>
          <div className="font-bold text-sm text-gray-900">Pelacakan Pesanan</div>
          <div className="text-xs font-mono text-gray-400">{order.orderNumber}</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Status Card */}
        <div className="rounded-3xl p-6 text-white text-center shadow-lg transition-all" style={{ background: order.status === "cancelled" ? "#ef4444" : `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
          {curr && <curr.icon className="mx-auto mb-3 animate-pulse" size={40} />}
          <div className="text-xl font-black">{curr?.label ?? order.status.toUpperCase()}</div>
          <div className="text-xs opacity-90 mt-1.5 bg-white/20 inline-block px-3 py-1 rounded-full font-bold">
            {displayOrderTypeLabels[order.orderType] ?? order.orderType}
          </div>
        </div>

        {/* Steps Progress */}
        {order.status !== "cancelled" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Status Alur Kerja</div>
            <div className="relative flex justify-between items-center">
              {steps.map((s, i) => {
                const step = (statusSteps as any)[s];
                const done = (curr?.step ?? 0) >= (step?.step ?? 0);
                return (
                  <div key={s} className="flex flex-col items-center gap-1.5 flex-1 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${done ? "text-white shadow-md shadow-primary/20" : "bg-gray-100 text-gray-300"}`}
                      style={done ? { backgroundColor: primary } : {}}>
                      {i + 1}
                    </div>
                    <div className={`text-[10px] text-center leading-tight font-semibold ${done ? "text-gray-800" : "text-gray-300"}`}>
                      {step?.label.split(" ")[0]}
                    </div>
                  </div>
                );
              })}
              {/* Progress Line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 -z-10" />
            </div>
          </div>
        )}

        {/* Delivery / Address Progress */}
        {order.orderType === "delivery" && order.deliveryAddress && (
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Truck size={16} style={{ color: primary }} /> Informasi Pengantaran
            </div>
            <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-3 rounded-2xl">
              <div>
                <span className="font-semibold block text-gray-800">Alamat Tujuan:</span>
                {order.deliveryAddress}
              </div>
              {order.deliveryNotes && (
                <div>
                  <span className="font-semibold block text-gray-800">Catatan Kurir:</span>
                  <span className="italic text-gray-500">"{order.deliveryNotes}"</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QRIS Payment Instruction Card */}
        {order.paymentMethod === "qris" && order.status !== "completed" && order.status !== "cancelled" && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border flex flex-col items-center text-center space-y-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 justify-center">
              <QrCode size={14} style={{ color: primary }} /> Pembayaran QRIS Mandiri
            </div>
            <div className="font-semibold text-xs text-gray-600">
              Silakan pindai/scan kode QRIS di bawah ini untuk menyelesaikan pembayaran:
            </div>
            
            {qrisImageUrl ? (
              <div className="w-48 h-48 border rounded-2xl overflow-hidden bg-white p-2 flex items-center justify-center shadow-inner">
                <img src={qrisImageUrl} alt="QRIS" className="w-full h-full object-contain" />
              </div>
            ) : qrisId ? (
              <QrisCanvas payload={qrisId} primary={primary} />
            ) : (
              <div className="w-48 h-48 border rounded-2xl overflow-hidden bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                <QrCode size={36} className="text-gray-300 mb-2" />
                <span className="text-[10px] text-gray-400 font-semibold leading-tight">QRIS belum diset oleh penjual</span>
              </div>
            )}
            
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded-2xl px-4 py-2.5 font-medium leading-relaxed">
              Setelah pembayaran selesai dilakukan, silakan tunggu konfirmasi status pesanan di atas oleh kasir/penjual.
            </div>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
          <div className="font-bold text-gray-900 text-sm">Rincian Transaksi</div>
          <div className="text-xs text-gray-500 space-y-2 border-b pb-3">
            <div className="flex justify-between"><span>Nama Pelanggan</span><span className="font-bold text-gray-800">{order.customerName}</span></div>
            {order.customerPhone && <div className="flex justify-between"><span>Nomor Telepon</span><span className="font-bold text-gray-800">{order.customerPhone}</span></div>}
            {order.tableNumber && <div className="flex justify-between"><span>{isFashion ? "Fitting Room / Area" : "Nomor Meja"}</span><span className="font-bold text-gray-800">{isFashion ? "Fitting Room" : "Meja"} #{order.tableNumber}</span></div>}
            <div className="flex justify-between"><span>Metode Pembayaran</span><span className="font-bold text-gray-800">{PAY_LABELS[order.paymentMethod] ?? order.paymentMethod}</span></div>
            {(order.branchName || branchName) && <div className="flex justify-between"><span>Cabang / Lokasi</span><span className="font-bold text-gray-800">{order.branchName || branchName}</span></div>}
          </div>
          <div className="space-y-3">
            {order.items?.map((item: any) => (
              <div key={item.id} className="text-xs">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>{item.productName} <span className="text-gray-400 font-normal">×{item.quantity}</span></span>
                  <span>{formatRp(item.subtotal)}</span>
                </div>
                {item.variantSelection && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {item.variantSelection}
                  </div>
                )}
                {item.notes && <div className="text-[10px] text-amber-600 mt-0.5 italic">"Catatan: {item.notes}"</div>}
              </div>
            ))}
            {Number(order.deliveryFee) > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Ongkos Kirim</span>
                <span>{formatRp(Number(order.deliveryFee))}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-3 border-t">
              <span>Total Bayar</span>
              <span style={{ color: primary }}>{formatRp(Number(order.total))}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDownloadReceipt}
          className="w-full flex items-center justify-center gap-2 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md hover:opacity-95 transition-opacity mb-3"
          style={{ backgroundColor: primary }}
        >
          <Download size={16} /> Download Struk
        </button>

        <button onClick={onBack} className="w-full bg-white border border-gray-200 py-3.5 rounded-2xl text-gray-700 font-bold text-sm shadow-sm hover:bg-gray-50 transition-colors">
          Kembali Belanja
        </button>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function CustomerMenuPage({ slug: slugProp }: { slug?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const slug = slugProp ?? params.slug;

  const [loading, setLoading] = useState(true);
  const [deliveryDistance, setDeliveryDistance] = useState<"near" | "far">("near");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const handleConfirmLocation = async () => {
    if (!tempCoords) return;
    const { lat, lng } = tempCoords;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    setForm(f => ({ ...f, googleMapsLocation: mapsUrl }));

    setGeocoding(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { "Accept-Language": "id-ID,id;q=0.9,en;q=0.8" }
      });
      if (r.ok) {
        const d = await r.json();
        if (d.display_name) {
          setForm(f => ({ ...f, deliveryAddress: d.display_name }));
        }
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    } finally {
      setGeocoding(false);
      setMapModalOpen(false);
    }
  };

  useEffect(() => {
    if (!mapModalOpen) return;

    loadLeaflet(() => {
      const L = (window as any).L;
      if (!L) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      let defaultLat = -6.2088;
      let defaultLng = 106.8456;
      let zoom = 12;

      const map = L.map("leaflet-map").setView([defaultLat, defaultLng], zoom);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
      markerInstanceRef.current = marker;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 16);
          marker.setLatLng([latitude, longitude]);
          setTempCoords({ lat: latitude, lng: longitude });
        }, () => {
          // Geolocation failed
        });
      }

      const updatePosition = (lat: number, lng: number) => {
        marker.setLatLng([lat, lng]);
        setTempCoords({ lat, lng });
      };

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        updatePosition(pos.lat, pos.lng);
      });

      map.on("click", (e: any) => {
        updatePosition(e.latlng.lat, e.latlng.lng);
      });

      setTempCoords({ lat: defaultLat, lng: defaultLng });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapModalOpen]);
  const [error, setError] = useState("");
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [menu, setMenu] = useState<PublicMenuInfo | null>(null);

  const isStoreOpen = useMemo(() => {
    if (!tenant) return true;
    if (!tenant.enableOpsHours) return true;
    if (!tenant.opsOpeningTime || !tenant.opsClosingTime) return true;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotal = currentHours * 60 + currentMinutes;

    const [openH, openM] = tenant.opsOpeningTime.split(":").map(Number);
    const openTotal = openH * 60 + openM;

    const [closeH, closeM] = tenant.opsClosingTime.split(":").map(Number);
    const closeTotal = closeH * 60 + closeM;

    if (openTotal <= closeTotal) {
      return currentTotal >= openTotal && currentTotal <= closeTotal;
    } else {
      return currentTotal >= openTotal || currentTotal <= closeTotal;
    }
  }, [tenant]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [promoBanners, setPromoBanners] = useState<any[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "order-type" | "form" | "success">("menu");
  const [trackingId, setTrackingId] = useState<number | null>(null);

  // Order history and tracking states
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Selected product for detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVariant, setModalVariant] = useState("");
  const [modalToppings, setModalToppings] = useState<string[]>([]);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState("");
  const [modalVariantsList, setModalVariantsList] = useState<{ name: string; price: number }[]>([]);
  const [modalToppingsList, setModalToppingsList] = useState<{ name: string; price: number }[]>([]);

  const allBanners = useMemo(() => {
    const list = promoBanners.filter((b: any) => b.showInCustomerMenu !== false);
    products.forEach((p: any) => {
      if (p.variantSettings) {
        try {
          const parsed = JSON.parse(p.variantSettings);
          if (parsed.isBundle && parsed.bannerImageUrl && parsed.showInCustomerMenu !== false) {
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

  const activeOrders = useMemo(() => {
    return customerOrders.filter(o => o.status !== "completed" && o.status !== "cancelled");
  }, [customerOrders]);

  // Checkout inputs
  const [orderType, setOrderType] = useState("dine_in");
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    tableNumber: "",
    deliveryAddress: "",
    deliveryNotes: "",
    googleMapsLocation: ""
  });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Session state
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);

  // Customer Auth States
  const [customer, setCustomer] = useState<any>(null);
  const hasPointDiscount = customer?.claimedDiscountActive === true;

  const isProductDrink = (p: Product) => {
    if (p.publicMenuCategoryId && categories.length > 0) {
      const cat = categories.find(c => c.id === p.publicMenuCategoryId);
      if (cat) {
        const catName = cat.name.toLowerCase();
        if (catName.includes("minuman") || catName.includes("drink") || catName.includes("beverage") || catName.includes("coffee") || catName.includes("tea") || catName.includes("kopi")) {
          return true;
        }
      }
    }
    const name = p.name.toLowerCase();
    if (/toast|roti|bakar/i.test(name)) return false;
    return /kopi|teh|tea|latte|americano|cappuccino|jus|juice|es |drink|beverage|coffee/i.test(name);
  };

  const isProductToast = (p: Product) => {
    if (p.publicMenuCategoryId && categories.length > 0) {
      const cat = categories.find(c => c.id === p.publicMenuCategoryId);
      if (cat) {
        const catName = cat.name.toLowerCase();
        if (catName.includes("toast") || catName.includes("roti") || catName.includes("bakar")) {
          return true;
        }
      }
    }
    const name = p.name.toLowerCase();
    return /toast|roti|bakar/i.test(name);
  };

  const isProductDrinkOrToast = (p: Product) => {
    return isProductDrink(p) || isProductToast(p);
  };

  const getGrandRewardDiscountBreakdown = (cartItems: CartItem[]) => {
    let drinks: { cartItemId: string; basePrice: number }[] = [];
    let toasts: { cartItemId: string; basePrice: number }[] = [];

    cartItems.forEach((c) => {
      const basePrice = c.product.promoPrice ?? c.product.price;
      if (isProductDrink(c.product)) {
        for (let q = 0; q < c.quantity; q++) {
          drinks.push({ cartItemId: c.id, basePrice });
        }
      } else if (isProductToast(c.product)) {
        for (let q = 0; q < c.quantity; q++) {
          toasts.push({ cartItemId: c.id, basePrice });
        }
      }
    });

    drinks.sort((a, b) => b.basePrice - a.basePrice);
    toasts.sort((a, b) => b.basePrice - a.basePrice);

    const freeDrinkItem = drinks.length > 0 ? drinks[0] : null;
    const freeToastItem = toasts.length > 0 ? toasts[0] : null;

    return {
      freeDrinkItem,
      freeToastItem,
      totalDiscount: (freeDrinkItem?.basePrice || 0) + (freeToastItem?.basePrice || 0)
    };
  };

  const getCartItemPriceLabel = (c: CartItem) => {
    if (customer?.activeReward === "grand_reward") {
      const breakdown = getGrandRewardDiscountBreakdown(cart);
      let freeQty = 0;
      if (breakdown.freeDrinkItem && breakdown.freeDrinkItem.cartItemId === c.id) {
        freeQty++;
      }
      if (breakdown.freeToastItem && breakdown.freeToastItem.cartItemId === c.id) {
        freeQty++;
      }
      if (freeQty > 0) {
        if (freeQty === c.quantity) {
          return "FREE";
        } else {
          const basePrice = c.product.promoPrice ?? c.product.price;
          const discountedAmount = basePrice * freeQty;
          return `${formatRp(c.totalPrice - discountedAmount)} (1 Free)`;
        }
      }
    }
    return formatRp(c.totalPrice);
  };

  const getProductDisplayPrice = (p: Product) => {
    const basePrice = p.promoPrice ?? p.price;
    if (customer?.activeReward === "grand_reward") {
      if (isProductDrink(p)) {
        const hasDrinkInCart = cart.some(c => isProductDrink(c.product));
        return hasDrinkInCart ? basePrice : 0;
      }
      if (isProductToast(p)) {
        const hasToastInCart = cart.some(c => isProductToast(c.product));
        return hasToastInCart ? basePrice : 0;
      }
      return basePrice;
    }
    if (hasPointDiscount) {
      let discountPercent = 0.1;
      if (customer?.activeReward) {
        const match = customer.activeReward.match(/^discount_(\d+)$/);
        if (match) {
          discountPercent = parseInt(match[1]) / 100;
        }
      }
      return Math.round(basePrice * (1 - discountPercent));
    }
    return basePrice;
  };

  const getItemCartPrice = (p: Product) => {
    if (customer?.activeReward === "grand_reward") {
      if (isProductDrinkOrToast(p)) {
        return 0;
      }
    }
    return p.promoPrice ?? p.price;
  };

  const getPointDiscountLabel = () => {
    if (!customer?.activeReward) return "10% POIN";
    if (customer.activeReward === "grand_reward") {
      return "GRAND REWARD";
    }
    const match = customer.activeReward.match(/^discount_(\d+)$/);
    if (match) {
      return `${match[1]}% POIN`;
    }
    return "10% POIN";
  };

  const [authChecking, setAuthChecking] = useState(true);
  const [authTab, setAuthTab] = useState<"login" | "register" | "forgot">("login");
  const [authForm, setAuthForm] = useState({ name: "", phone: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  
  // Forgot Password / OTP recovery state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // Profile Modal State
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", password: "" });
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [customerClaiming, setCustomerClaiming] = useState(false);

  const fetchCustomerProfile = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${BASE}/api/customers/auth/me`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        setForm(f => ({ ...f, customerName: data.name, customerPhone: data.phone }));
        setProfileForm({ name: data.name, phone: data.phone, password: "" });
        setProfileAvatarUrl(data.avatarUrl || "");
      } else {
        localStorage.removeItem(`customer_token_${slug}`);
        setCustomer(null);
      }
    } catch {
      localStorage.removeItem(`customer_token_${slug}`);
      setCustomer(null);
    } finally {
      setAuthChecking(false);
    }
  }, [slug]);

  // Handle auto-login
  useEffect(() => {
    if (!tenant) return;
    if (!tenant.enableCustomerLogin) {
      setAuthChecking(false);
      return;
    }
    const token = localStorage.getItem(`customer_token_${slug}`);
    if (token) {
      fetchCustomerProfile(token);
    } else {
      setAuthChecking(false);
    }
  }, [tenant, slug, fetchCustomerProfile]);

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authForm.phone || !authForm.password) {
      setAuthError("Nomor HP dan password wajib diisi");
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/customers/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          phone: authForm.phone,
          password: authForm.password
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(`customer_token_${slug}`, data.token);
        setCustomer(data.customer);
        setForm(f => ({ ...f, customerName: data.customer.name, customerPhone: data.customer.phone }));
        setProfileForm({ name: data.customer.name, phone: data.customer.phone, password: "" });
        setProfileAvatarUrl(data.customer.avatarUrl || "");
        setAuthForm({ name: "", phone: "", password: "", confirmPassword: "" });
      } else {
        setAuthError(data.error || "Gagal masuk");
      }
    } catch {
      setAuthError("Terjadi kesalahan koneksi");
    }
  };

  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authForm.name || !authForm.phone || !authForm.password) {
      setAuthError("Nama, Nomor HP, dan password wajib diisi");
      return;
    }
    if (authForm.password !== authForm.confirmPassword) {
      setAuthError("Konfirmasi password tidak cocok");
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/customers/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: authForm.name,
          phone: authForm.phone,
          password: authForm.password
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(`customer_token_${slug}`, data.token);
        setCustomer(data.customer);
        setForm(f => ({ ...f, customerName: data.customer.name, customerPhone: data.customer.phone }));
        setProfileForm({ name: data.customer.name, phone: data.customer.phone, password: "" });
        setProfileAvatarUrl(data.customer.avatarUrl || "");
        setAuthForm({ name: "", phone: "", password: "", confirmPassword: "" });
      } else {
        setAuthError(data.error || "Gagal mendaftar");
      }
    } catch {
      setAuthError("Terjadi kesalahan koneksi");
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authForm.phone) {
      setAuthError("Nomor HP wajib diisi");
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/customers/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone: authForm.phone })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setAuthSuccess(`Kode OTP berhasil dikirim (OTP Demo: ${data.code})`);
      } else {
        setAuthError(data.error || "Gagal meminta reset password");
      }
    } catch {
      setAuthError("Terjadi kesalahan koneksi");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!otpCode || !newPassword) {
      setAuthError("Kode OTP dan password baru wajib diisi");
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/customers/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          phone: authForm.phone,
          code: otpCode,
          password: newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess("Password berhasil diubah, silakan masuk.");
        setAuthTab("login");
        setOtpSent(false);
        setOtpCode("");
        setNewPassword("");
      } else {
        setAuthError(data.error || "Gagal mengubah password");
      }
    } catch {
      setAuthError("Terjadi kesalahan koneksi");
    }
  };

  const handleCustomerLogout = () => {
    localStorage.removeItem(`customer_token_${slug}`);
    setCustomer(null);
    setProfileOpen(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!profileForm.name || !profileForm.phone) {
      setProfileError("Nama dan Nomor HP tidak boleh kosong");
      return;
    }

    try {
      const token = localStorage.getItem(`customer_token_${slug}`);
      const res = await fetch(`${BASE}/api/customers/auth/update-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileForm.name,
          phone: profileForm.phone,
          password: profileForm.password || undefined,
          avatarUrl: profileAvatarUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomer(data);
        setForm(f => ({ ...f, customerName: data.name, customerPhone: data.phone }));
        setProfileSuccess("Profil berhasil diperbarui!");
        setProfileForm(p => ({ ...p, password: "" }));
      } else {
        setProfileError(data.error || "Gagal memperbarui profil");
      }
    } catch {
      setProfileError("Terjadi kesalahan koneksi");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("File harus berupa gambar");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Ukuran gambar maksimal 2MB");
      return;
    }

    setAvatarUploading(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const token = localStorage.getItem(`customer_token_${slug}`);
          const res = await fetch(`${BASE}/api/customers/upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              name: file.name,
              base64
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Gagal mengunggah foto");
          }

          const data = await res.json();
          setProfileAvatarUrl(data.imageUrl);
          
          const updateRes = await fetch(`${BASE}/api/customers/auth/update-profile`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ avatarUrl: data.imageUrl })
          });
          if (updateRes.ok) {
            const updatedCustomer = await updateRes.json();
            setCustomer(updatedCustomer);
            setProfileSuccess("Foto profil berhasil diubah!");
          }
        } catch (err: any) {
          setProfileError(err.message || "Gagal mengunggah foto");
        } finally {
          setAvatarUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setProfileError("Gagal memproses file");
      setAvatarUploading(false);
    }
  };

  const handleCustomerClaimReward = async (milestone: number) => {
    setCustomerClaiming(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const token = localStorage.getItem(`customer_token_${slug}`);
      const res = await fetch(`${BASE}/api/customers/${customer.id}/claim-reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ milestone })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomer(data);
        setProfileSuccess("Selamat! Reward Anda berhasil diklaim.");
        const rewardDesc = milestone === 1000 ? "Grand Reward (Free 1 Minuman & 1 Toast) aktif!" : `Diskon ${milestone / 10}% aktif untuk transaksi berikutnya.`;
        alert(`🎉 Selamat! Reward Anda berhasil diklaim. ${rewardDesc}`);
      } else {
        setProfileError(data.error || "Gagal mengklaim reward");
      }
    } catch {
      setProfileError("Terjadi kesalahan koneksi");
    } finally {
      setCustomerClaiming(false);
    }
  };

  // Parse query parameters
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const tableParam = query.get("table_id") || query.get("table");
    const branchParam = query.get("branch_id") || query.get("branch");
    const qrCodeParam = query.get("qr_code") || query.get("code");

    if (tableParam) setForm(f => ({ ...f, tableNumber: tableParam }));
    
    // Fetch menu details
    (async () => {
      try {
        const url = branchParam ? `${BASE}/api/menu/${slug}?branch_id=${branchParam}` : `${BASE}/api/menu/${slug}`;
        const r = await fetch(url);
        if (!r.ok) { setError("Menu tidak ditemukan atau tidak aktif"); setLoading(false); return; }
        
        const data = await r.json();
        setTenant(data.tenant);
        setBranch(data.branch);
        setMenu(data.menu);

        if (data.tenant.primaryColor) {
          document.documentElement.style.setProperty("--menu-primary", data.tenant.primaryColor);
        }

        // Initialize Customer Session
        const sessResponse = await fetch(`${BASE}/api/menu/${slug}/sessions/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrCode: qrCodeParam || null,
            branchId: data.branch.id,
            tableId: tableParam || null,
          }),
        });

        if (sessResponse.ok) {
          const session = await sessResponse.json();
          setMenuSessionId(session.menuSessionId);
          if (session.tableId) setForm(f => ({ ...f, tableNumber: session.tableId }));
          
          // Try to load existing cart for this session
          const cartRes = await fetch(`${BASE}/api/menu/${slug}/cart?menu_session_id=${session.menuSessionId}`);
          if (cartRes.ok) {
            const cartData = await cartRes.json();
            if (cartData.cartData && Array.isArray(cartData.cartData)) {
              setCart(cartData.cartData);
            }
          }
        }

        // Load Products & Categories
        const prodResponse = await fetch(`${BASE}/api/menu/${slug}/products?branch_id=${data.branch.id}`);
        if (prodResponse.ok) {
          const prods = await prodResponse.json();
          setCategories(prods.categories || []);
          setProducts(prods.products || []);
        }

      } catch { setError("Gagal memuat menu"); }
      setLoading(false);
    })();
  }, [slug]);

  // Load saved orders from localStorage and check status
  const loadSavedOrders = useCallback(async () => {
    if (!slug) return;
    try {
      if (customer && customer.phone) {
        const res = await fetch(`${BASE}/api/menu/${slug}/customer-orders-history?phone=${customer.phone}`);
        if (res.ok) {
          const list = await res.json();
          setCustomerOrders(list);
        }
        return;
      }
      
      const stored = localStorage.getItem(`customer_orders_${slug}`);
      if (!stored) return;
      const orderIds = JSON.parse(stored);
      if (!Array.isArray(orderIds) || orderIds.length === 0) return;

      const fetchedOrders = await Promise.all(
        orderIds.map(async (id) => {
          try {
            const res = await fetch(`${BASE}/api/menu/${slug}/orders/${id}`);
            if (res.ok) {
              return await res.json();
            }
          } catch (err) {
            console.error("Error fetching order status:", err);
          }
          return null;
        })
      );

      const validOrders = fetchedOrders.filter(Boolean);
      setCustomerOrders(validOrders);
    } catch (err) {
      console.error("Failed to load customer orders history:", err);
    }
  }, [slug, customer]);

  useEffect(() => {
    loadSavedOrders();
    const interval = setInterval(loadSavedOrders, 10000);
    return () => clearInterval(interval);
  }, [slug, loadSavedOrders]);

  useEffect(() => {
    if (tenant?.id) {
      try {
        const stored = localStorage.getItem(`flow_marketing_banners_${tenant.id}`);
        if (stored) {
          setPromoBanners(JSON.parse(stored));
        } else {
          const oldStored = localStorage.getItem("flow_marketing_banners");
          if (oldStored) {
            setPromoBanners(JSON.parse(oldStored));
          } else {
            setPromoBanners([]);
          }
        }
      } catch (err) {}
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant) {
      document.title = `${tenant.name} - Menu Online`;

      const updateMeta = (name: string, content: string, isProperty = false) => {
        let el = document.querySelector(isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`);
        if (!el) {
          el = document.createElement("meta");
          if (isProperty) el.setAttribute("property", name);
          else el.setAttribute("name", name);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };

      const description = tenant.bio || `Menu digital online resmi dari ${tenant.name}. Silakan pesan menu favorit Anda secara online langsung dari smartphone Anda.`;
      updateMeta("description", description);
      updateMeta("og:title", `${tenant.name} - Menu Online`, true);
      updateMeta("og:description", description, true);
      
      const absoluteLogoUrl = tenant.logoUrl
        ? (tenant.logoUrl.startsWith("http") ? tenant.logoUrl : `${window.location.origin}${tenant.logoUrl}`)
        : `${window.location.origin}/flow_logo.png`;

      updateMeta("og:image", absoluteLogoUrl, true);
      updateMeta("twitter:title", `${tenant.name} - Menu Online`);
      updateMeta("twitter:description", description);
      updateMeta("twitter:image", absoluteLogoUrl);
    }
  }, [tenant]);

  const primary = tenant?.primaryColor ?? "#1D4EF5";

  // Sync cart data to backend on update
  const syncCartToBackend = async (updatedCart: CartItem[]) => {
    if (!menuSessionId) return;
    try {
      await fetch(`${BASE}/api/menu/${slug}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuSessionId,
          cartData: updatedCart,
        }),
      });
    } catch {}
  };

  const handleBannerClick = (pb: any) => {
    if (pb.linkedProductId) {
      const matched = products.find(p => p.id === pb.linkedProductId);
      if (matched) {
        handleOpenDetailModal(matched);
      }
    }
  };

  const handleOpenDetailModal = (product: Product) => {
    setSelectedProduct(product);
    setModalQty(1);
    setModalNotes("");
    
    let variants = DEFAULT_VARIANTS;
    let toppings = isFashion ? [] : DEFAULT_TOPPINGS;

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
        toppings = isFashion ? [] : DEFAULT_TOPPINGS;
      }
    } else {
      variants = DEFAULT_VARIANTS;
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

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    // Build cart item details
    const price = selectedProduct.promoPrice ?? selectedProduct.price;
    const toppings = tenant?.showToppings !== false ? modalToppings : [];
    const variant = tenant?.showVariants !== false ? modalVariant : "";

    let variantPrice = 0;
    const variantObj = modalVariantsList.find(v => v.name === variant);
    if (variantObj) variantPrice = variantObj.price;

    const toppingsPrice = toppings.reduce((sum, name) => {
      const t = modalToppingsList.find(x => x.name === name);
      return sum + (t ? t.price : 2000);
    }, 0);

    const itemTotalPrice = (price + variantPrice + toppingsPrice) * modalQty;
    
    const cartId = `${selectedProduct.id}-${variant}-${toppings.sort().join(",")}-${modalNotes}`;

    const newCartItem: CartItem = {
      id: cartId,
      product: selectedProduct,
      quantity: modalQty,
      notes: modalNotes,
      selectedVariant: variant,
      selectedToppings: toppings,
      totalPrice: itemTotalPrice
    };

    setCart(prev => {
      let updated: CartItem[];
      const existingIdx = prev.findIndex(item => item.id === cartId);
      if (existingIdx !== -1) {
        updated = prev.map((item, idx) => idx === existingIdx ? {
          ...item,
          quantity: item.quantity + modalQty,
          totalPrice: item.totalPrice + itemTotalPrice
        } : item);
      } else {
        updated = [...prev, newCartItem];
      }
      syncCartToBackend(updated);
      return updated;
    });

    setSelectedProduct(null);
  };

  const updateQty = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => {
        const updated = prev.filter(c => c.id !== itemId);
        syncCartToBackend(updated);
        return updated;
      });
      return;
    }
    
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.id !== itemId) return item;
        const basePrice = item.product.promoPrice ?? item.product.price;
        
        let variantPrice = 0;
        let toppingsPrice = 0;
        
        const settingsStr = item.product.variantSettings;
        let variantsList = DEFAULT_VARIANTS;
        let toppingsList = isFashion ? [] : DEFAULT_TOPPINGS;
        
        if (settingsStr) {
          try {
            const parsed = JSON.parse(settingsStr);
            if (parsed.variants && Array.isArray(parsed.variants)) variantsList = parsed.variants;
            if (parsed.toppings && Array.isArray(parsed.toppings)) toppingsList = parsed.toppings;
          } catch {}
        }
        
        const variantObj = variantsList.find(v => v.name === item.selectedVariant);
        if (variantObj) variantPrice = variantObj.price;
        
        toppingsPrice = item.selectedToppings.reduce((sum, name) => {
          const t = toppingsList.find(x => x.name === name);
          return sum + (t ? t.price : 2000);
        }, 0);

        return {
          ...item,
          quantity: newQuantity,
          totalPrice: (basePrice + variantPrice + toppingsPrice) * newQuantity
        };
      });
      syncCartToBackend(updated);
      return updated;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const updated = prev.filter(c => c.id !== itemId);
      syncCartToBackend(updated);
      return updated;
    });
  };

  const cartTotal = cart.reduce((s, c) => s + c.totalPrice, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const enableTax = tenant?.enableTax ?? false;
  const taxPct = enableTax ? Number(tenant?.taxPercentage ?? 10) : 0;
  const enableServiceCharge = (tenant as any)?.enableServiceCharge ?? false;
  const serviceChargePct = enableServiceCharge ? Number((tenant as any)?.serviceChargePercentage ?? 10) : 0;
  const pointDiscountAmount = (() => {
    if (!hasPointDiscount) return 0;
    if (customer?.activeReward === "grand_reward") {
      const breakdown = getGrandRewardDiscountBreakdown(cart);
      return breakdown.totalDiscount;
    }
    let discountPercent = 0.1;
    if (customer?.activeReward) {
      const match = customer.activeReward.match(/^discount_(\d+)$/);
      if (match) {
        discountPercent = parseInt(match[1]) / 100;
      }
    }
    return Math.round(cartTotal * discountPercent);
  })();
  const subtotalAfterDiscount = Math.max(0, cartTotal - pointDiscountAmount);
  const serviceChargeAmount = subtotalAfterDiscount * (serviceChargePct / 100);
  const taxAmount = (subtotalAfterDiscount + serviceChargeAmount) * (taxPct / 100);
  const cartTotalWithTax = subtotalAfterDiscount + serviceChargeAmount + taxAmount;

  const filteredProducts = products.filter(p => {
    const matchCat = !activeCat || p.publicMenuCategoryId === activeCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const bestSellers = products.filter(p => p.isBestSeller === true || p.promoPrice !== null).slice(0, 4);

  const availablePayments = (() => {
    if (!menu) return [];
    const opts: { value: string; label: string; desc: string }[] = [];
    if (tenant?.enableCash) opts.push({ value: "cash", label: "Cash on Delivery", desc: "Bayar tunai di kurir saat barang sampai" });
    if (menu.enableDineIn) opts.push({ value: "cashier", label: "Bayar di Kasir", desc: "Selesaikan pembayaran langsung di kasir toko" });
    if (tenant?.enableQris) opts.push({ value: "qris", label: "QRIS", desc: "Scan barcode digital secara realtime" });
    if (tenant?.enableBankTransfer) opts.push({ value: "bank_transfer", label: "Transfer Bank", desc: "Mandiri, BCA, BRI, BNI" });
    if (tenant?.enableEwallet) opts.push({ value: "ewallet", label: "E-Wallet", desc: "OVO, GoPay, DANA, LinkAja" });
    return opts;
  })();

  const handleSubmitOrder = async () => {
    if (!form.customerName.trim()) { setSubmitError("Nama pelanggan wajib diisi"); return; }
    if (orderType === "dine_in" && !form.tableNumber.trim()) { setSubmitError(isFashion ? "Nomor fitting room wajib diisi" : "Nomor meja wajib diisi"); return; }
    if (orderType === "delivery" && !form.deliveryAddress.trim()) { setSubmitError("Alamat pengiriman wajib diisi"); return; }
    if (orderType !== "dine_in" && !form.customerPhone.trim()) { setSubmitError("Nomor telepon wajib diisi"); return; }
    
    setSubmitting(true); setSubmitError("");
    try {
      const feeNear = tenant?.deliveryFeeNear !== undefined ? Number(tenant.deliveryFeeNear) : 0;
      const feeFar = tenant?.deliveryFeeFar !== undefined ? Number(tenant.deliveryFeeFar) : 5000;
      const fee = orderType === "delivery" ? (deliveryDistance === "near" ? feeNear : feeFar) : 0;
      const r = await fetch(`${BASE}/api/menu/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.id || null,
          menuSessionId,
          branchId: branch?.id,
          orderType,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim() || null,
          tableNumber: form.tableNumber.trim() || null,
          deliveryAddress: form.deliveryAddress.trim() || null,
          deliveryNotes: form.deliveryNotes.trim() || null,
          deliveryFee: fee,
          paymentMethod,
          googleMapsLocation: form.googleMapsLocation.trim() || null,
          notes: orderNotes.trim() || null,
          items: cart.map(c => ({
            productId: c.product.productId,
            quantity: c.quantity,
            price: c.product.promoPrice ?? c.product.price,
            notes: c.notes || null,
            variantSelection: c.selectedVariant
              ? `${c.selectedVariant}${c.selectedToppings && c.selectedToppings.length > 0 ? " " + c.selectedToppings.join(", ") : ""}`
              : (c.selectedToppings && c.selectedToppings.length > 0 ? c.selectedToppings.join(", ") : null),
          })),
        }),
      });

      if (!r.ok) {
        const e = await r.json();
        setSubmitError(e.error ?? "Gagal memproses pesanan");
        setSubmitting(false);
        return;
      }
      
      const order = await r.json();
      
      // Save order ID to localStorage
      try {
        const stored = localStorage.getItem(`customer_orders_${slug}`);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(order.id)) {
          list.push(order.id);
          localStorage.setItem(`customer_orders_${slug}`, JSON.stringify(list));
        }
        setTimeout(() => {
          loadSavedOrders();
        }, 100);
      } catch (err) {
        console.error("Failed to save order history:", err);
      }

      setTrackingId(order.id);
      setCart([]);
      syncCartToBackend([]);
      setStep("success");
      const token = localStorage.getItem(`customer_token_${slug}`);
      if (token) {
        fetchCustomerProfile(token);
      }
    } catch {
      setSubmitError("Terjadi kesalahan sistem, silakan coba lagi");
    }
    setSubmitting(false);
  };

  const isFashion = tenant?.businessType === "fashion";
  const displayOrderTypeLabels = isFashion ? {
    dine_in: "Coba di Fitting Room",
    take_away: "Ambil di Toko",
    delivery: "Antar ke Alamat",
  } : ORDER_TYPE_LABELS;

  if (loading || (tenant?.enableCustomerLogin && authChecking)) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: primary, borderTopColor: "transparent" }} />
        <div className="text-sm font-bold text-gray-500">Memuat Sesi...</div>
      </div>
    </div>
  );

  if (error || !tenant || !menu) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center bg-white p-8 rounded-3xl shadow-sm border max-w-sm">
        <div className="text-6xl mb-4">{isFashion ? "👗" : "🍽️"}</div>
        <div className="text-xl font-black text-gray-800 mb-2">{isFashion ? "Katalog Tidak Aktif" : "Menu Tidak Aktif"}</div>
        <div className="text-gray-400 text-sm mb-6">{error || (isFashion ? "Katalog toko tidak ditemukan atau sedang dinonaktifkan." : "Menu restoran tidak ditemukan atau sedang dinonaktifkan.")}</div>
      </div>
    </div>
  );

  if (tenant?.enableCustomerLogin && !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
          <div className="text-center">
            {menu.logoUrl || tenant.logoUrl ? (
              <img src={menu.logoUrl || tenant.logoUrl || ""} alt="Logo" className="w-20 h-20 mx-auto object-cover rounded-2xl shadow-md border mb-4" />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-2xl text-white font-black text-3xl flex items-center justify-center mb-4" style={{ backgroundColor: primary }}>
                {tenant.name[0]}
              </div>
            )}
            <h2 className="text-2xl font-black text-gray-900 leading-tight">Selamat Datang di {tenant.name}</h2>
            <p className="text-xs text-gray-400 mt-1">Silakan masuk atau daftar untuk memesan menu & mendapatkan loyalitas poin.</p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-4 py-3 font-semibold text-center">
              {authError}
            </div>
          )}
          {authSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-2xl px-4 py-3 font-semibold text-center">
              {authSuccess}
            </div>
          )}

          {authTab === "login" && (
            <form onSubmit={handleCustomerLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Nomor HP</label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={authForm.phone}
                  onChange={e => setAuthForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Password Anda"
                  value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setAuthTab("forgot"); setAuthError(""); setAuthSuccess(""); }}
                  className="text-xs font-bold hover:underline"
                  style={{ color: primary }}
                >
                  Lupa Password?
                </button>
              </div>
              <button
                type="submit"
                className="w-full py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg animate-fade-in"
                style={{ backgroundColor: primary }}
              >
                Masuk
              </button>
              <div className="text-center text-xs text-gray-500 pt-2">
                Belum punya akun?{" "}
                <button
                  type="button"
                  onClick={() => { setAuthTab("register"); setAuthError(""); setAuthSuccess(""); }}
                  className="font-bold hover:underline"
                  style={{ color: primary }}
                >
                  Daftar Sekarang
                </button>
              </div>
            </form>
          )}

          {authTab === "register" && (
            <form onSubmit={handleCustomerRegister} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Nama Lengkap Anda"
                  value={authForm.name}
                  onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Nomor HP</label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={authForm.phone}
                  onChange={e => setAuthForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  placeholder="Ulangi password"
                  value={authForm.confirmPassword}
                  onChange={e => setAuthForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                style={{ backgroundColor: primary }}
              >
                Daftar
              </button>
              <div className="text-center text-xs text-gray-500 pt-2">
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => { setAuthTab("login"); setAuthError(""); setAuthSuccess(""); }}
                  className="font-bold hover:underline"
                  style={{ color: primary }}
                >
                  Masuk
                </button>
              </div>
            </form>
          )}

          {authTab === "forgot" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Nomor HP</label>
                    <input
                      type="tel"
                      placeholder="Masukkan Nomor HP terdaftar"
                      value={authForm.phone}
                      onChange={e => setAuthForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: primary }}
                  >
                    Kirim Kode Reset
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Kode OTP (Cek Console / Response)</label>
                    <input
                      type="text"
                      placeholder="Masukkan 6 digit kode OTP"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Password Baru</label>
                    <input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none focus:bg-white transition-all text-foreground"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: primary }}
                  >
                    Ubah Password & Simpan
                  </button>
                </form>
              )}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthTab("login"); setOtpSent(false); setAuthError(""); setAuthSuccess(""); }}
                  className="text-xs font-bold hover:underline"
                  style={{ color: primary }}
                >
                  Kembali ke Halaman Masuk
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "success" && trackingId) {
    return (
      <TrackingView
        orderId={trackingId}
        slug={slug!}
        primary={primary}
        tenantName={tenant?.name || "FreshMood"}
        branchName={branch?.name || "Utama"}
        onBack={() => { setStep("menu"); setTrackingId(null); }}
        isFashion={isFashion}
        qrisId={tenant?.qrisId}
        qrisImageUrl={tenant?.qrisImageUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans antialiased">
      {hasPointDiscount && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 text-center text-xs font-black flex items-center justify-center gap-2 shadow-inner animate-pulse">
          <span>
            🎉 Reward Aktif: {
              customer.activeReward === "grand_reward"
                ? "Free 1 Minuman & 1 Toast otomatis diterapkan!"
                : `Diskon ${customer.activeReward === "discount_20" ? "20%" : customer.activeReward === "discount_30" ? "30%" : customer.activeReward === "discount_40" ? "40%" : customer.activeReward === "discount_50" ? "50%" : "10%"} otomatis diterapkan pada pesanan ini!`
            }
          </span>
        </div>
      )}
      {/* Customer Sticky Navbar if enabled and logged in */}
      {tenant.enableCustomerLogin && customer && (
        <div className="sticky top-0 z-40 bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const token = localStorage.getItem(`customer_token_${slug}`);
                if (token) fetchCustomerProfile(token);
                setProfileOpen(true);
              }}
              className="w-10 h-10 rounded-full border bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
            >
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-gray-400" />
              )}
            </button>
            <div>
              <div className="text-xs text-gray-400 font-bold">Halo,</div>
              <div className="text-sm font-black text-gray-900 leading-tight">{customer.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Loyalty points info */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-1 text-right">
              <div className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">Poin Loyalitas</div>
              <div className="text-xs font-black text-amber-700">{customer.loyaltyPoints || 0} Poin ({customer.membershipLevel || "regular"})</div>
            </div>
            
            <button
              onClick={() => setHistoryOpen(true)}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-gray-600 transition-colors cursor-pointer"
              title="Riwayat Pesanan"
            >
              <ClipboardList size={18} />
            </button>

            <button
              onClick={() => {
                const token = localStorage.getItem(`customer_token_${slug}`);
                if (token) fetchCustomerProfile(token);
                setProfileOpen(true);
              }}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-gray-600 transition-colors cursor-pointer"
              title="Profil Saya"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      )}
      {/* 1. Branded Store Header */}
      <div className="bg-white border-b shadow-sm">
        {/* Banner and Logo Wrapper */}
        <div className="relative">
          {/* Banner Image */}
          <div className="h-44 sm:h-56 md:h-68 lg:h-80 xl:h-96 bg-gray-100 overflow-hidden transition-all duration-300">
            {tenant.coverUrl || menu.bannerUrl ? (
              <img src={tenant.coverUrl || menu.bannerUrl || ""} alt="Store Banner" className="w-full h-full object-cover object-center" />
            ) : (
              <div className="w-full h-full opacity-80" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }} />
            )}
          </div>
          {/* Logo overlay */}
          <div className="absolute -bottom-8 sm:-bottom-10 md:-bottom-12 left-4 w-18 h-18 sm:w-22 sm:h-22 md:w-26 md:h-26 bg-white rounded-2xl sm:rounded-3xl shadow-md p-1 border flex items-center justify-center overflow-hidden transition-all duration-300 z-10">
            {menu.logoUrl || tenant.logoUrl ? (
              <img src={menu.logoUrl || tenant.logoUrl || ""} alt="Logo" className="w-full h-full object-cover rounded-xl sm:rounded-2xl" />
            ) : (
              <div className="w-full h-full rounded-xl sm:rounded-2xl text-white font-black text-2xl sm:text-3xl flex items-center justify-center" style={{ backgroundColor: primary }}>
                {tenant.name[0]}
              </div>
            )}
          </div>
        </div>

        {/* Store Name, open/closed, delivery specs */}
        <div className="pt-10 sm:pt-12 md:pt-14 px-4 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-tight">{menu.name || tenant.name}</h1>
              <div className="text-xs text-gray-500 font-semibold mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400" /> {branch?.name || "Utama"} • {tenant.address || "Indonesia"}</span>
              </div>
              {tenant.bio && (
                <p className="text-xs text-gray-600 font-normal mt-2 leading-relaxed max-w-2xl italic border-l-2 border-gray-200 pl-2">
                  {tenant.bio}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {tenant.enableOpsHours ? (
                isStoreOpen ? (
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-3 py-1 rounded-full border border-green-200 uppercase tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Buka ({tenant.opsOpeningTime} - {tenant.opsClosingTime})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-200 uppercase tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Tutup ({tenant.opsOpeningTime} - {tenant.opsClosingTime})
                  </span>
                )
              ) : (
                <span className="text-[10px] font-bold bg-green-50 text-green-600 px-3 py-1 rounded-full border border-green-200 uppercase tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Buka
                </span>
              )}
              {tenant.enableCustomerLogin && customer && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <ClipboardList size={13} style={{ color: primary }} />
                  <span>Riwayat</span>
                </button>
              )}
            </div>
          </div>

          {tenant.showDeliveryInfo !== false && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-2xl">
              <span className="flex items-center gap-1"><Truck size={13} style={{ color: primary }} /> {(menu.enableDelivery || tenant.enableDelivery) ? "Menerima Pengantaran" : "Hanya Ambil Sendiri"}</span>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span className="flex items-center gap-1"><Clock size={13} style={{ color: primary }} /> {tenant.estimatedDeliveryTime || menu.estimatedDeliveryTime || "30 mnt"}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Marketing Promo Banners */}
      {allBanners.length > 0 && (
        <div className="mt-4 px-4 space-y-3 max-w-7xl mx-auto w-full">
          <div className="font-black text-gray-900 text-sm flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500" /> Promo Spesial
          </div>
          <div className="flex gap-4 scroll-x-container no-scrollbar py-1">
            {allBanners.map(pb => (
              <div
                key={pb.id}
                onClick={() => handleBannerClick(pb)}
                className="flex-none h-36 sm:h-40 md:h-[160px] w-76 sm:w-84 md:w-[350px] rounded-3xl overflow-hidden shadow-sm border border-gray-100 relative group transition-all duration-300 hover:shadow-md cursor-pointer hover:border-blue-500/50 hover:scale-[1.01]"
              >
                {pb.imageUrl ? (
                  <div className="relative h-full w-full">
                    <img src={pb.imageUrl} alt={pb.title || "Promo"} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" />
                    {pb.title && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-4">
                        <div className="text-white font-black text-sm sm:text-base leading-snug drop-shadow">
                          {pb.title}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{ backgroundColor: pb.bgColor, color: pb.textColor }}
                    className="w-full h-full p-4.5 flex flex-col justify-between"
                  >
                    <div className="font-black text-sm sm:text-base leading-snug">{pb.title}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Tunjukkan di Kasir / POS</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {bestSellers.length > 0 && (
        <div className="mt-4 px-4 space-y-3 max-w-7xl mx-auto w-full">
          <div className="font-black text-gray-900 text-sm flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500" /> Promo Rekomendasi
          </div>
          <div className="flex gap-3 scroll-x-container no-scrollbar py-1">
            {bestSellers.map(p => (
              <div key={p.id} onClick={() => handleOpenDetailModal(p)} className="flex-none w-64 bg-white border border-gray-100 rounded-3xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-3">
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden relative">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-3xl flex items-center justify-center h-full">{isFashion ? "👗" : "🍔"}</span>}
                  {p.isBestSeller ? (
                    <span className="absolute top-1 left-1 bg-amber-500 text-black font-extrabold text-[8px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 leading-none">🔥 BEST</span>
                  ) : (
                    <span className="absolute top-1 left-1 bg-red-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-md leading-none">PROMO</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-gray-800 truncate">{p.name}</div>
                    <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">{p.description || (isFashion ? "Koleksi pakaian premium terbaik." : "Rasa lezat tiada tanding.")}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-red-500">{formatRp(getProductDisplayPrice(p))}</span>
                      {(p.promoPrice !== null || hasPointDiscount) && (
                        <span className="text-[10px] text-gray-305 line-through">
                          {formatRp(p.promoPrice !== null ? p.price : p.price)}
                        </span>
                      )}
                    </div>
                    {hasPointDiscount && (
                      <span className="inline-block text-[8px] font-black bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded border border-amber-200 w-max leading-none">
                        {getPointDiscountLabel()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Category Tabs */}
      <div className="sticky z-10 bg-white border-y mt-4" style={{ top: tenant.enableCustomerLogin && customer ? "65px" : "0" }}>
        <div className="max-w-7xl mx-auto w-full">
          {/* Search */}
          <div className="px-4 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isFashion ? "Cari pakaian & produk favorit..." : "Cari makanan & minuman favorit..."}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border border-transparent focus:border-gray-200 rounded-2xl text-xs text-gray-700 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Sticky category tabs */}
          <div className="flex gap-2 px-4 pb-2.5 scroll-x-container no-scrollbar">
            <button
              onClick={() => setActiveCat(null)}
              className={`flex-none px-4 py-2 rounded-full text-xs font-bold transition-all ${!activeCat ? "text-white shadow-sm" : "bg-gray-50 text-gray-600 border"}`}
              style={!activeCat ? { backgroundColor: primary } : {}}
            >{isFashion ? "Semua Produk" : "Semua Menu"}</button>
            {categories.map(c => (
              <button key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`flex-none px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCat === c.id ? "text-white shadow-sm" : "bg-gray-50 text-gray-600 border"}`}
                style={activeCat === c.id ? { backgroundColor: primary } : {}}
              >{c.name}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Product Grid */}
      <div className="p-4 max-w-7xl mx-auto w-full">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-3xl border border-gray-100">
            <div className="text-5xl mb-3">{isFashion ? "👗" : "🍽️"}</div>
            <div className="text-sm font-semibold">{isFashion ? "Produk tidak ditemukan" : "Menu tidak ditemukan"}</div>
            <p className="text-xs text-gray-300 mt-1">Coba gunakan kata kunci pencarian lain.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5">
            {filteredProducts.map(p => {
              const countInCart = cart.filter(c => c.product.id === p.id).reduce((s, c) => s + c.quantity, 0);
              return (
                <div key={p.id} onClick={() => handleOpenDetailModal(p)} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer flex flex-col justify-between group">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-4xl">🍕</span>
                    )}
                    {p.isBestSeller && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-black font-black text-[9px] px-2 py-0.5 rounded-lg shadow-sm uppercase tracking-wide">
                        🔥 Best
                      </span>
                    )}
                    {countInCart > 0 && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm" style={{ backgroundColor: primary }}>
                        {countInCart}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-bold text-gray-800 text-xs sm:text-sm line-clamp-1 group-hover:text-gray-900 transition-colors" title={p.name}>{p.name}</div>
                    {p.description && <div className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed h-7.5 overflow-hidden">{p.description}</div>}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col">
                        {p.promoPrice || hasPointDiscount ? (
                          <>
                            <span className="text-xs sm:text-sm font-black text-red-500">{formatRp(getProductDisplayPrice(p))}</span>
                            <span className="text-[9px] text-gray-300 line-through leading-none">{formatRp(p.price)}</span>
                            {hasPointDiscount && (
                              <span className="inline-block text-[8px] font-black bg-amber-100 text-amber-800 px-1 py-0.5 rounded border border-amber-200 w-max leading-none mt-1">
                                {getPointDiscountLabel()}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs sm:text-sm font-black" style={{ color: primary }}>{formatRp(p.price)}</span>
                        )}
                      </div>
                      <button className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow hover:scale-105 active:scale-95 transition-all" style={{ backgroundColor: primary }}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Sticky Bottom Cart Bar */}
      {cartCount > 0 && step === "menu" && (
        <div className="fixed bottom-6 left-4 right-4 z-30 max-w-md mx-auto w-full animate-slide-up">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-3xl text-white shadow-xl hover:opacity-95 transition-opacity"
            style={{ backgroundColor: primary }}
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 rounded-xl px-2.5 py-1 text-xs font-black">{cartCount}</div>
              <span className="font-bold text-sm">Lihat Keranjang</span>
            </div>
            <span className="font-black text-sm">{formatRp(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* 5. Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] sm:max-h-[85vh] w-full max-w-md sm:max-w-lg flex flex-col overflow-hidden animate-slide-up shadow-2xl">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur rounded-full p-2 border shadow-sm text-gray-500 hover:bg-gray-100">
              <X size={16} />
            </button>
            <div className="overflow-y-auto flex-1 pb-4">
              <div className="h-56 bg-gray-50 flex items-center justify-center overflow-hidden">
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
                    <img src={displayImg} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">{isFashion ? "👗" : "🍛"}</span>
                  );
                })()}
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900 leading-tight">{selectedProduct.name}</h2>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{selectedProduct.description || (isFashion ? "Koleksi pakaian premium terbaik dengan bahan berkualitas tinggi." : "Menu istimewa yang dibuat dengan bahan segar berkualitas tinggi.")}</p>
                </div>

                {/* Bundling items list */}
                {(() => {
                  if (selectedProduct.variantSettings) {
                    try {
                      const parsed = JSON.parse(selectedProduct.variantSettings);
                      if (parsed.isBundle && parsed.bundleProducts && parsed.bundleProducts.length > 0) {
                        return (
                          <div className="space-y-2 border-t pt-3 border-border">
                            <div className="text-xs font-black text-gray-700 uppercase tracking-wide">Isi Paket Promo</div>
                            <div className="space-y-1.5">
                              {parsed.bundleProducts.map((bp: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-2.5 rounded-2xl text-xs">
                                  <span className="font-semibold text-gray-800">{bp.name}</span>
                                  <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-lg font-black">x{bp.qty}</span>
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

                {/* Variant selection */}
                {(() => {
                  if (selectedProduct.variantSettings) {
                    try {
                      const parsed = JSON.parse(selectedProduct.variantSettings);
                      if (parsed.isBundle) return null;
                    } catch (e) {}
                  }
                  return tenant?.showVariants !== false && modalVariantsList.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-black text-gray-700 uppercase tracking-wide">{isFashion ? "Varian Ukuran / Warna" : "Pilihan Ukuran / Varian"}</div>
                      <div className="flex gap-2">
                        {modalVariantsList.map(v => (
                          <button key={v.name} onClick={() => setModalVariant(v.name)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all ${modalVariant === v.name ? "text-white shadow-sm" : "bg-gray-50 text-gray-600"}`}
                            style={modalVariant === v.name ? { backgroundColor: primary, borderColor: primary } : {}}>
                            {v.name} {v.price > 0 && `(+${formatRp(v.price)})`}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Toppings selection */}
                {(() => {
                  if (selectedProduct.variantSettings) {
                    try {
                      const parsed = JSON.parse(selectedProduct.variantSettings);
                      if (parsed.isBundle) return null;
                    } catch (e) {}
                  }
                  return !isFashion && tenant?.showToppings !== false && modalToppingsList.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-black text-gray-700 uppercase tracking-wide">Topping / Tambahan</div>
                      <div className="grid grid-cols-2 gap-2">
                        {modalToppingsList.map(t => {
                          const selected = modalToppings.includes(t.name);
                          return (
                            <button key={t.name}
                              onClick={() => setModalToppings(prev => selected ? prev.filter(x => x !== t.name) : [...prev, t.name])}
                              className={`px-3 py-2 rounded-2xl text-xs font-bold text-left border flex items-center justify-between transition-all ${selected ? "bg-blue-50/50" : "bg-gray-50"}`}
                              style={selected ? { borderColor: primary, color: primary } : {}}>
                              <span>{t.name} {t.price > 0 && `(+${formatRp(t.price)})`}</span>
                              {selected && <CheckCircle2 size={14} style={{ color: primary }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <div className="text-xs font-black text-gray-700 uppercase tracking-wide">Catatan Pesanan</div>
                  <input
                    value={modalNotes}
                    onChange={e => setModalNotes(e.target.value)}
                    placeholder="Contoh: Tidak pedas, kuah dipisah..."
                    className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-xs focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Sticky Modal Bottom */}
            <div className="border-t p-4 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-gray-100 rounded-2xl p-1.5">
                <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center text-gray-600 hover:bg-gray-50">
                  <Minus size={14} />
                </button>
                <span className="font-black text-sm w-6 text-center">{modalQty}</span>
                <button onClick={() => setModalQty(q => q + 1)} className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center text-gray-600 hover:bg-gray-50">
                  <Plus size={14} />
                </button>
              </div>
              {(() => {
                const normalBasePrice = selectedProduct.promoPrice ?? selectedProduct.price;
                const toppings = tenant?.showToppings !== false ? modalToppings : [];
                const variant = tenant?.showVariants !== false ? modalVariant : "";

                let variantPrice = 0;
                const variantObj = modalVariantsList.find(v => v.name === variant);
                if (variantObj) variantPrice = variantObj.price;

                const toppingsPrice = toppings.reduce((sum, name) => {
                  const t = modalToppingsList.find(x => x.name === name);
                  return sum + (t ? t.price : 2000);
                }, 0);

                const normalTotalPriceSingle = normalBasePrice + variantPrice + toppingsPrice;
                let totalPrice = normalTotalPriceSingle * modalQty;

                if (customer?.activeReward === "grand_reward") {
                  if (isProductDrink(selectedProduct)) {
                    const cartDrinksQty = cart.filter(c => isProductDrink(c.product)).reduce((sum, c) => sum + c.quantity, 0);
                    const freeDrinksAllowed = Math.max(0, 1 - cartDrinksQty);
                    const freeInModal = Math.min(modalQty, freeDrinksAllowed);
                    totalPrice -= normalBasePrice * freeInModal;
                  } else if (isProductToast(selectedProduct)) {
                    const cartToastsQty = cart.filter(c => isProductToast(c.product)).reduce((sum, c) => sum + c.quantity, 0);
                    const freeToastsAllowed = Math.max(0, 1 - cartToastsQty);
                    const freeInModal = Math.min(modalQty, freeToastsAllowed);
                    totalPrice -= normalBasePrice * freeInModal;
                  }
                }

                return (
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 py-3.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2"
                    style={{ backgroundColor: primary }}
                  >
                    <span>Masukkan Keranjang • {formatRp(totalPrice)}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 6. Shopping Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[80vh] w-full max-w-md flex flex-col shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
              <div className="font-black text-gray-900">Keranjang Belanja ({cartCount} item)</div>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.map(c => (
                <div key={c.id} className="flex gap-3.5 border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.product.imageUrl ? <img src={c.product.imageUrl} className="w-full h-full object-cover" alt={c.product.name} /> : <span className="text-2xl">🍔</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-gray-900 truncate">{c.product.name}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                      {c.selectedVariant} {c.selectedToppings.length > 0 ? `+ Toppings: ${c.selectedToppings.join(", ")}` : ""}
                    </div>
                    {c.notes && <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-0.5 border border-amber-100 inline-block mt-1 italic">"{c.notes}"</div>}
                  </div>
                  <div className="flex flex-col items-end justify-between flex-shrink-0">
                    <button onClick={() => removeFromCart(c.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={13} /></button>
                    <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-1 border">
                      <button onClick={() => updateQty(c.id, c.quantity - 1)} className="w-5 h-5 rounded-lg bg-white border flex items-center justify-center text-gray-500">
                        <Minus size={10} />
                      </button>
                      <span className="text-xs font-black w-4 text-center">{c.quantity}</span>
                      <button onClick={() => updateQty(c.id, c.quantity + 1)} className="w-5 h-5 rounded-lg bg-white border flex items-center justify-center text-gray-500">
                        <Plus size={10} />
                      </button>
                    </div>
                    <div className="text-xs font-black mt-1" style={{ color: primary }}>
                      {getCartItemPriceLabel(c)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart summary and checkout trigger */}
            <div className="p-5 border-t bg-gray-50 space-y-3.5">
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-bold text-gray-900">{formatRp(cartTotal)}</span></div>
                {hasPointDiscount && (
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>
                      {customer.activeReward === "grand_reward"
                        ? "Grand Reward (Free Minuman & Toast)"
                        : `Diskon Poin (${customer.activeReward === "discount_20" ? "20%" : customer.activeReward === "discount_30" ? "30%" : customer.activeReward === "discount_40" ? "40%" : customer.activeReward === "discount_50" ? "50%" : "10%"})`}
                    </span>
                    <span>-{formatRp(pointDiscountAmount)}</span>
                  </div>
                )}
                {enableServiceCharge && (
                  <div className="flex justify-between"><span>Biaya Servis ({serviceChargePct}%)</span><span className="font-bold text-gray-900">{formatRp(serviceChargeAmount)}</span></div>
                )}
                {enableTax && (
                  <div className="flex justify-between"><span>Pajak ({taxPct}%)</span><span className="font-bold text-gray-900">{formatRp(taxAmount)}</span></div>
                )}
              </div>
              <div className="flex justify-between font-black text-sm pt-2 border-t text-gray-900">
                <span>Total Estimasi</span><span style={{ color: primary }}>{formatRp(cartTotalWithTax)}</span>
              </div>
              {!isStoreOpen ? (
                <div className="bg-red-50 text-red-600 border border-red-200 rounded-2xl p-4 text-xs font-semibold space-y-1">
                  <div className="font-bold flex items-center gap-1.5"><Info size={14} /> Toko Sedang Tutup</div>
                  <div>Pemesanan online tidak tersedia di luar jam operasional. Silakan pesan kembali pada jam operasional: {tenant.opsOpeningTime} - {tenant.opsClosingTime}.</div>
                </div>
              ) : (
                <button
                  onClick={() => { setCartOpen(false); setStep("order-type"); }}
                  className="w-full py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-95"
                  style={{ backgroundColor: primary }}>
                  Lanjut Pilih Jenis Pesanan <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Order Type Selection */}
      {step === "order-type" && (
        <div className="fixed inset-0 z-50 bg-gray-50 sm:bg-black/60 sm:backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 sm:bg-transparent" onClick={() => setStep("menu")} />
          <div className="relative bg-white rounded-none sm:rounded-3xl h-full sm:h-auto sm:max-h-[85vh] w-full max-w-md flex flex-col shadow-2xl animate-slide-up overflow-hidden">
            <div className="bg-white border-b px-4 py-3.5 flex items-center gap-3 shadow-sm">
              <button onClick={() => setStep("menu")} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full"><ArrowLeft size={18} /></button>
              <div className="font-black text-gray-900 text-sm">Pilih Jenis Pesanan</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4 w-full">
              {(menu.enableDineIn || tenant?.enableDineIn) && (
                <button
                  onClick={() => { setOrderType("dine_in"); setStep("form"); }}
                  className={`w-full p-5 rounded-3xl border text-left flex gap-4 transition-all hover:bg-white hover:shadow-sm ${orderType === "dine_in" ? "bg-white border-2" : "bg-white/60"}`}
                  style={orderType === "dine_in" ? { borderColor: primary } : {}}
                >
                  <div className="text-3xl bg-blue-50 p-3 rounded-2xl">{isFashion ? "👚" : "🪑"}</div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{isFashion ? "Coba di Fitting Room" : "Makan di Tempat"}</div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isFashion ? "Pesan pakaian untuk dicoba langsung di Fitting Room / Kamar Pas" : "Pesan dan makan langsung di meja restoran"}
                    </p>
                  </div>
                </button>
              )}
              
              {(menu.enableTakeAway || tenant?.enableTakeAway) && (
                <button
                  onClick={() => { setOrderType("take_away"); setStep("form"); }}
                  className={`w-full p-5 rounded-3xl border text-left flex gap-4 transition-all hover:bg-white hover:shadow-sm ${orderType === "take_away" ? "bg-white border-2" : "bg-white/60"}`}
                  style={orderType === "take_away" ? { borderColor: primary } : {}}
                >
                  <div className="text-3xl bg-amber-50 p-3 rounded-2xl">🛍️</div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{isFashion ? "Ambil di Toko" : "Bawa Pulang"}</div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isFashion ? "Pesan online, ambil langsung di kasir toko" : "Pesan online, ambil langsung di outlet kasir"}
                    </p>
                  </div>
                </button>
              )}
              
              {(menu.enableDelivery || tenant?.enableDelivery) && (
                <button
                  onClick={() => { setOrderType("delivery"); setStep("form"); }}
                  className={`w-full p-5 rounded-3xl border text-left flex gap-4 transition-all hover:bg-white hover:shadow-sm ${orderType === "delivery" ? "bg-white border-2" : "bg-white/60"}`}
                  style={orderType === "delivery" ? { borderColor: primary } : {}}
                >
                  <div className="text-3xl bg-purple-50 p-3 rounded-2xl">🛵</div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">Antar ke Alamat</div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {isFashion ? "Kurir akan mengirimkan pakaian langsung ke alamat Anda" : "Kurir kami akan mengantarkan pesanan langsung ke pintu Anda"}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Checkout Form */}
      {step === "form" && (
        <div className="fixed inset-0 z-50 bg-gray-50 sm:bg-black/60 sm:backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 sm:bg-transparent" onClick={() => setStep("order-type")} />
          <div className="relative bg-white rounded-none sm:rounded-3xl h-full sm:h-auto sm:max-h-[90vh] w-full max-w-lg flex flex-col shadow-2xl animate-slide-up overflow-hidden">
            <div className="bg-white border-b px-4 py-3.5 flex items-center gap-3 shadow-sm">
              <button onClick={() => setStep("order-type")} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full"><ArrowLeft size={18} /></button>
              <div>
                <div className="font-black text-gray-900 text-sm">Lengkapi Data Pemesanan</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{displayOrderTypeLabels[orderType]}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full">
              {/* Customer Inputs */}
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100">
                <div className="font-bold text-xs text-gray-400 uppercase tracking-wide">Informasi Kontak</div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Nama Lengkap *</label>
                  <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                    placeholder="Masukkan nama Anda"
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all" />
                </div>
                
                {orderType !== "dine_in" && (
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Nomor Telepon / WhatsApp *</label>
                    <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      placeholder="Contoh: 081234567890" type="tel"
                      className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all" />
                  </div>
                )}

                {orderType === "dine_in" && (
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">{isFashion ? "Nomor Fitting Room *" : "Nomor Meja *"}</label>
                    <input value={form.tableNumber} onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
                      placeholder={isFashion ? "Nomor Fitting Room / Kabin Anda" : "Nomor meja yang Anda duduki"}
                      className="w-full px-4 py-3 bg-gray-55 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all" />
                  </div>
                )}

                {orderType === "delivery" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 block">Jarak Pengiriman *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setDeliveryDistance("near")}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            deliveryDistance === "near"
                              ? "bg-blue-50/20 border-2"
                              : "bg-gray-50"
                          }`}
                          style={deliveryDistance === "near" ? { borderColor: primary } : {}}
                        >
                          <div className="text-xl mb-0.5">📍</div>
                          <div className="font-bold text-gray-900 text-xs">Jarak Dekat</div>
                          <div className="text-[10px] text-green-600 font-semibold mt-0.5">
                            {tenant?.deliveryFeeNear === 0 || tenant?.deliveryFeeNear === undefined ? "Gratis" : formatRp(Number(tenant.deliveryFeeNear))}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryDistance("far")}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            deliveryDistance === "far"
                              ? "bg-blue-50/20 border-2"
                              : "bg-gray-50"
                          }`}
                          style={deliveryDistance === "far" ? { borderColor: primary } : {}}
                        >
                          <div className="text-xl mb-0.5">🚀</div>
                          <div className="font-bold text-gray-900 text-xs">Jarak Jauh</div>
                          <div className="text-[10px] text-primary font-semibold mt-0.5">
                            {formatRp(Number(tenant?.deliveryFeeFar ?? 5000))}
                          </div>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">Alamat Lengkap Pengantaran *</label>
                      <textarea value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))}
                        placeholder="Tuliskan nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all resize-none text-foreground" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">Patokan Alamat / Catatan Pengiriman</label>
                      <input value={form.deliveryNotes} onChange={e => setForm(f => ({ ...f, deliveryNotes: e.target.value }))}
                        placeholder="Contoh: Rumah warna biru pagar besi hitam"
                        className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all text-foreground" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">Link Google Maps (Opsional)</label>
                      <div className="flex gap-2">
                        <input value={form.googleMapsLocation} onChange={e => setForm(f => ({ ...f, googleMapsLocation: e.target.value }))}
                          placeholder="Tempel link share lokasi Google Maps Anda"
                          className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all text-foreground" />
                        <button
                          type="button"
                          onClick={() => setMapModalOpen(true)}
                          className="px-4 py-3 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-2xl transition-colors whitespace-nowrap flex items-center gap-1.5"
                          style={{ color: primary, backgroundColor: `${primary}15` }}
                        >
                          <MapPin size={14} />
                          <span>Pin Lokasi</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Catatan Tambahan Pesanan</label>
                  <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Alergi, permintaan khusus, sendok garpu..."
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all" />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100">
                <div className="font-bold text-xs text-gray-400 uppercase tracking-wide">Metode Pembayaran</div>
                <div className="space-y-2">
                  {availablePayments.map(pm => (
                    <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border transition-all text-left ${paymentMethod === pm.value ? "bg-blue-50/50 border-2" : "bg-gray-50/50 border-transparent hover:bg-gray-100/50"}`}
                      style={paymentMethod === pm.value ? { borderColor: primary } : {}}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${paymentMethod === pm.value ? "" : "border-gray-300"}`}
                        style={paymentMethod === pm.value ? { borderColor: primary } : {}}>
                        {paymentMethod === pm.value && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primary }} />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-800">{pm.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{pm.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-4 py-3">{submitError}</div>
              )}
            </div>

            {/* Sticky checkout bottom */}
            <div className="p-4 bg-white border-t">
              <div className="w-full flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Total Bayar</span>
                  <span className="text-base font-black" style={{ color: primary }}>
                    {formatRp( cartTotalWithTax + (orderType === "delivery" ? (deliveryDistance === "near" ? (tenant?.deliveryFeeNear !== undefined ? Number(tenant.deliveryFeeNear) : 0) : (tenant?.deliveryFeeFar !== undefined ? Number(tenant.deliveryFeeFar) : 5000)) : 0) )}
                  </span>
                  {hasPointDiscount && (
                    <span className="text-[9px] text-amber-605 font-bold leading-none mt-0.5">
                      {customer.activeReward === "grand_reward"
                        ? "Grand Reward Aktif (Free Minuman & Toast)"
                        : `Hemat ${formatRp(pointDiscountAmount)} (Diskon ${customer.activeReward === "discount_20" ? "20%" : customer.activeReward === "discount_30" ? "30%" : customer.activeReward === "discount_40" ? "40%" : customer.activeReward === "discount_50" ? "50%" : "10%"})`}
                    </span>
                  )}
                </div>
                
                {!isStoreOpen ? (
                  <button
                    disabled
                    className="flex-1 py-4 rounded-3xl bg-red-100 text-red-500 border border-red-200 font-bold text-xs flex items-center justify-center gap-2 select-none cursor-not-allowed"
                  >
                    Toko Sedang Tutup
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                    className="flex-1 py-4 rounded-3xl text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-primary/25"
                    style={{ backgroundColor: primary }}>
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Konfirmasi & Kirim Pesanan</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Pin Location Modal */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-slide-up border">
            <div className="bg-white border-b px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={18} style={{ color: primary }} />
                <span className="font-black text-gray-900 text-sm">Pin Lokasi Pengiriman</span>
              </div>
              <button
                type="button"
                onClick={() => setMapModalOpen(false)}
                className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="text-xs text-gray-500 leading-relaxed">
                Silakan geser pin merah atau klik peta untuk menentukan lokasi rumah Anda secara tepat di peta.
              </div>
              
              {/* Map Container */}
              <div
                id="leaflet-map"
                className="h-68 sm:h-80 w-full rounded-2xl border border-gray-200 bg-gray-50 relative overflow-hidden shadow-inner animate-fade-in"
              />
              
              {tempCoords && (
                <div className="text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-xl border font-mono">
                  Koordinat: {tempCoords.lat.toFixed(6)}, {tempCoords.lng.toFixed(6)}
                </div>
              )}
            </div>

            <div className="border-t p-4 bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setMapModalOpen(false)}
                className="flex-1 py-3 border rounded-2xl text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                disabled={geocoding || !tempCoords}
                className="flex-1 py-3 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: primary }}
              >
                {geocoding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mencari Alamat...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Konfirmasi Lokasi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Order Floating Notification */}
      {activeOrders.length > 0 && step === "menu" && (
        <div className="fixed bottom-24 left-4 right-4 z-35 max-w-md mx-auto w-full animate-slide-up">
          <button
            onClick={() => {
              if (activeOrders.length === 1) {
                setTrackingId(activeOrders[0].id);
                setStep("success");
              } else {
                setHistoryOpen(true);
              }
            }}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-3xl bg-amber-500 text-white shadow-xl hover:opacity-95 transition-all border border-amber-400 font-bold text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>Pesanan Aktif ({activeOrders.length}): Sedang diproses...</span>
            </div>
            <span className="underline font-black">Pantau Pesanan</span>
          </button>
        </div>
      )}

      {/* Order History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-slide-up border max-h-[80vh]">
            <div className="bg-white border-b px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} style={{ color: primary }} />
                <span className="font-black text-gray-900 text-sm">Riwayat & Pelacakan Pesanan</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {customerOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ClipboardList size={48} className="mx-auto mb-3 opacity-25" />
                  <div className="text-sm font-semibold">Belum ada riwayat pesanan</div>
                  <p className="text-xs text-gray-300 mt-1">Pesanan Anda akan muncul di sini setelah Anda melakukan order.</p>
                </div>
              ) : (
                [...customerOrders].reverse().map((o) => {
                  const isActive = o.status !== "completed" && o.status !== "cancelled";
                  const stepInfo = STATUS_STEPS[o.status] || { label: o.status, icon: Clock };
                  const formattedDate = new Date(o.createdAt).toLocaleString("id-ID", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  });
                  return (
                    <div key={o.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-gray-900 font-mono">Order #{o.id}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{formattedDate}</div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          o.status === "completed" ? "bg-green-50 text-green-700 border-green-200" :
                          o.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {stepInfo.label}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-650 space-y-1">
                        <div className="flex justify-between">
                          <span>Tipe Pesanan:</span>
                          <span className="font-semibold">{ORDER_TYPE_LABELS[o.orderType] || o.orderType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Bayar:</span>
                          <span className="font-black text-gray-900">{formatRp(Number(o.total))}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setTrackingId(o.id);
                          setStep("success");
                          setHistoryOpen(false);
                        }}
                        className="w-full py-2.5 text-center text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: primary, color: "#ffffff" }}
                      >
                        {isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>Lacak Status Pesanan</span>
                          </>
                        ) : (
                          <span>Lihat Rincian & Struk</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Profile & Loyalty Modal */}
      {profileOpen && customer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-slide-up border max-h-[90vh]">
            <div className="bg-white border-b px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={18} style={{ color: primary }} />
                <span className="font-black text-gray-900 text-sm">Akun Saya</span>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Success & Error */}
              {profileError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-4 py-3 font-semibold text-center font-sans">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-2xl px-4 py-3 font-semibold text-center font-sans">
                  {profileSuccess}
                </div>
              )}

              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-gray-100 flex items-center justify-center overflow-hidden">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-gray-300" />
                    )}
                  </div>
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-white border shadow p-2 rounded-full cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={avatarUploading}
                    />
                    <Sparkles size={14} style={{ color: primary }} />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-sm text-gray-800 font-sans">{customer.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-sans">{customer.phone}</p>
                </div>
              </div>

              {/* Loyalty Points */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={16} className="text-amber-500 animate-pulse" />
                    <span className="font-black text-gray-800 text-xs uppercase tracking-wider font-sans">Loyalitas Poin</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider font-sans ${
                    customer.membershipLevel === "platinum" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                    customer.membershipLevel === "gold" ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                    customer.membershipLevel === "silver" ? "bg-slate-200 text-slate-700 border border-slate-300" :
                    "bg-amber-100 text-amber-700 border border-amber-200"
                  }`}>
                    {customer.membershipLevel || "regular"} Member
                  </span>
                </div>

                <div className="flex items-baseline justify-between font-sans">
                  <div className="text-2xl font-black text-amber-700">{customer.loyaltyPoints || 0} Poin</div>
                  <div className="text-xs text-gray-500 font-semibold">Target Klaim (1000 Poin)</div>
                </div>

                <div className="w-full bg-gray-200/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((customer.loyaltyPoints || 0) / 1000) * 100)}%`,
                      backgroundColor: primary
                    }}
                  />
                </div>

                <div className="text-[10px] text-gray-500 leading-relaxed space-y-1 font-sans">
                  <p>• Dapatkan +10 poin setiap pembelian 1 menu (apapun produk dan harganya).</p>
                  <p>• Setiap kelipatan 100 poin (s.d 500) bisa klaim reward diskon 10% - 50% untuk transaksi berikutnya.</p>
                  <p>• Poin akan terus terakumulasi hingga 1000 poin dan direset setelah mengklaim Grand Reward (1 free minuman & 1 toast).</p>
                </div>

                {hasPointDiscount ? (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-650 text-white text-xs font-black p-3.5 rounded-2xl text-center shadow-inner font-sans">
                    🎁 REWARD AKTIF: {
                      customer.activeReward === "grand_reward"
                        ? "FREE 1 MINUMAN & 1 TOAST"
                        : `DISKON ${customer.activeReward === "discount_20" ? "20%" : customer.activeReward === "discount_30" ? "30%" : customer.activeReward === "discount_40" ? "40%" : customer.activeReward === "discount_50" ? "50%" : "10%"}`
                    }
                    <p className="text-[10px] font-normal opacity-90 mt-0.5">Diskon otomatis diterapkan pada transaksi Anda berikutnya.</p>
                  </div>
                ) : (() => {
                  const claimedList = customer.claimedMilestones || [];
                  const points = customer.loyaltyPoints || 0;
                  
                  if (points >= 1000) {
                    return (
                      <button
                        onClick={() => handleCustomerClaimReward(1000)}
                        disabled={customerClaiming}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-98 cursor-pointer font-sans"
                      >
                        {customerClaiming ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>KLAIM GRAND REWARD (1000 Poin)</span>
                          </>
                        )}
                      </button>
                    );
                  }
                  
                  const milestones = [100, 200, 300, 400, 500];
                  const maxClaimed = claimedList.length > 0 ? Math.max(...claimedList) : 0;

                  // If points are 500+ and they have already claimed 500 milestone (50% discount)
                  if (points >= 500 && maxClaimed === 500) {
                    return (
                      <div className="space-y-3">
                        <button
                          disabled
                          className="w-full py-3.5 bg-gray-200 text-gray-400 border border-gray-300/40 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-not-allowed font-sans select-none"
                        >
                          <Sparkles size={14} className="opacity-40" />
                          <span>KLAIM GRAND REWARD (1000 Poin)</span>
                        </button>
                        <div className="text-center bg-amber-50/50 rounded-2xl p-3.5 border border-dashed border-amber-200 text-xs font-semibold text-amber-800 font-sans">
                          Kumpulkan {1000 - points} Poin Lagi untuk Klaim Grand Reward
                        </div>
                      </div>
                    );
                  }

                  const claimable = milestones.filter(m => points >= m && m > maxClaimed && !claimedList.includes(m));
                  
                  if (claimable.length > 0) {
                    const highestMilestone = Math.max(...claimable);
                    const discountPercent = highestMilestone / 10;
                    return (
                      <button
                        onClick={() => handleCustomerClaimReward(highestMilestone)}
                        disabled={customerClaiming}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-98 cursor-pointer font-sans"
                      >
                        {customerClaiming ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>KLAIM DISKON {discountPercent}% ({highestMilestone} Poin)</span>
                          </>
                        )}
                      </button>
                    );
                  }
                  
                  const nextMilestone = milestones.find(m => points < m) || 1000;
                  return (
                    <div className="text-center bg-amber-50/50 rounded-2xl p-3.5 border border-dashed border-amber-200 text-xs font-semibold text-amber-800 font-sans">
                      Kumpulkan {nextMilestone - points} Poin Lagi untuk Klaim {nextMilestone === 1000 ? "Grand Reward" : `Diskon ${nextMilestone / 10}%`}
                    </div>
                  );
                })()}
              </div>

              {/* Account Stats Panel */}
              <div className="bg-gray-50 border border-gray-150 rounded-3xl p-4.5 space-y-3.5 font-sans">
                <div className="flex items-center gap-1.5 border-b pb-2 border-gray-200">
                  <User size={15} style={{ color: primary }} />
                  <span className="font-black text-gray-800 text-xs uppercase tracking-wider">Ringkasan Aktivitas</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center font-sans">
                  <div className="bg-white border rounded-2xl p-3 flex flex-col justify-between shadow-xs">
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase">Total Transaksi</span>
                    <span className="text-xs font-black text-gray-850 mt-1">{customer.totalOrders ?? 0} Kali</span>
                  </div>
                  <div className="bg-white border rounded-2xl p-3 flex flex-col justify-between shadow-xs">
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase">Total Belanja</span>
                    <span className="text-xs font-black text-gray-850 mt-1 truncate">{formatRp(customer.totalSpent ?? 0)}</span>
                  </div>
                </div>
                <div className="bg-white border rounded-2xl p-3 flex flex-col justify-between shadow-xs">
                  <span className="text-[9px] text-gray-400 font-extrabold uppercase text-left">Produk Favorit</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-black text-gray-850 truncate pr-2">{customer.favoriteProduct || "Belum ada"}</span>
                    <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-black uppercase shrink-0">Bestseller</span>
                  </div>
                </div>
              </div>

              {/* Form Update Profile */}
              <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2 font-sans">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none transition-all text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Nomor HP</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none transition-all text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Password Baru (Kosongkan jika tidak diubah)</label>
                  <input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={profileForm.password}
                    onChange={e => setProfileForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-xs border focus:border-gray-200 focus:outline-none transition-all text-foreground"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                  style={{ backgroundColor: primary }}
                >
                  Simpan Perubahan
                </button>
              </form>
            </div>

            <div className="border-t p-4 bg-gray-50 flex gap-3 font-sans">
              <button
                type="button"
                onClick={handleCustomerLogout}
                className="w-full py-3 bg-white border border-red-200 rounded-2xl text-xs font-bold text-red-650 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
