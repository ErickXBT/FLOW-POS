import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc, inArray, ilike } from "drizzle-orm";
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

  let customerId = body.data.customerId ?? null;
  const rawData = req.body.data || req.body;
  const phone = rawData.customerPhone;
  
  if (!customerId && phone) {
    const [cust] = await db.select().from(customersTable)
      .where(and(eq(customersTable.phone, phone), eq(customersTable.tenantId, claims.tenantId!)))
      .limit(1);
    if (cust) {
      customerId = cust.id;
    }
  }

  let customerName: string | null = null;
  let isClaimReward = false;
  let customerRecord = null;
  if (customerId) {
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (cust) {
      customerName = cust.name;
      customerRecord = cust;
      if (cust.claimedDiscountActive) {
        isClaimReward = true;
      }
    }
  }

  const orderNum = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const subtotal = body.data.subtotal ?? body.data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = body.data.discount ?? 0;
  let tax = body.data.tax ?? 0;


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

  const itemInputs = body.data.items;
  const productIds = itemInputs.map(i => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(and(inArray(productsTable.id, productIds), eq(productsTable.tenantId, claims.tenantId!)))
    : [];
  const productMap = products.reduce((m: any, p) => { m[p.id] = p; return m; }, {});

  if (isClaimReward && discount === 0) {
    if (customerRecord?.activeReward === "grand_reward") {
      // Fetch categories to identify drinks
      const drinksCategoryIds = (await db.select().from(categoriesTable)
        .where(and(
          eq(categoriesTable.tenantId, claims.tenantId!),
          sql`name ILIKE '%minuman%' OR name ILIKE '%drink%' OR name ILIKE '%beverage%' OR name ILIKE '%coffee%' OR name ILIKE '%tea%' OR name ILIKE '%kopi%'`
        )))
        .map(c => c.id);

      const drinkPrices: number[] = [];
      const toastPrices: number[] = [];

      for (const item of itemInputs) {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const isDrink = (prod.categoryId && drinksCategoryIds.includes(prod.categoryId)) ||
                          /kopi|teh|tea|latte|americano|cappuccino|jus|juice|es |drink|beverage|coffee/i.test(prod.name);
          const isToast = !/kopi|teh|tea|latte|americano|cappuccino|jus|juice|es |drink|beverage|coffee/i.test(prod.name) &&
                          /roti|toast|bakar/i.test(prod.name);
          const price = Number(item.price);

          if (isDrink) {
            for (let q = 0; q < item.quantity; q++) {
              drinkPrices.push(price);
            }
          } else if (isToast) {
            for (let q = 0; q < item.quantity; q++) {
              toastPrices.push(price);
            }
          }
        }
      }

      drinkPrices.sort((a, b) => b - a);
      toastPrices.sort((a, b) => b - a);

      const freeDrinkDiscount = drinkPrices.length > 0 ? drinkPrices[0] : 0;
      const freeToastDiscount = toastPrices.length > 0 ? toastPrices[0] : 0;

      discount = freeDrinkDiscount + freeToastDiscount;
    } else {
      let discountPercent = 0.1;
      if (customerRecord?.activeReward === "discount_20") discountPercent = 0.2;
      else if (customerRecord?.activeReward === "discount_30") discountPercent = 0.3;
      else if (customerRecord?.activeReward === "discount_40") discountPercent = 0.4;
      else if (customerRecord?.activeReward === "discount_50") discountPercent = 0.5;

      discount = subtotal * discountPercent;
    }
  }

  let orderNotesWithReward = body.data.notes ?? null;
  if (isClaimReward && customerRecord && customerRecord.activeReward) {
    const rewardTag = `[REWARD:${customerRecord.activeReward}]`;
    orderNotesWithReward = orderNotesWithReward
      ? `${orderNotesWithReward} ${rewardTag}`
      : rewardTag;
  }

  const total = body.data.total ?? (subtotal - discount + tax);

  // Calculate prep time and other shift / priority metrics
  const maxPrepTime = products.length > 0 ? Math.max(...products.map(p => (p as any).prepTime || 5)) : 5;
  const totalItemsCount = itemInputs.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedPrepTime = maxPrepTime + (totalItemsCount - 1) * 1;

  const estimatedTime = req.body.estimatedTime || req.body.data?.estimatedTime || calculatedPrepTime;
  const priority = req.body.priority || req.body.data?.priority || "normal";
  const shiftId = req.body.shiftId ? Number(req.body.shiftId) : (req.body.data?.shiftId ? Number(req.body.data.shiftId) : null);

  const [order] = await db.insert(ordersTable).values({
    orderNumber: orderNum,
    subtotal: String(subtotal),
    discount: String(discount),
    tax: String(tax),
    total: String(total),
    status: "completed",
    paymentMethod: body.data.paymentMethod,
    notes: orderNotesWithReward,
    customerId: customerId,
    customerName,
    employeeId,
    employeeName,
    tenantId: claims.tenantId!,
    branchId,
    shiftId,
    isClaimReward: isClaimReward,
  }).returning();

  const insertedItems = await db.insert(orderItemsTable).values(
    itemInputs.map(i => ({
      orderId: order.id,
      productId: i.productId,
      productName: productMap[i.productId]?.name ?? String(i.productId),
      quantity: i.quantity,
      price: String(i.price),
      subtotal: String(i.price * i.quantity),
      variantSelection: i.variantSelection ?? null,
      notes: i.notes ?? null,
    }))
  ).returning();

  // Also create a corresponding order in customerOrdersTable for kitchen (KDS) & delivery tracking
  try {
    const rawData = req.body.data || req.body;
    const { orderType, customerPhone, tableNumber, deliveryAddress, customerName: posCustomerName } = rawData;
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
      notes: orderNotesWithReward,
      employeeId,
      employeeName,
      priority,
      estimatedTime,
      isClaimReward: isClaimReward,
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

  if (customerId) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId!));
    const pointsPerItem = (tenant?.pointSystemConfig as any)?.pointsPerItem ?? 10;
    const totalItems = itemInputs.reduce((sum, item) => sum + item.quantity, 0);
    const pointsEarned = totalItems * pointsPerItem;

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
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
          claimedDiscountActive: false,
          activeReward: null,
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, customerId));
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

router.patch("/orders/:id/void", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const orderId = Number(req.params.id);
  const { voidReason } = req.body;
  if (!voidReason) {
    res.status(400).json({ error: "Sebab void wajib diisi" });
    return;
  }

  // Find order
  const [existingOrder] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.tenantId, claims.tenantId!)))
    .limit(1);

  if (!existingOrder) {
    res.status(404).json({ error: "Order tidak ditemukan" });
    return;
  }

  let voidedByName = "Owner";
  const [userRec] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId)).limit(1);
  if (userRec) {
    voidedByName = userRec.name;
  }

  const [order] = await db.update(ordersTable)
    .set({
      status: "void",
      voidReason,
      voidedBy: claims.userId,
      voidedByName,
      voidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, orderId))
    .returning();

  // Also update corresponding customerOrdersTable status to "cancelled"
  await db.update(customerOrdersTable)
    .set({
      status: "cancelled",
      notes: sql`COALESCE(notes, '') || ' (Voided: ' || ${voidReason} || ')'`,
      updatedAt: new Date(),
    })
    .where(and(eq(customerOrdersTable.orderNumber, order.orderNumber), eq(customerOrdersTable.tenantId, claims.tenantId!)));

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: voidedByName,
    userRole: claims.role,
    action: "void_order",
    module: "orders",
    details: { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), voidReason },
    ipAddress: req.ip,
  });

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

export default router;
