import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, branchesTable, tenantsTable, branchSettingsTable } from "@workspace/db";
import { extractToken } from "./auth";
import { logActivity } from "./activity";

const PLAN_LIMITS: Record<string, number> = {
  trial: 1,
  starter: 1,
  business: 3,
  pro: 5,
  enterprise: 999999,
};

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return claims;
}

function requireOwner(req: any, res: any) {
  const claims = requireTenant(req, res);
  if (!claims) return null;
  if (claims.role !== "owner" && claims.role !== "super_admin") {
    res.status(403).json({ error: "Akses ditolak" });
    return null;
  }
  return claims;
}

// GET /branches
router.get("/branches", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branches = await db.select().from(branchesTable)
    .where(eq(branchesTable.tenantId, claims.tenantId!));

  res.json(branches);
});

// POST /branches
router.post("/branches", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const { name, address, phone, franchiseeId } = req.body;
  if (!name) {
    res.status(400).json({ error: "Nama cabang wajib diisi" });
    return;
  }

  // 1. Fetch current subscription details from tenantsTable
  const [tenant] = await db.select({ subscriptionPlan: tenantsTable.subscriptionPlan })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, claims.tenantId!))
    .limit(1);

  const plan = tenant?.subscriptionPlan || "trial";
  const limit = PLAN_LIMITS[plan] || 1;

  // 2. Count existing branches
  const existingBranches = await db.select().from(branchesTable)
    .where(eq(branchesTable.tenantId, claims.tenantId!));

  if (existingBranches.length >= limit) {
    res.status(403).json({
      error: `Limit outlet terlampaui. Paket Anda (${plan.toUpperCase()}) hanya mengizinkan maksimal ${limit} outlet. Silakan upgrade paket Anda.`
    });
    return;
  }

  const [branch] = await db.insert(branchesTable).values({
    tenantId: claims.tenantId!,
    name,
    address: address || null,
    phone: phone || null,
    status: "active",
    franchiseeId: franchiseeId ? Number(franchiseeId) : null,
  }).returning();

  // 3. Create default branch settings
  await db.insert(branchSettingsTable).values({
    tenantId: claims.tenantId!,
    branchId: branch.id,
    qrMenuEnabled: true,
    taxPercentage: "0.00",
    receiptFooter: "Terima kasih atas kunjungan Anda!",
    printerSettings: JSON.stringify({ paperSize: "80mm", type: "IP", ip: "192.168.1.100" }),
    paymentMethods: JSON.stringify(["cash", "qris"]),
  });

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "create_branch",
    module: "settings",
    details: { name },
    ipAddress: req.ip,
  });

  res.status(201).json(branch);
});

// PATCH /branches/:id
router.patch("/branches/:id", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const { name, address, phone, franchiseeId } = req.body;

  const [branch] = await db.update(branchesTable)
    .set({
      name,
      address: address !== undefined ? address : undefined,
      phone: phone !== undefined ? phone : undefined,
      franchiseeId: franchiseeId !== undefined ? (franchiseeId ? Number(franchiseeId) : null) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(branchesTable.id, id), eq(branchesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!branch) {
    res.status(404).json({ error: "Cabang tidak ditemukan" });
    return;
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "update_branch",
    module: "settings",
    details: { id, name },
    ipAddress: req.ip,
  });

  res.json(branch);
});

// DELETE /branches/:id
router.delete("/branches/:id", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const id = Number(req.params.id);

  const [deleted] = await db.delete(branchesTable)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Cabang tidak ditemukan" });
    return;
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "Owner/Admin",
    userRole: claims.role,
    action: "delete_branch",
    module: "settings",
    details: { id, name: deleted.name },
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

// GET /branches/:id/settings
router.get("/branches/:id/settings", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = Number(req.params.id);

  // Check if branch belongs to tenant
  const [branch] = await db.select().from(branchesTable)
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.tenantId, claims.tenantId!)))
    .limit(1);

  if (!branch) {
    res.status(404).json({ error: "Cabang tidak ditemukan" });
    return;
  }

  // Get settings
  let [settings] = await db.select().from(branchSettingsTable)
    .where(and(eq(branchSettingsTable.branchId, branchId), eq(branchSettingsTable.tenantId, claims.tenantId!)))
    .limit(1);

  // If settings don't exist, create default
  if (!settings) {
    [settings] = await db.insert(branchSettingsTable).values({
      tenantId: claims.tenantId!,
      branchId,
      qrMenuEnabled: true,
      taxPercentage: "0.00",
      receiptFooter: "Terima kasih atas kunjungan Anda!",
      printerSettings: JSON.stringify({ paperSize: "80mm", type: "IP", ip: "192.168.1.100" }),
      paymentMethods: JSON.stringify(["cash", "qris"]),
    }).returning();
  }

  res.json({
    ...settings,
    taxPercentage: Number(settings.taxPercentage),
    printerSettings: JSON.parse(settings.printerSettings || "{}"),
    paymentMethods: JSON.parse(settings.paymentMethods || "[]"),
  });
});

// PATCH /branches/:id/settings
router.patch("/branches/:id/settings", async (req, res): Promise<void> => {
  const claims = requireOwner(req, res);
  if (!claims) return;

  const branchId = Number(req.params.id);
  const { qrMenuEnabled, taxPercentage, receiptFooter, printerSettings, paymentMethods } = req.body;

  // Check if branch belongs to tenant
  const [branch] = await db.select().from(branchesTable)
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.tenantId, claims.tenantId!)))
    .limit(1);

  if (!branch) {
    res.status(404).json({ error: "Cabang tidak ditemukan" });
    return;
  }

  // Update or insert settings
  let [settings] = await db.select().from(branchSettingsTable)
    .where(and(eq(branchSettingsTable.branchId, branchId), eq(branchSettingsTable.tenantId, claims.tenantId!)))
    .limit(1);

  const valuesToSet = {
    qrMenuEnabled: qrMenuEnabled !== undefined ? qrMenuEnabled : undefined,
    taxPercentage: taxPercentage !== undefined ? String(taxPercentage) : undefined,
    receiptFooter: receiptFooter !== undefined ? receiptFooter : undefined,
    printerSettings: printerSettings !== undefined ? JSON.stringify(printerSettings) : undefined,
    paymentMethods: paymentMethods !== undefined ? JSON.stringify(paymentMethods) : undefined,
    updatedAt: new Date(),
  };

  if (!settings) {
    [settings] = await db.insert(branchSettingsTable).values({
      tenantId: claims.tenantId!,
      branchId,
      qrMenuEnabled: qrMenuEnabled ?? true,
      taxPercentage: String(taxPercentage ?? 0),
      receiptFooter: receiptFooter ?? "",
      printerSettings: JSON.stringify(printerSettings ?? {}),
      paymentMethods: JSON.stringify(paymentMethods ?? []),
    }).returning();
  } else {
    [settings] = await db.update(branchSettingsTable)
      .set(valuesToSet)
      .where(and(eq(branchSettingsTable.branchId, branchId), eq(branchSettingsTable.tenantId, claims.tenantId!)))
      .returning();
  }

  res.json({
    ...settings,
    taxPercentage: Number(settings.taxPercentage),
    printerSettings: JSON.parse(settings.printerSettings || "{}"),
    paymentMethods: JSON.parse(settings.paymentMethods || "[]"),
  });
});

export default router;
