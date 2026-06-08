import { useState, useEffect, useRef } from "react";
import { QrCode, Plus, Trash2, Download, Copy, Check, ExternalLink, RefreshCw, Globe } from "lucide-react";
import QRCode from "qrcode";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getMenuUrl(slug: string, table?: string) {
  const origin = window.location.origin;
  const base = BASE ? `${origin}${BASE}` : origin;
  const url = `${base}/menu/${slug}`;
  return table ? `${url}?table=${encodeURIComponent(table)}` : url;
}

async function generateQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#1D4EF5", light: "#FFFFFF" } });
}

export default function QrManagerPage() {
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTable, setNewTable] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedQrs, setGeneratedQrs] = useState<Record<string, string>>({});
  const [storeQr, setStoreQr] = useState("");
  const [settings, setSettings] = useState({
    enableDineIn: true, enableTakeAway: true, enableDelivery: false,
    enableCash: true, enableQris: true, enableBankTransfer: false, enableEwallet: false,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const token = useRef(localStorage.getItem("flow_token") ?? "");

  async function fetchData() {
    const r = await fetch(`${BASE}/api/tenant/qr-codes`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (r.ok) {
      const d = await r.json();
      setSlug(d.slug ?? "");
      setSlugInput(d.slug ?? "");
      setQrCodes(d.qrCodes ?? []);
    }
    // Fetch tenant settings
    const rt = await fetch(`${BASE}/api/tenant`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (rt.ok) {
      const t = await rt.json();
      setSettings({
        enableDineIn: t.enableDineIn ?? true,
        enableTakeAway: t.enableTakeAway ?? true,
        enableDelivery: t.enableDelivery ?? false,
        enableCash: t.enableCash ?? true,
        enableQris: t.enableQris ?? true,
        enableBankTransfer: t.enableBankTransfer ?? false,
        enableEwallet: t.enableEwallet ?? false,
      });
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!slug) return;
    generateQR(getMenuUrl(slug)).then(setStoreQr);
  }, [slug]);

  useEffect(() => {
    qrCodes.forEach(async (qr) => {
      if (!slug) return;
      const url = getMenuUrl(slug, qr.tableNumber);
      const dataUrl = await generateQR(url);
      setGeneratedQrs(prev => ({ ...prev, [qr.id]: dataUrl }));
    });
  }, [qrCodes, slug]);

  async function saveSlug() {
    if (!slugInput.trim()) return;
    setSlugSaving(true); setSlugError("");
    const r = await fetch(`${BASE}/api/tenant/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ slug: slugInput.trim() }),
    });
    if (r.ok) {
      const t = await r.json();
      setSlug(t.slug ?? slugInput);
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
      body: JSON.stringify(settings),
    });
    if (r.ok) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }
    setSettingsSaving(false);
  }

  async function addTable() {
    if (!newTable.trim()) return;
    setAdding(true);
    const r = await fetch(`${BASE}/api/tenant/qr-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
      body: JSON.stringify({ tableNumber: newTable.trim(), label: newLabel.trim() || null }),
    });
    if (r.ok) {
      const qr = await r.json();
      setQrCodes(prev => [...prev, qr]);
      setNewTable(""); setNewLabel("");
    }
    setAdding(false);
  }

  async function deleteTable(id: number) {
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

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const menuUrl = slug ? getMenuUrl(slug) : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">QR Menu & Online Order</h1>
        <p className="text-muted-foreground text-sm">Kelola link menu publik dan QR code meja</p>
      </div>

      {/* Slug setup */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Globe size={18} className="text-primary" /> Link Menu Publik
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1 bg-muted/40 rounded-lg border border-input px-3 py-2 text-sm">
            <span className="text-muted-foreground text-xs">yourapp.com/menu/</span>
            <input
              value={slugInput}
              onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="nama-toko-anda"
              className="flex-1 bg-transparent focus:outline-none text-foreground font-medium"
            />
          </div>
          <button onClick={saveSlug} disabled={slugSaving || !slugInput.trim() || slugInput === slug}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {slugSaving ? "..." : "Simpan"}
          </button>
        </div>
        {slugError && <div className="text-red-500 text-xs">{slugError}</div>}
        {slug && menuUrl && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-mono text-xs bg-background border border-border px-2 py-1 rounded-md flex-1 truncate">{menuUrl}</span>
              <button onClick={() => copyLink(menuUrl)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                {copied === menuUrl ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
              <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1">
                <ExternalLink size={14} />
              </a>
            </div>
            {storeQr && (
              <div className="flex items-start gap-4">
                <img src={storeQr} alt="QR Store" className="w-32 h-32 rounded-xl border border-border" />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">QR Code Toko</div>
                  <p className="text-xs text-muted-foreground">Pelanggan scan QR ini untuk membuka menu langsung di ponsel mereka</p>
                  <button onClick={() => downloadQR(storeQr, "toko")}
                    className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                    <Download size={12} /> Download QR
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!slug && (
          <div className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Tentukan slug terlebih dahulu untuk mengaktifkan link menu publik
          </div>
        )}
      </div>

      {/* Order type & payment settings */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-foreground text-sm">Pengaturan Menu Online</div>
          <button onClick={saveSettings} disabled={settingsSaving}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {settingsSaved ? <><Check size={11} /> Tersimpan</> : settingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Jenis Pesanan</div>
            <div className="space-y-2">
              {[
                { key: "enableDineIn", label: "🪑 Makan di Tempat" },
                { key: "enableTakeAway", label: "🛍️ Bawa Pulang" },
                { key: "enableDelivery", label: "🛵 Antar ke Alamat" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${(settings as any)[key] ? "bg-primary" : "bg-muted"}`}
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s as any)[key] }))}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(settings as any)[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Metode Pembayaran</div>
            <div className="space-y-2">
              {[
                { key: "enableCash", label: "💵 Tunai" },
                { key: "enableQris", label: "📱 QRIS" },
                { key: "enableBankTransfer", label: "🏦 Transfer Bank" },
                { key: "enableEwallet", label: "💳 E-Wallet" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${(settings as any)[key] ? "bg-primary" : "bg-muted"}`}
                    onClick={() => setSettings(s => ({ ...s, [key]: !(s as any)[key] }))}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(settings as any)[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table QR codes */}
      {slug && (
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <QrCode size={18} className="text-primary" /> QR Code per Meja
          </div>
          <div className="flex gap-2">
            <input value={newTable} onChange={e => setNewTable(e.target.value)}
              placeholder="Nomor meja (contoh: 5)"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (opsional)"
              className="w-36 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={addTable} disabled={adding || !newTable.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
              <Plus size={14} />{adding ? "..." : "Tambah"}
            </button>
          </div>

          {qrCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <QrCode size={32} className="mx-auto mb-2 opacity-30" />
              Belum ada QR meja. Tambahkan meja di atas.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {qrCodes.map(qr => {
                const url = getMenuUrl(slug, qr.tableNumber);
                const qrImg = generatedQrs[qr.id];
                return (
                  <div key={qr.id} className="border border-border rounded-xl p-4 flex gap-4 bg-muted/10">
                    {qrImg
                      ? <img src={qrImg} alt={`Meja ${qr.tableNumber}`} className="w-20 h-20 rounded-lg border border-border flex-shrink-0" />
                      : <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground text-sm">Meja {qr.tableNumber}</div>
                      {qr.label && <div className="text-xs text-muted-foreground mb-1">{qr.label}</div>}
                      <div className="text-xs font-mono text-muted-foreground truncate mb-2">{url}</div>
                      <div className="flex gap-1.5">
                        <button onClick={() => copyLink(url)}
                          className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground">
                          {copied === url ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                          Salin
                        </button>
                        {qrImg && (
                          <button onClick={() => downloadQR(qrImg, `meja-${qr.tableNumber}`)}
                            className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition-colors">
                            <Download size={10} /> Download
                          </button>
                        )}
                        <button onClick={() => deleteTable(qr.id)}
                          className="flex items-center gap-1 text-xs bg-red-50 text-red-500 px-2 py-1 rounded-md hover:bg-red-100 transition-colors ml-auto">
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
    </div>
  );
}
