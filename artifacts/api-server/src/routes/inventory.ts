import { Router, type IRouter } from "express";
import { eq, and, ilike, desc } from "drizzle-orm";
import { db, productsTable, categoriesTable, inventoryAdjustmentsTable } from "@workspace/db";
import {
  ListInventoryQueryParams,
  CreateInventoryAdjustmentBody,
  ListInventoryAdjustmentsQueryParams,
} from "@workspace/api-zod";
import { extractToken } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

router.get("/inventory", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListInventoryQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const lowStock = qp.success ? qp.data.lowStock : undefined;

  const conditions = [eq(productsTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions));

  const result = rows.map(r => ({
    productId: r.product.id,
    productName: r.product.name,
    sku: r.product.sku,
    stock: r.product.stock,
    minStock: r.product.minStock,
    isLowStock: r.product.stock <= r.product.minStock,
    categoryName: r.categoryName ?? null,
    tenantId: r.product.tenantId,
  }));

  const filtered = lowStock === true || lowStock === "true" as any
    ? result.filter(i => i.isLowStock)
    : result;

  res.json(filtered);
});

router.post("/inventory/adjustments", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateInventoryAdjustmentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, body.data.productId), eq(productsTable.tenantId, claims.tenantId!)));

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  let delta = body.data.quantity;
  if (body.data.type === "stock_out") delta = -Math.abs(delta);
  else if (body.data.type === "stock_in") delta = Math.abs(delta);

  const newStock = Math.max(0, product.stock + delta);
  await db.update(productsTable)
    .set({ stock: newStock, updatedAt: new Date() })
    .where(eq(productsTable.id, product.id));

  const [adj] = await db.insert(inventoryAdjustmentsTable).values({
    productId: body.data.productId,
    productName: product.name,
    type: body.data.type,
    quantity: body.data.quantity,
    notes: body.data.notes ?? null,
    tenantId: claims.tenantId!,
  }).returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: claims.role === "owner" ? "Owner" : "Manager",
    userRole: claims.role,
    action: "adjust_stock",
    module: "inventory",
    details: { productId: product.id, productName: product.name, type: body.data.type, quantity: body.data.quantity },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...adj,
    createdAt: adj.createdAt.toISOString(),
  });
});

router.get("/inventory/adjustments/list", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListInventoryAdjustmentsQueryParams.safeParse(req.query);
  const productId = qp.success ? qp.data.productId : undefined;

  const conditions = [eq(inventoryAdjustmentsTable.tenantId, claims.tenantId!)];
  if (productId) conditions.push(eq(inventoryAdjustmentsTable.productId, productId));

  const adjustments = await db.select().from(inventoryAdjustmentsTable)
    .where(and(...conditions))
    .orderBy(desc(inventoryAdjustmentsTable.createdAt))
    .limit(50);

  res.json(adjustments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

export default router;
