/**
 * Audio Notification Service for Flow POS
 * Plays bell chime alert note sequences when new orders arrive
 * and handles Web Notification permission & AudioContext unlocking.
 */

let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioContext = new AudioCtx();
    }
  }
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    globalAudioContext.resume().catch(() => {});
  }
  return globalAudioContext;
}

export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(err => console.error("Failed to resume AudioContext:", err));
  }
}

/**
 * Plays a pleasant, loud 3-tone chime sequence twice ("Ding-Dong-Ding!")
 */
export function playOrderAlertSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Helper to play a single bell note with harmonics and decay
    const playBellNote = (freq: number, startTime: number, duration: number = 0.4) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 2, startTime);

      // Volume envelope (fast attack, exponential decay)
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      gain2.gain.setValueAtTime(0.01, startTime);
      gain2.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + (duration * 0.7));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      osc2.start(startTime);
      osc2.stop(startTime + duration);
    };

    // First Chime Sequence (G5 -> C6 -> E6)
    playBellNote(783.99, now + 0.00, 0.35); // G5
    playBellNote(1046.50, now + 0.18, 0.35); // C6
    playBellNote(1318.51, now + 0.36, 0.60); // E6

    // Repeat Chime Sequence after 0.75s pause
    playBellNote(783.99, now + 0.95, 0.35);
    playBellNote(1046.50, now + 1.13, 0.35);
    playBellNote(1318.51, now + 1.31, 0.70);

  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

/**
 * Requests browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  unlockAudioContext();
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error("Failed to request notification permission:", err);
    return Notification.permission;
  }
}

/**
 * Format order detail string for push/native notification body
 */
export function formatOrderNotificationDetails(order: any): { title: string; body: string } {
  const orderNum = order.orderNumber || `#${order.id || ''}`;
  const isPosOrder = order.source === "pos" || !!order.employeeName;
  
  const title = isPosOrder 
    ? `🔔 Pesanan Kasir Masuk! (${orderNum})` 
    : `🔔 Pesanan Online Masuk! (${orderNum})`;

  const customer = order.customerName || "Pelanggan";
  const typeMap: Record<string, string> = {
    dine_in: "Dine In",
    take_away: "Take Away",
    delivery: "Delivery",
  };
  const typeStr = typeMap[order.orderType] || order.orderType || "Take Away";
  const totalStr = `Rp ${Number(order.total || 0).toLocaleString("id-ID")}`;

  const payMap: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    transfer: "Transfer",
  };
  const payStr = order.paymentMethod ? (payMap[order.paymentMethod] || order.paymentMethod) : "";

  let itemsStr = "";
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsStr = order.items
      .map((item: any) => {
        const name = item.productName || item.name || "Produk";
        const qty = item.quantity || item.qty || 1;
        const variant = item.selectedVariant || item.variantSelection ? ` (${item.selectedVariant || item.variantSelection})` : "";
        return `${qty}x ${name}${variant}`;
      })
      .slice(0, 3)
      .join(", ");

    if (order.items.length > 3) {
      itemsStr += `, +${order.items.length - 3} item lagi`;
    }
  }

  const bodyLines: string[] = [];

  if (isPosOrder && order.employeeName) {
    bodyLines.push(`Kasir: ${order.employeeName} • Pelanggan: ${customer}`);
  } else {
    bodyLines.push(`Pelanggan: ${customer}`);
  }

  bodyLines.push(`Tipe: ${typeStr} • ${totalStr}${payStr ? ` (${payStr})` : ""}`);

  if (itemsStr) {
    bodyLines.push(`Menu: ${itemsStr}`);
  }
  if (order.tableNumber) {
    bodyLines.push(`Meja: ${order.tableNumber}`);
  }

  return {
    title,
    body: bodyLines.join("\n"),
  };
}
