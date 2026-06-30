import { useState, useMemo } from "react";
import {
  useListWorkOrders,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
  useListEmployees,
  useListCustomers,
  getListWorkOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Plus, Search, User, Wrench, X, AlertCircle, Phone, Check, ShieldCheck, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: workOrders, isLoading: loadingWO } = useListWorkOrders();
  const { data: employees } = useListEmployees();
  const { data: customers } = useListCustomers();

  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const deleteMutation = useDeleteWorkOrder();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerId: "" as string | number,
    customerName: "",
    customerPhone: "",
    technicianId: "" as string | number,
    deviceName: "",
    deviceIdentifier: "",
    problemDescription: "",
    servicePrice: 0,
    sparepartsPrice: 0,
    sparepartsDetails: "",
    warrantyDays: 0,
    status: "queue" as "queue" | "inspecting" | "repairing" | "testing" | "completed",
    notes: "",
  });

  const handleOpenCreate = () => {
    setForm({
      customerId: "",
      customerName: "",
      customerPhone: "",
      technicianId: "",
      deviceName: "",
      deviceIdentifier: "",
      problemDescription: "",
      servicePrice: 0,
      sparepartsPrice: 0,
      sparepartsDetails: "",
      warrantyDays: 0,
      status: "queue",
      notes: "",
    });
    setShowModal(true);
  };

  const handleCustomerChange = (customerIdVal: string) => {
    if (!customerIdVal) {
      setForm(prev => ({
        ...prev,
        customerId: "",
        customerName: "",
        customerPhone: "",
      }));
      return;
    }

    const cust = customers?.data?.find((c: any) => String(c.id) === customerIdVal);
    if (cust) {
      setForm(prev => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone || "",
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerName.trim() || !form.deviceName.trim() || !form.problemDescription.trim()) {
      toast({ variant: "destructive", title: "Lengkapi data wajib" });
      return;
    }

    const totalPriceCalc = Number(form.servicePrice || 0) + Number(form.sparepartsPrice || 0);

    createMutation.mutate({
      data: {
        customerId: form.customerId ? Number(form.customerId) : null,
        customerName: form.customerName,
        customerPhone: form.customerPhone || null,
        technicianId: form.technicianId ? Number(form.technicianId) : null,
        deviceName: form.deviceName,
        deviceIdentifier: form.deviceIdentifier || null,
        problemDescription: form.problemDescription,
        servicePrice: form.servicePrice,
        sparepartsPrice: form.sparepartsPrice,
        totalPrice: totalPriceCalc,
        sparepartsDetails: form.sparepartsDetails || null,
        warrantyDays: form.warrantyDays,
        status: form.status,
        paymentStatus: "unpaid",
        notes: form.notes || null,
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
        setShowModal(false);
        toast({
          title: "Work Order Dibuat",
          description: `Work order untuk unit "${form.deviceName}" berhasil dibuat.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Gagal Membuat WO",
          description: err?.data?.error || "Terjadi kesalahan.",
        });
      },
    });
  };

  const handleUpdatePayment = (id: number) => {
    updateMutation.mutate({
      id,
      data: { paymentStatus: "paid" }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
        toast({ title: "Pembayaran Sukses", description: "Work order ditandai telah dibayar." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Bayar", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus data WO ini secara permanen?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
          toast({ title: "Work Order Dihapus", description: "Data berhasil dihapus." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal Menghapus", description: err?.data?.error || "Terjadi kesalahan." });
        }
      });
    }
  };

  const filteredWO = useMemo(() => {
    if (!workOrders) return [];
    return workOrders.filter((item: any) => {
      return (
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.deviceIdentifier && item.deviceIdentifier.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [workOrders, searchTerm]);

  if (loadingWO) {
    return <div className="p-6 text-center text-muted-foreground">Memuat data work order...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="text-primary" /> Work Order (WO)
          </h1>
          <p className="text-muted-foreground text-sm">Kelola tanda terima perbaikan perangkat/kendaraan masuk</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 border-0 cursor-pointer"
        >
          <Plus size={16} /> Buat Work Order
        </button>
      </div>

      <div className="relative w-full sm:w-80 bg-card border border-card-border p-3 rounded-xl shadow-sm">
        <Search className="absolute left-6 top-5.5 text-muted-foreground" size={18} />
        <input
          type="text"
          placeholder="Cari nama, tipe unit, plat/SN..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none"
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground">
              <th className="p-4 font-semibold">Tanda Terima WO</th>
              <th className="p-4 font-semibold">Unit Device</th>
              <th className="p-4 font-semibold">Keluhan / Kerusakan</th>
              <th className="p-4 font-semibold">Sparepart & Jasa</th>
              <th className="p-4 font-semibold">Total Biaya</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredWO && filteredWO.length > 0 ? (
              filteredWO.map((item: any) => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-foreground">WO-{item.id}</div>
                    <div className="text-xs text-muted-foreground font-semibold mt-0.5">{item.customerName}</div>
                    {item.customerPhone && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                        <Phone size={8} /> {item.customerPhone}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-foreground">{item.deviceName}</div>
                    {item.deviceIdentifier && (
                      <div className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                        ID: {item.deviceIdentifier}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground max-w-[180px] truncate" title={item.problemDescription}>
                    {item.problemDescription}
                  </td>
                  <td className="p-4 text-xs space-y-0.5">
                    <div>Jasa: Rp {Number(item.servicePrice).toLocaleString("id-ID")}</div>
                    <div>Sparepart: Rp {Number(item.sparepartsPrice).toLocaleString("id-ID")}</div>
                  </td>
                  <td className="p-4 font-bold text-foreground">
                    Rp {Number(item.totalPrice).toLocaleString("id-ID")}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-start gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        item.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : item.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {item.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        item.paymentStatus === "paid"
                          ? "bg-green-50 text-green-600 border border-green-200"
                          : "bg-amber-50 text-amber-600 border border-amber-200"
                      }`}>
                        {item.paymentStatus === "paid" ? "Lunas" : "Belum Bayar"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {item.paymentStatus === "unpaid" && item.status !== "cancelled" && (
                        <button
                          onClick={() => handleUpdatePayment(item.id)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer border-0"
                        >
                          Bayar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer bg-transparent border-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Tidak ada data work order aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Wrench size={16} className="text-primary" /> Penerimaan Perbaikan Baru
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 max-h-[420px] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Hubungkan Ke Pelanggan/Member
                  </label>
                  <select
                    value={String(form.customerId)}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  >
                    <option value="">-- Guest / Pelanggan Baru --</option>
                    {customers?.data?.map((c: any) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} ({c.phone || "No phone"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Nama Pemesan</label>
                    <input
                      type="text"
                      required
                      value={form.customerName}
                      onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                      disabled={!!form.customerId}
                      placeholder="Nama Pelanggan"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Telepon</label>
                    <input
                      type="text"
                      value={form.customerPhone}
                      onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      disabled={!!form.customerId}
                      placeholder="Nomor Handphone"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Tipe / Nama Unit</label>
                    <input
                      type="text"
                      required
                      value={form.deviceName}
                      onChange={e => setForm(f => ({ ...f, deviceName: e.target.value }))}
                      placeholder="Contoh: Vario 150 CBS"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">IMEI / Plat / SN</label>
                    <input
                      type="text"
                      value={form.deviceIdentifier}
                      onChange={e => setForm(f => ({ ...f, deviceIdentifier: e.target.value }))}
                      placeholder="Contoh: B 1234 XYZ"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Keluhan Kerusakan</label>
                  <textarea
                    required
                    value={form.problemDescription}
                    onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))}
                    placeholder="Contoh: Ganti oli, service karburator, shockbreaker bocor..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Biaya Jasa (Rp)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={form.servicePrice}
                      onChange={e => setForm(f => ({ ...f, servicePrice: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Teknisi</label>
                    <select
                      value={String(form.technicianId)}
                      onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      <option value="">-- Tanpa Teknisi (Queue) --</option>
                      {employees?.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Biaya Sparepart (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.sparepartsPrice}
                      onChange={e => setForm(f => ({ ...f, sparepartsPrice: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Masa Garansi (Hari)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.warrantyDays}
                      onChange={e => setForm(f => ({ ...f, warrantyDays: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Detail Sparepart Usulan</label>
                  <input
                    type="text"
                    value={form.sparepartsDetails}
                    onChange={e => setForm(f => ({ ...f, sparepartsDetails: e.target.value }))}
                    placeholder="Contoh: Oli MPX2, Kampas rem depan"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  />
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
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 border-0 cursor-pointer"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Buat WO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
