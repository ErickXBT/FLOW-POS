import { Router, type IRouter } from "express";
import { eq, and, desc, count, gte, lte, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customersTable } from "@workspace/db";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  GetRecentOrdersQueryParams,
} from "@workspace/api-zod";
import { extractToken } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatOrder(order: any, items: any[]) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    total: Number(order.total),
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    items: items.map(i => ({
      ...i,
      price: Number(i.price),
      subtotal: Number(i.subtotal),
    })),
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListOrdersQueryParams.safeParse(req.query);
  const page = (qp.success ? qp.data.page : 1) ?? 1;
  const limit = (qp.success ? qp.data.limit : 20) ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(ordersTable.tenantId, claims.tenantId!)];
  if (qp.success && qp.data.status) conditions.push(eq(ordersTable.status, qp.data.status));
  if (qp.success && qp.data.dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(qp.data.dateFrom)));
  if (qp.success && qp.data.dateTo) conditions.push(lte(ordersTable.createdAt, new Date(qp.data.dateTo)));
  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(ordersTable).where(where);
  const orders = await db.select().from(ordersTable).where(where)
    .orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);

  const orderIds = orders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select().from(orderItemsTable).where(sql`order_id = ANY(${orderIds}::int[])`)
    : [];

  const itemsByOrder = items.reduce((acc: any, item) => {
    if (!acc[item.orderId]) acc[item.orderId] = [];
    acc[item.orderId].push(item);
    return acc;
  }, {});

  res.json({
    data: orders.map(o => formatOrder(o, itemsByOrder[o.id] || [])),
    total: totalResult.count,
    page,
    limit,
  });
});

router.post("/orders", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateOrderBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const orderNum = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const subtotal = body.data.subtotal ?? body.data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = body.data.discount ?? 0;
  const tax = body.data.tax ?? 0;
  const total = body.data.total ?? subtotal - discount + tax;

  let customerName: string | null = null;
  if (body.data.customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, body.data.customerId));
    customerName = cust?.name ?? null;
  }

  const [order] = await db.insert(ordersTable).values({
    orderNumber: orderNum,
    subtotal: String(subtotal),
    discount: String(discount),
    tax: String(tax),
    total: String(total),
    status: "completed",
    paymentMethod: body.data.paymentMethod,
    notes: body.data.notes ?? null,
    customerId: body.data.customerId ?? null,
    customerName,
    employeeId: body.data.employeeId ?? null,
    tenantId: claims.tenantId!,
  }).returning();

  const itemInputs = body.data.items;
  const productIds = itemInputs.map(i => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(sql`id = ANY(${productIds}::int[])`)
    : [];
  const productMap = products.reduce((m: any, p) => { m[p.id] = p; return m; }, {});

  const insertedItems = await db.insert(orderItemsTable).values(
    itemInputs.map(i => ({
      orderId: order.id,
      productId: i.productId,
      productName: productMap[i.productId]?.name ?? String(i.productId),
      quantity: i.quantity,
      price: String(i.price),
      subtotal: String(i.price * i.quantity),
    }))
  ).returning();

  // Deduct stock
  for (const item of itemInputs) {
    await db.execute(sql`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${claims.tenantId}`);
  }

  // Update customer stats
  if (body.data.customerId) {
    await db.execute(sql`
      UPDATE customers SET
        total_spent = CAST(total_spent AS DECIMAL) + ${total},
        total_orders = total_orders + 1,
        loyalty_points = loyalty_points + ${Math.floor(total / 1000)}
      WHERE id = ${body.data.customerId} AND tenant_id = ${claims.tenantId}
    `);
  }

  res.status(201).json(formatOrder(order, insertedItems));
});

router.get("/orders/recent", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = GetRecentOrdersQueryParams.safeParse(req.query);
  const limit = (qp.success ? qp.data.limit : 10) ?? 10;

  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.tenantId, claims.tenantId!))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  res.json(orders.map(o => formatOrder(o, [])));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = GetOrderParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.tenantId, claims.tenantId!)));

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateOrderStatusParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [order] = await db.update(ordersTable)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.tenantId, claims.tenantId!)))
    .returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

export default router;
