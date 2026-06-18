import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, customRolesTable, employeesTable, usersTable } from "@workspace/db";
import { extractToken } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

function requireOwner(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (claims.role !== "owner" && claims.role !== "super_admin") {
    res.status(403).json({ error: "Akses ditolak" });
    return null;
  }
  return claims;
}

// GET /roles
router.get("/roles", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const roles = await db.select().from(customRolesTable)
    .where(eq(customRolesTable.tenantId, claims.tenantId!));

  res.json(roles);
});

// POST /roles
router.post("/roles", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const { name, permissions } = req.body;
  if (!name) {
    res.status(400).json({ error: "Nama role wajib diisi" });
    return;
  }

  const [role] = await db.insert(customRolesTable).values({
    tenantId: claims.tenantId!,
    name,
    permissions: Array.isArray(permissions) ? permissions : [],
  }).returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "create_role",
    module: "settings",
    details: { name, permissions },
    ipAddress: req.ip,
  });

  res.status(201).json(role);
});

// PATCH /roles/:id
router.patch("/roles/:id", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const { name, permissions } = req.body;

  const [role] = await db.update(customRolesTable)
    .set({
      name,
      permissions: Array.isArray(permissions) ? permissions : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(customRolesTable.id, id), eq(customRolesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!role) {
    res.status(404).json({ error: "Role tidak ditemukan" });
    return;
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "update_role",
    module: "settings",
    details: { id, name, permissions },
    ipAddress: req.ip,
  });

  res.json(role);
});

// DELETE /roles/:id
router.delete("/roles/:id", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const id = Number(req.params.id);

  // Find employees using this custom role
  const affected = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.customRoleId, id), eq(employeesTable.tenantId, claims.tenantId!)));

  const userIds = affected.map(emp => emp.userId).filter((uid): uid is number => uid !== null);

  if (userIds.length > 0) {
    // Delete associated login user accounts so they cannot access the system anymore
    await db.delete(usersTable)
      .where(inArray(usersTable.id, userIds));
  }

  // Clear role references and reset user ID links on those employees
  await db.update(employeesTable)
    .set({ customRoleId: null, userId: null, role: "staff" })
    .where(and(eq(employeesTable.customRoleId, id), eq(employeesTable.tenantId, claims.tenantId!)));

  const [deleted] = await db.delete(customRolesTable)
    .where(and(eq(customRolesTable.id, id), eq(customRolesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Role tidak ditemukan" });
    return;
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "delete_role",
    module: "settings",
    details: { id, name: deleted.name },
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

export default router;
