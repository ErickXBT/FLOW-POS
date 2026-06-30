import { useState } from "react";
import {
  useListServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  getListServicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Scissors, X, Percent, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: services, isLoading } = useListServices();

  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    duration: 30, // in minutes
    price: 0,
    commissionRate: 0, // in percentage
    description: "",
    status: "active" as "active" | "inactive",
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      duration: 30,
      price: 0,
      commissionRate: 0,
      description: "",
      status: "active",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (svc: any) => {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      duration: svc.duration,
      price: Number(svc.price),
      commissionRate: Number(svc.commissionRate),
      description: svc.description || "",
      status: svc.status,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        setShowModal(false);
        toast({
          title: editingId ? "Layanan Berhasil Diubah" : "Layanan Berhasil Ditambahkan",
          description: `Layanan "${form.name}" telah disimpan.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Terjadi Kesalahan",
          description: err?.data?.error || "Gagal menyimpan layanan.",
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
    if (confirm(`Apakah Anda yakin ingin menghapus layanan "${name}"?`)) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({
            title: "Layanan Dihapus",
            description: `Layanan "${name}" berhasil dihapus.`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Gagal Menghapus",
            description: err?.data?.error || "Layanan tidak dapat dihapus.",
          });
        },
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Memuat daftar layanan...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scissors className="text-primary" /> Layanan / Service
          </h1>
          <p className="text-muted-foreground text-sm">Kelola jenis jasa layanan, durasi pengerjaan, dan komisi staff</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity border-0 cursor-pointer"
        >
          <Plus size={16} /> Tambah Layanan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services && services.length > 0 ? (
          services.map((svc: any) => (
            <div
              key={svc.id}
              className="bg-card border border-card-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{svc.name}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock size={12} /> {svc.duration} menit
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    svc.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {svc.status === "active" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground min-h-[32px] line-clamp-2">
                  {svc.description || "Tidak ada deskripsi."}
                </p>

                <div className="border-t border-border/80 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Harga Jasa:</span>
                    <span className="font-bold text-foreground">Rp {Number(svc.price).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Komisi Karyawan:</span>
                    <span className="font-semibold text-primary flex items-center gap-0.5">
                      <Percent size={10} /> {Number(svc.commissionRate)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border/80 pt-4 mt-4">
                <button
                  onClick={() => handleOpenEdit(svc)}
                  className="flex-1 py-1.5 border border-border rounded-lg text-xs font-semibold hover:bg-muted text-foreground flex items-center justify-center gap-1.5 cursor-pointer bg-transparent"
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(svc.id, svc.name)}
                  className="flex-1 py-1.5 border border-destructive/20 rounded-lg text-xs font-semibold hover:bg-destructive/10 text-destructive flex items-center justify-center gap-1.5 cursor-pointer bg-transparent"
                >
                  <Trash2 size={12} /> Hapus
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
            Belum ada daftar layanan jasa yang dibuat.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm">
                {editingId ? "Edit Layanan Jasa" : "Tambah Layanan Baru"}
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
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Nama Layanan Jasa</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Potong Rambut Pria + Massage"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Durasi (Menit)</label>
                    <input
                      type="number"
                      required
                      min={5}
                      step={5}
                      value={form.duration}
                      onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Harga Layanan (Rp)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Tarif Komisi Staff (%)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.commissionRate}
                    onChange={e => setForm(f => ({ ...f, commissionRate: Number(e.target.value) }))}
                    placeholder="Contoh: 10 untuk komisi 10% per order"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Deskripsi Layanan</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Rincian treatment..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Status Keaktifan</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  >
                    <option value="active">Aktif (Ditampilkan)</option>
                    <option value="inactive">Nonaktif (Sembunyikan)</option>
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
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 border-0 cursor-pointer"
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
