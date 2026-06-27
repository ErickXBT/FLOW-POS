import { useState, useEffect, useRef } from "react";
import { QrCode, Plus, Trash2, Download, Copy, Check, ExternalLink, Globe, MapPin, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useActiveBranch } from "@/hooks/use-active-branch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getMenuUrl(slug: string, qrCodeValue: string) {
  const origin = window.location.origin;
  const base = BASE ? `${origin}${BASE}` : origin;
  return `${base}/menu/${slug}?qr_code=${encodeURIComponent(qrCodeValue)}`;
}

async function generateQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#1D4EF5", light: "#FFFFFF" } });
}

export default function QrManagerPage() {
  const { activeBranchId } = useActiveBranch();
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState("");
  
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New QR Code Form inputs
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [newTable, setNewTable] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [generatedQrs, setGeneratedQrs] = useState<Record<string, string>>({});
  const [storeQrImg, setStoreQrImg] = useState("");
  const [settings, setSettings] = useState({
    enableDineIn: true, enableTakeAway: true, enableDelivery: false,
    enableCash: true, enableQris: true, enableBankTransfer: false, enableEwallet: false,
    deliveryFeeNear: 0, deliveryFeeFar: 5000,
    showVariants: true, showToppings: true,
    showDeliveryInfo: true,
    estimatedDeliveryTime: "25-35 menit",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [businessType, setBusinessType] = useState("fnb");
  const isFashion = businessType === "fashion";
  const token = useRef(localStorage.getItem("flow_token") ?? "");

  async function fetchData() {
    const branchQuery = activeBranchId ? `?branch_id=${activeBranchId}` : "";
    const r = await fetch(`${BASE}/api/tenant/qr-codes${branchQuery}`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (r.ok) {
      const d = await r.json();
      setSlug(d.slug ?? "");
      setSlugInput(d.slug ?? "");
      setQrCodes(d.qrCodes ?? []);
      if (d.menu) {
        setSettings(s => ({
          ...s,
          enableDineIn: d.menu.enableDineIn,
          enableTakeAway: d.menu.enableTakeAway,
          enableDelivery: d.menu.enableDelivery,
        }));
      }
    }

    // Fetch branches
    const rb = await fetch(`${BASE}/api/branches`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (rb.ok) {
      const b = await rb.json();
      setBranches(b || []);
      if (b.length > 0) {
        setSelectedBranchId(activeBranchId || b[0].id);
      }
    }

    // Fetch categories
    const rc = await fetch(`${BASE}/api/categories`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (rc.ok) {
      const c = await rc.json();
      setCategories(c || []);
    }

    // Fetch tenant settings
    const rt = await fetch(`${BASE}/api/tenant`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (rt.ok) {
      const t = await rt.json();
      setBusinessType(t.businessType || "fnb");
      setSettings(s => ({
        ...s,
        enableDineIn: t.enableDineIn ?? true,
        enableTakeAway: t.enableTakeAway ?? true,
        enableDelivery: t.enableDelivery ?? false,
        enableCash: t.enableCash ?? true,
        enableQris: t.enableQris ?? true,
        enableBankTransfer: t.enableBankTransfer ?? false,
        enableEwallet: t.enableEwallet ?? false,
        deliveryFeeNear: t.deliveryFeeNear !== undefined ? Number(t.deliveryFeeNear) : 0,
        deliveryFeeFar: t.deliveryFeeFar !== undefined ? Number(t.deliveryFeeFar) : 5000,
        showVariants: t.showVariants ?? true,
        showToppings: t.showToppings ?? true,
        showDeliveryInfo: t.showDeliveryInfo ?? true,
        estimatedDeliveryTime: t.estimatedDeliveryTime ?? "25-35 menit",
      }));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  // Generate individual table QR codes
  useEffect(() => {
    qrCodes.forEach(async (qr) => {
      if (!slug) return;
      const url = getMenuUrl(slug, qr.code);
      const dataUrl = await generateQR(url);
      setGeneratedQrs(prev => ({ ...prev, [qr.id]: dataUrl }));
    });
  }, [qrCodes, slug]);

  // Generate store general QR code
  useEffect(() => {
    if (slug) {
      const url = `${window.location.origin}${BASE}/menu/${slug}`;
      generateQR(url).then(setStoreQrImg).catch(console.error);
    } else {
      setStoreQrImg("");
    }
  }, [slug]);

  async function saveSlug() {
    if (!slugInput.trim()) return;
    setSlugSaving(true); setSlugError("");
    const r = await fetch(`${BASE}/api/tenant/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ slug: slugInput.trim(), branchId: activeBranchId }),
    });
    if (r.ok) {
      const t = await r.json();
      setSlug(slugInput.trim());
    } else {
      const e = await r.json();
      setSlugError(e.error ?? "Gagal menyimpan slug");
    }
    setSlugSaving(false);
  }

  async function saveSettings() {
    setSettingsSaving(true);
    const r = await fetch(`${BASE}/api/tenant/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ ...settings, branchId: activeBranchId }),
    });
    if (r.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }
    setSettingsSaving(false);
  }

  async function addQrCode() {
    if (!newTable.trim()) return;
    setAdding(true);
    const r = await fetch(`${BASE}/api/tenant/qr-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({
        qrType: "table",
        branchId: selectedBranchId || null,
        tableNumber: newTable.trim(),
        categoryId: null,
        label: newLabel.trim() || null
      }),
    });
    if (r.ok) {
      const qr = await r.json();
      setQrCodes(prev => [...prev, qr]);
      setNewTable("");
      setNewLabel("");
    }
    setAdding(false);
  }

  async function deleteQrCode(id: number) {
    if (!confirm("Hapus QR Code ini?")) return;
    await fetch(`${BASE}/api/tenant/qr-codes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.current}` },
    });
    setQrCodes(prev => prev.filter(q => q.id !== id));
    setGeneratedQrs(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadQR(dataUrl: string, name: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${name}.png`;
    a.click();
  }

  function printQR(qrImg: string, tableId: string, branchName: string, label: string) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up Terblokir! Silakan izinkan pop-up di browser Anda untuk mencetak QR Code.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Print QR Meja ${tableId}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: auto; margin: 0; }
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              text-align: center;
              padding: 20px;
              color: #333;
              background-color: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              box-sizing: border-box;
            }
            .card {
              border: 3px solid #1D4EF5;
              border-radius: 20px;
              padding: 30px;
              width: 320px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #1D4EF5;
              margin-bottom: 5px;
            }
            .branch {
              font-size: 12px;
              color: #666;
              margin-bottom: 20px;
              font-weight: 600;
            }
            .qr-image {
              width: 200px;
              height: 200px;
              margin-bottom: 20px;
            }
            .table-number {
              font-size: 28px;
              font-weight: 800;
              color: #111;
              margin-bottom: 5px;
            }
            .instruction {
              font-size: 13px;
              color: #555;
              font-weight: 500;
            }
            .label-tag {
              font-size: 11px;
              background-color: #EBF0FF;
              color: #1D4EF5;
              padding: 4px 8px;
              border-radius: 6px;
              font-weight: bold;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo font-sans">Flow POS</div>
            <div class="branch font-sans">${branchName}</div>
            <img class="qr-image" src="${qrImg}" />
            <div class="table-number font-sans">${isFashion ? "Fitting Room" : "MEJA"} ${tableId}</div>
            <div class="instruction font-sans">Scan untuk melihat Menu & Memesan</div>
            ${label ? `<div class="label-tag font-sans">${label}</div>` : ""}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  const publicMenuUrl = slug ? `${window.location.origin}${BASE}/menu/${slug}` : "";
  const tableQrs = qrCodes.filter(qr => qr.qrType === "table");
  const otherQrs = qrCodes.filter(qr => qr.qrType !== "table");

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl font-sans">
      <div>
        <h1 className="text-xl font-bold text-foreground">{isFashion ? "QR Katalog & Pesanan Online" : "QR Menu & Online Order"}</h1>
        <p className="text-muted-foreground text-sm">{isFashion ? "Kelola link katalog publik dan QR code fitting room" : "Kelola link menu publik dan QR code meja"}</p>
      </div>

      {/* Card 1: Link Menu Publik */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Globe size={18} className="text-primary" /> {isFashion ? "Link Katalog Publik" : "Link Menu Publik"}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center bg-muted/40 rounded-lg border border-input px-3 py-2 text-sm min-w-0">
            <span className="text-muted-foreground font-medium select-none pr-1 text-xs xs:text-sm">flowapp.id/menu/</span>
            <input
              value={slugInput}
              onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="nama-toko-anda"
              className="flex-1 bg-transparent focus:outline-none text-foreground font-semibold min-w-0 text-xs xs:text-sm"
            />
          </div>
          <button onClick={saveSlug} disabled={slugSaving || !slugInput.trim() || slugInput === slug}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {slugSaving ? "..." : "Simpan"}
          </button>
        </div>
        {slugError && <div className="text-red-500 text-xs">{slugError}</div>}
        
        {!slug && (
          <div className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ {isFashion ? "Tentukan slug terlebih dahulu untuk mengaktifkan pembuatan QR Code Katalog publik" : "Tentukan slug terlebih dahulu untuk mengaktifkan pembuatan QR Code Menu publik"}
          </div>
        )}

        {slug && (
          <>
            <div className="flex items-center justify-between bg-muted/20 rounded-lg border border-border px-3 py-2 text-sm text-foreground min-w-0">
              <span className="truncate font-mono text-xs flex-1 min-w-0 pr-2">{publicMenuUrl}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => copyLink(publicMenuUrl)} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors" title="Salin Link">
                  {copied === publicMenuUrl ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
                <a href={publicMenuUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors" title="Buka Link">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="bg-muted/10 border border-border rounded-xl p-4 flex gap-4 items-center">
              {storeQrImg ? (
                <img src={storeQrImg} alt={isFashion ? "QR Code Katalog Toko" : "QR Code Toko"} className="w-24 h-24 rounded-lg border border-border flex-shrink-0 bg-white p-1" />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 p-1">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-foreground text-sm">{isFashion ? "QR Code Katalog Toko" : "QR Code Toko"}</div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isFashion ? "Pelanggan scan QR ini untuk membuka katalog langsung di ponsel mereka" : "Pelanggan scan QR ini untuk membuka menu langsung di ponsel mereka"}
                </p>
                <button onClick={() => downloadQR(storeQrImg, `store-${slug}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors mt-1">
                  <Download size={13} /> Download QR
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Card 2: Pengaturan Menu Online */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="font-semibold text-foreground text-sm font-sans">{isFashion ? "Pengaturan Katalog Online" : "Pengaturan Menu Online"}</div>
          <button onClick={saveSettings} disabled={settingsSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold font-sans">
            {settingsSaved ? <><Check size={12} /> Tersimpan</> : settingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Jenis Pesanan</div>
            <div className="space-y-3">
              {[
                { key: "enableDineIn", label: isFashion ? "Coba di Fitting Room" : "Makan di Tempat", emoji: isFashion ? "👚" : "🪑" },
                { key: "enableTakeAway", label: isFashion ? "Ambil di Toko" : "Bawa Pulang", emoji: "🛍️" },
                { key: "enableDelivery", label: "Antar ke Alamat", emoji: "🛵" },
              ].map(({ key, label, emoji }) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s as any)[key] }))}
                    className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none flex-shrink-0 ${(settings as any)[key] ? "bg-primary" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${(settings as any)[key] ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5 font-sans">
                    <span>{emoji}</span> {label}
                  </span>
                </div>
              ))}
              {settings.enableDelivery && (
                <div className="mt-4 p-4 bg-muted/20 border rounded-2xl space-y-3.5 animate-slide-up">
                  <div className="text-xs font-bold text-foreground">Pengaturan Biaya Delivery</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Jarak Dekat (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        value={settings.deliveryFeeNear}
                        onChange={e => setSettings(s => ({ ...s, deliveryFeeNear: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                        placeholder="Contoh: 0 (Gratis)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Jarak Jauh (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        value={settings.deliveryFeeFar}
                        onChange={e => setSettings(s => ({ ...s, deliveryFeeFar: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                        placeholder="Contoh: 5000"
                      />
                    </div>
                  </div>
                  
                  <hr className="border-border my-2" />
                  
                  <div className="text-xs font-bold text-foreground mt-2">Tampilan Menu Customer</div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, showDeliveryInfo: !(s as any).showDeliveryInfo }))}
                      className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none flex-shrink-0 ${(settings as any).showDeliveryInfo ? "bg-primary" : "bg-zinc-300"}`}
                    >
                      <span
                        className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${(settings as any).showDeliveryInfo ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                    <span className="text-xs font-medium text-foreground font-sans">
                      Tampilkan Status Pengiriman &amp; Durasi
                    </span>
                  </div>

                  {(settings as any).showDeliveryInfo && (
                    <div className="animate-slide-up">
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Estimasi Durasi Pengiriman</label>
                      <input
                        type="text"
                        value={(settings as any).estimatedDeliveryTime || ""}
                        onChange={e => setSettings(s => ({ ...s, estimatedDeliveryTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                        placeholder="Contoh: 25-35 menit"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Metode Pembayaran</div>
            <div className="space-y-3">
              {[
                { key: "enableCash", label: "Tunai", emoji: "💵" },
                { key: "enableQris", label: "QRIS", emoji: "📱" },
                { key: "enableBankTransfer", label: "Transfer Bank", emoji: "🏦" },
                { key: "enableEwallet", label: "E-Wallet", emoji: "💳" },
              ].map(({ key, label, emoji }) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s as any)[key] }))}
                    className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none flex-shrink-0 ${(settings as any)[key] ? "bg-primary" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${(settings as any)[key] ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5 font-sans">
                    <span>{emoji}</span> {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">{isFashion ? "Modul Katalog / Varian" : "Modul Menu / Tambahan"}</div>
            <div className="space-y-3">
              {[
                { key: "showVariants", label: isFashion ? "Varian Ukuran / Warna" : "Pilihan Ukuran / Varian", emoji: "🏷️" },
                !isFashion && { key: "showToppings", label: "Topping / Tambahan", emoji: "➕" },
              ].filter(Boolean).map(({ key, label, emoji }: any) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s as any)[key] }))}
                    className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none flex-shrink-0 ${(settings as any)[key] ? "bg-primary" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${(settings as any)[key] ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5 font-sans">
                    <span>{emoji}</span> {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: QR Code per Meja */}
      {slug && (
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
            <QrCode size={18} className="text-primary" /> {isFashion ? "QR Code per Fitting Room" : "QR Code per Meja"}
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder={isFashion ? "Nomor fitting room (contoh: 3)" : "Nomor meja (contoh: 5)"}
              value={newTable}
              onChange={e => setNewTable(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-sans"
            />
            <input
              type="text"
              placeholder="Label (opsional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-sans"
            />
            <button
              onClick={addQrCode}
              disabled={adding || !newTable.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/95 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap font-sans"
            >
              <Plus size={16} /> Tambah
            </button>
          </div>

          {tableQrs.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border mt-4">
              {tableQrs.map(qr => {
                const url = getMenuUrl(slug, qr.code);
                const qrImg = generatedQrs[qr.id];
                const branchName = branches.find(b => b.id === qr.branchId)?.name || "Cabang";
                
                return (
                  <div key={qr.id} className="border border-border rounded-xl p-4 flex gap-4 bg-muted/10 items-start">
                    {qrImg ? (
                      <img src={qrImg} alt={isFashion ? `QR Fitting Room ${qr.tableId}` : `QR Meja ${qr.tableId}`} className="w-24 h-24 rounded-lg border border-border flex-shrink-0 bg-white p-1" />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-bold text-foreground text-sm font-sans">{isFashion ? "Fitting Room" : "Meja"} {qr.tableId}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 font-sans"><MapPin size={10} /> {branchName}</div>
                      {qr.label && <div className="text-xs text-primary font-semibold font-sans">Tag: {qr.label}</div>}
                      <div className="text-[10px] font-mono text-muted-foreground truncate">{url}</div>
                      
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => copyLink(url)}
                          className="flex items-center gap-1 text-[10px] bg-muted px-2 py-1 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground font-sans">
                          {copied === url ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                          Salin Link
                        </button>
                        {qrImg && (
                          <button onClick={() => downloadQR(qrImg, isFashion ? `qr-fitting-${qr.tableId}` : `qr-meja-${qr.tableId}`)}
                            className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition-colors font-sans">
                            <Download size={10} /> Save PNG
                          </button>
                        )}
                        {qrImg && (
                          <button onClick={() => printQR(qrImg, qr.tableId, branchName, qr.label)}
                            className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-650 px-2 py-1 rounded-md hover:bg-indigo-150 transition-colors font-sans">
                            <Printer size={10} /> Print QR
                          </button>
                        )}
                        <button onClick={() => deleteQrCode(qr.id)}
                          className="flex items-center gap-1 text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded-md hover:bg-red-100 transition-colors ml-auto font-sans">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Advanced QR Codes (If any exist from previous configurations) */}
      {slug && otherQrs.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="font-semibold text-foreground text-sm font-sans">QR Code Lainnya (Cabang / Kategori)</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {otherQrs.map(qr => {
              const url = getMenuUrl(slug, qr.code);
              const qrImg = generatedQrs[qr.id];
              const branchName = branches.find(b => b.id === qr.branchId)?.name || "Cabang";
              
              let qrTypeLabel = "Toko";
              if (qr.qrType === "branch") qrTypeLabel = "Cabang";
              else if (qr.qrType === "category") {
                const catName = categories.find(c => c.id === qr.categoryId)?.name || "Kategori";
                qrTypeLabel = `Kategori: ${catName}`;
              }

              return (
                <div key={qr.id} className="border border-border rounded-xl p-4 flex gap-4 bg-muted/10 items-start">
                  {qrImg ? (
                    <img src={qrImg} alt={`QR ${qrTypeLabel}`} className="w-24 h-24 rounded-lg border border-border flex-shrink-0 bg-white p-1" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1 font-sans">
                    <div className="font-bold text-foreground text-sm capitalize">{qrTypeLabel}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {branchName}</div>
                    {qr.label && <div className="text-xs text-primary font-semibold">Tag: {qr.label}</div>}
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{url}</div>
                    
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => copyLink(url)}
                        className="flex items-center gap-1 text-[10px] bg-muted px-2 py-1 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground">
                        {copied === url ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                        Salin Link
                      </button>
                      {qrImg && (
                        <button onClick={() => downloadQR(qrImg, `qr-${qr.qrType}-${qr.id}`)}
                          className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition-colors">
                          <Download size={10} /> Save PNG
                        </button>
                      )}
                      <button onClick={() => deleteQrCode(qr.id)}
                        className="flex items-center gap-1 text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded-md hover:bg-red-100 transition-colors ml-auto">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
