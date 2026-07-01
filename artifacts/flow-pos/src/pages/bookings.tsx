import { useState } from "react";
import {
  useListBookings,
  useCheckInBooking,
  useCompleteBooking,
  useUpdateBooking,
  useDeleteBooking,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle, Clock, XCircle, Trash2, Calendar,
  ArrowRight, Search, Play, Check, AlertCircle, Phone, Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: bookings, isLoading } = useListBookings();
  const checkInMutation = useCheckInBooking();
  const completeMutation = useCompleteBooking();
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();

  const [rescheduleData, setRescheduleData] = useState<{ id: number; date: string; time: string } | null>(null);

  const handleCheckIn = (id: number) => {
    checkInMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Check In Berhasil", description: "Status reservasi diubah menjadi Checked In." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Check In", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleStartPlaying = (id: number) => {
    updateMutation.mutate({
      id,
      data: { status: "playing" }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Mulai Bermain", description: "Status reservasi diubah menjadi Playing." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Mengubah Status", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleComplete = (id: number) => {
    completeMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Pemesanan Selesai", description: "Status reservasi diubah menjadi Completed." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Menyelesaikan Pemesanan", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleCancel = (id: number) => {
    if (confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
      updateMutation.mutate({
        id,
        data: { status: "cancelled" }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          toast({ title: "Booking Dibatalkan", description: "Reservasi berhasil dibatalkan." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal Membatalkan", description: err?.data?.error || "Terjadi kesalahan." });
        }
      });
    }
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleData) return;

    updateMutation.mutate({
      id: rescheduleData.id,
      data: {
        bookingDate: rescheduleData.date,
        startTime: rescheduleData.time,
        status: "rescheduled"
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        setRescheduleData(null);
        toast({ title: "Reschedule Berhasil", description: "Jadwal reservasi telah dipindahkan." });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Reschedule", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus permanen riwayat booking ini?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          toast({ title: "Booking Dihapus", description: "Data berhasil dihapus dari database." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Gagal Menghapus", description: err?.data?.error || "Terjadi kesalahan." });
        }
      });
    }
  };

  // Filter list
  const filteredBookings = bookings?.filter((b: any) => {
    const matchesSearch =
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.customerPhone && b.customerPhone.includes(searchTerm)) ||
      b.resourceName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate status counters
  const counters = (() => {
    let pending = 0, checkedIn = 0, playing = 0, completed = 0, cancelled = 0;
    bookings?.forEach((b: any) => {
      if (b.status === "confirmed" || b.status === "pending" || b.status === "rescheduled") pending++;
      else if (b.status === "checked_in") checkedIn++;
      else if (b.status === "playing") playing++;
      else if (b.status === "completed" || b.status === "finished") completed++;
      else if (b.status === "cancelled") cancelled++;
    });
    return { pending, checkedIn, playing, completed, cancelled, total: bookings?.length || 0 };
  })();

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Memuat daftar booking...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="text-primary" /> Riwayat & Konfirmasi Booking
        </h1>
        <p className="text-muted-foreground text-sm">Lihat, ubah status, reschedule, dan kelola pembayaran booking lapangan/studio</p>
      </div>

      {/* Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center">
          <div className="text-sm font-semibold text-muted-foreground">Semua</div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.total}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center border-l-4 border-l-blue-500">
          <div className="text-sm font-semibold text-blue-500 flex items-center justify-center gap-1">
            <Clock size={14} /> Aktif / Confirmed
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.pending}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center border-l-4 border-l-amber-500">
          <div className="text-sm font-semibold text-amber-500 flex items-center justify-center gap-1">
            <Play size={14} /> Checked In
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.checkedIn}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center border-l-4 border-l-purple-500">
          <div className="text-sm font-semibold text-purple-500 flex items-center justify-center gap-1">
            <Activity size={14} /> Playing
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.playing}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center border-l-4 border-l-green-500">
          <div className="text-sm font-semibold text-green-500 flex items-center justify-center gap-1">
            <CheckCircle size={14} /> Selesai
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.completed}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm text-center border-l-4 border-l-red-500">
          <div className="text-sm font-semibold text-red-500 flex items-center justify-center gap-1">
            <XCircle size={14} /> Batal
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{counters.cancelled}</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Cari nama pemesan atau lapangan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { value: "all", label: "Semua Status" },
            { value: "confirmed", label: "Confirmed" },
            { value: "checked_in", label: "Checked In" },
            { value: "playing", label: "Playing" },
            { value: "completed", label: "Selesai" },
            { value: "cancelled", label: "Batal" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                statusFilter === item.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground">
              <th className="p-4 font-semibold">Pemesan</th>
              <th className="p-4 font-semibold">Lapangan</th>
              <th className="p-4 font-semibold">Tanggal & Jam</th>
              <th className="p-4 font-semibold">Total Biaya</th>
              <th className="p-4 font-semibold">Pembayaran</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings && filteredBookings.length > 0 ? (
              filteredBookings.map((b: any) => (
                <tr key={b.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="p-4 font-semibold text-foreground">
                    <div>{b.customerName}</div>
                    {b.customerPhone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {b.customerPhone}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-foreground font-medium">{b.resourceName}</td>
                  <td className="p-4">
                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <Calendar size={12} className="text-muted-foreground" /> {b.bookingDate}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {b.startTime} - {b.endTime}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-foreground">Rp {Number(b.totalPrice).toLocaleString("id-ID")}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      b.paymentStatus === "paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    }`}>
                      {b.paymentStatus === "paid" ? "Sudah Bayar" : "Belum Bayar"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      b.status === "completed" || b.status === "finished"
                        ? "bg-green-100 text-green-700 dark:bg-green-950/30"
                        : b.status === "playing"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30"
                        : b.status === "checked_in"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30"
                        : b.status === "cancelled"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/30"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/30"
                    }`}>
                      {b.status === "checked_in" ? "Checked In" : b.status === "playing" ? "Playing" : b.status === "completed" || b.status === "finished" ? "Selesai" : b.status === "cancelled" ? "Batal" : "Confirmed"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {(b.status === "confirmed" || b.status === "pending" || b.status === "rescheduled") && (
                        <>
                          <button
                            onClick={() => handleCheckIn(b.id)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer border-0 flex items-center gap-1"
                            title="Check In Pelanggan"
                          >
                            <Check size={12} /> Check In
                          </button>
                          <button
                            onClick={() => setRescheduleData({ id: b.id, date: b.bookingDate, time: b.startTime })}
                            className="px-2 py-1 border border-border bg-background text-foreground rounded text-xs font-semibold cursor-pointer hover:bg-muted"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(b.id)}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold cursor-pointer border-0"
                          >
                            Batal
                          </button>
                        </>
                      )}
                      {b.status === "checked_in" && (
                        <button
                          onClick={() => handleStartPlaying(b.id)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer border-0 flex items-center gap-1"
                        >
                          <Play size={12} /> Mulai Main
                        </button>
                      )}
                      {b.status === "playing" && (
                        <button
                          onClick={() => handleComplete(b.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold cursor-pointer border-0 flex items-center gap-1"
                        >
                          <CheckCircle size={12} /> Selesai Main
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer bg-transparent border-0"
                        title="Hapus Booking"
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
                  Tidak ada data booking sewa lapangan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reschedule Modal */}
      {rescheduleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> Reschedule Pemesanan
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
                    placeholder="Contoh: 09:00"
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
