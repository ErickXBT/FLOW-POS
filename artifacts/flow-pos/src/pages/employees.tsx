import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListBranches,
  useListRoles,
  getListEmployeesQueryKey,

  useListEmployeeShifts,
  useCreateEmployeeShift,
  useUpdateEmployeeShift,
  useDeleteEmployeeShift,
  useListEmployeeAttendance,
  useCheckInEmployee,
  useCheckOutEmployee,
  getListEmployeeShiftsQueryKey,
  getListEmployeeAttendanceQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Edit2, Trash2, UserCheck, X, KeyRound,
  ShieldCheck, MapPin, Shield, Calendar, Clock, Camera,
  RefreshCw, FileText, AlertCircle, Sparkles, CheckCircle2,
  Maximize2, Eye, User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const ALL_ROLES = [
  { value: "manager", label: "Manager", icon: "👔", desc: "Akses penuh operasional" },
  { value: "cashier", label: "Kasir", icon: "💳", desc: "POS dan transaksi" },
  { value: "kitchen_staff", label: "Staff Dapur", icon: "🍳", desc: "Kitchen display system" },
  { value: "delivery_staff", label: "Kurir", icon: "🛵", desc: "Pesanan delivery" },
  { value: "staff", label: "Staff", icon: "👤", desc: "Akses terbatas" },
];

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager", cashier: "Kasir", kitchen_staff: "Staff Dapur",
  delivery_staff: "Kurir", staff: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cashier: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  kitchen_staff: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivery_staff: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  staff: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const getDisplayRoleLabel = (role: string, isFashion: boolean) => {
  if (isFashion) {
    if (role === "cashier") return "Kasir Retail";
    if (role === "kitchen_staff") return "Staff Packing";
    if (role === "delivery_staff") return "Kurir Toko";
  }
  return ROLE_LABELS[role] ?? role;
};

const getDisplayRolesList = (isFashion: boolean) => {
  if (!isFashion) return ALL_ROLES;
  return ALL_ROLES.map(r => {
    if (r.value === "cashier") {
      return { ...r, label: "Kasir Retail", desc: "POS dan transaksi ritel" };
    }
    if (r.value === "kitchen_staff") {
      return { ...r, label: "Staff Packing", icon: "📦", desc: "Packing display system" };
    }
    if (r.value === "delivery_staff") {
      return { ...r, label: "Kurir Toko", desc: "Pesanan kurir toko" };
    }
    return r;
  });
};

function EmployeeForm({ initial, onSubmit, onClose, loading, shifts }: any) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const { data: branches } = useListBranches();
  const { data: customRoles } = useListRoles();

  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    role: initial?.role || "cashier",
    isActive: initial?.isActive ?? true,
    branchId: initial?.branchId != null ? Number(initial.branchId) : "",
    customRoleId: initial?.customRoleId != null ? Number(initial.customRoleId) : "",
    employeeShiftId: initial?.employeeShiftId != null ? Number(initial.employeeShiftId) : "",
  });

  const [roleType, setRoleType] = useState(initial?.customRoleId ? "custom" : "standard");

  const handleSubmitForm = () => {
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role: roleType === "custom"
        ? (customRoles?.find(r => r.id === Number(form.customRoleId))?.name || "staff")
        : form.role,
      isActive: form.isActive,
      branchId: form.branchId ? Number(form.branchId) : null,
      customRoleId: roleType === "custom" && form.customRoleId ? Number(form.customRoleId) : null,
      employeeShiftId: form.employeeShiftId ? Number(form.employeeShiftId) : null,
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{initial ? "Edit Karyawan" : "Tambah Karyawan"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: "name", label: "Nama Lengkap *", type: "text", placeholder: "Nama karyawan" },
            { key: "email", label: "Email (untuk akun login)", type: "email", placeholder: "email@contoh.com" },
            { key: "phone", label: "No. Telepon", type: "text", placeholder: "08xx" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1 text-foreground">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
            </div>
          ))}

          {/* Branch Assignment */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Penempatan Cabang (Branch)</label>
            <select
              value={form.branchId}
              onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            >
              <option value="">Semua Cabang / Pusat</option>
              {(branches || []).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Shift Schedule Selector */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Jadwal Shift Default</label>
            <select
              value={form.employeeShiftId}
              onChange={e => setForm(p => ({ ...p, employeeShiftId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            >
              <option value="">-- Pilih Jadwal Shift --</option>
              {(shifts || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
              ))}
            </select>
          </div>

          {/* Role Type Tabs */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Tipe Peran (Role Type)</label>
            <div className="flex gap-2 p-1 bg-muted rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setRoleType("standard")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleType === "standard" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Role Standar
              </button>
              <button
                type="button"
                onClick={() => setRoleType("custom")}
                disabled={(customRoles || []).length === 0}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${roleType === "custom" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"} disabled:opacity-50`}
              >
                Role Custom ({ (customRoles || []).length })
              </button>
            </div>

            {roleType === "standard" ? (
              <div className="grid grid-cols-1 gap-2">
                {getDisplayRolesList(isFashion).map(r => (
                  <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, role: r.value }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${form.role === r.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
                    <span className="text-xl">{r.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                    {form.role === r.value && <ShieldCheck size={16} className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Pilih Role Custom</label>
                <select
                  value={form.customRoleId}
                  onChange={e => setForm(p => ({ ...p, customRoleId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                >
                  <option value="">-- Pilih Role --</option>
                  {(customRoles || []).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
            <label htmlFor="isActive" className="text-sm font-medium text-foreground">Aktif</label>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 sticky bottom-0 bg-card pt-3 border-t border-border flex-shrink-0 z-10">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
          <button onClick={handleSubmitForm} disabled={loading || !form.name || (roleType === "custom" && !form.customRoleId)}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/10">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const { user } = useAuth();
  const isFashion = user?.businessType === "fashion";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("flow_token") ?? "";
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleInvite(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!password || password.length < 6) { setError("Password minimal 6 karakter"); return; }
    setLoading(true); setError("");
    const r = await fetch(`${BASE}/api/employees/${employee.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    if (r.ok) { setDone(true); }
    else { const e = await r.json(); setError(e.error ?? "Gagal mengundang"); }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><KeyRound size={16} className="text-primary" /> Buat Akun Login</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {done ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-foreground mb-1">Akun berhasil dibuat!</div>
            <div className="text-sm text-muted-foreground mb-1">Email: <strong>{employee.email}</strong></div>
            <div className="text-sm text-muted-foreground mb-4">Role: <strong>{getDisplayRoleLabel(employee.role, isFashion)}</strong></div>
            <div className="bg-muted rounded-xl px-4 py-3 text-xs text-muted-foreground mb-4">
              Karyawan dapat login dengan email dan password yang ditetapkan. Dashboard akan disesuaikan dengan role mereka.
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Selesai</button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="p-6 space-y-4">
            <input
              type="text"
              name="username"
              value={employee.email || ""}
              readOnly
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
            />
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <div className="text-sm font-medium text-foreground">{employee.name}</div>
              <div className="text-xs text-muted-foreground">{employee.email}</div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[employee.role] ?? "bg-primary/10 text-primary"}`}>
                {getDisplayRoleLabel(employee.role, isFashion)}
              </span>
            </div>
            {!employee.email && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                Tambahkan email karyawan terlebih dahulu sebelum membuat akun login.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Set Password</label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                disabled={!employee.email}
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
              />
            </div>
            {error && <div className="text-red-500 text-xs">{error}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
              <button type="submit" disabled={loading || !employee.email || !password}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? "..." : "Buat Akun"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ShiftForm({ initial, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    startTime: initial?.startTime || "08:00",
    endTime: initial?.endTime || "17:00",
  });

  const handleSubmit = () => {
    if (!form.name || !form.startTime || !form.endTime) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{initial ? "Edit Shift" : "Tambah Shift baru"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Nama Shift *</label>
            <input type="text" value={form.name} placeholder="Contoh: Shift Pagi, Shift Sore"
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Jam Masuk *</label>
              <input type="time" value={form.startTime}
                onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Jam Keluar *</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
          <button onClick={handleSubmit} disabled={loading || !form.name}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isFashion = user?.businessType === "fashion";
  const [activeTab, setActiveTab] = useState<"employees" | "shifts" | "attendance" | "kiosk">("employees");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [inviting, setInviting] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Shifts state
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [deletingShiftId, setDeletingShiftId] = useState<number | null>(null);

  // Attendance history state
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [lightboxRecord, setLightboxRecord] = useState<any>(null);

  // Kiosk Terminal State
  const [kioskStep, setKioskStep] = useState<"select" | "capture" | "success">("select");
  const [kioskEmp, setKioskEmp] = useState<any>(null);
  const [kioskActiveSession, setKioskActiveSession] = useState<any>(null);
  const [kioskNotes, setKioskNotes] = useState("");
  const [kioskPhoto, setKioskPhoto] = useState<string>("");
  const [kioskTime, setKioskTime] = useState<string>("");
  const [isMockCamera, setIsMockCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [submittingKiosk, setSubmittingKiosk] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const token = localStorage.getItem("flow_token") ?? "";

  // React Query Hooks
  const { data: employees, isLoading: employeesLoading } = useListEmployees({ search: search || undefined });
  const { data: branches } = useListBranches();
  const { data: customRoles } = useListRoles();
  const { data: shifts, isLoading: shiftsLoading } = useListEmployeeShifts();
  const { data: attendanceLogs, isLoading: logsLoading } = useListEmployeeAttendance({
    employeeId: selectedEmpId ? Number(selectedEmpId) : undefined,
    branchId: selectedBranchId ? Number(selectedBranchId) : undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
  });

  const createEmp = useCreateEmployee();
  const updateEmp = useUpdateEmployee();
  const removeEmp = useDeleteEmployee();

  const createShift = useCreateEmployeeShift();
  const updateShift = useUpdateEmployeeShift();
  const removeShift = useDeleteEmployeeShift();

  const checkInMutation = useCheckInEmployee();
  const checkOutMutation = useCheckOutEmployee();

  // Kiosk digital clock
  useEffect(() => {
    if (activeTab !== "kiosk") return;
    const interval = setInterval(() => {
      setKioskTime(new Date().toLocaleTimeString("id-ID"));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Clean up camera on unmount/tab switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setIsMockCamera(false);
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError("Kamera hardware tidak terdeteksi atau diblokir. Mengaktifkan mode simulasi absensi.");
      setIsMockCamera(true);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleSelectKioskEmployee = async (emp: any) => {
    setKioskEmp(emp);
    setKioskNotes("");
    setKioskPhoto("");
    setKioskActiveSession(null);

    // Fetch active session via express endpoint directly
    try {
      const response = await fetch(`${BASE}/api/employee-attendance/active?employeeId=${emp.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const activeSession = await response.json();
        setKioskActiveSession(activeSession);
      }
    } catch (err) {
      console.log("No active attendance session.");
    }

    setKioskStep("capture");
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const handleCapture = () => {
    if (isMockCamera) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d")!;
      // Draw background
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(0, 0, 320, 240);
      // Draw avatar circle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(160, 100, 50, 0, Math.PI * 2);
      ctx.fill();
      // Draw initials
      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(kioskEmp.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2), 160, 100);
      // Draw label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("SIMULASI SELFIE KIOSK", 160, 180);
      ctx.font = "12px sans-serif";
      ctx.fillText(new Date().toLocaleString("id-ID"), 160, 200);

      const mockDataUrl = canvas.toDataURL("image/png");
      setKioskPhoto(mockDataUrl);
      return mockDataUrl;
    } else if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Security watermark overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(10, canvas.height - 35, canvas.width - 20, 28);
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`FLOW PRESENSI | ${kioskEmp.name} | ${new Date().toLocaleString("id-ID")}`, 20, canvas.height - 17);

      const capturedDataUrl = canvas.toDataURL("image/png");
      setKioskPhoto(capturedDataUrl);
      return capturedDataUrl;
    }
    return "";
  };

  const handleKioskSubmit = async () => {
    const photoData = handleCapture();
    if (!photoData) {
      toast({ variant: "destructive", title: "Gagal mengambil foto", description: "Silakan muat ulang kamera" });
      return;
    }

    setSubmittingKiosk(true);
    stopCamera();

    try {
      if (kioskActiveSession) {
        // Clock out
        await checkOutMutation.mutateAsync({
          data: {
            employeeId: kioskEmp.id,
            photo: photoData,
            notes: kioskNotes,
          }
        });
        toast({ title: "Absen Pulang Berhasil!", description: `Sampai jumpa, ${kioskEmp.name}. Hati-hati di jalan!` });
      } else {
        // Clock in
        await checkInMutation.mutateAsync({
          data: {
            employeeId: kioskEmp.id,
            photo: photoData,
            notes: kioskNotes,
            branchId: kioskEmp.branchId,
            employeeShiftId: kioskEmp.employeeShiftId,
          }
        });
        toast({ title: "Absen Masuk Berhasil!", description: `Selamat bekerja, ${kioskEmp.name}!` });
      }

      queryClient.invalidateQueries({ queryKey: getListEmployeeAttendanceQueryKey() });
      setKioskStep("success");
      setTimeout(() => {
        setKioskStep("select");
        setKioskEmp(null);
        setKioskActiveSession(null);
      }, 3500);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal memproses absensi",
        description: err.message || "Silakan coba lagi"
      });
      // Restart camera on failure
      startCamera();
    } finally {
      setSubmittingKiosk(false);
    }
  };

  // CRUD Handlers for Employees
  async function handleCreateEmployee(form: any) {
    await createEmp.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    setShowForm(false);
    toast({ title: "Karyawan dibuat", description: "Data karyawan baru berhasil ditambahkan." });
  }

  async function handleUpdateEmployee(form: any) {
    await updateEmp.mutateAsync({ id: editing.id, data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    setEditing(null);
    toast({ title: "Karyawan diperbarui", description: "Data karyawan berhasil diubah." });
  }

  // CRUD Handlers for Shifts
  async function handleCreateShift(form: any) {
    await createShift.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeeShiftsQueryKey() });
    setShowShiftForm(false);
    toast({ title: "Shift ditambahkan", description: "Jadwal shift baru telah didaftarkan." });
  }

  async function handleUpdateShift(form: any) {
    await updateShift.mutateAsync({ id: editingShift.id, data: form });
    queryClient.invalidateQueries({ queryKey: getListEmployeeShiftsQueryKey() });
    setEditingShift(null);
    toast({ title: "Shift diperbarui", description: "Data jadwal shift berhasil disesuaikan." });
  }

  async function handleDeleteShift(id: number) {
    await removeShift.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListEmployeeShiftsQueryKey() });
    setDeletingShiftId(null);
    toast({ title: "Shift dihapus", description: "Shift berhasil dihapus." });
  }

  const canManage = user && ["owner", "manager"].includes(user.role);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCheck className="text-primary" /> Karyawan & Presensi
          </h1>
          <p className="text-muted-foreground text-sm">Kelola profil staf, atur shift kerja, dan pantau absensi berselfie secara langsung.</p>
        </div>

        {/* Tab navigation buttons */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl self-start">
          <button onClick={() => { setActiveTab("employees"); stopCamera(); }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "employees" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <User size={14} /> Daftar Staf
          </button>
          <button onClick={() => { setActiveTab("shifts"); stopCamera(); }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "shifts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Clock size={14} /> Jadwal Shift
          </button>
          <button onClick={() => { setActiveTab("attendance"); stopCamera(); }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "attendance" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Calendar size={14} /> Riwayat Absen
          </button>
          <button onClick={() => { setActiveTab("kiosk"); }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === "kiosk" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Camera size={14} /> Terminal Kiosk
          </button>
        </div>
      </div>

      {/* TAB 1: EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama karyawan..."
                className="w-full pl-10 pr-4 py-2 border border-input rounded-xl bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              {user?.role === "owner" && (
                <Link href="/roles">
                  <a className="flex items-center gap-2 px-3.5 py-2 border border-border bg-card text-foreground hover:bg-muted rounded-xl text-sm font-medium transition-all shadow-sm">
                    <Shield size={15} className="text-primary" /> Atur Role Custom
                  </a>
                </Link>
              )}
              {canManage && (
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 shadow-md">
                  <Plus size={15} /> Tambah Staf
                </button>
              )}
            </div>
          </div>

          {employeesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-card border border-card-border animate-pulse" />)}
            </div>
          ) : (employees || []).length === 0 ? (
            <div className="text-center py-16 bg-card border border-card-border rounded-2xl">
              <UserCheck size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <div className="text-muted-foreground text-sm font-medium">Belum ada karyawan. Tambahkan anggota tim Anda.</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(employees || []).map((emp: any) => {
                const branchName = branches?.find(b => b.id === emp.branchId)?.name;
                const isCustomRole = !!emp.customRoleId;
                const customRoleName = customRoles?.find(r => r.id === emp.customRoleId)?.name;
                const shift = shifts?.find((s: any) => s.id === emp.employeeShiftId);

                return (
                  <div key={emp.id} className="bg-card border border-card-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="flex gap-3.5 items-start">
                      <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate pr-6">{emp.name}</div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isCustomRole ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : (ROLE_COLORS[emp.role] ?? "bg-muted text-muted-foreground")}`}>
                            {isCustomRole ? `Custom: ${customRoleName || emp.role}` : getDisplayRoleLabel(emp.role, isFashion)}
                          </span>
                          {!emp.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold uppercase">Nonaktif</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                      {branchName && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-primary/70" /> <span>{branchName}</span>
                        </div>
                      )}
                      {shift && (
                        <div className="flex items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400 bg-orange-500/5 dark:bg-orange-500/10 px-2 py-1 rounded-lg w-max">
                          <Clock size={13} /> <span>{shift.name} ({shift.startTime} - {shift.endTime})</span>
                        </div>
                      )}
                      <div className="text-[10px] opacity-75 truncate">{emp.email || "Tanpa email"} • {emp.phone || "Tanpa HP"}</div>
                    </div>

                    {canManage && (
                      <div className="absolute top-4 right-4 flex items-center gap-0.5">
                        {emp.email && (
                          <button onClick={() => setInviting(emp)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Buat Akun Login">
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button onClick={() => setEditing(emp)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeletingId(emp.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SHIFT MANAGEMENT */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-sm">Daftar Jadwal Shift Kerja</h3>
              <p className="text-xs text-muted-foreground">Konfigurasi jadwal kerja operasional harian yang akan ditugaskan ke staf.</p>
            </div>
            {canManage && (
              <button onClick={() => setShowShiftForm(true)}
                className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 shadow-md">
                <Plus size={14} /> Tambah Shift
              </button>
            )}
          </div>

          {shiftsLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-card border border-card-border animate-pulse" />)}
            </div>
          ) : (shifts || []).length === 0 ? (
            <div className="text-center py-12 bg-card border border-card-border rounded-2xl">
              <Clock size={36} className="mx-auto mb-3 text-muted-foreground/30" />
              <div className="text-muted-foreground text-sm">Belum ada shift terdaftar. Klik "+ Tambah Shift" untuk membuat jadwal kerja pertama Anda.</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(shifts || []).map((s: any) => (
                <div key={s.id} className="bg-card border border-card-border rounded-2xl p-5 relative shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                      {s.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">Ditambahkan: {new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="mt-4 flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2">
                    <Clock size={16} className="text-primary" />
                    <div>
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase">Jadwal Kerja</div>
                      <div className="text-sm font-bold text-foreground tracking-wide font-mono">{s.startTime} - {s.endTime}</div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="absolute top-4 right-4 flex gap-1">
                      <button onClick={() => setEditingShift(s)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeletingShiftId(s.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY & PHOTOS */}
      {activeTab === "attendance" && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters Bar */}
          <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Pilih Cabang (Branch)</label>
              <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none">
                <option value="">Semua Cabang</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Pilih Karyawan</label>
              <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none">
                <option value="">Semua Karyawan</option>
                {(employees || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="w-[120px]">
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Mulai Tanggal</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none" />
            </div>
            <div className="w-[120px]">
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Hingga Tanggal</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none" />
            </div>
            <button onClick={() => { setSelectedBranchId(""); setSelectedEmpId(""); }}
              className="py-1.5 px-3 border border-border rounded-lg text-xs font-semibold hover:bg-muted text-foreground transition-all">
              Reset Filter
            </button>
          </div>

          {/* Logs Output */}
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />)}
            </div>
          ) : (attendanceLogs || []).length === 0 ? (
            <div className="text-center py-16 bg-card border border-card-border rounded-2xl">
              <Calendar size={36} className="mx-auto mb-2 text-muted-foreground/30" />
              <div className="text-muted-foreground text-sm font-medium">Tidak ditemukan catatan absensi untuk kriteria ini.</div>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                      <th className="px-4 py-3">Karyawan</th>
                      <th className="px-4 py-3">Jadwal Shift</th>
                      <th className="px-4 py-3">Absen Masuk (Clock-In)</th>
                      <th className="px-4 py-3">Absen Pulang (Clock-Out)</th>
                      <th className="px-4 py-3 text-center">Foto Selfie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-foreground">
                    {(attendanceLogs || []).map((log: any) => {
                      const checkIn = new Date(log.checkInTime);
                      const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : null;

                      return (
                        <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                          {/* Employee Name */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground text-sm">{log.employeeName}</div>
                            <div className="text-[10px] text-muted-foreground">ID Karyawan: #{log.employeeId}</div>
                          </td>

                          {/* Shift Name */}
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-foreground">{log.shiftName || "Luar Shift"}</span>
                          </td>

                          {/* Clock In */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground font-mono">{checkIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                            <div className="text-[10px] text-muted-foreground">{checkIn.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${log.checkInStatus === "Tepat Waktu" ? "bg-green-50 text-green-700 dark:bg-green-950/20" : "bg-red-50 text-red-700 dark:bg-red-950/20"}`}>
                              {log.checkInStatus}
                            </span>
                            {log.checkInNotes && <div className="text-[10px] text-muted-foreground mt-0.5 italic">" {log.checkInNotes} "</div>}
                          </td>

                          {/* Clock Out */}
                          <td className="px-4 py-3.5">
                            {checkOut ? (
                              <>
                                <div className="font-bold text-foreground font-mono">{checkOut.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                                <div className="text-[10px] text-muted-foreground">{checkOut.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${log.checkOutStatus === "Tepat Waktu" ? "bg-green-50 text-green-700 dark:bg-green-950/20" : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20"}`}>
                                  {log.checkOutStatus}
                                </span>
                                {log.checkOutNotes && <div className="text-[10px] text-muted-foreground mt-0.5 italic">" {log.checkOutNotes} "</div>}
                              </>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Sedang Bekerja...</span>
                            )}
                          </td>

                          {/* Photos Trigger */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => setLightboxRecord(log)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-xl font-semibold transition-all">
                              <Eye size={13} /> Lihat Foto
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KIOSK TERMINAL (ATTENDANCE INTERACTIVE WINDOW) */}
      {activeTab === "kiosk" && (
        <div className="max-w-2xl mx-auto bg-card border border-card-border rounded-3xl p-8 shadow-xl relative overflow-hidden animate-scale-up">
          {/* Header decor */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary via-indigo-500 to-purple-600"></div>

          {/* KIOSK STEP 1: SELECT EMPLOYEE */}
          {kioskStep === "select" && (
            <div className="space-y-6 text-center">
              <div>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                  <Sparkles size={12} /> Terminal Absensi Toko
                </span>
                <h2 className="text-xl font-bold text-foreground mt-3">Silakan Pilih Nama Anda</h2>
                <p className="text-xs text-muted-foreground">Pilih nama karyawan Anda untuk memulai absen masuk atau pulang.</p>
              </div>

              <div className="relative max-w-sm mx-auto">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Ketik nama Anda..."
                  className="w-full pl-10 pr-4 py-2.5 border border-input rounded-2xl bg-muted/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-center"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto p-1">
                {(employees || [])
                  .filter((e: any) => e.isActive && e.name.toLowerCase().includes(search.toLowerCase()))
                  .map((emp: any) => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectKioskEmployee(emp)}
                      className="p-4 bg-muted hover:bg-primary/5 hover:border-primary/50 border border-transparent rounded-2xl transition-all flex flex-col items-center text-center gap-2 group">
                      <div className="w-10 h-10 rounded-full bg-card group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center font-bold text-foreground text-sm shadow-sm transition-all">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate w-full">{emp.name}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">{ROLE_LABELS[emp.role] || emp.role}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* KIOSK STEP 2: CAMERA AND CONFIRM */}
          {kioskStep === "capture" && kioskEmp && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between border-b border-border/80 pb-4">
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Karyawan Terpilih</div>
                  <div className="font-bold text-base text-foreground">{kioskEmp.name}</div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${kioskActiveSession ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20" : "bg-green-100 text-green-700 dark:bg-green-950/20"}`}>
                    📢 Sesi: {kioskActiveSession ? "Absen Pulang (Clock-Out)" : "Absen Masuk (Clock-In)"}
                  </span>
                </div>
              </div>

              {/* Digital Clock */}
              <div className="text-center space-y-0.5">
                <div className="text-3xl font-bold font-mono tracking-wider text-foreground">{kioskTime}</div>
                <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              </div>

              {/* Camera Stream & Simulasi Frame */}
              <div className="relative w-full max-w-sm aspect-video bg-black rounded-2xl overflow-hidden border border-card-border shadow-inner">
                {isMockCamera ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-800 p-4">
                    <User size={48} className="animate-pulse mb-3 opacity-60" />
                    <div className="font-bold text-sm">Mode Simulasi Kamera Aktif</div>
                    <div className="text-xs text-slate-400 mt-1">Sistem akan menyimulasikan selfie absensi Anda.</div>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute bottom-3 left-3 bg-red-600 px-2 py-0.5 rounded text-[10px] text-white font-bold flex items-center gap-1 uppercase tracking-wider animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span> Live
                    </div>
                  </>
                )}

                {cameraError && (
                  <div className="absolute top-2 inset-x-2 bg-yellow-500 text-white rounded-lg p-2 text-[10px] flex items-start gap-1.5 shadow-md">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>

              {/* Notes input */}
              <div className="w-full max-w-sm">
                <label className="block text-xs font-semibold text-muted-foreground mb-1 text-left">Catatan Staf (Opsional)</label>
                <input
                  type="text"
                  value={kioskNotes}
                  onChange={e => setKioskNotes(e.target.value)}
                  placeholder="Tulis alasan jika terlambat/pulang cepat..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>

              {/* Actions */}
              <div className="w-full max-w-sm flex gap-3">
                <button
                  onClick={() => {
                    stopCamera();
                    setKioskStep("select");
                    setKioskEmp(null);
                  }}
                  className="flex-1 py-3 border border-border rounded-xl text-sm font-semibold hover:bg-muted text-foreground transition-all">
                  Batal
                </button>
                <button
                  onClick={handleKioskSubmit}
                  disabled={submittingKiosk}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-all ${kioskActiveSession ? "bg-yellow-600 shadow-yellow-600/10" : "bg-green-600 shadow-green-600/10"}`}>
                  {submittingKiosk ? "Mengirim..." : kioskActiveSession ? "Ambil Foto & Pulang" : "Ambil Foto & Masuk"}
                </button>
              </div>

              {/* Camera debug helper */}
              {!cameraError && (
                <button
                  onClick={() => {
                    if (isMockCamera) {
                      startCamera();
                    } else {
                      stopCamera();
                      setIsMockCamera(true);
                    }
                  }}
                  className="text-[10px] text-muted-foreground underline hover:text-primary transition-all">
                  {isMockCamera ? "Aktifkan Kamera Asli" : "Simulasikan Kamera (Gunakan Mockup)"}
                </button>
              )}
            </div>
          )}

          {/* KIOSK STEP 3: SUCCESS CONFIRMATION */}
          {kioskStep === "success" && (
            <div className="py-12 space-y-6 text-center animate-fade-in flex flex-col items-center justify-center">
              <CheckCircle2 size={72} className="text-green-600 animate-bounce" />
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Absensi Berhasil Tercatat!</h3>
                <p className="text-sm text-muted-foreground">Terima kasih atas kerja keras Anda hari ini.</p>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 w-full max-w-xs text-xs space-y-2.5 shadow-sm text-left">
                <div className="flex justify-between border-b border-border/80 pb-2">
                  <span className="text-muted-foreground">Karyawan:</span>
                  <span className="font-bold text-foreground">{kioskEmp?.name}</span>
                </div>
                <div className="flex justify-between border-b border-border/80 pb-2">
                  <span className="text-muted-foreground">Tipe Absen:</span>
                  <span className="font-bold text-foreground">{kioskActiveSession ? "Clock-Out (Keluar)" : "Clock-In (Masuk)"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu:</span>
                  <span className="font-bold text-foreground font-mono">{new Date().toLocaleTimeString("id-ID")}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground animate-pulse">Mengalihkan kembali ke layar utama dalam beberapa detik...</p>
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX MODAL FOR ATTENDANCE LOG PHOTOS */}
      {lightboxRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-card-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground text-base">Detail Presensi Karyawan</h3>
                <p className="text-xs text-muted-foreground">{lightboxRecord.employeeName} • Shift: {lightboxRecord.shiftName || "Luar Shift"}</p>
              </div>
              <button onClick={() => setLightboxRecord(null)} className="text-muted-foreground hover:text-foreground transition-all"><X size={22} /></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Check-In Selfie Card */}
              <div className="space-y-3">
                <div className="font-semibold text-xs uppercase tracking-wider text-green-700 bg-green-500/10 px-2.5 py-1 rounded-lg w-max">
                  Selfie Masuk (Clock-In)
                </div>
                <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-border relative group shadow-sm">
                  {lightboxRecord.checkInPhoto ? (
                    <img src={lightboxRecord.checkInPhoto} alt="Clock In Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">Tidak ada foto</div>
                  )}
                </div>
                <div className="text-xs space-y-1.5 bg-muted/30 p-3.5 rounded-xl text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Masuk:</span>
                    <span className="font-bold text-foreground font-mono">{new Date(lightboxRecord.checkInTime).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status Masuk:</span>
                    <span className="font-bold text-foreground">{lightboxRecord.checkInStatus}</span>
                  </div>
                  {lightboxRecord.checkInNotes && (
                    <div className="pt-1.5 border-t border-border mt-1.5">
                      <span className="text-muted-foreground font-semibold block text-[10px]">Catatan Masuk:</span>
                      <span className="text-foreground italic">"{lightboxRecord.checkInNotes}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Check-Out Selfie Card */}
              <div className="space-y-3">
                <div className="font-semibold text-xs uppercase tracking-wider text-yellow-700 bg-yellow-500/10 px-2.5 py-1 rounded-lg w-max">
                  Selfie Pulang (Clock-Out)
                </div>
                <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-border relative group shadow-sm">
                  {lightboxRecord.checkOutPhoto ? (
                    <img src={lightboxRecord.checkOutPhoto} alt="Clock Out Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground italic">Belum absen pulang</div>
                  )}
                </div>
                <div className="text-xs space-y-1.5 bg-muted/30 p-3.5 rounded-xl text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Pulang:</span>
                    <span className="font-bold text-foreground font-mono">
                      {lightboxRecord.checkOutTime ? new Date(lightboxRecord.checkOutTime).toLocaleString("id-ID") : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status Pulang:</span>
                    <span className="font-bold text-foreground">{lightboxRecord.checkOutStatus || "—"}</span>
                  </div>
                  {lightboxRecord.checkOutNotes && (
                    <div className="pt-1.5 border-t border-border mt-1.5">
                      <span className="text-muted-foreground font-semibold block text-[10px]">Catatan Pulang:</span>
                      <span className="text-foreground italic">"{lightboxRecord.checkOutNotes}"</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-muted/20 border-t border-border text-center">
              <button onClick={() => setLightboxRecord(null)}
                className="px-6 py-2 bg-foreground text-background text-xs font-semibold rounded-xl hover:opacity-90 shadow-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Employees CRUD */}
      {showForm && <EmployeeForm onSubmit={handleCreateEmployee} onClose={() => setShowForm(false)} loading={createEmp.isPending} shifts={shifts} />}
      {editing && <EmployeeForm initial={editing} onSubmit={handleUpdateEmployee} onClose={() => setEditing(null)} loading={updateEmp.isPending} shifts={shifts} />}
      {inviting && <InviteModal employee={inviting} onClose={() => setInviting(null)} />}

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 flex items-center justify-center mx-auto text-xl">⚠️</div>
              <h3 className="text-lg font-bold text-foreground">Hapus Karyawan</h3>
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus karyawan ini? Data login terkait akan dihapus secara permanen.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingId(null)} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
              <button type="button"
                onClick={async () => {
                  await removeEmp.mutateAsync({ id: deletingId });
                  queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
                  setDeletingId(null);
                  toast({ title: "Karyawan dihapus", description: "Data karyawan berhasil dihapus." });
                }}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Shifts CRUD */}
      {showShiftForm && <ShiftForm onSubmit={handleCreateShift} onClose={() => setShowShiftForm(false)} loading={createShift.isPending} />}
      {editingShift && <ShiftForm initial={editingShift} onSubmit={handleUpdateShift} onClose={() => setEditingShift(null)} loading={updateShift.isPending} />}

      {deletingShiftId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 flex items-center justify-center mx-auto text-xl">⚠️</div>
              <h3 className="text-lg font-bold text-foreground">Hapus Shift</h3>
              <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus shift ini? Karyawan yang dikaitkan dengan shift ini akan diubah menjadi tidak memiliki shift default.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingShiftId(null)} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted text-foreground">Batal</button>
              <button type="button"
                onClick={() => handleDeleteShift(deletingShiftId)}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
