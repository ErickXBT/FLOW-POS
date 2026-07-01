import { Router, type IRouter } from "express";
import { eq, and, or, isNull } from "drizzle-orm";
import { db, categoriesTable, tenantsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryBody,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

router.get("/categories", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(categoriesTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(or(eq(categoriesTable.branchId, branchId), isNull(categoriesTable.branchId)));
  }

  const cats = await db.select().from(categoriesTable)
    .where(and(...conditions));

  const [tenant] = await db.select({ businessEngine: tenantsTable.businessEngine })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, claims.tenantId!))
    .limit(1);
  const engine = tenant?.businessEngine || "retail";

  const formatted = cats.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }));

  if (engine === "booking") {
    formatted.unshift({
      id: 1000000,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      name: "Lapangan",
      description: "Sewa Lapangan / Resource",
      createdAt: new Date().toISOString(),
      updatedAt: new Date(),
    } as any);
  } else if (engine === "appointment") {
    formatted.unshift({
      id: 2000000,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      name: "Layanan",
      description: "Layanan / Jasa Reservasi",
      createdAt: new Date().toISOString(),
      updatedAt: new Date(),
    } as any);
  }

  res.json(formatted);
});

router.post("/categories", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateCategoryBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const branchId = await getRequestedBranchId(req, claims);

  const [cat] = await db.insert(categoriesTable).values({
    ...body.data,
    tenantId: claims.tenantId!,
    branchId: branchId ?? null,
  }).returning();

  res.status(201).json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateCategoryParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateCategoryBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [cat] = await db.update(categoriesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.tenantId, claims.tenantId!)))
    .returning();

  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = DeleteCategoryParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.tenantId, claims.tenantId!)));

  res.sendStatus(204);
});

export default router;
