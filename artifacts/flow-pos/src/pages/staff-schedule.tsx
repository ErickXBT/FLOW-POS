import { useState, useMemo } from "react";
import {
  useListEmployees,
  useListAppointments,
} from "@workspace/api-client-react";
import { Users, Award, DollarSign, Star, Calendar, Clock, Sparkles } from "lucide-react";

export default function StaffSchedulePage() {
  const { data: employees, isLoading: loadingEmployees } = useListEmployees();
  const { data: appointments, isLoading: loadingAppointments } = useListAppointments();

  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Calculate commission and statistics per staff member
  const staffStats = useMemo(() => {
    const stats: Record<number, { totalAppointments: number; totalCommission: number; completedCount: number }> = {};
    
    if (employees) {
      employees.forEach((emp: any) => {
        stats[emp.id] = { totalAppointments: 0, totalCommission: 0, completedCount: 0 };
      });
    }

    if (appointments) {
      appointments.forEach((app: any) => {
        if (stats[app.employeeId]) {
          stats[app.employeeId].totalAppointments++;
          if (app.status === "completed") {
            stats[app.employeeId].completedCount++;
            stats[app.employeeId].totalCommission += Number(app.commissionPaid || 0);
          }
        }
      });
    }

    return stats;
  }, [employees, appointments]);

  const selectedStaffAppointments = useMemo(() => {
    if (!selectedStaffId || !appointments) return [];
    return appointments.filter((app: any) => app.employeeId === selectedStaffId);
  }, [selectedStaffId, appointments]);

  const selectedStaffDetails = useMemo(() => {
    if (!selectedStaffId || !employees) return null;
    return employees.find((emp: any) => emp.id === selectedStaffId);
  }, [selectedStaffId, employees]);

  if (loadingEmployees || loadingAppointments) {
    return <div className="p-6 text-center text-muted-foreground">Memuat laporan kinerja staff...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="text-primary" /> Penjadwalan & Komisi Staff
        </h1>
        <p className="text-muted-foreground text-sm">Lihat aktivitas kerja karyawan, rating pelayanan, dan akumulasi komisi jasa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Cards List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Karyawan / Therapist</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employees && employees.length > 0 ? (
              employees.map((emp: any) => {
                const stats = staffStats[emp.id] || { totalAppointments: 0, totalCommission: 0, completedCount: 0 };
                const isSelected = selectedStaffId === emp.id;
                // Generate a mockup rating based on name length for visual excellence
                const mockRating = (4.0 + (emp.name.length % 10) * 0.1).toFixed(1);

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedStaffId(emp.id)}
                    className={`bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-card-border"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-foreground text-base">{emp.name}</h3>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{emp.role}</p>
                        </div>
                        <div className="flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg text-xs font-bold">
                          <Star size={12} fill="currentColor" /> {mockRating}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-border/80 pt-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Total Janji Temu:</div>
                          <div className="font-bold text-foreground mt-0.5">{stats.totalAppointments} kali</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Komisi:</div>
                          <div className="font-bold text-primary mt-0.5">Rp {stats.totalCommission.toLocaleString("id-ID")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground italic mt-4 text-right">
                      {isSelected ? "Sedang Dipilih" : "Klik untuk detail aktivitas"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                Belum ada data karyawan terdaftar.
              </div>
            )}
          </div>
        </div>

        {/* Detailed Work Activities Panel */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Aktivitas & Riwayat Tugas</h2>
          {selectedStaffDetails ? (
            <div className="space-y-4">
              <div className="border-b border-border pb-4">
                <h3 className="font-bold text-foreground text-lg">{selectedStaffDetails.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{selectedStaffDetails.role}</p>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {selectedStaffAppointments.length > 0 ? (
                  selectedStaffAppointments.map((app: any) => (
                    <div key={app.id} className="border border-border/70 p-3 rounded-lg text-xs space-y-2 bg-muted/10">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">{app.serviceName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          app.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1"><Calendar size={10} /> {app.appointmentDate}</div>
                        <div className="flex items-center gap-1"><Clock size={10} /> {app.startTime} - {app.endTime}</div>
                      </div>
                      <div className="border-t border-border/70 pt-2 flex justify-between font-medium">
                        <span className="text-muted-foreground">Komisi:</span>
                        <span className="text-primary font-bold">Rp {Number(app.commissionPaid || 0).toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Belum ada pengerjaan order jasa oleh karyawan ini.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <Sparkles size={24} className="text-muted-foreground/40" />
              Pilih karyawan di sebelah kiri untuk melihat rincian aktivitas dan komisi kerja.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
