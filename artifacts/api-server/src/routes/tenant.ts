import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db, tenantsTable, subscriptionsTable, subscriptionPlansTable,
  publicMenusTable, usersTable, subscriptionUpgradeRequestsTable,
  ordersTable, orderItemsTable, customerOrdersTable, shiftsTable,
  expensesTable, employeeAttendanceTable, customerCartsTable,
  customerSessionsTable, customersTable, activityLogsTable
} from "@workspace/db";
import { UpdateTenantBody, CreateSubscriptionUpgradeRequestBody } from "@workspace/api-zod";
import { extractToken, verifyPassword } from "./auth";
import { logActivity } from "./activity";

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
    .orderBy(desc(subscriptionsTable.createdAt));

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

router.post("/tenant/reset-data", async (req, res): Promise<void> => {
  const claims = requireAuth(req, res);
  if (!claims) return;
  if (!claims.tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  if (claims.role !== "owner") {
    res.status(403).json({ error: "Hanya Pemilik (Owner) yang diizinkan untuk meriset data." });
    return;
  }

  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password konfirmasi wajib diisi." });
    return;
  }

  // Verify the owner's password
  const [ownerUser] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId)).limit(1);
  if (!ownerUser || !verifyPassword(password, ownerUser.passwordHash)) {
    res.status(400).json({ error: "Password konfirmasi salah." });
    return;
  }

  const tenantId = claims.tenantId;

  try {
    await db.transaction(async (tx) => {
      // 1. Delete order items first (no foreign key cascade)
      const tenantOrders = await tx.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.tenantId, tenantId));
      const orderIds = tenantOrders.map(o => o.id);
      if (orderIds.length > 0) {
        await tx.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
      }

      // 2. Delete orders
      await tx.delete(ordersTable).where(eq(ordersTable.tenantId, tenantId));

      // 3. Delete customer orders (cascades to customer_order_items, customer_addresses, delivery_orders)
      await tx.delete(customerOrdersTable).where(eq(customerOrdersTable.tenantId, tenantId));

      // 4. Delete shifts
      await tx.delete(shiftsTable).where(eq(shiftsTable.tenantId, tenantId));

      // 5. Delete expenses
      await tx.delete(expensesTable).where(eq(expensesTable.tenantId, tenantId));

      // 6. Delete attendance
      await tx.delete(employeeAttendanceTable).where(eq(employeeAttendanceTable.tenantId, tenantId));

      // 7. Delete customer carts & sessions
      await tx.delete(customerCartsTable).where(eq(customerCartsTable.tenantId, tenantId));
      await tx.delete(customerSessionsTable).where(eq(customerSessionsTable.tenantId, tenantId));

      // 8. Delete customers
      await tx.delete(customersTable).where(eq(customersTable.tenantId, tenantId));

      // 9. Delete activity logs
      await tx.delete(activityLogsTable).where(eq(activityLogsTable.tenantId, tenantId));
    });

    // Write a new log entry about the reset activity
    await logActivity({
      tenantId: claims.tenantId,
      userId: claims.userId,
      userName: ownerUser.name,
      userRole: claims.role,
      action: "reset_business_data",
      module: "tenant",
      details: { message: "Seluruh data transaksi, shift, log aktivitas, dan absensi berhasil diriset ke kondisi bersih." },
      ipAddress: req.ip,
    });

    res.json({ message: "Data usaha berhasil diriset." });
  } catch (err: any) {
    console.error("Failed to reset business data:", err);
    res.status(500).json({ error: "Gagal meriset data usaha: " + err.message });
  }
});

export default router;
