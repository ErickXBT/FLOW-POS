import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customersTable, employeesTable, usersTable, branchesTable, customerOrdersTable, customerOrderItemsTable } from "@workspace/db";
import { broadcastNewOrder } from "./menu";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetRecentOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";
import { extractToken } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatOrder(o: any, items: any[] = []) {
  return {
    ...o,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    tax: Number(o.tax),
    total: Number(o.total),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
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

  // Enforce branch limit
  if (claims.role !== "owner" && claims.role !== "super_admin") {
    const [emp] = await db.select({ branchId: employeesTable.branchId }).from(employeesTable).where(eq(employeesTable.userId, claims.userId)).limit(1);
    if (emp && emp.branchId) {
      conditions.push(eq(ordersTable.branchId, emp.branchId));
    }
  }

  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(ordersTable).where(where);
  const orders = await db.select().from(ordersTable).where(where)
    .orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);

  const orderIds = orders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
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

  // Resolve branchId
  let branchId: number | null = null;
  const employeeBody = body.data as any;
  if (employeeBody.branchId) {
    branchId = employeeBody.branchId;
  } else if (claims.role !== "owner" && claims.role !== "super_admin") {
    const [emp] = await db.select({ branchId: employeesTable.branchId }).from(employeesTable).where(eq(employeesTable.userId, claims.userId)).limit(1);
    if (emp) branchId = emp.branchId;
  }

  if (branchId) {
    const [br] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
    if (br && br.status === "locked") {
      res.status(403).json({ error: "Cabang ini dinonaktifkan (terkunci) karena melampaui batas paket langganan. Silakan hubungi admin untuk upgrade paket." });
      return;
    }
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
    branchId,
  }).returning();

  const itemInputs = body.data.items;
  const productIds = itemInputs.map(i => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
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

  // Also create a corresponding order in customerOrdersTable for kitchen (KDS) & delivery tracking
  try {
    const { orderType, customerPhone, tableNumber, deliveryAddress, customerName: posCustomerName } = req.body;
    const [custOrder] = await db.insert(customerOrdersTable).values({
      orderNumber: orderNum,
      tenantId: claims.tenantId!,
      branchId: branchId || 1, // Fallback branch ID if not set
      orderType: orderType || "dine_in",
      customerName: posCustomerName || customerName || "Pelanggan POS",
      customerPhone: customerPhone || null,
      tableNumber: tableNumber || null,
      deliveryAddress: deliveryAddress || null,
      deliveryNotes: null,
      googleMapsLocation: null,
      deliveryFee: "0",
      paymentMethod: body.data.paymentMethod,
      subtotal: String(subtotal),
      discount: String(discount),
      tax: String(tax),
      total: String(total),
      status: "pending", // POS orders start as pending (Antrian Baru)
      notes: body.data.notes ?? null,
    }).returning();

    if (custOrder) {
      await db.insert(customerOrderItemsTable).values(
        itemInputs.map(i => ({
          tenantId: claims.tenantId!,
          branchId: branchId || 1,
          customerOrderId: custOrder.id,
          productId: i.productId,
          productName: productMap[i.productId]?.name ?? String(i.productId),
          quantity: i.quantity,
          price: String(i.price),
          subtotal: String(i.price * i.quantity),
          variantSelection: i.variantSelection ?? null,
          notes: i.notes ?? null,
        }))
      );

      // Broadcast SSE events so KDS, Pesanan Online, and Delivery pages update in realtime!
      const itemsForBroadcast = itemInputs.map(i => ({
        productId: i.productId,
        productName: productMap[i.productId]?.name ?? String(i.productId),
        quantity: i.quantity,
        price: Number(i.price),
        subtotal: Number(i.price * i.quantity),
        variantSelection: i.variantSelection ?? null,
        notes: i.notes ?? null,
      }));

      const formatted = {
        ...custOrder,
        subtotal: Number(custOrder.subtotal),
        discount: Number(custOrder.discount),
        tax: Number(custOrder.tax),
        total: Number(custOrder.total),
        deliveryFee: Number(custOrder.deliveryFee ?? 0),
        createdAt: custOrder.createdAt.toISOString(),
        items: itemsForBroadcast,
      };

      broadcastNewOrder(claims.tenantId!, formatted);
    }
  } catch (err) {
    console.error("Failed to sync POS order to KDS/customer_orders:", err);
  }

  for (const item of itemInputs) {
    await db.execute(sql`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${claims.tenantId}`);
  }

  if (body.data.customerId) {
    await db.execute(sql`
      UPDATE customers SET
        total_spent = CAST(total_spent AS DECIMAL) + ${total},
        total_orders = total_orders + 1,
        loyalty_points = loyalty_points + ${Math.floor(total / 1000)}
      WHERE id = ${body.data.customerId} AND tenant_id = ${claims.tenantId}
    `);
  }

  // Fetch user details for log
  const [userRec] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: userRec?.name || "Kasir",
    userRole: claims.role,
    action: "create_order",
    module: "pos",
    details: { orderId: order.id, orderNumber: order.orderNumber, total },
    ipAddress: req.ip,
  });

  res.status(201).json(formatOrder(order, insertedItems));
});

router.get("/orders/recent", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = GetRecentOrdersQueryParams.safeParse(req.query);
  const limit = (qp.success ? qp.data.limit : 10) ?? 10;

  const conditions = [eq(ordersTable.tenantId, claims.tenantId!)];

  // Enforce branch limit or query branch filtering
  if (claims.role !== "owner" && claims.role !== "super_admin") {
    const [emp] = await db.select({ branchId: employeesTable.branchId }).from(employeesTable).where(eq(employeesTable.userId, claims.userId)).limit(1);
    if (emp && emp.branchId) {
      conditions.push(eq(ordersTable.branchId, emp.branchId));
    }
  } else if (req.query.branchId) {
    conditions.push(eq(ordersTable.branchId, Number(req.query.branchId)));
  }

  const orders = await db.select().from(ordersTable)
    .where(and(...conditions))
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

  const [userRec] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));

  if (body.data.status === "refunded") {
    // Log refund order activity
    await logActivity({
      tenantId: claims.tenantId,
      userId: claims.userId,
      userName: userRec?.name || "Manager/Owner",
      userRole: claims.role,
      action: "refund_order",
      module: "orders",
      details: { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total) },
      ipAddress: req.ip,
    });
  } else {
    await logActivity({
      tenantId: claims.tenantId,
      userId: claims.userId,
      userName: userRec?.name || "User",
      userRole: claims.role,
      action: "update_order_status",
      module: "orders",
      details: { orderId: order.id, orderNumber: order.orderNumber, status: body.data.status },
      ipAddress: req.ip,
    });
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

export default router;
