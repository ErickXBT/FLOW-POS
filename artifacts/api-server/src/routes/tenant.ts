import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tenantsTable, subscriptionsTable, subscriptionPlansTable, publicMenusTable, usersTable, subscriptionUpgradeRequestsTable } from "@workspace/db";
import { UpdateTenantBody, CreateSubscriptionUpgradeRequestBody } from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireAuth(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

router.get("/tenant", async (req, res): Promise<void> => {
  const claims = requireAuth(req, res);
  if (!claims) return;
  if (!claims.tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  let tenantEmail = tenant.email;
  if (!tenantEmail) {
    const [owner] = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.tenantId, claims.tenantId), eq(usersTable.role, "owner")));
    if (owner?.email) {
      tenantEmail = owner.email;
      await db.update(tenantsTable)
        .set({ email: tenantEmail })
        .where(eq(tenantsTable.id, claims.tenantId));
      tenant.email = tenantEmail;
    }
  }

  res.json({
    ...tenant,
    taxPercentage: tenant.taxPercentage ? Number(tenant.taxPercentage) : 10,
    enableServiceCharge: tenant.enableServiceCharge ?? false,
    serviceChargePercentage: tenant.serviceChargePercentage ? Number(tenant.serviceChargePercentage) : 10,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
  });
});

router.patch("/tenant", async (req, res): Promise<void> => {
  const claims = requireAuth(req, res);
  if (!claims) return;
  if (!claims.tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  const body = UpdateTenantBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [tenant] = await db.update(tenantsTable)
    .set({ ...body.data, updatedAt: new Date() } as any)
    .where(eq(tenantsTable.id, claims.tenantId))
    .returning();

  if (body.data.name) {
    await db.update(publicMenusTable)
      .set({ name: body.data.name })
      .where(eq(publicMenusTable.tenantId, claims.tenantId));
  }

  res.json({
    ...tenant,
    taxPercentage: tenant.taxPercentage ? Number(tenant.taxPercentage) : 10,
    enableServiceCharge: tenant.enableServiceCharge ?? false,
    serviceChargePercentage: tenant.serviceChargePercentage ? Number(tenant.serviceChargePercentage) : 10,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
  });
});

router.get("/tenant/subscription", async (req, res): Promise<void> => {
  const claims = requireAuth(req, res);
  if (!claims) return;
  if (!claims.tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  const [sub] = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.tenantId, claims.tenantId))
    .orderBy(subscriptionsTable.createdAt);

  if (!sub) { res.status(404).json({ error: "No subscription" }); return; }

  const [pending] = await db.select().from(subscriptionUpgradeRequestsTable)
    .where(and(
      eq(subscriptionUpgradeRequestsTable.tenantId, claims.tenantId),
      eq(subscriptionUpgradeRequestsTable.status, "pending")
    ));

  res.json({
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    price: Number(sub.price),
    startedAt: sub.startedAt.toISOString(),
    expiresAt: sub.expiresAt.toISOString(),
    pendingUpgradeRequest: pending ? {
      id: pending.id,
      tenantId: pending.tenantId,
      requestedPlan: pending.requestedPlan,
      billingCycle: pending.billingCycle,
      status: pending.status,
      createdAt: pending.createdAt.toISOString(),
      updatedAt: pending.updatedAt.toISOString(),
    } : null,
  });
});

router.post("/tenant/upgrade-request", async (req, res): Promise<void> => {
  const claims = requireAuth(req, res);
  if (!claims) return;
  if (!claims.tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  const body = CreateSubscriptionUpgradeRequestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const { requestedPlan, billingCycle } = body.data;

  // Check if there is already a pending upgrade request for this tenant
  const [existingPending] = await db.select().from(subscriptionUpgradeRequestsTable)
    .where(and(
      eq(subscriptionUpgradeRequestsTable.tenantId, claims.tenantId),
      eq(subscriptionUpgradeRequestsTable.status, "pending")
    ));

  if (existingPending) {
    res.status(400).json({ error: "Anda sudah memiliki permintaan upgrade yang sedang diproses." });
    return;
  }

  const [newRequest] = await db.insert(subscriptionUpgradeRequestsTable).values({
    tenantId: claims.tenantId,
    requestedPlan,
    billingCycle,
    status: "pending",
  }).returning();

  res.json({
    id: newRequest.id,
    tenantId: newRequest.tenantId,
    requestedPlan: newRequest.requestedPlan,
    billingCycle: newRequest.billingCycle,
    status: newRequest.status,
    createdAt: newRequest.createdAt.toISOString(),
    updatedAt: newRequest.updatedAt.toISOString(),
  });
});

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(subscriptionPlansTable);
  res.json(plans.map(p => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    durationDays: p.durationDays,
    maxBranches: p.maxBranches,
    features: p.features,
  })));
});

export default router;
