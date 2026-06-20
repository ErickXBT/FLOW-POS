import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customersTable, employeesTable, usersTable, branchesTable, customerOrdersTable, customerOrderItemsTable, tenantsTable, publicMenuProductsTable, publicMenusTable, publicMenuCategoriesTable, categoriesTable } from "@workspace/db";
import { broadcastNewOrder } from "./menu";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetRecentOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

export async function deductBranchStock(tenantId: number, branchId: number, productId: number, quantity: number) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) return;

  let [menu] = await db.select().from(publicMenusTable)
    .where(and(eq(publicMenusTable.branchId, branchId), eq(publicMenusTable.tenantId, tenantId)))
    .limit(1);
  if (!menu) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const slug = tenant ? `${tenant.slug}-${branchId}` : `branch-${branchId}`;
    [menu] = await db.insert(publicMenusTable).values({
      tenantId,
      branchId,
      slug,
      name: tenant?.name || "Cabang",
      isActive: true,
      enableDineIn: true,
      enableTakeAway: true,
      enableDelivery: true,
    }).returning();
  }

  let publicMenuCategoryId: number;
  if (product.categoryId) {
    const [globalCat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);
    const catName = globalCat?.name || "Kategori";
    
    let [menuCat] = await db.select().from(publicMenuCategoriesTable)
      .where(and(
        eq(publicMenuCategoriesTable.publicMenuId, menu.id),
        eq(publicMenuCategoriesTable.name, catName)
      ))
      .limit(1);
    if (!menuCat) {
      [menuCat] = await db.insert(publicMenuCategoriesTable).values({
        tenantId,
        branchId,
        publicMenuId: menu.id,
        name: catName,
        sortOrder: 0,
      }).returning();
    }
    publicMenuCategoryId = menuCat.id;
  } else {
    let [menuCat] = await db.select().from(publicMenuCategoriesTable)
      .where(and(
        eq(publicMenuCategoriesTable.publicMenuId, menu.id),
        eq(publicMenuCategoriesTable.name, "Umum")
      ))
      .limit(1);
    if (!menuCat) {
      [menuCat] = await db.insert(publicMenuCategoriesTable).values({
        tenantId,
        branchId,
        publicMenuId: menu.id,
        name: "Umum",
        sortOrder: 0,
      }).returning();
    }
    publicMenuCategoryId = menuCat.id;
  }

  const [branchProd] = await db.select().from(publicMenuProductsTable)
    .where(and(
      eq(publicMenuProductsTable.productId, productId),
      eq(publicMenuProductsTable.branchId, branchId)
    ))
    .limit(1);

  if (branchProd) {
    await db.execute(sql`
      UPDATE public_menu_products 
      SET stock = stock - ${quantity} 
      WHERE id = ${branchProd.id}
    `);
  } else {
    const initialStock = Math.max(0, product.stock - quantity);
    await db.insert(publicMenuProductsTable).values({
      tenantId,
      branchId,
      publicMenuCategoryId,
      productId,
      name: product.name,
      description: product.description,
      price: String(product.price),
      promoPrice: null,
      imageUrl: product.imageUrl,
      isAvailable: product.isActive,
      stock: initialStock,
      variantSettings: product.variantSettings,
    });
  }
}

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

  const branchId = await getRequestedBranchId(req, claims);
  if (branchId) {
    conditions.push(eq(ordersTable.branchId, branchId));
  }

  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(ordersTable).where(where);
  const ordersWithBranch = await db.select({
    order: ordersTable,
    branchName: branchesTable.name
  })
  .from(ordersTable)
  .leftJoin(branchesTable, eq(ordersTable.branchId, branchesTable.id))
  .where(where)
  .orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);

  const orders = ordersWithBranch.map(owb => ({
    ...owb.order,
    branchName: owb.branchName
  }));

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

  // If owner checkout or not resolved, find the first branch of the tenant
  if (!branchId && claims.tenantId) {
    const [firstBranch] = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.tenantId, claims.tenantId)).limit(1);
    if (firstBranch) branchId = firstBranch.id;
  }

  if (branchId) {
    const [br] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
    if (br && br.status === "locked") {
      res.status(403).json({ error: "Cabang ini dinonaktifkan (terkunci) karena melampaui batas paket langganan. Silakan hubungi admin untuk upgrade paket." });
      return;
    }
  }

  // Resolve employee name
  let employeeName = req.body.employeeName;
  let employeeId = req.body.employeeId || body.data.employeeId || null;

  if (!employeeName) {
    if (employeeId) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
      if (emp) {
        employeeName = emp.name;
      }
    }
  }

  if (!employeeName) {
    const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId!)).limit(1);
    employeeName = (t as any)?.defaultCashierName || "Kasir Utama";
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
    employeeId,
    employeeName,
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
      employeeId,
      employeeName,
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
    if (branchId) {
      await deductBranchStock(claims.tenantId!, branchId, item.productId, item.quantity);
    } else {
      await db.execute(sql`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${claims.tenantId}`);
    }
  }

  if (body.data.customerId) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId!));
    const pointsPerItem = (tenant?.pointSystemConfig as any)?.pointsPerItem ?? 10;
    const totalItems = itemInputs.reduce((sum, item) => sum + item.quantity, 0);
    const pointsEarned = totalItems * pointsPerItem;

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, body.data.customerId));
    if (customer) {
      const newPoints = customer.loyaltyPoints + pointsEarned;
      const getMembershipLevel = (pts: number) => {
        if (pts >= 1000) return "platinum";
        if (pts >= 500) return "gold";
        if (pts >= 100) return "silver";
        return "regular";
      };
      const newLevel = getMembershipLevel(newPoints);

      await db.update(customersTable)
        .set({
          totalSpent: String(Number(customer.totalSpent) + total),
          totalOrders: customer.totalOrders + 1,
          loyaltyPoints: newPoints,
          membershipLevel: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, body.data.customerId));
    }
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

  const branchId = await getRequestedBranchId(req, claims);
  if (branchId) {
    conditions.push(eq(ordersTable.branchId, branchId));
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

  const [orderWithBranch] = await db.select({
    order: ordersTable,
    branchName: branchesTable.name
  })
  .from(ordersTable)
  .leftJoin(branchesTable, eq(ordersTable.branchId, branchesTable.id))
  .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.tenantId, claims.tenantId!)))
  .limit(1);

  if (!orderWithBranch) { res.status(404).json({ error: "Order not found" }); return; }

  const order = {
    ...orderWithBranch.order,
    branchName: orderWithBranch.branchName
  };

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
