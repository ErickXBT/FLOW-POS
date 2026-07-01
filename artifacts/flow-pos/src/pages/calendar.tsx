import { useState, useMemo } from "react";
import {
  useListBookingResources,
  useListBookings,
  useCreateBooking,
  useListCustomers,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Clock, Plus, Users, Search, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OPERATIONAL_HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { data: resources, isLoading: loadingResources } = useListBookingResources();
  const { data: bookings, isLoading: loadingBookings } = useListBookings({ date: selectedDate });
  const { data: customers } = useListCustomers();

  const createBookingMutation = useCreateBooking();

  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({
    resourceId: 0,
    startTime: "08:00",
    endTime: "09:00",
    customerId: "" as string | number,
    customerName: "",
    customerPhone: "",
    notes: "",
  });

  // Map bookings to resource & time slots for easy grid lookup
  const bookingGrid = useMemo(() => {
    const grid: Record<string, any> = {};
    if (bookings) {
      bookings.forEach((b: any) => {
        try {
          if (!b.startTime || !b.endTime) return;
          const startH = parseInt(b.startTime.split(":")[0]);
          const endH = parseInt(b.endTime.split(":")[0]);
          if (isNaN(startH) || isNaN(endH)) return;

          for (let h = startH; h < endH; h++) {
            const hourStr = String(h).padStart(2, "0") + ":00";
            grid[`${b.resourceId}-${hourStr}`] = b;
          }
        } catch (e) {
          console.error("Error mapping booking grid:", e);
        }
      });
    }
    return grid;
  }, [bookings]);

  const handleCellClick = (resourceId: number, time: string) => {
    const hour = parseInt(time.split(":")[0]);
    const nextHour = String(hour + 1).padStart(2, "0") + ":00";
    
    // Find resource details to calculate default price
    const resItem = resources?.find((r: any) => r.id === resourceId);
    if (resItem?.status === "maintenance" || resItem?.status === "inactive") {
      toast({
        variant: "destructive",
        title: "Resource Tidak Tersedia",
        description: "Lapangan ini sedang tidak aktif atau dalam pemeliharaan.",
      });
      return;
    }

    setModalData({
      resourceId,
      startTime: time,
      endTime: nextHour,
      customerId: "",
      customerName: "",
      customerPhone: "",
      notes: "",
    });
    setShowModal(true);
  };

  const handleCustomerChange = (customerIdVal: string) => {
    if (!customerIdVal) {
      setModalData(prev => ({
        ...prev,
        customerId: "",
        customerName: "",
        customerPhone: "",
      }));
      return;
    }

    const cust = customers?.data?.find((c: any) => String(c.id) === customerIdVal);
    if (cust) {
      setModalData(prev => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone || "",
      }));
    }
  };

  // Determine pricing dynamically for the form preview
  const calculatedPrice = useMemo(() => {
    if (!modalData.resourceId) return 0;
    const resItem = resources?.find((r: any) => r.id === modalData.resourceId);
    if (!resItem) return 0;

    const dateObj = new Date(selectedDate);
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6;

    if (modalData.customerId) {
      return Number(resItem.priceMember);
    }
    return isWeekend ? Number(resItem.priceWeekend) : Number(resItem.priceWeekday);
  }, [modalData.resourceId, modalData.customerId, selectedDate, resources]);

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!modalData.customerName.trim()) {
      toast({ variant: "destructive", title: "Nama Pelanggan Wajib diisi" });
      return;
    }

    createBookingMutation.mutate({
      data: {
        resourceId: modalData.resourceId,
        customerId: modalData.customerId ? Number(modalData.customerId) : null,
        customerName: modalData.customerName,
        customerPhone: modalData.customerPhone || null,
        bookingDate: selectedDate,
        startTime: modalData.startTime,
        endTime: modalData.endTime,
        totalPrice: calculatedPrice,
        notes: modalData.notes || null,
        status: "confirmed",
        paymentStatus: "unpaid",
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        setShowModal(false);
        toast({
          title: "Booking Berhasil",
          description: `Jadwal atas nama ${modalData.customerName} telah disimpan.`,
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Gagal Membuat Booking",
          description: err?.data?.error || "Terjadi kesalahan.",
        });
      },
    });
  };

  if (loadingResources || loadingBookings) {
    return <div className="p-6 text-center text-muted-foreground">Memuat Kalender Reservasi...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-primary" /> Kalender Jadwal
          </h1>
          <p className="text-muted-foreground text-sm">Visual slot ketersediaan lapangan dan jadwal hari ini</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-muted-foreground uppercase">Pilih Tanggal:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center bg-card border border-card-border p-3.5 rounded-xl text-xs font-semibold">
        <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider mr-2">Status Lapangan:</span>
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/25 border border-emerald-500/40 flex items-center justify-center text-[9px] font-bold">✓</span>
          <span>Available (Tersedia)</span>
        </div>
        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
          <span className="w-3.5 h-3.5 rounded-full bg-rose-500/25 border border-rose-500/40 flex items-center justify-center text-[9px] font-bold">✗</span>
          <span>Booked (Sudah Dibooking)</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-3.5 h-3.5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold opacity-60">!</span>
          <span>Off / Maintenance (Tutup)</span>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[700px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="p-4 font-semibold text-muted-foreground w-44">Lapangan</th>
              {OPERATIONAL_HOURS.map((hour) => (
                <th key={hour} className="p-4 font-semibold text-muted-foreground text-center border-l border-border/80">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources && resources.length > 0 ? (
              resources.map((resItem: any) => (
                <tr key={resItem.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                  <td className="p-4 font-semibold text-foreground bg-card sticky left-0 z-10 border-r border-border/80 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div>{resItem.name}</div>
                    <div className="text-[10px] font-normal text-muted-foreground uppercase">{resItem.status}</div>
                  </td>
                  {OPERATIONAL_HOURS.map((hour) => {
                    const booking = bookingGrid[`${resItem.id}-${hour}`];
                    const isOccupied = !!booking;
                    const isBlocked = resItem.status === "maintenance" || resItem.status === "inactive";

                    return (
                      <td
                        key={hour}
                        className={`p-2.5 border-l border-border/85 text-center min-w-[120px] ${
                          isBlocked ? "bg-muted/40 cursor-not-allowed" : "cursor-pointer"
                        }`}
                        onClick={() => !isOccupied && !isBlocked && handleCellClick(resItem.id, hour)}
                      >
                        {isOccupied ? (
                          <div className="flex flex-col gap-1 items-center justify-center p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-medium transition-all hover:scale-[1.02] duration-200">
                            <div className="flex items-center gap-1 font-bold text-rose-700 dark:text-rose-300">
                              <span className="text-xs">✗</span> Terisi
                            </div>
                            <div className="font-semibold line-clamp-1 text-[10px] opacity-90">{booking.customerName}</div>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                              booking.status === "completed" || booking.status === "finished"
                                ? "bg-green-100 text-green-700 dark:bg-green-950/30"
                                : booking.status === "playing"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30"
                                : booking.status === "checked_in"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30"
                                : "bg-rose-200 text-rose-800"
                            }`}>
                              {booking.status === "checked_in" ? "Checked In" : booking.status === "playing" ? "Playing" : booking.status === "completed" || booking.status === "finished" ? "Selesai" : "Paid"}
                            </span>
                          </div>
                        ) : isBlocked ? (
                          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/60 text-muted-foreground/60 text-[10px] italic">
                            <span className="font-bold">Off</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-center justify-center p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-all hover:scale-[1.02] duration-200">
                            <div className="flex items-center gap-1 font-bold">
                              <span className="text-xs">✓</span> Tersedia
                            </div>
                            <span className="text-[8px] font-bold uppercase text-emerald-600/80 dark:text-emerald-400/80">Sewa</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={OPERATIONAL_HOURS.length + 1} className="p-8 text-center text-muted-foreground">
                  Konfigurasikan Lapangan/Resource di menu "Lapangan" terlebih dahulu.
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
                <Clock size={16} className="text-primary" /> Reservasi Baru
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Hubungkan Ke Pelanggan/Member (Opsional)
                  </label>
                  <select
                    value={String(modalData.customerId)}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                      value={modalData.customerName}
                      onChange={(e) => setModalData(f => ({ ...f, customerName: e.target.value }))}
                      disabled={!!modalData.customerId}
                      placeholder="Nama Pelanggan"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Telepon</label>
                    <input
                      type="text"
                      value={modalData.customerPhone}
                      onChange={(e) => setModalData(f => ({ ...f, customerPhone: e.target.value }))}
                      disabled={!!modalData.customerId}
                      placeholder="Nomor Whatsapp/Telp"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
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
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Mulai</label>
                    <select
                      value={modalData.startTime}
                      onChange={(e) => setModalData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {OPERATIONAL_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Selesai</label>
                    <select
                      value={modalData.endTime}
                      onChange={(e) => setModalData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none"
                    >
                      {OPERATIONAL_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center text-sm">
                  <span className="font-semibold text-muted-foreground">Tarif Biaya Sewa:</span>
                  <span className="text-primary font-bold text-base">
                    Rp {calculatedPrice.toLocaleString("id-ID")}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Catatan Tambahan</label>
                  <textarea
                    value={modalData.notes}
                    onChange={(e) => setModalData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: Butuh raket sewa, dsb."
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
                  disabled={createBookingMutation.isPending}
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 border-0 cursor-pointer"
                >
                  {createBookingMutation.isPending ? "Memproses..." : "Konfirmasi Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline state helper
function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
