import { Router, type IRouter } from "express";
import { eq, sql, count, ilike, and, desc } from "drizzle-orm";
import {
  db, tenantsTable, usersTable, ordersTable, subscriptionsTable,
  employeesTable, branchesTable, customersTable, announcementsTable,
  supportTicketsTable, ticketRepliesTable, platformSettingsTable,
  activityLogsTable
} from "@workspace/db";
import {
  ListAdminTenantsQueryParams,
  GetAdminTenantParams,
  DeleteAdminTenantParams,
  UpdateTenantStatusParams,
  UpdateTenantStatusBody,
} from "@workspace/api-zod";
import { extractToken } from "./auth";
import * as jwt from "jsonwebtoken";
import { logActivity } from "./activity";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "flow-pos-secret-key-2024";

function requireAdmin(req: any, res: any): { userId: number; tenantId: number | null; role: string } | null {
  const claims = extractToken(req);
  if (!claims || claims.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return claims;
}

function requireAdminOrTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return claims;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [totalResult] = await db.select({ count: count() }).from(tenantsTable);
  const [activeResult] = await db.select({ count: count() }).from(tenantsTable).where(eq(tenantsTable.status, "active"));
  const [suspendedResult] = await db.select({ count: count() }).from(tenantsTable).where(eq(tenantsTable.status, "suspended"));
  const [trialResult] = await db.select({ count: count() }).from(tenantsTable).where(eq(tenantsTable.status, "trial"));
  const [expiredResult] = await db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "expired"));
  const [usersResult] = await db.select({ count: count() }).from(usersTable);
  const [ordersResult] = await db.select({ count: count() }).from(ordersTable);
  const [employeesResult] = await db.select({ count: count() }).from(employeesTable);
  const [branchesResult] = await db.select({ count: count() }).from(branchesTable);
  const [customersResult] = await db.select({ count: count() }).from(customersTable);

  const [mrrResult] = await db.select({
    mrr: sql<number>`COALESCE(SUM(CAST(price AS DECIMAL)), 0)`,
  }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active"));

  const mrr = Number(mrrResult.mrr) || 0;
  const annualRevenue = mrr * 12;

  const byType = await db.select({
    type: tenantsTable.businessType,
    count: count(),
  }).from(tenantsTable).groupBy(tenantsTable.businessType);

  res.json({
    totalTenants: totalResult.count,
    activeTenants: activeResult.count,
    suspendedTenants: suspendedResult.count,
    trialUsers: trialResult.count,
    expiredSubscriptions: expiredResult.count,
    monthlyRevenue: mrr,
    annualRevenue,
    totalOrders: ordersResult.count,
    totalCustomers: customersResult.count,
    totalEmployees: employeesResult.count,
    totalBranches: branchesResult.count,
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

const PLAN_LIMITS: Record<string, number> = {
  trial: 1,
  starter: 1,
  business: 3,
  pro: 5,
  enterprise: 999999,
};

async function enforceBranchLimits(tenantId: number, plan: string, reqIp: string = "127.0.0.1") {
  const limit = PLAN_LIMITS[plan] || 1;

  // Get all branches of tenant, ordered by createdAt (oldest first)
  const branches = await db.select().from(branchesTable)
    .where(eq(branchesTable.tenantId, tenantId))
    .orderBy(branchesTable.createdAt);

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    let newStatus = "active";
    if (i >= limit) {
      newStatus = "locked";
    } else {
      if (branch.status === "locked") {
        newStatus = "active";
      } else {
        newStatus = branch.status || "active";
      }
    }

    if (branch.status !== newStatus) {
      await db.update(branchesTable)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(branchesTable.id, branch.id));

      await logActivity({
        tenantId,
        userId: 0,
        userName: "System",
        userRole: "system",
        action: newStatus === "locked" ? "lock_branch" : "unlock_branch",
        module: "settings",
        details: { id: branch.id, name: branch.name, reason: `Plan changed to ${plan}` },
        ipAddress: reqIp,
      });
    }
  }
}

router.patch("/admin/tenants/:id/subscription", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  const { subscriptionPlan, expiresDays } = req.body; // trial, starter, business, pro, enterprise

  if (!subscriptionPlan) {
    res.status(400).json({ error: "Paket langganan wajib ditentukan" });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (expiresDays || 30));

  const [tenant] = await db.update(tenantsTable)
    .set({
      subscriptionPlan,
      subscriptionExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(tenantsTable.id, id))
    .returning();

  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan" });
    return;
  }

  // Also insert active subscription record
  await db.insert(subscriptionsTable).values({
    tenantId: id,
    plan: subscriptionPlan,
    status: "active",
    price: subscriptionPlan === "starter" ? "299000" : subscriptionPlan === "business" ? "499000" : subscriptionPlan === "pro" ? "749000" : "0",
    expiresAt,
  });

  // Downgrade/Upgrade branch limit enforcement
  await enforceBranchLimits(id, subscriptionPlan, req.ip);

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

// Impersonation Login POST /admin/tenants/:id/impersonate
router.post("/admin/tenants/:id/impersonate", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

  // Query owner user of the tenant
  const [owner] = await db.select().from(usersTable)
    .where(and(eq(usersTable.tenantId, id), eq(usersTable.role, "owner")))
    .limit(1);

  if (!owner) {
    res.status(404).json({ error: "Pemilik tenant tidak ditemukan" });
    return;
  }

  // Generate token impersonating the owner
  const token = jwt.sign(
    { userId: owner.id, tenantId: tenant.id, role: "owner", impersonating: true },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      id: owner.id,
      name: `Preview: ${owner.name}`,
      email: owner.email,
      role: "owner",
      tenantId: tenant.id,
      createdAt: owner.createdAt.toISOString(),
    },
  });
});

// Announcements endpoints
router.get("/announcements", async (req, res): Promise<void> => {
  if (!requireAdminOrTenant(req, res)) return;

  const list = await db.select().from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt))
    .limit(10);

  res.json(list.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/admin/announcements", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { title, content, type } = req.body;
  if (!title || !content) { res.status(400).json({ error: "Judul dan konten wajib diisi" }); return; }

  const [ann] = await db.insert(announcementsTable).values({
    title,
    content,
    type: type || "general",
  }).returning();

  res.status(201).json({ ...ann, createdAt: ann.createdAt.toISOString() });
});

// Support Ticket endpoints
router.get("/support/tickets", async (req, res): Promise<void> => {
  const claims = requireAdminOrTenant(req, res);
  if (!claims) return;

  let list;
  if (claims.role === "super_admin") {
    // Return all tickets joined with tenant name
    list = await db
      .select({
        ticket: supportTicketsTable,
        tenantName: tenantsTable.name,
      })
      .from(supportTicketsTable)
      .leftJoin(tenantsTable, eq(supportTicketsTable.tenantId, tenantsTable.id))
      .orderBy(desc(supportTicketsTable.createdAt));
  } else {
    // Return only tenant's tickets
    list = await db
      .select({
        ticket: supportTicketsTable,
        tenantName: tenantsTable.name,
      })
      .from(supportTicketsTable)
      .leftJoin(tenantsTable, eq(supportTicketsTable.tenantId, tenantsTable.id))
      .where(eq(supportTicketsTable.tenantId, claims.tenantId!))
      .orderBy(desc(supportTicketsTable.createdAt));
  }

  res.json(list.map(l => ({
    ...l.ticket,
    tenantName: l.tenantName,
    createdAt: l.ticket.createdAt.toISOString(),
    updatedAt: l.ticket.updatedAt.toISOString(),
  })));
});

router.post("/support/tickets", async (req, res): Promise<void> => {
  const claims = requireAdminOrTenant(req, res);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, description, category } = req.body;
  if (!title || !description || !category) {
    res.status(400).json({ error: "Judul, deskripsi dan kategori wajib diisi" });
    return;
  }

  const [ticket] = await db.insert(supportTicketsTable).values({
    tenantId: claims.tenantId,
    title,
    description,
    category,
    status: "open",
  }).returning();

  res.status(201).json({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  });
});

router.get("/support/tickets/:id/replies", async (req, res): Promise<void> => {
  const claims = requireAdminOrTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);

  // Verify ticket belongs to tenant or caller is admin
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Tiket tidak ditemukan" }); return; }

  if (claims.role !== "super_admin" && ticket.tenantId !== claims.tenantId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const replies = await db.select().from(ticketRepliesTable)
    .where(eq(ticketRepliesTable.ticketId, id))
    .orderBy(ticketRepliesTable.createdAt);

  res.json(replies.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/support/tickets/:id/replies", async (req, res): Promise<void> => {
  const claims = requireAdminOrTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "Pesan tidak boleh kosong" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Tiket tidak ditemukan" }); return; }

  if (claims.role !== "super_admin" && ticket.tenantId !== claims.tenantId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Resolve sender name
  let senderName = "Admin";
  if (claims.role !== "super_admin") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId)).limit(1);
    senderName = user?.name || "User";
  }

  const [reply] = await db.insert(ticketRepliesTable).values({
    ticketId: id,
    senderId: claims.userId,
    senderRole: claims.role === "super_admin" ? "admin" : "user",
    senderName,
    message,
  }).returning();

  // Update ticket status
  await db.update(supportTicketsTable)
    .set({
      status: claims.role === "super_admin" ? "in_progress" : "open",
      updatedAt: new Date(),
    })
    .where(eq(supportTicketsTable.id, id));

  res.status(201).json({ ...reply, createdAt: reply.createdAt.toISOString() });
});

// Settings endpoints
router.get("/admin/settings", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const [settings] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "global_config"));

  if (!settings) {
    // Seed default settings if empty
    const defaultConfig = {
      branding: { title: "Flow POS Platform", primaryColor: "#1D4EF5" },
      gateways: { qrisActive: true, stripeActive: false, xenditActive: true },
      tax: { defaultRate: 11, active: true },
      email: { smtpHost: "smtp.mailtrap.io", smtpPort: 2525, active: true },
      sms: { provider: "twilio", active: false },
      storage: { provider: "supabase", active: true },
      cdn: { provider: "cloudflare", active: false }
    };
    const [seeded] = await db.insert(platformSettingsTable).values({
      key: "global_config",
      value: defaultConfig,
    }).returning();
    res.json(seeded);
    return;
  }

  res.json(settings);
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { value } = req.body;
  if (!value) { res.status(400).json({ error: "Konfigurasi tidak valid" }); return; }

  const [updated] = await db.update(platformSettingsTable)
    .set({ value, updatedAt: new Date() })
    .where(eq(platformSettingsTable.key, "global_config"))
    .returning();

  res.json(updated);
});

// Security Logs
router.get("/admin/security-logs", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const logs = await db.select().from(activityLogsTable)
    .where(and(
      sql`action IN ('failed_login', 'suspicious_login', 'logout', 'unauthorized_access')`
    ))
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(50);

  res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

export default router;
