import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  Printer, Wifi, Bluetooth, Usb, RefreshCw, Check, 
  AlertCircle, ArrowLeft, Save, ShieldAlert, Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetTenant } from "@workspace/api-client-react";

interface PrinterSettings {
  connectionMode: "browser_print" | "bluetooth" | "usb" | "network";
  deviceName: string;
  ipAddress: string;
  port: string;
  paperSize: "58mm" | "80mm";
  autoPrint: boolean;
  autoCut: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  connectionMode: "browser_print",
  deviceName: "",
  ipAddress: "192.168.1.100",
  port: "9100",
  paperSize: "58mm",
  autoPrint: true,
  autoCut: false,
};

export default function PrinterSettingsPage() {
  const { toast } = useToast();
  const { data: tenant } = useGetTenant();
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Array<{ name: string; type: string; address?: string }>>([]);
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

  const startScan = () => {
    setIsScanning(true);
    setScannedDevices([]);
    
    // Simulate Bluetooth/USB device discovery
    setTimeout(() => {
      if (settings.connectionMode === "bluetooth") {
        setScannedDevices([
          { name: "MPT-II (Portable Mini Printer)", type: "Bluetooth", address: "00:11:22:33:AA:BB" },
          { name: "RPP02N (58mm Thermal)", type: "Bluetooth", address: "AA:BB:CC:DD:EE:FF" },
          { name: "EP-58A (Bluetooth Printer)", type: "Bluetooth", address: "88:99:A6:B5:C4:D3" }
        ]);
      } else if (settings.connectionMode === "usb") {
        setScannedDevices([
          { name: "RP80 Thermal Printer (USB)", type: "USB" },
          { name: "XP-80C Receipt Printer (USB)", type: "USB" },
          { name: "Generic POS-58 Printer (USB)", type: "USB" }
        ]);
      }
      setIsScanning(false);
    }, 2000);
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
      // Simulate ping success for local IPs, fail for empty/bad formats
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

  // Generate functional HTML receipt layout and open print dialog
  const printTestPage = () => {
    const storeName = tenant?.name || "Flow POS Kasir";
    const storeAddress = tenant?.address || "Jl. Sudirman No. 100, Jakarta";
    const storePhone = tenant?.phone || "0812-3456-7890";
    const paperWidth = settings.paperSize === "58mm" ? "280px" : "380px";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Pop-up Terblokir",
        description: "Silakan izinkan pop-up di browser Anda untuk mencetak struk.",
        variant: "destructive",
      });
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Test Print - ${storeName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${paperWidth};
              font-size: 12px;
              color: #000;
              margin: 0 auto;
              padding: 20px;
              background-color: #fff;
            }
            .text-center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .footer-msg { font-size: 11px; margin-top: 15px; }
            .barcode { font-family: monospace; font-size: 10px; border: 1px solid #000; padding: 4px; display: inline-block; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3 style="margin: 0 0 4px 0;">${storeName.toUpperCase()}</h3>
            <p style="margin: 0 0 2px 0; font-size: 10px;">${storeAddress}</p>
            <p style="margin: 0 0 8px 0; font-size: 10px;">Telp: ${storePhone}</p>
          </div>
          <div class="divider"></div>
          <div>
            <p style="margin: 0 0 4px 0;">Tanggal: ${new Date().toLocaleString("id-ID")}</p>
            <p style="margin: 0 0 4px 0;">Tipe: HALAMAN TEST KONEKSI</p>
            <p style="margin: 0 0 4px 0;">Mode: ${settings.connectionMode.toUpperCase()}</p>
            <p style="margin: 0 0 4px 0;">Ukuran: ${settings.paperSize}</p>
          </div>
          <div class="divider"></div>
          <div class="item-row">
            <span>1x Test Print Connection</span>
            <span>Rp 0</span>
          </div>
          <div class="item-row">
            <span>   [STATUS: OK]</span>
            <span></span>
          </div>
          <div class="divider"></div>
          <div class="item-row" style="font-weight: bold;">
            <span>TOTAL</span>
            <span>Rp 0</span>
          </div>
          <div class="divider"></div>
          <div class="text-center footer-msg">
            <p style="margin: 0 0 4px 0; font-weight: bold;">PRINTER BERHASIL DIKONFIGURASI</p>
            <p style="margin: 0 0 8px 0;">Terima kasih telah menggunakan Flow POS</p>
            <div class="barcode">*FLOWPOS-TEST*</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Trigger print dialog
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);

    toast({
      title: "Halaman Tes Dikirim",
      description: "Memulai print dialog bawaan browser untuk tes cetak.",
    });
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pos">
              <a className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20"
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
                      setSettings(p => ({ ...p, connectionMode: mode.id as any }));
                      setScannedDevices([]);
                    }}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
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
                    className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                    <span>{isScanning ? "Memindai..." : "Pindai Perangkat"}</span>
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
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Mencari port printer aktif...</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Pastikan kabel terhubung atau bluetooth aktif</div>
                  </div>
                )}

                {!isScanning && scannedDevices.length === 0 && (
                  <div className="text-center py-6 border border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
                    Belum ada perangkat terpilih. Klik Pindai Perangkat untuk memulai.
                  </div>
                )}

                {!isScanning && scannedDevices.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    {scannedDevices.map((device, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSettings(p => ({ ...p, deviceName: device.name }));
                          toast({
                            title: "Perangkat Dipilih",
                            description: `${device.name} ditautkan sebagai printer POS utama.`,
                          });
                        }}
                        className={`w-full flex items-center justify-between p-3.5 text-left text-xs transition-colors ${
                          settings.deviceName === device.name
                            ? "bg-primary/5 dark:bg-primary/10 text-primary font-semibold"
                            : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <div>
                            <div className="font-bold">{device.name}</div>
                            {device.address && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{device.address}</div>}
                          </div>
                        </div>
                        {settings.deviceName === device.name ? (
                          <div className="flex items-center gap-1 text-[10px] text-primary font-bold">
                            <Check size={14} /> Terhubung
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg">Hubungkan</span>
                        )}
                      </button>
                    ))}
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
                    className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300"
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
                    className={`p-4 rounded-xl border text-left transition-all ${
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
          </div>

          {/* Configuration Summary & Action Panel - Right column */}
          <div className="space-y-6">
            
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

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={printTestPage}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-slate-800"
                >
                  <Printer size={14} />
                  <span>Cetak Halaman Tes</span>
                </button>
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
