import { Router, type IRouter } from "express";
import { eq, and, ilike, count, sql, desc } from "drizzle-orm";
import { db, productsTable, categoriesTable, orderItemsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetTopProductsQueryParams,
} from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatProduct(p: any, categoryName?: string | null) {
  return {
    ...p,
    price: Number(p.price),
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    categoryName: categoryName ?? null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListProductsQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const categoryId = qp.success ? qp.data.categoryId : undefined;
  const page = (qp.success ? qp.data.page : 1) ?? 1;
  const limit = (qp.success ? qp.data.limit : 20) ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(productsTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(productsTable).where(where);

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(where)
    .limit(limit)
    .offset(offset);

  res.json({
    data: rows.map(r => formatProduct(r.product, r.categoryName)),
    total: totalResult.count,
    page,
    limit,
  });
});

router.post("/products", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [product] = await db.insert(productsTable).values({
    ...body.data,
    price: String(body.data.price),
    costPrice: body.data.costPrice != null ? String(body.data.costPrice) : undefined,
    tenantId: claims.tenantId!,
  }).returning();

  res.status(201).json(formatProduct(product));
});

router.get("/products/top", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = GetTopProductsQueryParams.safeParse(req.query);
  const limit = (qp.success ? qp.data.limit : 5) ?? 5;

  const rows = await db
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
      totalSold: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`,
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(productsTable.id, orderItemsTable.productId))
    .where(eq(productsTable.tenantId, claims.tenantId!))
    .groupBy(productsTable.id)
    .orderBy(desc(sql`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`))
    .limit(limit);

  res.json(rows.map(r => ({
    productId: r.productId,
    name: r.name,
    imageUrl: r.imageUrl,
    totalSold: Number(r.totalSold),
    revenue: Number(r.revenue),
  })));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = GetProductParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, claims.tenantId!)));

  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(row.product, row.categoryName));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateProductParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateProductBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: any = { ...body.data, updatedAt: new Date() };
  if (body.data.price != null) updateData.price = String(body.data.price);
  if (body.data.costPrice != null) updateData.costPrice = String(body.data.costPrice);

  const [product] = await db.update(productsTable)
    .set(updateData)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, claims.tenantId!)))
    .returning();

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = DeleteProductParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, claims.tenantId!)));

  res.sendStatus(204);
});

export default router;
