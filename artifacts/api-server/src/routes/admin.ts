import { Router, type IRouter } from "express";
import { eq, sql, count, ilike, and } from "drizzle-orm";
import { db, tenantsTable, usersTable, ordersTable, subscriptionsTable } from "@workspace/db";
import {
  ListAdminTenantsQueryParams,
  GetAdminTenantParams,
  DeleteAdminTenantParams,
  UpdateTenantStatusParams,
  UpdateTenantStatusBody,
} from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireAdmin(req: any, res: any): { userId: number; tenantId: number | null; role: string } | null {
  const claims = extractToken(req);
  if (!claims || claims.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return claims;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [totalResult] = await db.select({ count: count() }).from(tenantsTable);
  const [activeResult] = await db.select({ count: count() }).from(tenantsTable).where(eq(tenantsTable.status, "active"));
  const [suspendedResult] = await db.select({ count: count() }).from(tenantsTable).where(eq(tenantsTable.status, "suspended"));
  const [expiredResult] = await db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "expired"));
  const [usersResult] = await db.select({ count: count() }).from(usersTable);
  const [ordersResult] = await db.select({ count: count() }).from(ordersTable);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const [revenueResult] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
  }).from(ordersTable).where(sql`created_at >= ${thisMonth.toISOString()}`);

  const byType = await db.select({
    type: tenantsTable.businessType,
    count: count(),
  }).from(tenantsTable).groupBy(tenantsTable.businessType);

  res.json({
    totalTenants: totalResult.count,
    activeTenants: activeResult.count,
    suspendedTenants: suspendedResult.count,
    expiredSubscriptions: expiredResult.count,
    monthlyRevenue: Number(revenueResult.total) || 0,
    totalTransactions: ordersResult.count,
    totalUsers: usersResult.count,
    byBusinessType: byType.map(b => ({ type: b.type, count: b.count })),
  });
});

router.get("/admin/tenants", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const qp = ListAdminTenantsQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const status = qp.success ? qp.data.status : undefined;
  const page = (qp.success ? qp.data.page : undefined) ?? 1;
  const limit = (qp.success ? qp.data.limit : undefined) ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(ilike(tenantsTable.name, `%${search}%`));
  if (status) conditions.push(eq(tenantsTable.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(tenantsTable).where(where);
  const tenants = await db.select().from(tenantsTable).where(where).limit(limit).offset(offset);

  const formatted = tenants.map(t => ({
    ...t,
    subscriptionExpiresAt: t.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json({ data: formatted, total: totalResult.count, page, limit });
});

router.get("/admin/tenants/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const params = GetAdminTenantParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, params.data.id));
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  res.json({
    ...tenant,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
  });
});

router.patch("/admin/tenants/:id/status", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const params = UpdateTenantStatusParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateTenantStatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [tenant] = await db.update(tenantsTable)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(eq(tenantsTable.id, params.data.id))
    .returning();

  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  res.json({
    ...tenant,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
  });
});

router.delete("/admin/tenants/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const params = DeleteAdminTenantParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(tenantsTable).where(eq(tenantsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
