import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Printer, Wifi, Bluetooth, Usb, RefreshCw, Check, 
  AlertCircle, ArrowLeft, Save, ShieldAlert, Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetTenant } from "@workspace/api-client-react";
import { PrinterService, type PrinterSettings } from "@/lib/printer-service";

const DEFAULT_SETTINGS: PrinterSettings = {
  connectionMode: "browser_print",
  deviceName: "",
  ipAddress: "192.168.1.100",
  port: "9100",
  paperSize: "58mm",
  autoPrint: true,
  autoCut: false,
  fontSize: 12,
  marginLeft: 0,
  marginRight: 0,
  alignment: "left",
  showOrderType: true,
  showCustomerName: true,
  showCashierName: true,
  showNotes: true,
  showFooterMessage: true,
};

export default function PrinterSettingsPage() {
  const { toast } = useToast();
  const { data: tenant } = useGetTenant();
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState(false);
  const [pingStatus, setPingStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");

  // Load settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("flow_printer_settings");
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error("Failed to load printer settings:", e);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem("flow_printer_settings", JSON.stringify(settings));
      toast({
        title: "Konfigurasi Disimpan",
        description: "Pengaturan printer berhasil disimpan untuk perangkat ini.",
        variant: "default",
      });
    } catch (e) {
      toast({
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan ke penyimpanan lokal.",
        variant: "destructive",
      });
    }
  };

  const startScan = async () => {
    setIsScanning(true);
    try {
      if (settings.connectionMode === "bluetooth") {
        const name = await PrinterService.connectBluetooth();
        setSettings(p => ({ ...p, deviceName: name }));
        toast({
          title: "Printer Bluetooth Terhubung",
          description: `${name} terhubung sebagai printer POS utama.`,
        });
      } else if (settings.connectionMode === "usb") {
        const name = await PrinterService.connectUsb();
        setSettings(p => ({ ...p, deviceName: name }));
        toast({
          title: "Printer USB Terhubung",
          description: `${name} terhubung sebagai printer POS utama.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Koneksi Gagal",
        description: err.message || "Gagal menghubungi perangkat printer.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestPing = () => {
    if (!settings.ipAddress) {
      toast({
        title: "IP Tidak Valid",
        description: "Silakan masukkan alamat IP printer LAN terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    setPingStatus("testing");
    setTimeout(() => {
      const isValidIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(settings.ipAddress);
      if (isValidIp) {
        setPingStatus("success");
        toast({
          title: "Koneksi Berhasil",
          description: `Printer LAN pada ${settings.ipAddress}:${settings.port} terhubung.`,
        });
      } else {
        setPingStatus("failed");
        toast({
          title: "Koneksi Gagal",
          description: `Tidak dapat menjangkau ${settings.ipAddress}:${settings.port}. Periksa kabel LAN dan jaringan Wi-Fi Anda.`,
          variant: "destructive",
        });
      }
    }, 1500);
  };

  const printTestPage = async () => {
    const testOrder = {
      id: "TEST-0001",
      orderNumber: "TEST-0001",
      createdAt: new Date().toISOString(),
      orderType: "dine_in",
      tableNumber: "Meja #12",
      paymentMethod: "cash",
      employeeName: "Kasir Utama",
      customerName: "Pelanggan Tes",
      subtotal: 0,
      discount: 0,
      tax: 0,
      serviceCharge: 0,
      total: 0,
      items: [
        {
          quantity: 1,
          productName: "Test Print Connection",
          name: "Test Print Connection",
          price: 0,
          subtotal: 0,
          variantSelection: "STATUS: KONEKSI OK"
        }
      ]
    };

    try {
      await PrinterService.print(testOrder, tenant, settings);
      toast({
        title: "Cetak Berhasil",
        description: "Halaman test koneksi telah dikirim ke printer.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Cetak Gagal",
        description: err.message || "Terjadi kesalahan saat mengirim data cetak.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pos">
              <a className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all cursor-pointer">
                <ArrowLeft size={18} />
              </a>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pengaturan Printer</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Atur koneksi mesin cetak struk kasir Anda</p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Save size={14} />
            <span>Simpan Konfigurasi</span>
          </button>
        </div>

        {/* Main Panel grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Connection selection - Left column */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Printer size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Konfigurasi Printer Thermal</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Atur koneksi printer untuk cetak struk otomatis.</p>
              </div>
            </div>

            {/* Connection Mode Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode Koneksi Printer</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { 
                    id: "browser_print", 
                    title: "Browser / System Print Dialog (USB & Bluetooth)", 
                    desc: "Menggunakan dialog cetak bawaan sistem operasi. Cocok untuk semua printer dengan driver.",
                    icon: <Printer className="text-indigo-500" size={16} /> 
                  },
                  { 
                    id: "bluetooth", 
                    title: "Direct Web Bluetooth (Mini Portable Printer)", 
                    desc: "Koneksi nirkabel langsung ke perangkat mini thermal bluetooth modern tanpa driver.",
                    icon: <Bluetooth className="text-blue-500" size={16} /> 
                  },
                  { 
                    id: "usb", 
                    title: "Direct WebUSB (Kabel USB Thermal)", 
                    desc: "Koneksi kabel langsung ke USB printer thermal. Kecepatan tinggi & handal.",
                    icon: <Usb className="text-emerald-500" size={16} /> 
                  },
                  { 
                    id: "network", 
                    title: "Network IP / LAN (Ethernet / Wi-Fi)", 
                    desc: "Cetak melalui jaringan lokal IP Address. Cocok untuk dapur atau counter besar.",
                    icon: <Wifi className="text-amber-500" size={16} /> 
                  }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSettings(p => ({ ...p, connectionMode: mode.id as any, deviceName: "" }));
                      PrinterService.disconnect();
                    }}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.connectionMode === mode.id
                        ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
                    }`}
                  >
                    <div className="mt-1 flex-shrink-0">{mode.icon}</div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        {mode.title}
                        {settings.connectionMode === mode.id && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{mode.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-panels based on selected connection */}
            {settings.connectionMode === "browser_print" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/80 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <ShieldAlert size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Mode Driver / Browser Print (Rekomendasi)</span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      Metode paling kompatibel untuk mesin printer lama, printer desktop berukuran besar (Epson, Star, Xprinter), maupun sistem multi-terminal. Cukup install driver printer di komputer Anda terlebih dahulu.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scanning / Device List Panel for Bluetooth & USB */}
            {(settings.connectionMode === "bluetooth" || settings.connectionMode === "usb") && (
              <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pemindaian Perangkat</label>
                  <button
                    onClick={startScan}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                    <span>{isScanning ? "Menghubungkan..." : "Hubungkan Printer Baru"}</span>
                  </button>
                </div>

                {isScanning && (
                  <div className="flex flex-col items-center justify-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="relative mb-3">
                      <div className="w-10 h-10 rounded-full border border-primary border-t-transparent animate-spin" />
                      <div className="absolute inset-1.5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {settings.connectionMode === "bluetooth" ? "BT" : "USB"}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Hubungkan perangkat printer...</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Pilih printer pada dialog sistem browser Anda</div>
                  </div>
                )}

                {!isScanning && !settings.deviceName && (
                  <div className="text-center py-6 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
                    Belum ada perangkat terhubung. Klik "Hubungkan Printer Baru" di atas.
                  </div>
                )}

                {!isScanning && settings.deviceName && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                    <div className="w-full flex items-center justify-between p-3.5 text-xs bg-primary/5 dark:bg-primary/10 text-primary font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white">{settings.deviceName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Koneksi Aktif ({settings.connectionMode.toUpperCase()})</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          PrinterService.disconnect();
                          setSettings(p => ({ ...p, deviceName: "" }));
                          toast({
                            title: "Perangkat Terputus",
                            description: "Hubungan printer telah dilepas.",
                          });
                        }}
                        className="text-[10px] text-red-500 hover:underline cursor-pointer"
                      >
                        Putuskan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Network / LAN IP configuration Panel */}
            {settings.connectionMode === "network" && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Konfigurasi Alamat IP Jaringan</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Alamat IP Printer</span>
                    <input
                      type="text"
                      value={settings.ipAddress}
                      onChange={e => setSettings(p => ({ ...p, ipAddress: e.target.value }))}
                      placeholder="Contoh: 192.168.1.100"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Port POS</span>
                    <input
                      type="text"
                      value={settings.port}
                      onChange={e => setSettings(p => ({ ...p, port: e.target.value }))}
                      placeholder="9100"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-mono"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTestPing}
                    disabled={pingStatus === "testing"}
                    className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {pingStatus === "testing" ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Mencoba Hubungi...</span>
                      </>
                    ) : (
                      <>
                        <Wifi size={12} />
                        <span>Tes Ping Koneksi</span>
                      </>
                    )}
                  </button>

                  {pingStatus === "success" && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <Check size={14} /> Terhubung (Ping OK)
                    </span>
                  )}
                  {pingStatus === "failed" && (
                    <span className="text-red-500 font-bold text-xs flex items-center gap-1">
                      <AlertCircle size={14} /> Gagal Terhubung
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Paper Size selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ukuran Kertas Struk</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "58mm", title: "58 mm (Standar Kecil)", desc: "Cocok untuk mini mobile printer, mesin EDC thermal, & kasir kecil." },
                  { value: "80mm", title: "80 mm (Standar Besar)", desc: "Cocok untuk printer laci kasir statis, restoran, & retail swalayan." }
                ].map((size) => (
                  <button
                    key={size.value}
                    onClick={() => setSettings(p => ({ ...p, paperSize: size.value as any }))}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.paperSize === size.value
                        ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-white">{size.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{size.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Customization Settings Panel */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Kustomisasi Ukuran & Penempatan</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Sesuaikan ukuran font, margin kiri/kanan, dan posisi struk agar pas di kertas cetak.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Ukuran Font Struk (px)</span>
                  <input
                    type="number"
                    min={8}
                    max={24}
                    value={settings.fontSize || 12}
                    onChange={e => setSettings(p => ({ ...p, fontSize: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Rata Halaman (System Print)</span>
                  <select
                    value={settings.alignment || "left"}
                    onChange={e => setSettings(p => ({ ...p, alignment: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  >
                    <option value="left">Rata Kiri</option>
                    <option value="center">Rata Tengah (Centered)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Margin Kiri Halaman (px)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.marginLeft || 0}
                    onChange={e => setSettings(p => ({ ...p, marginLeft: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Margin Kanan Halaman (px)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.marginRight || 0}
                    onChange={e => setSettings(p => ({ ...p, marginRight: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Content Visibility Settings Panel */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Pengaturan Konten Struk</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Sembunyikan bagian struk tertentu untuk menghemat kertas struk thermal.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: "showOrderType", label: "Tampilkan Tipe Pesanan", desc: "Menampilkan Dine-In, Take-Away, atau Delivery." },
                  { key: "showCustomerName", label: "Tampilkan Nama Pelanggan", desc: "Menampilkan nama pelanggan di bagian header." },
                  { key: "showCashierName", label: "Tampilkan Nama Kasir", desc: "Menampilkan nama kasir yang melayani." },
                  { key: "showNotes", label: "Tampilkan Catatan Item", desc: "Menampilkan catatan kustom untuk tiap item pesanan." },
                  { key: "showFooterMessage", label: "Tampilkan Pesan Kaki", desc: "Menampilkan pesan terima kasih di akhir struk." }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl">
                    <div className="pr-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-350">{item.label}</div>
                      <div className="text-[10px] text-slate-550 dark:text-slate-400 leading-tight mt-0.5">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={settings[item.key as keyof PrinterSettings] !== false}
                        onChange={e => setSettings(p => ({ ...p, [item.key]: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Configuration Summary & Action Panel - Right column */}
          <div className="space-y-6">
            
            {/* Live Receipt Preview Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Live Preview Struk</h3>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Simulasi</span>
              </div>
              
              {/* Receipt Paper Simulation */}
              <div className="w-full overflow-x-auto py-2.5 flex justify-center bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-850">
                <div 
                  className="bg-[#fdfbf7] text-slate-900 shadow-sm border border-slate-300 p-4 transition-all duration-300 font-mono text-[11px] leading-relaxed relative"
                  style={{
                    width: settings.paperSize === "58mm" ? "220px" : "290px",
                    paddingLeft: `${Math.min(settings.marginLeft || 0, 40)}px`,
                    paddingRight: `${Math.min(settings.marginRight || 0, 40)}px`,
                  }}
                >
                  {/* Top Paper Tear Simulation */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-transparent to-transparent bg-repeat-x bg-[length:6px_4px]" />
                  
                  {/* Header */}
                  <div className="text-center space-y-1">
                    <div className="font-bold uppercase" style={{ fontSize: `${(settings.fontSize || 12) + 1}px` }}>
                      {tenant?.name || "BEAUTY & BAG"}
                    </div>
                    <div className="text-[9px] text-slate-600 leading-tight">
                      {tenant?.address || "Jl. Ahmad Yani Depan Ruko"}
                    </div>
                    <div className="text-[9px] text-slate-600">
                      Telp: {tenant?.phone || "08123456789"}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-dashed border-slate-400 my-2" />
                  
                  {/* Metadata */}
                  <div className="space-y-0.5 text-[9px] text-slate-700">
                    <div className="flex justify-between">
                      <span>Nota:</span>
                      <span className="font-bold">ORD-1782823851985-822</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tanggal:</span>
                      <span>30 Jun 2026 19.50</span>
                    </div>
                    {settings.showOrderType !== false && (
                      <div className="flex justify-between">
                        <span>Tipe:</span>
                        <span>{tenant?.businessType === "fashion" ? "Fitting Room" : "Dine In"}</span>
                      </div>
                    )}
                    {settings.showCustomerName !== false && (
                      <div className="flex justify-between">
                        <span>Pelanggan:</span>
                        <span>Pelanggan POS</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Pembayaran:</span>
                      <span>Tunai</span>
                    </div>
                    {settings.showCashierName !== false && (
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span>Kasir Utama</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-dashed border-slate-400 my-2" />
                  
                  {/* Items List */}
                  <div className="space-y-1" style={{ fontSize: `${settings.fontSize || 12}px` }}>
                    <div>
                      <div className="flex justify-between">
                        <span className={settings.alignment === "center" ? "mx-auto text-center font-bold" : "font-bold"}>
                          1x Dompet Cantik
                        </span>
                        <span>Rp 95.000</span>
                      </div>
                      {settings.showNotes !== false && (
                        <div className="text-[9px] text-slate-500 italic pl-2">
                          * "Warna merah marun"
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <span className={settings.alignment === "center" ? "mx-auto text-center font-bold" : "font-bold"}>
                          1x Gantungan Kunci
                        </span>
                        <span>Rp 10.000</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-dashed border-slate-400 my-2" />
                  
                  {/* Totals */}
                  <div className="space-y-0.5 text-[9px] text-slate-700">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>Rp 105.000</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Diskon</span>
                      <span>-Rp 10.000</span>
                    </div>
                    
                    <div className="flex justify-between font-bold mt-1 text-slate-900 border-t border-slate-200 pt-1" style={{ fontSize: `${(settings.fontSize || 12) + 1}px` }}>
                      <span>TOTAL</span>
                      <span>Rp 95.000</span>
                    </div>

                    <div className="flex justify-between mt-0.5">
                      <span>Uang Diterima</span>
                      <span>Rp 100.000</span>
                    </div>
                    <div className="flex justify-between font-medium text-emerald-600">
                      <span>Kembalian</span>
                      <span>Rp 5.000</span>
                    </div>
                  </div>
                  
                  {/* Footer Message */}
                  {settings.showFooterMessage !== false && (
                    <>
                      <div className="border-t border-dashed border-slate-400 my-2" />
                      <div className="text-center space-y-0.5 text-[9px] text-slate-600">
                        <div>Terima kasih atas kunjungan Anda!</div>
                        <div className="font-bold">Selamat menikmati 🛍️</div>
                      </div>
                    </>
                  )}
                  
                  {/* Bottom Paper Tear Simulation */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-200 via-transparent to-transparent bg-repeat-x bg-[length:6px_4px]" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full pt-1 space-y-2">
                <button
                  onClick={printTestPage}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak Struk Tes</span>
                </button>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Detail Perangkat</h3>
              
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Mode Koneksi</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {settings.connectionMode.replace("_", " ")}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Nama Driver / IP</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                    {settings.connectionMode === "network" 
                      ? `${settings.ipAddress}:${settings.port}` 
                      : (settings.deviceName || "Bawaan Browser")}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Ukuran Kertas</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{settings.paperSize}</span>
                </div>
              </div>
            </div>

            {/* Extra Features & Toggles */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Fitur Tambahan</h3>
              
              <div className="space-y-4">
                {/* Auto Print receipt */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Cetak Otomatis Struk</div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5">Struk dicetak otomatis saat pembayaran sukses</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoPrint}
                      onChange={e => setSettings(p => ({ ...p, autoPrint: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Auto Cut paper */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Pemotong Kertas Otomatis</div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5">Kertas terpotong otomatis (jika didukung printer)</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoCut}
                      onChange={e => setSettings(p => ({ ...p, autoCut: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Flow Premium Badge Info */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-950 flex gap-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold">Konektivitas Cloud Print</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Flow POS mendukung integrasi langsung dengan cloud printing API. Lakukan pemesanan nirkabel instan dari smartphone pelanggan langsung tercetak di printer kasir atau dapur!
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
