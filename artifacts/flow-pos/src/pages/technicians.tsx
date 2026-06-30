import { useState, useMemo } from "react";
import {
  useListEmployees,
  useListWorkOrders,
} from "@workspace/api-client-react";
import { Wrench, Award, Calendar, CheckSquare, Sparkles } from "lucide-react";

export default function TechniciansPage() {
  const { data: employees, isLoading: loadingEmployees } = useListEmployees();
  const { data: workOrders, isLoading: loadingWO } = useListWorkOrders();

  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);

  // Filter out employees who are technician-related or just analyze all
  const techniciansList = useMemo(() => {
    if (!employees) return [];
    // Can filter by role if needed, e.g. emp.role === "technician", but analyzing all is safer for POS demo
    return employees;
  }, [employees]);

  // Calculate technician metrics
  const technicianStats = useMemo(() => {
    const stats: Record<number, { totalJobs: number; activeJobs: number; completedJobs: number; revenueService: number }> = {};

    if (techniciansList) {
      techniciansList.forEach((tech: any) => {
        stats[tech.id] = { totalJobs: 0, activeJobs: 0, completedJobs: 0, revenueService: 0 };
      });
    }

    if (workOrders) {
      workOrders.forEach((wo: any) => {
        if (wo.technicianId && stats[wo.technicianId]) {
          stats[wo.technicianId].totalJobs++;
          if (wo.status === "completed") {
            stats[wo.technicianId].completedJobs++;
            stats[wo.technicianId].revenueService += Number(wo.servicePrice || 0);
          } else if (wo.status !== "cancelled") {
            stats[wo.technicianId].activeJobs++;
          }
        }
      });
    }

    return stats;
  }, [techniciansList, workOrders]);

  const selectedTechJobs = useMemo(() => {
    if (!selectedTechId || !workOrders) return [];
    return workOrders.filter((wo: any) => wo.technicianId === selectedTechId);
  }, [selectedTechId, workOrders]);

  const selectedTechDetails = useMemo(() => {
    if (!selectedTechId || !employees) return null;
    return employees.find((emp: any) => emp.id === selectedTechId);
  }, [selectedTechId, employees]);

  if (loadingEmployees || loadingWO) {
    return <div className="p-6 text-center text-muted-foreground">Memuat laporan kinerja teknisi...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="text-primary" /> Beban Kerja & Produktivitas Teknisi
        </h1>
        <p className="text-muted-foreground text-sm">Lihat riwayat tugas, antrean pengerjaan unit aktif, dan nilai jasa perbaikan per teknisi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Technicians list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Teknisi / Montir</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {techniciansList && techniciansList.length > 0 ? (
              techniciansList.map((tech: any) => {
                const stats = technicianStats[tech.id] || { totalJobs: 0, activeJobs: 0, completedJobs: 0, revenueService: 0 };
                const isSelected = selectedTechId === tech.id;

                return (
                  <div
                    key={tech.id}
                    onClick={() => setSelectedTechId(tech.id)}
                    className={`bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-card-border"
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-foreground text-base">{tech.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{tech.role}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 border-t border-border/80 pt-3 text-xs">
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase">Selesai</div>
                          <div className="font-bold text-green-600 mt-0.5">{stats.completedJobs} unit</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase">Antrean Aktif</div>
                          <div className="font-bold text-amber-600 mt-0.5">{stats.activeJobs} unit</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase">Nilai Jasa</div>
                          <div className="font-bold text-primary mt-0.5">Rp {stats.revenueService.toLocaleString("id-ID")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground italic mt-4 text-right">
                      {isSelected ? "Sedang Dipilih" : "Klik untuk rincian unit perbaikan"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                Belum ada data teknisi terdaftar.
              </div>
            )}
          </div>
        </div>

        {/* Detailed job tasks log */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Daftar Antrean Pengerjaan</h2>
          {selectedTechDetails ? (
            <div className="space-y-4">
              <div className="border-b border-border pb-4">
                <h3 className="font-bold text-foreground text-lg">{selectedTechDetails.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{selectedTechDetails.role}</p>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {selectedTechJobs.length > 0 ? (
                  selectedTechJobs.map((wo: any) => (
                    <div key={wo.id} className="border border-border/70 p-3 rounded-lg text-xs space-y-2 bg-muted/10">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">{wo.deviceName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          wo.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {wo.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        <div>Pelanggan: {wo.customerName}</div>
                        <div>Plat/SN: {wo.deviceIdentifier || "-"}</div>
                        <div className="mt-1">Kerusakan: <span className="italic">"{wo.problemDescription}"</span></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Belum ada antrean perbaikan unit untuk teknisi ini.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <Sparkles size={24} className="text-muted-foreground/40" />
              Pilih teknisi di sebelah kiri untuk melihat detail tugas aktif dan kinerjanya.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
