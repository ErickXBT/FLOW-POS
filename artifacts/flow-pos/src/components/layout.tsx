import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Package, Tag, ClipboardList,
  Users, UserCheck, BarChart3, Warehouse, Settings,
  Shield, LogOut, Menu, X, Sun, Moon, Smartphone,
  ChefHat, Truck, Activity, MapPin, ShieldCheck, QrCode, ShoppingBag, Sparkles,
  Receipt, Coins, History, ArrowLeftRight, Printer, AlertTriangle, Bell,
  Calendar, Wrench, Briefcase, Clock
} from "lucide-react";
import flowLogo from "@assets/FLOW_LOGO_1780799864457.png";
import type { AuthUser } from "@/hooks/use-auth";
import { ROLE_LABELS, hasPermission } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { useGetTenant, getGetTenantQueryKey, useListAnnouncements, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import { playOrderAlertSound, requestNotificationPermission, formatOrderNotificationDetails, unlockAudioContext } from "@/lib/audio-service";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Role color badges
const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  kitchen_staff: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivery_staff: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  staff: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

interface LayoutProps {
  user: AuthUser;
  onLogout: () => void;
  isImpersonating?: boolean;
  exitImpersonate?: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, isImpersonating, exitImpersonate, children }: LayoutProps) {
  const { activeBranchId, setActiveBranchId, branches } = useActiveBranch();
  const { data: tenant } = useGetTenant({
    query: {
      queryKey: getGetTenantQueryKey(),
      enabled: !!user?.tenantId
    }
  });

  useEffect(() => {
    if (tenant?.primaryColor) {
      const color = tenant.primaryColor;
      try {
        const hex = color.replace(/^#/, "");
        let num = parseInt(hex, 16);
        if (hex.length === 3) {
          num = parseInt(
            hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2],
            16
          );
        }
        let r = (num >> 16) & 255;
        let g = (num >> 8) & 255;
        let b = num & 255;
        
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        let l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        
        const h_deg = Math.round(h * 360);
        const s_pct = Math.round(s * 100);
        const l_pct = Math.round(l * 100);
        
        document.documentElement.style.setProperty("--primary", `${h_deg} ${s_pct}% ${l_pct}%`);
        document.documentElement.style.setProperty("--sidebar-primary", `${h_deg} ${s_pct}% ${l_pct}%`);
        document.documentElement.style.setProperty("--sidebar-ring", `${h_deg} ${s_pct}% ${l_pct}%`);
        document.documentElement.style.setProperty("--ring", `${h_deg} ${s_pct}% ${l_pct}%`);
      } catch (err) {
        console.error("Failed to parse tenant primaryColor:", err);
      }
    } else {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--sidebar-primary");
      document.documentElement.style.removeProperty("--sidebar-ring");
      document.documentElement.style.removeProperty("--ring");
    }

    return () => {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--sidebar-primary");
      document.documentElement.style.removeProperty("--sidebar-ring");
      document.documentElement.style.removeProperty("--ring");
    };
  }, [tenant?.primaryColor]);

  const isOwnerOrManager = user.role === "owner" || user.role === "manager";
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDark(d => !d);
  };

  const { toast } = useToast();
  const tokenRef = useRef(localStorage.getItem("flow_token") ?? "");
  const [activePopupOrder, setActivePopupOrder] = useState<any | null>(null);

  const isSuperAdmin = user.role === "super_admin";
  const { data: rawAnnouncements } = useListAnnouncements({
    query: {
      enabled: !isSuperAdmin,
      queryKey: getListAnnouncementsQueryKey()
    }
  });

  const activeAnnouncements = ((rawAnnouncements || []) as any[]).filter((a: any) => a.isActive);
  const maintenanceAlerts = activeAnnouncements.filter((a: any) => a.type === "maintenance");
  const carouselBanners = activeAnnouncements.filter((a: any) => a.type !== "maintenance");

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setCurrentSlide(0);
  }, [carouselBanners.length]);

  useEffect(() => {
    if (carouselBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % carouselBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [carouselBanners.length]);

  // Request Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  // Barcode scanner auto-checkout on specific pages
  useEffect(() => {
    const allowedPages = ["/dashboard", "/customer-orders", "/kitchen", "/delivery"];
    if (!allowedPages.includes(location)) return;
 
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
 
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = "";
      }
 
      if (e.key !== "Enter") {
        if (e.key.length === 1) {
          barcodeBuffer += e.key;
        }
      } else {
        if (barcodeBuffer.length >= 3) {
          if (!isInput || (currentTime - lastKeyTime < 50)) {
            e.preventDefault();
            e.stopPropagation();
            const scannedCode = barcodeBuffer.trim();
            barcodeBuffer = "";
 
            try {
              const token = localStorage.getItem("flow_token") ?? "";
              const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/tenant/customer-orders/scan-checkout`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                  barcode: scannedCode,
                  branchId: activeBranchId
                })
              });
 
              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Gagal melakukan checkout");
              }
 
              const data = await res.json();
              toast({
                title: "Checkout Otomatis Berhasil",
                description: `Produk "${data.items?.[0]?.productName || 'Produk'}" telah berhasil masuk ke antrean Pesanan Online & Display Packing.`,
              });
            } catch (err: any) {
              console.error(err);
              toast({
                variant: "destructive",
                title: "Checkout Gagal",
                description: err.message || "Gagal menghubungkan ke server.",
              });
            }
          }
        }
        barcodeBuffer = "";
      }
      lastKeyTime = currentTime;
    };
 
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [location, activeBranchId]);

  // Auto-unlock AudioContext & request Notification permission on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudioContext();
      requestNotificationPermission().catch(() => {});
    };
    window.addEventListener("pointerdown", handleFirstInteraction, { once: true });
    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  const triggerNativeNotification = (ord: any) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      if (Notification.permission === "granted") {
        try {
          const { title, body } = formatOrderNotificationDetails(ord);
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
              (reg as any).showNotification(title, {
                body,
                icon: "/icon-192.jpg",
                badge: "/icon-192.jpg",
                vibrate: [200, 100, 200, 100, 200],
                data: "/customer-orders",
              });
            }).catch(() => {
              new Notification(title, { body, icon: "/icon-192.jpg" });
            });
          } else {
            new Notification(title, { body, icon: "/icon-192.jpg" });
          }
        } catch (err) {
          console.error("Failed to trigger native notification:", err);
        }
      }
    }
  };

  const userRef = useRef(user);
  userRef.current = user;
  const activeBranchIdRef = useRef(activeBranchId);
  activeBranchIdRef.current = activeBranchId;

  const seenOrderIdsRef = useRef<Set<string | number>>(new Set());
  const isInitialOrderFetchRef = useRef<boolean>(true);

  const triggerOrderNotification = useCallback((ord: any) => {
    const currentUser = userRef.current;
    if (!currentUser || currentUser.role === "super_admin") return;

    const isOwner = currentUser.role === "owner" || currentUser.role === "manager";
    const curBranchId = activeBranchIdRef.current;
    const isTargetBranch = !currentUser.branchId || isOwner || !curBranchId || ord.branchId === curBranchId || ord.branchId === currentUser.branchId;

    if (isTargetBranch) {
      // 1. Play loud bell chime sound
      playOrderAlertSound();

      // 2. Trigger native push notification
      triggerNativeNotification(ord);

      // 3. Pop up detailed overlay modal
      setActivePopupOrder(ord);

      // 4. Show detailed toast notification
      const notifInfo = formatOrderNotificationDetails(ord);
      toast({
        title: notifInfo.title,
        description: notifInfo.body,
        duration: 10000,
      });
    }
  }, [toast]);

  // Realtime SSE Listener (persistent connection per user session)
  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    const token = localStorage.getItem("flow_token") ?? "";
    tokenRef.current = token;
    if (!token) return;

    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    let evtSrc: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      evtSrc = new EventSource(`${BASE}/api/tenant/orders/events?token=${encodeURIComponent(token)}`);

      evtSrc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_order" && data.order) {
            if (data.order.id) seenOrderIdsRef.current.add(data.order.id);
            triggerOrderNotification(data.order);
          }
        } catch (err) {
          console.error("Error processing SSE message in Layout:", err);
        }
      };

      evtSrc.onerror = () => {
        if (evtSrc) evtSrc.close();
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (evtSrc) evtSrc.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user?.id, triggerOrderNotification]);

  // Backup Realtime Order Detector (3s interval) - Checks both POS Cashier Orders and Customer Menu Orders
  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    const token = localStorage.getItem("flow_token") ?? "";
    if (!token) return;

    const checkNewOrders = async () => {
      try {
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        
        // 1. Fetch recent customer orders (Online + KDS)
        const resCust = await fetch(`${BASE}/api/tenant/customer-orders?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        let custOrders: any[] = [];
        if (resCust.ok) {
          const jsonCust = await resCust.json();
          custOrders = Array.isArray(jsonCust) ? jsonCust : (Array.isArray(jsonCust?.data) ? jsonCust.data : []);
        }

        // 2. Fetch recent main sales orders (POS Cashier transactions)
        const resPos = await fetch(`${BASE}/api/orders?limit=30`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        let posOrders: any[] = [];
        if (resPos.ok) {
          const jsonPos = await resPos.json();
          posOrders = Array.isArray(jsonPos) ? jsonPos : (Array.isArray(jsonPos?.data) ? jsonPos.data : []);
        }

        const allRecentOrders = [...custOrders, ...posOrders];

        if (isInitialOrderFetchRef.current) {
          allRecentOrders.forEach((o: any) => {
            const key = o.id ? `id_${o.id}` : `num_${o.orderNumber}`;
            if (key) seenOrderIdsRef.current.add(key);
          });
          isInitialOrderFetchRef.current = false;
          return;
        }

        for (const ord of allRecentOrders) {
          const key = ord.id ? `id_${ord.id}` : `num_${ord.orderNumber}`;
          if (key && !seenOrderIdsRef.current.has(key)) {
            seenOrderIdsRef.current.add(key);
            triggerOrderNotification(ord);
          }
        }
      } catch (err) {
        console.error("Order polling error:", err);
      }
    };

    const timer = setTimeout(checkNewOrders, 1000);
    const interval = setInterval(checkNewOrders, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user?.id, triggerOrderNotification]);

  // Listen for local POS orders created on the same window
  useEffect(() => {
    const handlePosOrderCreated = (e: any) => {
      if (e.detail) {
        if (e.detail.id) seenOrderIdsRef.current.add(e.detail.id);
        triggerOrderNotification(e.detail);
      }
    };
    window.addEventListener("flow_pos_order_created", handlePosOrderCreated);
    return () => {
      window.removeEventListener("flow_pos_order_created", handlePosOrderCreated);
    };
  }, [triggerOrderNotification]);

  // Auto Register Background Web Push Subscription for Mobile HP lockscreen when closed
  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const token = localStorage.getItem("flow_token");
    if (!token) return;

    const registerPush = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        const resKey = await fetch(`${BASE}/api/push/vapid-key`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resKey.ok) return;
        const { vapidPublicKey } = await resKey.json();
        if (!vapidPublicKey) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
          const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const convertedKey = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            convertedKey[i] = rawData.charCodeAt(i);
          }

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
        }

        if (sub) {
          await fetch(`${BASE}/api/push/subscribe`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ subscription: sub })
          });
        }
      } catch (err) {
        console.error("Auto Web Push subscription error:", err);
      }
    };

    registerPush();
  }, [user?.id]);

  const navItems: NavItem[] = [];

  if (user.role === "super_admin") {
    navItems.push({ href: "/admin", label: "Super Admin", icon: <Shield size={18} /> });
  } else {
    // Normal / Custom tenant users
    const engine = user.businessEngine || "retail";
    const isFashion = user.businessType === "fashion";

    // 1. Dashboard is core and common for all engines
    if (hasPermission(user, "view_dashboard")) {
      navItems.push({ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> });
    }

    // 2. FlowAI Insights is core and common for all engines
    if (user.role === "owner" || user.role === "manager" || hasPermission(user, "view_reports")) {
      navItems.push({ href: "/flowai", label: "FlowAI Insights", icon: <Sparkles size={18} /> });
    }

    // 3. Engine Specific Menus
    if (engine === "retail") {
      // Flow Retail Specific Menus
      if (hasPermission(user, "view_pos")) {
        navItems.push({ href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> });
      }
      if (hasPermission(user, "manage_orders")) {
        navItems.push({ href: "/customer-orders", label: "Pesanan Online", icon: <Smartphone size={18} /> });
      }
      if (hasPermission(user, "view_kitchen")) {
        navItems.push({
          href: "/kitchen",
          label: isFashion ? "Display Packing" : "Display Dapur",
          icon: isFashion ? <ShoppingBag size={18} /> : <ChefHat size={18} />
        });
      }
      if (hasPermission(user, "view_delivery")) {
        navItems.push({ href: "/delivery", label: "Delivery", icon: <Truck size={18} /> });
      }
      if (hasPermission(user, "manage_orders")) {
        navItems.push({ href: "/orders", label: "Transaksi", icon: <ClipboardList size={18} /> });
      }
      if (hasPermission(user, "manage_products")) {
        navItems.push({ href: "/products", label: "Produk", icon: <Package size={18} /> });
        navItems.push({ href: "/categories", label: "Kategori", icon: <Tag size={18} /> });
      }
      if (hasPermission(user, "manage_inventory")) {
        navItems.push({ href: "/inventory", label: "Inventori", icon: <Warehouse size={18} /> });
      }
    } else if (engine === "booking") {
      // Flow Booking Specific Menus
      navItems.push({ href: "/calendar", label: "Kalender", icon: <Calendar size={18} /> });
      navItems.push({ href: "/bookings", label: "Booking", icon: <ClipboardList size={18} /> });
      navItems.push({ href: "/resources", label: "Lapangan", icon: <Warehouse size={18} /> });
      if (hasPermission(user, "manage_products")) {
        navItems.push({ href: "/products", label: "Produk", icon: <Package size={18} /> });
        navItems.push({ href: "/categories", label: "Kategori", icon: <Tag size={18} /> });
      }
      if (hasPermission(user, "view_pos")) {
        navItems.push({ href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> });
      }
    } else if (engine === "appointment") {
      // Flow Appointment Specific Menus
      navItems.push({ href: "/appointments", label: "Appointment", icon: <Calendar size={18} /> });
      navItems.push({ href: "/staff-schedule", label: "Staff", icon: <Users size={18} /> });
      navItems.push({ href: "/services", label: "Service", icon: <Briefcase size={18} /> });
      if (hasPermission(user, "manage_products")) {
        navItems.push({ href: "/products", label: "Produk", icon: <Package size={18} /> });
        navItems.push({ href: "/categories", label: "Kategori", icon: <Tag size={18} /> });
      }
      if (hasPermission(user, "view_pos")) {
        navItems.push({ href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> });
      }
    } else if (engine === "service") {
      // Flow Service Specific Menus
      navItems.push({ href: "/work-orders", label: "Work Order", icon: <ClipboardList size={18} /> });
      navItems.push({ href: "/queue", label: "Queue", icon: <Clock size={18} /> });
      navItems.push({ href: "/technicians", label: "Teknisi", icon: <Wrench size={18} /> });
      if (hasPermission(user, "manage_products")) {
        navItems.push({ href: "/products", label: "Produk", icon: <Package size={18} /> });
        navItems.push({ href: "/categories", label: "Kategori", icon: <Tag size={18} /> });
      }
      if (hasPermission(user, "view_pos")) {
        navItems.push({ href: "/pos", label: "Kasir (POS)", icon: <ShoppingCart size={18} /> });
      }
    }

    // 4. Core Core menus (Common across all engines)
    if (hasPermission(user, "manage_customers")) {
      navItems.push({ href: "/customers", label: "Pelanggan", icon: <Users size={18} /> });
    }
    if (hasPermission(user, "manage_employees")) {
      navItems.push({ href: "/employees", label: "Karyawan", icon: <UserCheck size={18} /> });
    }
    // Only owners can manage branches and roles
    if (user.role === "owner") {
      navItems.push({ href: "/branches", label: "Cabang (Branch)", icon: <MapPin size={18} /> });
      navItems.push({ href: "/roles", label: "Role & Hak Akses", icon: <ShieldCheck size={18} /> });
    }
    if (hasPermission(user, "view_reports")) {
      navItems.push({ href: "/reports", label: "Laporan", icon: <BarChart3 size={18} /> });
    }
    // QR Menu / Booking link enabled for all engines
    if (hasPermission(user, "manage_qr_menu")) {
      const qrLabel = engine === "booking"
        ? "QR Booking"
        : engine === "appointment"
        ? "QR Reservasi"
        : engine === "service"
        ? "QR Layanan"
        : isFashion
        ? "QR Katalog"
        : "QR Menu";

      navItems.push({
        href: "/qr-menu",
        label: qrLabel,
        icon: <QrCode size={18} />
      });
    }
    if (hasPermission(user, "view_activity_logs")) {
      navItems.push({ href: "/activity-logs", label: "Log Aktivitas", icon: <Activity size={18} /> });
    }
    if (hasPermission(user, "manage_settings")) {
      navItems.push({ href: "/settings", label: "Pengaturan", icon: <Settings size={18} /> });
    }
    if (user.role === "owner" || user.role === "manager" || user.role === "cashier" || hasPermission(user, "manage_settings")) {
      navItems.push({ href: "/printer-settings", label: "Pengaturan Printer", icon: <Printer size={18} /> });
    }

    // Tenant Owner & Manager cash & stock transfer tools (Common)
    if (user.role === "owner" || user.role === "manager") {
      navItems.push({ href: "/rekap-kas", label: "Rekap Kas Bulanan", icon: <Coins size={18} /> });
      navItems.push({ href: "/mutasi-kas", label: "Mutasi Kas", icon: <ArrowLeftRight size={18} /> });
      navItems.push({ href: "/riwayat-cetak-struk", label: "Riwayat Cetak Struk", icon: <Receipt size={18} /> });
      // Only Retail uses stock distribution
      if (engine === "retail") {
        navItems.push({ href: "/ambil-stok", label: "Ambil/Saluran Stok", icon: <Warehouse size={18} /> });
      }
    }
  }

  // Kitchen/Delivery staff get full-screen layout (no sidebar)
  const isFullscreen = user.role === "kitchen_staff" || user.role === "delivery_staff";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <img src={flowLogo} alt="Flow" className="h-8 brightness-0 invert" />
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(item => {
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-sidebar-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sm font-bold text-sidebar-primary-foreground flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sidebar-foreground text-sm font-medium truncate">{user.name}</div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${ROLE_COLORS[user.role] ?? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
              {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground opacity-70 hover:opacity-100 hover:bg-sidebar-accent transition-all"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </div>
  );

  const now = new Date();
  const plan = tenant?.subscriptionPlan || "trial";
  const expiresAt = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
  const isTrialExpired = user.role !== "super_admin" && plan === "trial" && expiresAt && expiresAt < now;

  if (isTrialExpired) {
    const isOwner = user.role === "owner";
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
        
        {/* Decorative glowing blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-lg bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 text-center animate-scale-up">
          {/* Logo & Lock Icon */}
          <div className="space-y-4">
            <img src={flowLogo} alt="Flow" className="h-10 mx-auto brightness-0 invert" />
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-3xl border border-red-500/20 shadow-inner">
              🔒
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Masa Uji Coba Gratis Anda Telah Berakhir</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Paket Uji Coba Gratis 7 Hari untuk bisnis <span className="font-semibold text-white">"{tenant?.name || "Anda"}"</span> telah habis masa berlakunya.
            </p>
          </div>

          {isOwner ? (
            /* Upgrade instructions for owner */
            <div className="space-y-5 text-left">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3.5 shadow-inner">
                <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Langkah Upgrade ke FlowApp UMKM:</div>
                <div className="space-y-1 text-xs text-slate-300">
                  <p>1. Transfer biaya langganan sebesar <span className="font-bold text-white">Rp 249.000 / bulan</span> ke rekening BCA di bawah.</p>
                  <p>2. Klik tombol konfirmasi WhatsApp untuk mengirimkan bukti transfer kepada Admin.</p>
                  <p>3. Admin akan segera mengaktifkan akun Anda.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rekening Transfer Resmi</div>
                <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Bank</span>
                    <span className="font-bold text-white">BCA</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">No. Rekening</span>
                    <span className="font-mono font-bold text-primary select-all">0374739634</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Atas Nama</span>
                    <span className="font-bold text-white">Andri Jumawal Satria</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <a
                  href={`https://wa.me/6281297874671?text=Halo%20Admin%20FlowApp,%20saya%20ingin%20upgrade%20ke%20FlowApp%20UMKM%20untuk%20bisnis%20saya%20${encodeURIComponent(tenant?.name || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-primary/20 animate-pulse hover:animate-none"
                >
                  💬 Konfirmasi Pembayaran (WhatsApp)
                </a>
                
                <button
                  onClick={onLogout}
                  className="w-full py-2.5 bg-transparent border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 font-semibold text-xs rounded-xl transition-all"
                >
                  Keluar Akun
                </button>
              </div>
            </div>
          ) : (
            /* Message for employee/staff */
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-300 leading-relaxed">
                Silakan hubungi pemilik bisnis (Owner) untuk melakukan upgrade ke paket <span className="font-bold text-white">FlowApp UMKM</span> agar Anda dapat menggunakan aplikasi kasir dan mengakses dashboard kembali.
              </div>

              <div className="pt-2">
                <button
                  onClick={onLogout}
                  className="w-full py-3 bg-transparent border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 font-semibold text-xs rounded-xl transition-all"
                >
                  Keluar Akun
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 font-bold px-4 py-2.5 text-center text-xs flex items-center justify-center gap-3 select-none flex-shrink-0 shadow-md z-50 animate-bounce">
          <span>⚠️ Anda sedang menguji coba dasbor {user.branchName ? `Cabang ${user.branchName}` : "Tenant"} sebagai Super Admin</span>
          <button onClick={exitImpersonate} className="bg-amber-950 text-white rounded-lg px-3 py-1 font-semibold hover:bg-black transition-all">
            Keluar Preview
          </button>
        </div>
      )}
      
      {isFullscreen ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {user.role !== "kitchen_staff" && (
            <header className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
              <img src={flowLogo} alt="Flow" className="h-5 brightness-0 dark:invert opacity-60" />
              <div className="flex-1" />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
              </span>
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <button onClick={onLogout} className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors">
                <LogOut size={16} />
              </button>
            </header>
          )}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden lg:flex flex-col w-60 bg-sidebar flex-shrink-0 border-r border-sidebar-border">
            <SidebarContent />
          </aside>
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
              <aside className="relative w-60 bg-sidebar flex flex-col z-10">
                <button className="absolute top-4 right-4 text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
                  <X size={20} />
                </button>
                <SidebarContent />
              </aside>
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
              <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              {isOwnerOrManager ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <MapPin size={12} className="text-primary" /> Outlet:
                  </span>
                  <select
                    value={activeBranchId || ""}
                    onChange={e => setActiveBranchId(e.target.value ? Number(e.target.value) : undefined)}
                    className="px-2.5 py-1.5 border border-input rounded-xl bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold min-w-[130px]"
                  >
                    <option value="">Semua Cabang</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id} className={b.status === "locked" ? "text-red-500 font-bold" : ""}>
                        {b.status === "locked" ? `🔒 [TERKUNCI] ${b.name}` : b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                user.branchName && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/25">
                    <MapPin size={12} /> Cabang: {user.branchName}
                  </div>
                )
              )}
              <div className="flex-1" />
              <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </header>

            {/* Global Banner & Announcements (Between Outlet Selector and Page Content) */}
            {!isSuperAdmin && (maintenanceAlerts.length > 0 || carouselBanners.length > 0 || deferredPrompt) && (
              <div className="flex-shrink-0 px-6 pt-4 space-y-3">
                {/* 0. PWA Install Banner */}
                {deferredPrompt && (
                  <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow-md flex items-center justify-between gap-3 animate-slide-up relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-8 -translate-y-8 pointer-events-none" />
                    <div className="flex-1 min-w-0 relative z-10">
                      <h4 className="font-extrabold text-xs md:text-sm leading-tight flex items-center gap-1.5">
                        <Sparkles size={14} className="text-yellow-300 animate-pulse" />
                        Instal Aplikasi FlowApp
                      </h4>
                      <p className="text-[10px] md:text-xs opacity-90 leading-snug mt-0.5">Instal FlowApp di HP Anda untuk akses kasir & laporan lebih cepat</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 relative z-10">
                      <button 
                        onClick={() => setDeferredPrompt(null)} 
                        className="px-2.5 py-1 text-[10px] md:text-xs text-white/80 hover:text-white font-medium bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg transition-all"
                      >
                        Nanti
                      </button>
                      <button 
                        onClick={handleInstallClick} 
                        className="px-3.5 py-1 text-[10px] md:text-xs bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-900 font-extrabold rounded-lg shadow-md transition-all"
                      >
                        Instal
                      </button>
                    </div>
                  </div>
                )}
                {/* 1. Maintenance Alert (Urgent/Statis) */}
                {maintenanceAlerts.map((ann: any) => (
                  <div key={ann.id} className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 p-3 rounded-xl flex flex-row gap-3.5 shadow-sm border-l-4 border-l-red-500 animate-pulse items-center">
                    {ann.imageUrl && (
                      <div className="w-16 h-12 sm:w-28 sm:h-20 rounded-lg overflow-hidden border border-red-500/20 bg-muted flex-shrink-0">
                        <img src={ann.imageUrl} alt={ann.title} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs md:text-sm leading-snug">{ann.title}</h4>
                        <p className="text-[10px] md:text-xs text-muted-foreground leading-normal whitespace-pre-wrap">{ann.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. Autoplay Looping Carousel (Promo, Update, General) */}
                {carouselBanners.length > 0 && (
                  <div className="relative overflow-hidden rounded-2xl shadow-md border border-border bg-card transition-all duration-300">
                    <div 
                      className="flex transition-transform duration-500 ease-in-out"
                      style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                      {carouselBanners.map((ann: any) => {
                        const isPromo = ann.type === "promotion" || ann.type === "promo";
                        const isUpdate = ann.type === "update";
                        
                        return (
                          <div 
                            key={ann.id} 
                            className="w-full flex-shrink-0"
                            style={{ width: "100%" }}
                          >
                            {/* MOBILE VIEW (Ramping & Responsive) */}
                            {(!ann.title?.trim() && !ann.content?.trim()) ? (
                              <div className="flex md:hidden w-full h-[95px] relative">
                                <img 
                                  src={ann.mobileImageUrl || ann.imageUrl} 
                                  alt="Banner" 
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => {
                                    if (isPromo) window.location.href = "/settings";
                                  }}
                                />
                              </div>
                            ) : (
                              <div 
                                className={`flex md:hidden flex-row gap-3 items-center justify-between p-3.5 min-h-[90px] ${
                                  isPromo 
                                    ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white" 
                                    : "bg-card text-foreground"
                                } relative`}
                              >
                                {isPromo && (
                                  <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-8 -translate-y-8 pointer-events-none" />
                                )}
                                
                                {(ann.mobileImageUrl || ann.imageUrl) && (
                                  <div className={`w-[110px] h-[70px] rounded-xl overflow-hidden relative z-10 border flex-shrink-0 bg-black/5 ${
                                    isPromo ? "border-white/10" : "border-border/30 bg-muted"
                                  }`}>
                                    <img src={ann.mobileImageUrl || ann.imageUrl} alt={ann.title} className="w-full h-full object-contain" />
                                  </div>
                                )}

                                <div className="flex-1 flex flex-col justify-between relative z-10 min-w-0">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wide ${
                                        isPromo ? "bg-yellow-400 text-slate-900" : "bg-blue-100 text-blue-700"
                                      }`}>
                                        {isPromo ? "Promo" : ann.type}
                                      </span>
                                      <h4 className="font-bold text-xs leading-tight truncate max-w-[120px] xs:max-w-[160px]">{ann.title}</h4>
                                    </div>
                                    <p className={`text-[10px] leading-snug line-clamp-2 ${isPromo ? "opacity-90" : "text-muted-foreground"}`}>{ann.content}</p>
                                  </div>
                                  
                                  {isPromo && (
                                    <Link href="/settings">
                                      <a className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-900 font-extrabold text-[9px] rounded-md shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer w-fit mt-1">
                                        Kelola <Sparkles size={8} />
                                      </a>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* DESKTOP & TABLET VIEW (Text besar, Gambar full tanpa terpotong, CTA Menjolok) */}
                            {(!ann.title?.trim() && !ann.content?.trim()) ? (
                              <div className="hidden md:flex w-full h-[140px] relative">
                                <img 
                                  src={ann.imageUrl || ann.mobileImageUrl} 
                                  alt="Banner" 
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => {
                                    if (isPromo) window.location.href = "/settings";
                                  }}
                                />
                              </div>
                            ) : (
                              <div 
                                className={`hidden md:flex flex-row gap-6 items-center justify-between p-6 min-h-[140px] ${
                                  isPromo 
                                    ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white" 
                                    : "bg-card text-foreground"
                                } relative`}
                              >
                                {isPromo && (
                                  <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-x-16 -translate-y-16 pointer-events-none" />
                                )}
                                
                                {(ann.imageUrl || ann.mobileImageUrl) && (
                                  <div className={`w-[240px] lg:w-[280px] h-[96px] lg:h-[110px] rounded-xl overflow-hidden relative z-10 border flex-shrink-0 bg-black/10 ${
                                    isPromo ? "border-white/10" : "border-border/30 bg-muted"
                                  }`}>
                                    <img src={ann.imageUrl || ann.mobileImageUrl} alt={ann.title} className="w-full h-full object-contain" />
                                  </div>
                                )}

                                <div className="flex-1 flex flex-row justify-between items-center gap-6 relative z-10 min-w-0">
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                        isPromo 
                                          ? "bg-yellow-400 text-slate-900" 
                                          : isUpdate 
                                            ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400" 
                                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                                      }`}>
                                        {isPromo ? "Promo Platform" : ann.type}
                                      </span>
                                      <h4 className="font-extrabold text-base lg:text-lg leading-snug">{ann.title}</h4>
                                    </div>
                                    <p className={`text-xs lg:text-sm leading-relaxed ${isPromo ? "opacity-90" : "text-muted-foreground"}`}>{ann.content}</p>
                                  </div>
                                  
                                  {isPromo && (
                                    <Link href="/settings">
                                      <a className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-900 font-extrabold text-xs lg:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0">
                                        Kelola Langganan <Sparkles size={14} />
                                      </a>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Carousel Indicators (Dots) */}
                    {carouselBanners.length > 1 && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                        {carouselBanners.map((_: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`h-1 rounded-full transition-all ${
                              currentSlide === idx 
                                ? "w-3 bg-white dark:bg-primary" 
                                : "w-1 bg-white/40 dark:bg-muted-foreground/40"
                            }`}
                            title={`Slide ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
              {children}
            </main>

            {/* Mobile Bottom Navbar */}
            {!isFullscreen && !isSuperAdmin && (
              <div className="md:hidden fixed bottom-4 left-4 right-4 h-16 bg-primary rounded-2xl flex items-center justify-around px-2.5 z-40 select-none shadow-2xl border border-white/10 pb-safe">
                {/* 1. Dashboard */}
                {hasPermission(user, "view_dashboard") && (
                  <Link href="/dashboard">
                    <a className={`flex items-center gap-1.5 transition-all duration-300 ${
                      location === "/dashboard" 
                        ? "bg-white text-primary font-bold px-3.5 py-2 rounded-full shadow-md scale-105 animate-scale-up" 
                        : "text-white/70 hover:text-white p-2.5"
                    }`}>
                      <LayoutDashboard size={18} className={location === "/dashboard" ? "text-primary" : "text-white"} />
                      {location === "/dashboard" && <span className="text-[10px] tracking-tight font-sans">Dasbor</span>}
                    </a>
                  </Link>
                )}

                {/* 2. Kasir (POS) */}
                {hasPermission(user, "view_pos") && (
                  <Link href="/pos">
                    <a className={`flex items-center gap-1.5 transition-all duration-300 ${
                      location === "/pos" 
                        ? "bg-white text-primary font-bold px-3.5 py-2 rounded-full shadow-md scale-105 animate-scale-up" 
                        : "text-white/70 hover:text-white p-2.5"
                    }`}>
                      <ShoppingCart size={18} className={location === "/pos" ? "text-primary" : "text-white"} />
                      {location === "/pos" && <span className="text-[10px] tracking-tight font-sans">Kasir</span>}
                    </a>
                  </Link>
                )}

                {/* 3. Pesanan Online */}
                {hasPermission(user, "manage_orders") && (
                  <Link href="/customer-orders">
                    <a className={`flex items-center gap-1.5 transition-all duration-300 ${
                      location === "/customer-orders" 
                        ? "bg-white text-primary font-bold px-3.5 py-2 rounded-full shadow-md scale-105 animate-scale-up" 
                        : "text-white/70 hover:text-white p-2.5"
                    }`}>
                      <Smartphone size={18} className={location === "/customer-orders" ? "text-primary" : "text-white"} />
                      {location === "/customer-orders" && <span className="text-[10px] tracking-tight font-sans">Online</span>}
                    </a>
                  </Link>
                )}

                {/* 4. Laporan */}
                {hasPermission(user, "view_reports") && (
                  <Link href="/reports">
                    <a className={`flex items-center gap-1.5 transition-all duration-300 ${
                      location === "/reports" 
                        ? "bg-white text-primary font-bold px-3.5 py-2 rounded-full shadow-md scale-105 animate-scale-up" 
                        : "text-white/70 hover:text-white p-2.5"
                    }`}>
                      <BarChart3 size={18} className={location === "/reports" ? "text-primary" : "text-white"} />
                      {location === "/reports" && <span className="text-[10px] tracking-tight font-sans">Laporan</span>}
                    </a>
                  </Link>
                )}

                {/* 5. Menu Lainnya (Slides open the main sidebar) */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white p-2.5 transition-all duration-300"
                >
                  <Menu size={18} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Detailed Order Popup Modal */}
      {activePopupOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-destructive/5 dark:bg-destructive/10 text-destructive">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>🍳 Pesanan Baru Masuk!</span>
              </h3>
              <button
                onClick={() => setActivePopupOrder(null)}
                className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>No. Pesanan:</span>
                  <span className="font-bold text-foreground font-mono">{activePopupOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Nama Pelanggan:</span>
                  <span className="font-bold text-foreground">{activePopupOrder.customerName || "Pelanggan"}</span>
                </div>
                {activePopupOrder.orderType === "dine_in" && activePopupOrder.tableNumber && (
                  <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                    <span>Nomor Meja:</span>
                    <span className="font-bold text-foreground">{activePopupOrder.tableNumber}</span>
                  </div>
                )}
                {activePopupOrder.orderType === "delivery" && activePopupOrder.deliveryAddress && (
                  <div className="flex flex-col py-1 border-b border-border/40 text-muted-foreground">
                    <span>Alamat Pengiriman:</span>
                    <span className="font-semibold text-foreground mt-1 leading-relaxed">{activePopupOrder.deliveryAddress}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Tipe Pesanan:</span>
                  <span className="font-bold text-foreground capitalize">{activePopupOrder.orderType === "dine_in" ? "Dine In" : activePopupOrder.orderType === "take_away" ? "Take Away" : "Delivery"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 text-muted-foreground">
                  <span>Waktu:</span>
                  <span className="font-semibold text-foreground">{new Date(activePopupOrder.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Pesanan</h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(activePopupOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-primary text-xs">x{item.quantity}</span>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.productName}</span>
                          {item.variantSelection && (
                            <span className="text-[10px] text-muted-foreground font-mono">{item.variantSelection}</span>
                          )}
                          {item.notes && (
                            <span className="text-[10px] text-amber-600 italic">"{item.notes}"</span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-foreground">Rp {Number(item.subtotal || item.price * item.quantity).toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/30 p-3.5 rounded-xl border border-border/60 flex justify-between items-center text-xs font-bold text-foreground">
                <span>Total Bayar ({activePopupOrder.paymentMethod === "cash" ? "Tunai" : "Non-Tunai"})</span>
                <span className="text-sm text-primary">Rp {Number(activePopupOrder.total || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-muted/10 flex gap-3">
              <button
                onClick={() => setActivePopupOrder(null)}
                className="flex-1 py-2 border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl active:scale-95 transition-all"
              >
                Tutup
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("flow_token");
                    const res = await fetch(`/api/tenant/customer-orders/${activePopupOrder.id}/status`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token || ""}`
                      },
                      body: JSON.stringify({ status: "preparing" })
                    });
                    if (res.ok) {
                      setActivePopupOrder(null);
                      toast({
                        title: "Pesanan Diterima",
                        description: "Pesanan dipindahkan ke Display Dapur untuk mulai dimasak.",
                        duration: 3000,
                      });
                    } else {
                      const errData = await res.json();
                      alert(errData.error || "Gagal memproses pesanan");
                    }
                  } catch (err) {
                    console.error("Failed to accept order:", err);
                    alert("Gagal menghubungi server");
                  }
                }}
                className="flex-1 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all shadow"
              >
                🍳 Mulai Masak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
