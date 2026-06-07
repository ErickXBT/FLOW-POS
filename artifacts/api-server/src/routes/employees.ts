import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
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
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateEmployeeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [employee] = await db.insert(employeesTable).values({
    ...body.data,
    tenantId: claims.tenantId!,
  }).returning();

  res.status(201).json(fmt(employee));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateEmployeeParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateEmployeeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [employee] = await db.update(employeesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(fmt(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = DeleteEmployeeParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(employeesTable)
    .where(and(eq(employeesTable.id, params.data.id), eq(employeesTable.tenantId, claims.tenantId!)));

  res.sendStatus(204);
});

export default router;
