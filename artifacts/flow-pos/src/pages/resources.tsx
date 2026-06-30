import { useState } from "react";
import {
  useListBookingResources,
  useCreateBookingResource,
  useUpdateBookingResource,
  useDeleteBookingResource,
  getListBookingResourcesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, ShieldAlert, Check, X, Dumbbell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RESOURCE_TYPES = [
  { value: "court", label: "Lapangan", icon: "🏸" },
  { value: "room", label: "Ruangan/Meeting Room", icon: "🚪" },
  { value: "studio", label: "Studio Musik/Foto", icon: "🎸" },
  { value: "table", label: "Meja/Dine-in", icon: "🪑" },
  { value: "vehicle", label: "Kendaraan/Sewa", icon: "🚗" },
  { value: "asset", label: "Aset/Lainnya", icon: "📦" },
];

export default function ResourcesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: resources, isLoading } = useListBookingResources();

  const createMutation = useCreateBookingResource();
  const updateMutation = useUpdateBookingResource();
  const deleteMutation = useDeleteBookingResource();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "court",
    description: "",
    priceWeekday: 0,
    priceWeekend: 0,
    priceMember: 0,
    status: "active" as "active" | "inactive" | "maintenance",
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      type: "court",
      description: "",
      priceWeekday: 0,
      priceWeekend: 0,
      priceMember: 0,
      status: "active",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (resItem: any) => {
    setEditingId(resItem.id);
    setForm({
      name: resItem.name,
      type: resItem.type,
      description: resItem.description || "",
      priceWeekday: Number(resItem.priceWeekday),
      priceWeekend: Number(resItem.priceWeekend),
      priceMember: Number(resItem.priceMember),
      status: resItem.status,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingResourcesQueryKey() });
        setShowModal(false);
        toast({
          title: editingId ? "Resource Berhasil Diubah" : "Resource Berhasil Dibuat",
          description: `Resource "${form.name}" telah disimpan.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Terjadi Kesalahan",
          description: err?.data?.error || "Gagal menyimpan resource.",
        });
      },
    };

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: form as any,
      }, mutationOptions);
    } else {
      createMutation.mutate({
        data: form as any,
      }, mutationOptions);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus resource "${name}"?`)) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingResourcesQueryKey() });
          toast({
            title: "Resource Dihapus",
            description: `Resource "${name}" berhasil dihapus.`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Gagal Menghapus",
            description: err?.data?.error || "Resource tidak bisa dihapus.",
          });
        },
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Memuat daftar resource...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="text-primary" /> Lapangan / Resource
          </h1>
          <p className="text-muted-foreground text-sm">Kelola lapangan, ruangan, atau studio untuk reservasi</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity border-0 cursor-pointer"
        >
          <Plus size={16} /> Tambah Resource
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {resources && resources.length > 0 ? (
          resources.map((resItem: any) => {
            const typeLabel = RESOURCE_TYPES.find(t => t.value === resItem.type)?.label || resItem.type;
            const typeIcon = RESOURCE_TYPES.find(t => t.value === resItem.type)?.icon || "🏸";
            
            return (
              <div
                key={resItem.id}
                className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <span>{typeIcon}</span> {typeLabel}
                      </div>
                      <h3 className="font-bold text-foreground text-lg mt-0.5">{resItem.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      resItem.status === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                        : resItem.status === "inactive"
                        ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    }`}>
                      {resItem.status}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground min-h-[32px] line-clamp-2">
                    {resItem.description || "Tidak ada deskripsi."}
                  </p>

                  <div className="border-t border-border/80 pt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga Weekday:</span>
                      <span className="font-semibold text-foreground">Rp {Number(resItem.priceWeekday).toLocaleString("id-ID")}/jam</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga Weekend:</span>
                      <span className="font-semibold text-foreground">Rp {Number(resItem.priceWeekend).toLocaleString("id-ID")}/jam</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga Member:</span>
                      <span className="font-semibold text-foreground">Rp {Number(resItem.priceMember).toLocaleString("id-ID")}/jam</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border/80 pt-4 mt-4">
                  <button
                    onClick={() => handleOpenEdit(resItem)}
                    className="flex-1 py-1.5 border border-border rounded-lg text-xs font-semibold hover:bg-muted text-foreground flex items-center justify-center gap-1.5 cursor-pointer bg-transparent"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(resItem.id, resItem.name)}
                    className="flex-1 py-1.5 border border-destructive/20 rounded-lg text-xs font-semibold hover:bg-destructive/10 text-destructive flex items-center justify-center gap-1.5 cursor-pointer bg-transparent"
                  >
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
            Belum ada resource lapangan/ruangan yang dikonfigurasi.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm">
                {editingId ? "Edit Resource" : "Tambah Resource Baru"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Nama Lapangan / Asset</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Lapangan Bulutangkis A"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Tipe Resource</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  >
                    {RESOURCE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Deskripsi</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Spesifikasi, fasilitas, lokasi..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Weekday/Jam</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.priceWeekday}
                      onChange={e => setForm(f => ({ ...f, priceWeekday: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Weekend/Jam</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.priceWeekend}
                      onChange={e => setForm(f => ({ ...f, priceWeekend: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Member/Jam</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.priceMember}
                      onChange={e => setForm(f => ({ ...f, priceMember: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Status Ketersediaan</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  >
                    <option value="active">Aktif (Tersedia)</option>
                    <option value="inactive">Nonaktif</option>
                    <option value="maintenance">Perawatan (Maintenance)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-border bg-muted/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold hover:bg-muted text-foreground border border-border bg-transparent cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 border-0 cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
