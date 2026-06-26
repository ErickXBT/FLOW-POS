import { Router, type IRouter } from "express";
import { eq, and, ilike, desc, isNull, gte, lte } from "drizzle-orm";
import * as crypto from "crypto";
import { db, employeesTable, usersTable, employeeShiftsTable, employeeAttendanceTable } from "@workspace/db";
import { uploadAttendancePhoto } from "../lib/storage";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

const ALLOWED_ROLES = ["owner", "manager", "super_admin"];
const INVITE_ALLOWED_ROLES = ["owner", "manager"];

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function requireManagerOrOwner(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (!ALLOWED_ROLES.includes(claims.role)) { res.status(403).json({ error: "Akses ditolak" }); return null; }
  return claims;
}

function hashPassword(pw: string) {
  return crypto.createHash("sha256").update(pw + "flow-salt").digest("hex");
}

function fmt(e: any) {
  return { ...e, createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt };
}

router.get("/employees", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListEmployeesQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  
  const branchId = await getRequestedBranchId(req, claims);
  const conditions = [eq(employeesTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(employeesTable.name, `%${search}%`));
  if (branchId) conditions.push(eq(employeesTable.branchId, branchId));

  const employees = await db.select().from(employeesTable).where(and(...conditions));
  res.json(employees.map(fmt));
});

router.post("/employees", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const body = CreateEmployeeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [employee] = await db.insert(employeesTable).values({
    ...body.data,
    tenantId: claims.tenantId!,
  }).returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Manager/Owner",
    userRole: claims.role,
    action: "create_employee",
    module: "employees",
    details: { employeeId: employee.id, name: employee.name, role: employee.role },
  });

  res.status(201).json(fmt(employee));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const params = UpdateEmployeeParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateEmployeeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [employee] = await db.update(employeesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!employee) { res.status(404).json({ error: "Karyawan tidak ditemukan" }); return; }

  // Sync update to usersTable if linked user account exists
  if (employee.userId) {
    const userUpdate: any = { updatedAt: new Date() };
    if (body.data.name !== undefined) userUpdate.name = body.data.name;
    if (body.data.email !== undefined) userUpdate.email = body.data.email?.toLowerCase() ?? null;
    if (body.data.role !== undefined) userUpdate.role = body.data.role;

    await db.update(usersTable)
      .set(userUpdate)
      .where(eq(usersTable.id, employee.userId));
  }

  res.json(fmt(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const params = DeleteEmployeeParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.tenantId, claims.tenantId!)))
    .limit(1);

  if (!emp) { res.status(404).json({ error: "Karyawan tidak ditemukan" }); return; }

  await db.delete(employeesTable)
    .where(eq(employeesTable.id, emp.id));

  // Delete linked login user account if exists
  if (emp.userId) {
    await db.delete(usersTable)
      .where(eq(usersTable.id, emp.userId));
  }

  res.sendStatus(204);
});

// ── Invite employee: create a login account ────────────────────────────────────
router.post("/employees/:id/invite", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!INVITE_ALLOWED_ROLES.includes(claims.role)) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const empId = Number(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ error: "Password minimal 6 karakter" }); return; }

  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, empId), eq(employeesTable.tenantId, claims.tenantId)));
  if (!emp) { res.status(404).json({ error: "Karyawan tidak ditemukan" }); return; }
  if (!emp.email) { res.status(400).json({ error: "Karyawan harus punya email untuk diundang" }); return; }

  // Check if user account already exists for this email
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, emp.email.toLowerCase()));
  let userId: number;

  if (existing.length > 0) {
    // Update password
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(password), role: emp.role, updatedAt: new Date() })
      .where(eq(usersTable.id, existing[0].id));
    userId = existing[0].id;
  } else {
    const [newUser] = await db.insert(usersTable).values({
      name: emp.name,
      email: emp.email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: emp.role,
      tenantId: claims.tenantId,
    }).returning();
    userId = newUser.id;
  }

  // Link employee to user account
  const [updated] = await db.update(employeesTable)
    .set({ userId, updatedAt: new Date() })
    .where(eq(employeesTable.id, empId))
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Manager/Owner",
    userRole: claims.role,
    action: "invite_employee",
    module: "employees",
    details: { employeeId: empId, email: emp.email, role: emp.role },
  });

  res.json({ success: true, employee: fmt(updated), userId });
});

// ── Shifts management ────────────────────────────────────────────────────────
router.get("/employee-shifts", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;
  const shifts = await db.select().from(employeeShiftsTable).where(eq(employeeShiftsTable.tenantId, claims.tenantId!));
  res.json(shifts.map(fmt));
});

router.post("/employee-shifts", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const { name, startTime, endTime } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ error: "Nama, jam masuk, dan jam keluar wajib diisi" });
    return;
  }

  const [shift] = await db.insert(employeeShiftsTable).values({
    tenantId: claims.tenantId!,
    name,
    startTime,
    endTime,
  }).returning();

  res.status(201).json(fmt(shift));
});

router.patch("/employee-shifts/:id", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const shiftId = Number(req.params.id);
  const { name, startTime, endTime } = req.body;

  const [shift] = await db.update(employeeShiftsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      updatedAt: new Date(),
    })
    .where(and(eq(employeeShiftsTable.id, shiftId), eq(employeeShiftsTable.tenantId, claims.tenantId!)))
    .returning();

  if (!shift) {
    res.status(404).json({ error: "Shift tidak ditemukan" });
    return;
  }

  res.json(fmt(shift));
});

router.delete("/employee-shifts/:id", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const shiftId = Number(req.params.id);
  const [deleted] = await db.delete(employeeShiftsTable)
    .where(and(eq(employeeShiftsTable.id, shiftId), eq(employeeShiftsTable.tenantId, claims.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Shift tidak ditemukan" });
    return;
  }

  res.sendStatus(204);
});

// ── Attendance endpoints ─────────────────────────────────────────────────────
function calculateCheckInStatus(checkInDate: Date, shift: any): string {
  if (!shift) return "Luar Shift";
  const [shiftHour, shiftMin] = shift.startTime.split(":").map(Number);
  
  // Adjust to local time check (since node server might run in UTC, let's look at local clock)
  // Usually the server runs with user local time or we can extract hours/minutes directly
  const hours = checkInDate.getHours();
  const minutes = checkInDate.getMinutes();
  
  const checkInMinutes = hours * 60 + minutes;
  const shiftMinutes = shiftHour * 60 + shiftMin;
  
  const diff = checkInMinutes - shiftMinutes;
  
  if (diff > 15) { // 15-minute late tolerance
    return "Terlambat";
  }
  return "Tepat Waktu";
}

function calculateCheckOutStatus(checkOutDate: Date, shift: any): string {
  if (!shift) return "Tepat Waktu";
  const [shiftHour, shiftMin] = shift.endTime.split(":").map(Number);
  
  const hours = checkOutDate.getHours();
  const minutes = checkOutDate.getMinutes();
  
  const checkOutMinutes = hours * 60 + minutes;
  const shiftMinutes = shiftHour * 60 + shiftMin;
  
  const diff = shiftMinutes - checkOutMinutes; // minutes left early
  
  if (diff > 15) { // 15-minute early tolerance
    return "Pulang Cepat";
  }
  return "Tepat Waktu";
}

router.get("/employee-attendance", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const conditions = [eq(employeeAttendanceTable.tenantId, claims.tenantId!)];
  if (employeeId) conditions.push(eq(employeeAttendanceTable.employeeId, employeeId));
  if (branchId) conditions.push(eq(employeeAttendanceTable.branchId, branchId));
  if (startDate) conditions.push(gte(employeeAttendanceTable.checkInTime, startDate));
  if (endDate) conditions.push(lte(employeeAttendanceTable.checkInTime, endDate));

  const logs = await db.select({
    id: employeeAttendanceTable.id,
    tenantId: employeeAttendanceTable.tenantId,
    employeeId: employeeAttendanceTable.employeeId,
    employeeName: employeesTable.name,
    branchId: employeeAttendanceTable.branchId,
    employeeShiftId: employeeAttendanceTable.employeeShiftId,
    shiftName: employeeShiftsTable.name,
    checkInTime: employeeAttendanceTable.checkInTime,
    checkOutTime: employeeAttendanceTable.checkOutTime,
    checkInPhoto: employeeAttendanceTable.checkInPhoto,
    checkOutPhoto: employeeAttendanceTable.checkOutPhoto,
    checkInStatus: employeeAttendanceTable.checkInStatus,
    checkOutStatus: employeeAttendanceTable.checkOutStatus,
    checkInNotes: employeeAttendanceTable.checkInNotes,
    checkOutNotes: employeeAttendanceTable.checkOutNotes,
    createdAt: employeeAttendanceTable.createdAt,
  })
  .from(employeeAttendanceTable)
  .innerJoin(employeesTable, eq(employeeAttendanceTable.employeeId, employeesTable.id))
  .leftJoin(employeeShiftsTable, eq(employeeAttendanceTable.employeeShiftId, employeeShiftsTable.id))
  .where(and(...conditions))
  .orderBy(desc(employeeAttendanceTable.checkInTime));

  res.json(logs.map(fmt));
});

router.get("/employee-attendance/active", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const employeeId = Number(req.query.employeeId);
  if (Number.isNaN(employeeId)) {
    res.status(400).json({ error: "Invalid employeeId" });
    return;
  }

  const [activeLog] = await db.select({
    id: employeeAttendanceTable.id,
    tenantId: employeeAttendanceTable.tenantId,
    employeeId: employeeAttendanceTable.employeeId,
    employeeName: employeesTable.name,
    branchId: employeeAttendanceTable.branchId,
    employeeShiftId: employeeAttendanceTable.employeeShiftId,
    shiftName: employeeShiftsTable.name,
    checkInTime: employeeAttendanceTable.checkInTime,
    checkOutTime: employeeAttendanceTable.checkOutTime,
    checkInPhoto: employeeAttendanceTable.checkInPhoto,
    checkOutPhoto: employeeAttendanceTable.checkOutPhoto,
    checkInStatus: employeeAttendanceTable.checkInStatus,
    checkOutStatus: employeeAttendanceTable.checkOutStatus,
    checkInNotes: employeeAttendanceTable.checkInNotes,
    checkOutNotes: employeeAttendanceTable.checkOutNotes,
    createdAt: employeeAttendanceTable.createdAt,
  })
  .from(employeeAttendanceTable)
  .innerJoin(employeesTable, eq(employeeAttendanceTable.employeeId, employeesTable.id))
  .leftJoin(employeeShiftsTable, eq(employeeAttendanceTable.employeeShiftId, employeeShiftsTable.id))
  .where(and(
    eq(employeeAttendanceTable.tenantId, claims.tenantId!),
    eq(employeeAttendanceTable.employeeId, employeeId),
    isNull(employeeAttendanceTable.checkOutTime)
  ))
  .limit(1);

  if (!activeLog) {
    res.status(404).json({ error: "No active attendance session found" });
    return;
  }

  res.json(fmt(activeLog));
});

router.post("/employee-attendance/check-in", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { employeeId, branchId, employeeShiftId, photo, notes } = req.body;
  if (!employeeId || !photo) {
    res.status(400).json({ error: "Karyawan dan Foto wajib disertakan" });
    return;
  }

  const existingActive = await db.select().from(employeeAttendanceTable).where(and(
    eq(employeeAttendanceTable.tenantId, claims.tenantId!),
    eq(employeeAttendanceTable.employeeId, employeeId),
    isNull(employeeAttendanceTable.checkOutTime)
  )).limit(1);

  if (existingActive.length > 0) {
    res.status(400).json({ error: "Karyawan sudah melakukan absen masuk" });
    return;
  }

  const [emp] = await db.select().from(employeesTable).where(and(
    eq(employeesTable.id, employeeId),
    eq(employeesTable.tenantId, claims.tenantId!)
  )).limit(1);

  if (!emp) {
    res.status(404).json({ error: "Karyawan tidak ditemukan" });
    return;
  }

  const finalBranchId = branchId || emp.branchId;
  const finalShiftId = employeeShiftId || emp.employeeShiftId;

  let shift: any = null;
  if (finalShiftId) {
    [shift] = await db.select().from(employeeShiftsTable).where(eq(employeeShiftsTable.id, finalShiftId)).limit(1);
  }

  let photoUrl = "";
  try {
    photoUrl = await uploadAttendancePhoto(photo, employeeId, claims.tenantId!);
  } catch (err: any) {
    res.status(400).json({ error: `Gagal memproses foto: ${err.message}` });
    return;
  }

  const checkInTime = new Date();
  const checkInStatus = calculateCheckInStatus(checkInTime, shift);

  const [log] = await db.insert(employeeAttendanceTable).values({
    tenantId: claims.tenantId!,
    employeeId,
    branchId: finalBranchId,
    employeeShiftId: finalShiftId,
    checkInTime,
    checkInPhoto: photoUrl,
    checkInStatus,
    checkInNotes: notes || null,
  }).returning();

  const [fullLog] = await db.select({
    id: employeeAttendanceTable.id,
    tenantId: employeeAttendanceTable.tenantId,
    employeeId: employeeAttendanceTable.employeeId,
    employeeName: employeesTable.name,
    branchId: employeeAttendanceTable.branchId,
    employeeShiftId: employeeAttendanceTable.employeeShiftId,
    shiftName: employeeShiftsTable.name,
    checkInTime: employeeAttendanceTable.checkInTime,
    checkOutTime: employeeAttendanceTable.checkOutTime,
    checkInPhoto: employeeAttendanceTable.checkInPhoto,
    checkOutPhoto: employeeAttendanceTable.checkOutPhoto,
    checkInStatus: employeeAttendanceTable.checkInStatus,
    checkOutStatus: employeeAttendanceTable.checkOutStatus,
    checkInNotes: employeeAttendanceTable.checkInNotes,
    checkOutNotes: employeeAttendanceTable.checkOutNotes,
    createdAt: employeeAttendanceTable.createdAt,
  })
  .from(employeeAttendanceTable)
  .innerJoin(employeesTable, eq(employeeAttendanceTable.employeeId, employeesTable.id))
  .leftJoin(employeeShiftsTable, eq(employeeAttendanceTable.employeeShiftId, employeeShiftsTable.id))
  .where(eq(employeeAttendanceTable.id, log.id))
  .limit(1);

  res.status(201).json(fmt(fullLog));
});

router.post("/employee-attendance/check-out", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { employeeId, photo, notes } = req.body;
  if (!employeeId || !photo) {
    res.status(400).json({ error: "Karyawan dan Foto wajib disertakan" });
    return;
  }

  const [activeSession] = await db.select().from(employeeAttendanceTable).where(and(
    eq(employeeAttendanceTable.tenantId, claims.tenantId!),
    eq(employeeAttendanceTable.employeeId, employeeId),
    isNull(employeeAttendanceTable.checkOutTime)
  )).limit(1);

  if (!activeSession) {
    res.status(400).json({ error: "Karyawan belum melakukan absen masuk" });
    return;
  }

  let photoUrl = "";
  try {
    photoUrl = await uploadAttendancePhoto(photo, employeeId, claims.tenantId!);
  } catch (err: any) {
    res.status(400).json({ error: `Gagal memproses foto: ${err.message}` });
    return;
  }

  let shift: any = null;
  if (activeSession.employeeShiftId) {
    [shift] = await db.select().from(employeeShiftsTable).where(eq(employeeShiftsTable.id, activeSession.employeeShiftId)).limit(1);
  }

  const checkOutTime = new Date();
  const checkOutStatus = calculateCheckOutStatus(checkOutTime, shift);

  await db.update(employeeAttendanceTable)
    .set({
      checkOutTime,
      checkOutPhoto: photoUrl,
      checkOutStatus,
      checkOutNotes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(employeeAttendanceTable.id, activeSession.id));

  const [fullLog] = await db.select({
    id: employeeAttendanceTable.id,
    tenantId: employeeAttendanceTable.tenantId,
    employeeId: employeeAttendanceTable.employeeId,
    employeeName: employeesTable.name,
    branchId: employeeAttendanceTable.branchId,
    employeeShiftId: employeeAttendanceTable.employeeShiftId,
    shiftName: employeeShiftsTable.name,
    checkInTime: employeeAttendanceTable.checkInTime,
    checkOutTime: employeeAttendanceTable.checkOutTime,
    checkInPhoto: employeeAttendanceTable.checkInPhoto,
    checkOutPhoto: employeeAttendanceTable.checkOutPhoto,
    checkInStatus: employeeAttendanceTable.checkInStatus,
    checkOutStatus: employeeAttendanceTable.checkOutStatus,
    checkInNotes: employeeAttendanceTable.checkInNotes,
    checkOutNotes: employeeAttendanceTable.checkOutNotes,
    createdAt: employeeAttendanceTable.createdAt,
  })
  .from(employeeAttendanceTable)
  .innerJoin(employeesTable, eq(employeeAttendanceTable.employeeId, employeesTable.id))
  .leftJoin(employeeShiftsTable, eq(employeeAttendanceTable.employeeShiftId, employeeShiftsTable.id))
  .where(eq(employeeAttendanceTable.id, activeSession.id))
  .limit(1);

  res.json(fmt(fullLog));
});

export default router;
