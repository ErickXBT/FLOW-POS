import { useState, useEffect } from "react";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Users, X, Star, Calendar, MessageSquare, Award, RefreshCw, Send, CheckCircle2 } from "lucide-react";

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

const LEVEL_COLORS: Record<string, string> = {
  regular: "bg-muted text-muted-foreground",
  silver: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400",
  gold: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  platinum: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

function CustomerForm({ initial, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({ name: initial?.name || "", email: initial?.email || "", phone: initial?.phone || "", address: initial?.address || "", notes: initial?.notes || "" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">{initial ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {[
            { key: "name", label: "Nama *", type: "text" },
            { key: "email", label: "Email", type: "email" },
            { key: "phone", label: "No. Telepon", type: "text" },
            { key: "address", label: "Alamat", type: "text" },
            { key: "notes", label: "Catatan", type: "text" },
          ].map(f => (
            <div key={f.key} className="text-xs">
              <label className="block font-medium mb-1 text-foreground">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted text-foreground">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState("list"); // "list" or "crm"
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data, isLoading } = useListCustomers({ search: search || undefined, page, limit: 20 });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const [claimingId, setClaimingId] = useState<number | null>(null);

  // CRM tab states
  const [crmData, setCrmData] = useState<any>(null);
  const [retentionLogs, setRetentionLogs] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const fetchCrmData = async () => {
    setCrmLoading(true);
    try {
      const token = localStorage.getItem("flow_token");
      const [crmRes, logsRes] = await Promise.all([
        fetch("/api/reports/crm-dashboard", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers/retention/logs", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (crmRes.ok) setCrmData(await crmRes.json());
      if (logsRes.ok) setRetentionLogs(await logsRes.json());
    } catch (e) {
      console.error("Failed to load CRM data", e);
    }
    setCrmLoading(false);
  };

  useEffect(() => {
    if (activeTab === "crm") {
      fetchCrmData();
    }
  }, [activeTab]);

  const handleClaimReward = async (id: number) => {
    setClaimingId(id);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/customers/${id}/claim-reward`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token || ""}` }
      });
      if (res.ok) {
        invalidate();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal mengklaim reward");
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi");
    } finally {
      setClaimingId(null);
    }
  };

  const handleSendRetention = async (cust: any) => {
    setSendingId(cust.id);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch("/api/customers/retention/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId: cust.id,
          customerName: cust.name,
          phone: cust.phone || "08123456789",
          message: `Halo ${cust.name}, kami merindukan Anda! Dapatkan voucher belanja Rp20.000 dengan kode kupon: FLOWRET20 di kunjungan berikutnya.`,
          couponCode: "FLOWRET20"
        })
      });
      if (res.ok) {
        alert(`WhatsApp retensi terkirim simulator ke ${cust.name}!`);
        fetchCrmData(); // reload log history
      } else {
        alert("Gagal mengirim notifikasi retensi");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan koneksi");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pelanggan & CRM</h1>
          <p className="text-muted-foreground text-sm">Kelola member loyalitas dan program retensi pelanggan.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "list" && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 shadow-md transition-all">
              <Plus size={16} /> Tambah Pelanggan
            </button>
          )}
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex gap-2 border-b border-border pb-px">
        {[
          { id: "list", label: "👤 Daftar Pelanggan" },
          { id: "crm", label: "📊 CRM Dashboard & Retensi" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "list" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="customer-search"
              autoComplete="off"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau telepon pelanggan..."
              className="pl-10 pr-4 py-2 border border-input rounded-xl bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-sm w-full transition-all shadow-sm"
            />
          </div>

          <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Memuat...</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {["Pelanggan", "Kontak", "Level", "Poin", "Total Belanja", "Total Order", "Aksi"].map(h => (
                        <th key={h} className="text-left px-4 py-3.5 text-muted-foreground font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(data?.data || []).length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-16">
                        <Users size={36} className="mx-auto mb-2 opacity-20" />
                        <div className="font-semibold">Belum ada pelanggan</div>
                      </td></tr>
                    )}
                    {(data?.data || []).map(c => (
                      <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{c.name.charAt(0)}</div>
                            <div>{c.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-medium">
                          <div>{c.email || "-"}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{c.phone || ""}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${LEVEL_COLORS[c.membershipLevel ?? 'regular']}`}>
                            <Star size={8} />{c.membershipLevel ?? 'regular'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">{c.loyaltyPoints}</td>
                        <td className="px-4 py-3 font-bold text-primary">{formatRp(Number(c.totalSpent))}</td>
                        <td className="px-4 py-3 font-semibold text-muted-foreground">{c.totalOrders}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {c.claimedDiscountActive ? (
                              <button
                                disabled
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold mr-2 bg-blue-105 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 cursor-not-allowed"
                              >
                                Reward Aktif
                              </button>
                            ) : (() => {
                              const claimedList = c.claimedMilestones || [];
                              const points = c.loyaltyPoints || 0;
                              const milestones = [100, 200, 300, 400, 500];
                              const maxClaimed = claimedList.length > 0 ? Math.max(...claimedList) : 0;
                              const hasClaimableIntermediate = milestones.some(m => points >= m && m > maxClaimed && !claimedList.includes(m));
                              const hasClaimableGrand = points >= 1000;
                              const isClaimable = hasClaimableIntermediate || hasClaimableGrand;
                              return (
                                <button
                                  onClick={() => handleClaimReward(c.id)}
                                  disabled={!isClaimable || claimingId === c.id}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold mr-2 transition-all select-none ${
                                    isClaimable
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 cursor-pointer shadow-sm"
                                      : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                  }`}
                                >
                                  {claimingId === c.id ? "..." : "Klaim Reward"}
                                </button>
                              );
                            })()}
                            <button onClick={() => setEditCustomer(c)} className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all">
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CRM & Automation Tab */
        <div className="space-y-6">
          {crmLoading ? (
            <div className="py-20 text-center text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <span>Memuat metrik analitik CRM...</span>
            </div>
          ) : !crmData ? (
            <div className="text-center py-10">Gagal memuat dashboard CRM</div>
          ) : (
            <div className="space-y-6">
              {/* CRM Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Member Terdaftar", value: crmData.totalMember, icon: <Users size={16} className="text-primary" /> },
                  { label: "Member Baru (30 Hari)", value: crmData.memberBaru, icon: <Calendar size={16} className="text-blue-500" /> },
                  { label: "Pelanggan Aktif (30 Hari)", value: crmData.pelangganAktif, icon: <CheckCircle2 size={16} className="text-green-500" /> },
                  { label: "VIP/Member Tidak Aktif", value: crmData.pelangganTidakAktif, icon: <MessageSquare size={16} className="text-red-500 animate-pulse" /> }
                ].map((s, i) => (
                  <div key={i} className="bg-card border border-card-border p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-muted-foreground leading-normal">{s.label}</span>
                      {s.icon}
                    </div>
                    <span className="text-xl font-extrabold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Inactive Customers & Retensi WhatsApp */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Retensi Pelanggan VIP Tidak Aktif</h2>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Daftar pelanggan VIP yang tidak melakukan order dalam 30 hari terakhir. Kirimkan voucher simulator via WhatsApp untuk mengaktifkan kembali.</p>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Nama Pelanggan</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Membership</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Tidak Aktif</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Aksi Retensi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {crmData.inactiveCustomers.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Semua VIP aktif berbelanja!</td></tr>
                          ) : (
                            crmData.inactiveCustomers.map((cust: any) => (
                              <tr key={cust.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-3.5 py-3 font-semibold">
                                  <div className="flex flex-col">
                                    <span className="text-foreground">{cust.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{cust.phone}</span>
                                  </div>
                                </td>
                                <td className="px-3.5 py-3 capitalize">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${LEVEL_COLORS[cust.membershipLevel ?? 'regular']}`}>
                                    {cust.membershipLevel}
                                  </span>
                                </td>
                                <td className="px-3.5 py-3 font-bold text-red-500">{cust.daysInactive} hari</td>
                                <td className="px-3.5 py-3">
                                  <button
                                    onClick={() => handleSendRetention(cust)}
                                    disabled={sendingId === cust.id}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] active:scale-95 flex items-center gap-1 transition-all"
                                  >
                                    <Send size={10} />
                                    {sendingId === cust.id ? "..." : "Kirim WhatsApp"}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* WhatsApp simulator log list */}
                  <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4 shadow-sm">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Log Pengiriman Retensi WhatsApp</h2>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Riwayat pesan voucher simulator yang berhasil dikirimkan ke pelanggan.</p>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Pelanggan</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Pesan</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Kupon</th>
                            <th className="px-3.5 py-2.5 font-bold text-muted-foreground">Waktu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {retentionLogs.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada riwayat pengiriman.</td></tr>
                          ) : (
                            retentionLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-3.5 py-3 font-semibold text-foreground">
                                  <div>{log.customerName}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{log.phone}</div>
                                </td>
                                <td className="px-3.5 py-3 text-muted-foreground italic leading-normal truncate max-w-[200px]">"{log.message}"</td>
                                <td className="px-3.5 py-3 font-mono font-bold text-primary">{log.couponCode}</td>
                                <td className="px-3.5 py-3 text-muted-foreground">
                                  {new Date(log.sentAt).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Top 10 Customers List */}
                <div className="space-y-4">
                  <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-4">
                    <div>
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Award size={16} className="text-amber-500" /> Top 10 Member Terloyal
                      </h2>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">Anggota dengan kontribusi pembelanjaan terbesar.</p>
                    </div>

                    <div className="space-y-3 pr-1 max-h-[500px] overflow-y-auto">
                      {crmData.top10Customers.map((cust: any, idx: number) => (
                        <div key={cust.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10 hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-extrabold text-xs text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-xs text-foreground truncate">{cust.name}</h3>
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground capitalize mt-0.5">
                                <span className={`px-1.5 py-0.2 rounded ${LEVEL_COLORS[cust.membershipLevel ?? 'regular']}`}>{cust.membershipLevel}</span>
                                <span>• {cust.totalOrders} orders</span>
                              </div>
                            </div>
                          </div>
                          <span className="font-bold text-xs text-primary flex-shrink-0">{formatRp(cust.totalSpent)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forms */}
      {showForm && <CustomerForm onSubmit={(form: any) => createCustomer.mutate({ data: form }, { onSuccess: () => { setShowForm(false); invalidate(); } })} onClose={() => setShowForm(false)} loading={createCustomer.isPending} />}
      {editCustomer && <CustomerForm initial={editCustomer} onSubmit={(form: any) => updateCustomer.mutate({ id: editCustomer.id, data: form }, { onSuccess: () => { setEditCustomer(null); invalidate(); } })} onClose={() => setEditCustomer(null)} loading={updateCustomer.isPending} />}
    </div>
  );
}
