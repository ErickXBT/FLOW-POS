import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import * as crypto from "crypto";
import { db, employeesTable, usersTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { extractToken } from "./auth";
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
  const conditions = [eq(employeesTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(employeesTable.name, `%${search}%`));

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
  res.json(fmt(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const claims = requireManagerOrOwner(req, res);
  if (!claims) return;

  const params = DeleteEmployeeParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.tenantId, claims.tenantId!)));

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

export default router;
