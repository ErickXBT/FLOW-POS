import { useMemo } from "react";
import {
  useListWorkOrders,
  useUpdateWorkOrder,
  getListWorkOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Clock, Hammer, ShieldAlert, Sparkles, Check, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PHASES = [
  { value: "queue", label: "Antrean (Queue)", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { value: "inspecting", label: "Inspeksi (Inspecting)", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { value: "repairing", label: "Perbaikan (Repairing)", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  { value: "testing", label: "Pengujian (Testing)", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
  { value: "completed", label: "Selesai (Completed)", color: "bg-green-500/10 text-green-600 border-green-200" },
];

export default function QueuePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: workOrders, isLoading } = useListWorkOrders();
  const updateMutation = useUpdateWorkOrder();

  const handleMoveStatus = (id: number, nextStatus: string) => {
    updateMutation.mutate({
      id,
      data: { status: nextStatus as any }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
        toast({ title: "Status Diperbarui", description: `Fase unit dipindahkan ke status ${nextStatus}.` });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Gagal Pindah Fase", description: err?.data?.error || "Terjadi kesalahan." });
      }
    });
  };

  // Group WO by status
  const groupedWO = useMemo(() => {
    const groups: Record<string, any[]> = {
      queue: [],
      inspecting: [],
      repairing: [],
      testing: [],
      completed: [],
    };

    if (workOrders) {
      workOrders.forEach((item: any) => {
        if (groups[item.status]) {
          groups[item.status].push(item);
        }
      });
    }

    return groups;
  }, [workOrders]);

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Memuat antrean service...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="text-primary" /> Papan Antrean & Status Perbaikan (Kanban)
        </h1>
        <p className="text-muted-foreground text-sm">Pantau dan update perkembangan status unit perbaikan secara real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {PHASES.map((phase, idx) => {
          const list = groupedWO[phase.value] || [];
          
          return (
            <div key={phase.value} className="bg-card border border-card-border rounded-xl p-4 min-w-[200px] flex flex-col space-y-4 shadow-sm h-[500px]">
              <div className={`p-2.5 rounded-lg border text-xs font-bold text-center ${phase.color}`}>
                {phase.label} ({list.length})
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {list.length > 0 ? (
                  list.map((item) => (
                    <div
                      key={item.id}
                      className="border border-border/80 bg-background/50 hover:bg-background rounded-lg p-3 space-y-2.5 text-xs shadow-sm hover:shadow transition-all relative group"
                    >
                      <div>
                        <div className="font-bold text-foreground">WO-{item.id}</div>
                        <div className="font-semibold text-foreground/80 mt-0.5">{item.deviceName}</div>
                      </div>

                      <div className="text-muted-foreground space-y-1">
                        <div>Nama: {item.customerName}</div>
                        <div>Teknisi: {item.technicianName}</div>
                        <div className="font-bold text-primary mt-1">Rp {Number(item.totalPrice).toLocaleString("id-ID")}</div>
                      </div>

                      <div className="flex justify-between items-center border-t border-border/60 pt-2 mt-2">
                        {idx > 0 ? (
                          <button
                            onClick={() => handleMoveStatus(item.id, PHASES[idx - 1].value)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
                            title="Kembali"
                          >
                            <ArrowLeft size={12} />
                          </button>
                        ) : (
                          <div />
                        )}
                        {idx < PHASES.length - 1 ? (
                          <button
                            onClick={() => handleMoveStatus(item.id, PHASES[idx + 1].value)}
                            className="p-1 bg-primary text-primary-foreground hover:opacity-90 rounded cursor-pointer border-0 flex items-center gap-0.5 text-[10px] font-semibold"
                            title="Lanjut"
                          >
                            Proses <ArrowRight size={10} />
                          </button>
                        ) : (
                          <div className="text-green-600 font-bold flex items-center gap-0.5"><CheckSquare size={12} /> Selesai</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-muted-foreground/60 text-xs italic">
                    Kosong
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
