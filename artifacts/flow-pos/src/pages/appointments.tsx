import { useState, useMemo } from "react";
import {
  useListAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  useListEmployees,
  useListServices,
  useListCustomers,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar, Clock, Users, Search, Plus, User, FileText, CheckCircle,
  XCircle, Trash2, ArrowRight, Check, Play, Phone, HelpCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const APPOINTMENT_HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: appointments, isLoading: loadingAppointments } = useListAppointments({ date: selectedDate });
  const { data: employees } = useListEmployees();
  const { data: services } = useListServices();
  const { data: customers } = useListCustomers();

  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const deleteMutation = useDeleteAppointment();

  const [showModal, setShowModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{ id: number; date: string; time: string } | null>(null);
  
  const [form, setForm] = useState({
    customerId: "" as string | number,
    customerName: "",
    customerPhone: "",
    employeeId: 0,
    serviceId: 0,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });

  const handleOpenCreate = () => {
    setForm({
      customerId: "",
      customerName: "",
      customerPhone: "",
      employeeId: employees && employees.length > 0 ? employees[0].id : 0,
      serviceId: services && services.length > 0 ? services[0].id : 0,
      startTime: "09:00",
      endTime: "10:00",
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

  // Automatically calculate price based on selected service
  const calculatedPrice = useMemo(() => {
    if (!form.serviceId || !services) return 0;
    const service = services.find((s: any) => s.id === form.serviceId);
    return service ? Number(service.price) : 0;
  }, [form.serviceId, services]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId || !form.serviceId || !form.customerName.trim()) {
      toast({ variant: "destructive", title: "Lengkapi data wajib" });
      return;
    }

    createMutation.mutate({
      data: {
        employeeId: form.employeeId,
        serviceId: form.serviceId,
        customerId: form.customerId ? Number(form.customerId) : null,
        customerName: form.customerName,
        customerPhone: form.customerPhone || null,
        appointmentDate: selectedDate,
        startTime: form.startTime,
        endTime: form.endTime,
        totalPrice: calculatedPrice,
        notes: form.notes || null,
        status: "confirmed",
        paymentStatus: "unpaid",
        commissionPaid: 0, // calculated in backend
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setShowModal(false);
        toast({
          title: "Janji Temu Dibuat",
          description: `Jadwal pelayanan untuk ${form.customerName} berhasil disimpan.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Gagal Membuat Janji Temu",
          description: err?.data?.error || "Terjadi kesalahan.",
        });
      },
    });
  };

  const handleUpdateStatus = (id: number, status: string) => {
    updateMutation.mutate({
      id,
      data: { status: status as any }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: "Status Diubah", description: `Jadwal berhasil diubah menjadi ${status}.` });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Mengubah Status", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handlePay = (id: number) => {
    updateMutation.mutate({
      id,
      data: { paymentStatus: "paid" }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: "Pembayaran Berhasil", description: "Reservasi ditandai sebagai Sudah Bayar." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Memproses Pembayaran", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleData) return;

    updateMutation.mutate({
      id: rescheduleData.id,
      data: {
        appointmentDate: rescheduleData.date,
        startTime: rescheduleData.time,
        status: "rescheduled",
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setRescheduleData(null);
        toast({ title: "Reschedule Berhasil", description: "Jadwal pelayanan dipindahkan." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Reschedule", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus jadwal janji temu ini?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          toast({ title: "Jadwal Dihapus", description: "Data berhasil dihapus dari database." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal Menghapus", description: err?.data?.error || "Terjadi kesalahan." });
        }
      });
    }
  };

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((app: any) => {
      return (
        app.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [appointments, searchTerm]);

  if (loadingAppointments) {
    return <div className="p-6 text-center text-muted-foreground">Memuat jadwal janji temu...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="text-primary" /> Antrean & Janji Temu (Appointment)
          </h1>
          <p className="text-muted-foreground text-sm">Kelola pemesanan jadwal salon, spa, klinik kecantikan, atau konsultasi staff</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 border-0 cursor-pointer"
        >
          <Plus size={16} /> Buat Appointment
        </button>
      </div>

      {/* Date filter & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border border-card-border p-4 rounded-xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Cari pelanggan, staff, atau layanan..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="text-xs font-bold text-muted-foreground uppercase">Pilih Hari:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Queue List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAppointments && filteredAppointments.length > 0 ? (
          filteredAppointments.map((app: any) => (
            <div
              key={app.id}
              className="bg-card border border-card-border rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground text-base">{app.customerName}</h3>
                  {app.customerPhone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {app.customerPhone}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    app.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : app.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {app.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    app.paymentStatus === "paid"
                      ? "bg-green-50 text-green-600 border border-green-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}>
                    {app.paymentStatus === "paid" ? "Sudah Bayar" : "Belum Bayar"}
                  </span>
                </div>
              </div>

              <div className="border-t border-border/80 pt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Layanan Jasa:</span>
                  <span className="font-bold text-foreground">{app.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff / Therapist:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <User size={12} className="text-muted-foreground" /> {app.employeeName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu Pengerjaan:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground" /> {app.startTime} - {app.endTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Harga Jasa:</span>
                  <span className="font-bold text-primary">Rp {Number(app.totalPrice).toLocaleString("id-ID")}</span>
                </div>
                {app.notes && (
                  <div className="bg-muted/30 p-2 rounded text-muted-foreground text-[11px] leading-relaxed mt-1 flex items-start gap-1">
                    <FileText size={12} className="mt-0.5 shrink-0" />
                    <span>Catatan: {app.notes}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-1.5 border-t border-border/80 pt-4 mt-2">
                {app.status === "confirmed" && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(app.id, "completed")}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold cursor-pointer border-0 flex items-center gap-1"
                    >
                      <Check size={12} /> Selesai
                    </button>
                    <button
                      onClick={() => setRescheduleData({ id: app.id, date: app.appointmentDate, time: app.startTime })}
                      className="px-2 py-1 border border-border bg-background text-foreground rounded text-xs font-semibold cursor-pointer hover:bg-muted"
                    >
                      Reschedule
                    </button>
                  </>
                )}
                {app.paymentStatus === "unpaid" && app.status !== "cancelled" && (
                  <button
                    onClick={() => handlePay(app.id)}
                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer border-0"
                  >
                    Bayar
                  </button>
                )}
                {app.status === "confirmed" && (
                  <button
                    onClick={() => handleUpdateStatus(app.id, "cancelled")}
                    className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold cursor-pointer border-0"
                  >
                    Batal
                  </button>
                )}
                <button
                  onClick={() => handleDelete(app.id)}
                  className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer bg-transparent border-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
            Tidak ada janji temu hari ini.
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md animate-scale-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> Buat Janji Temu Baru
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Hubungkan Ke Pelanggan/Member (Opsional)
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
                      placeholder="Nomor Whatsapp/Telp"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Pilih Layanan</label>
                    <select
                      value={form.serviceId}
                      onChange={e => setForm(f => ({ ...f, serviceId: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {services?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}m)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Therapist / Staff</label>
                    <select
                      value={form.employeeId}
                      onChange={e => setForm(f => ({ ...f, employeeId: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {employees?.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Tanggal</label>
                    <div className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-muted-foreground text-sm font-semibold">
                      {selectedDate}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Jam Mulai</label>
                    <select
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {APPOINTMENT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Jam Selesai</label>
                    <select
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {APPOINTMENT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-muted-foreground">Total Tarif Layanan:</span>
                  <span className="text-primary font-bold text-base">
                    Rp {calculatedPrice.toLocaleString("id-ID")}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Catatan</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Contoh: Request potong pendek saja..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none resize-none"
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
                  {createMutation.isPending ? "Memproses..." : "Buat Jadwal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> Reschedule Pelayanan
              </h2>
              <button
                onClick={() => setRescheduleData(null)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Tanggal Baru</label>
                  <input
                    type="date"
                    required
                    value={rescheduleData.date}
                    onChange={(e) => setRescheduleData(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Mulai Jam</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 10:00"
                    value={rescheduleData.time}
                    onChange={(e) => setRescheduleData(prev => prev ? ({ ...prev, time: e.target.value }) : null)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-border bg-muted/10">
                <button
                  type="button"
                  onClick={() => setRescheduleData(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold hover:bg-muted text-foreground border border-border bg-transparent cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 border-0 cursor-pointer"
                >
                  Pindahkan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


