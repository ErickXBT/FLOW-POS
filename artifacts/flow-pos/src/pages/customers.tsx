import { useState } from "react";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Users, X, Star } from "lucide-react";

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
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">{initial ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
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
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data, isLoading } = useListCustomers({ search: search || undefined, page, limit: 20 });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const [claimingId, setClaimingId] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const handleClaimReward = async (id: number) => {
    setClaimingId(id);
    try {
      const token = localStorage.getItem("flow_token");
      const res = await fetch(`/api/customers/${id}/claim-reward`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token || ""}`
        }
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Pelanggan</h1>
          <p className="text-muted-foreground text-sm">{data?.total || 0} pelanggan terdaftar</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90">
          <Plus size={16} /> Tambah Pelanggan
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="customer-search"
          autoComplete="off"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari pelanggan..."
          className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-sm w-full"
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Memuat...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Pelanggan", "Kontak", "Level", "Poin", "Total Belanja", "Total Order", "Aksi"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.data || []).length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-12">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <div>Belum ada pelanggan</div>
                  </td></tr>
                )}
                {(data?.data || []).map(c => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{c.name.charAt(0)}</div>
                        <div><div className="font-medium text-foreground">{c.name}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{c.email || "-"}</div>
                      <div className="text-xs">{c.phone || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${LEVEL_COLORS[c.membershipLevel ?? 'regular']}`}>
                        <Star size={10} />{c.membershipLevel ?? 'regular'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{c.loyaltyPoints}</td>
                    <td className="px-4 py-3 font-semibold text-primary">{formatRp(Number(c.totalSpent))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.totalOrders}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleClaimReward(c.id)}
                          disabled={(c.loyaltyPoints ?? 0) < 1000 || claimingId === c.id}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold mr-2 transition-all select-none ${
                            (c.loyaltyPoints ?? 0) >= 1000
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 cursor-pointer"
                              : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {claimingId === c.id ? "..." : "Klaim Reward"}
                        </button>
                        <button onClick={() => setEditCustomer(c)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                          <Edit2 size={14} />
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

      {showForm && <CustomerForm onSubmit={(form: any) => createCustomer.mutate({ data: form }, { onSuccess: () => { setShowForm(false); invalidate(); } })} onClose={() => setShowForm(false)} loading={createCustomer.isPending} />}
      {editCustomer && <CustomerForm initial={editCustomer} onSubmit={(form: any) => updateCustomer.mutate({ id: editCustomer.id, data: form }, { onSuccess: () => { setEditCustomer(null); invalidate(); } })} onClose={() => setEditCustomer(null)} loading={updateCustomer.isPending} />}
    </div>
  );
}
