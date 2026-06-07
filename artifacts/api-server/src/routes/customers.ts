import { Router, type IRouter } from "express";
import { eq, and, ilike, count } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
} from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatCustomer(c: any) {
  return {
    ...c,
    totalSpent: Number(c.totalSpent),
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

router.get("/customers", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListCustomersQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const page = (qp.success ? qp.data.page : 1) ?? 1;
  const limit = (qp.success ? qp.data.limit : 20) ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(customersTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(customersTable).where(where);
  const customers = await db.select().from(customersTable).where(where).limit(limit).offset(offset);

  res.json({
    data: customers.map(formatCustomer),
    total: totalResult.count,
    page,
    limit,
  });
});

router.post("/customers", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateCustomerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [customer] = await db.insert(customersTable).values({
    ...body.data,
    tenantId: claims.tenantId!,
  }).returning();

  res.status(201).json(formatCustomer(customer));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = GetCustomerParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, claims.tenantId!)));

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(customer));
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateCustomerParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateCustomerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [customer] = await db.update(customersTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, claims.tenantId!)))
    .returning();

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(customer));
});

export default router;
