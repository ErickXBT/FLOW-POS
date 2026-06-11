import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";
import {
  db, tenantsTable, categoriesTable, productsTable,
  customerOrdersTable, customerOrderItemsTable, tableQrCodesTable,
  publicMenusTable, branchesTable, customerSessionsTable, customerCartsTable,
  publicMenuCategoriesTable, publicMenuProductsTable,
} from "@workspace/db";
import { extractToken } from "./auth";

const router: IRouter = Router();

type SseClient = { id: string; tenantId: number; res: any };
const sseClients: SseClient[] = [];

export function broadcastNewOrder(tenantId: number, order: any) {
  const clients = sseClients.filter(c => c.tenantId === tenantId);
  const data = `data: ${JSON.stringify({ type: "new_order", order })}\n\n`;
  clients.forEach(c => { try { c.res.write(data); } catch {} });
}

export function broadcastStatusUpdate(tenantId: number, orderId: number, status: string) {
  const clients = sseClients.filter(c => c.tenantId === tenantId);
  const data = `data: ${JSON.stringify({ type: "status_update", orderId, status })}\n\n`;
  clients.forEach(c => { try { c.res.write(data); } catch {} });
}

function formatCustomerOrder(order: any, items: any[]) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    total: Number(order.total),
    deliveryFee: Number(order.deliveryFee ?? 0),
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    items: items.map(i => ({
      ...i,
      price: Number(i.price),
      subtotal: Number(i.subtotal),
    })),
  };
}

// ── SSE stream for realtime notifications ─────────────────────────────────────
// Supports token via query param for EventSource compatibility
router.get("/tenant/orders/events", (req, res) => {
  const tokenFromQuery = req.query.token as string | undefined;
  const authHeader = req.headers.authorization;
  const token = tokenFromQuery ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  let claims: ReturnType<typeof extractToken> = null;
  if (token) {
    const { verifyToken } = require("./auth");
    claims = verifyToken(token);
  }
  if (!claims || !claims.tenantId) { res.status(401).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = `${claims.tenantId}-${Date.now()}`;
  const client: SseClient = { id: clientId, tenantId: claims.tenantId, res };
  sseClients.push(client);
  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

  const heartbeat = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch {} }, 30000);
  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// ── Public menu ───────────────────────────────────────────────────────────────

router.get("/menu/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const branchIdParam = req.query.branch_id ? Number(req.query.branch_id) : null;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant || tenant.status === "suspended") {
    res.status(404).json({ error: "Menu tidak ditemukan" }); return;
  }

  // Find active menu
  let menu = null;
  if (branchIdParam) {
    [menu] = await db.select().from(publicMenusTable)
      .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.branchId, branchIdParam), eq(publicMenusTable.isActive, true)));
  } else {
    [menu] = await db.select().from(publicMenusTable)
      .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.isActive, true)))
      .limit(1);
  }

  // Find branch
  let branch = null;
  if (menu) {
    [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, menu.branchId));
  } else {
    const branches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenant.id)).limit(1);
    if (branches.length > 0) {
      branch = branches[0];
    }
  }

  res.json({
    tenant: {
      id: tenant.id, name: tenant.name, slug: tenant.slug,
      businessType: tenant.businessType, address: tenant.address, phone: tenant.phone,
      logoUrl: tenant.logoUrl, primaryColor: tenant.primaryColor ?? "#1D4EF5",
      bannerUrl: (tenant as any).bannerUrl ?? null,
      coverUrl: tenant.coverUrl ?? null,
      bio: tenant.bio ?? null,
      deliveryFeeNear: tenant.deliveryFeeNear !== undefined ? Number(tenant.deliveryFeeNear) : 0,
      deliveryFeeFar: tenant.deliveryFeeFar !== undefined ? Number(tenant.deliveryFeeFar) : 5000,
      enableDineIn: (tenant as any).enableDineIn ?? true,
      enableTakeAway: (tenant as any).enableTakeAway ?? true,
      enableDelivery: (tenant as any).enableDelivery ?? false,
      enableCash: (tenant as any).enableCash ?? true,
      enableQris: (tenant as any).enableQris ?? true,
      enableBankTransfer: (tenant as any).enableBankTransfer ?? false,
      enableEwallet: (tenant as any).enableEwallet ?? false,
      showVariants: (tenant as any).showVariants ?? true,
      showToppings: (tenant as any).showToppings ?? true,
    },
    branch: branch ? {
      id: branch.id,
      name: branch.name,
    } : null,
    menu: menu ? {
      id: menu.id,
      name: menu.name,
      logoUrl: menu.logoUrl,
      bannerUrl: menu.bannerUrl,
      themeSettings: menu.themeSettings,
      enableDineIn: menu.enableDineIn,
      enableTakeAway: menu.enableTakeAway,
      enableDelivery: menu.enableDelivery,
      estimatedDeliveryTime: menu.estimatedDeliveryTime,
      isActive: menu.isActive,
    } : null,
  });
});

router.post("/menu/:slug/sessions/init", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const { qrCode, branchId, tableId } = req.body;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

  const activeBranchId = Number(branchId);
  const sessionId = crypto.randomBytes(16).toString("hex");
  const menuSessionId = crypto.randomBytes(16).toString("hex");

  // Expiry in 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const [session] = await db.insert(customerSessionsTable).values({
    tenantId: tenant.id,
    branchId: activeBranchId,
    sessionId,
    menuSessionId,
    tableId: tableId ? String(tableId) : null,
    isActive: true,
    expiresAt,
  }).returning();

  res.json({
    menuSessionId: session.menuSessionId,
    tableId: session.tableId,
  });
});

router.get("/menu/:slug/cart", async (req, res): Promise<void> => {
  const { menu_session_id } = req.query;
  if (!menu_session_id) { res.status(400).json({ error: "menu_session_id diperlukan" }); return; }

  const [session] = await db.select().from(customerSessionsTable)
    .where(and(eq(customerSessionsTable.menuSessionId, String(menu_session_id)), eq(customerSessionsTable.isActive, true)));
  if (!session) { res.json({ cartData: [] }); return; }

  const [cart] = await db.select().from(customerCartsTable)
    .where(eq(customerCartsTable.customerSessionId, session.id));

  if (!cart) {
    res.json({ cartData: [] });
  } else {
    try {
      res.json({ cartData: JSON.parse(cart.cartData) });
    } catch {
      res.json({ cartData: [] });
    }
  }
});

router.post("/menu/:slug/cart", async (req, res): Promise<void> => {
  const { menuSessionId, cartData } = req.body;
  if (!menuSessionId) { res.status(400).json({ error: "menuSessionId diperlukan" }); return; }

  const [session] = await db.select().from(customerSessionsTable)
    .where(and(eq(customerSessionsTable.menuSessionId, menuSessionId), eq(customerSessionsTable.isActive, true)));
  if (!session) { res.status(404).json({ error: "Sesi tidak ditemukan atau kedaluwarsa" }); return; }

  const cartJson = JSON.stringify(cartData || []);

  const [existingCart] = await db.select().from(customerCartsTable)
    .where(eq(customerCartsTable.customerSessionId, session.id));

  if (existingCart) {
    await db.update(customerCartsTable)
      .set({ cartData: cartJson, updatedAt: new Date() })
      .where(eq(customerCartsTable.id, existingCart.id));
  } else {
    await db.insert(customerCartsTable).values({
      tenantId: session.tenantId,
      branchId: session.branchId,
      customerSessionId: session.id,
      cartData: cartJson,
    });
  }

  res.json({ success: true });
});

router.get("/menu/:slug/products", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

  let categories: any[] = [];
  let products: any[] = [];

  if (branchId) {
    const [menu] = await db.select().from(publicMenusTable)
      .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.branchId, branchId), eq(publicMenusTable.isActive, true)));
    
    if (menu) {
      categories = await db.select().from(publicMenuCategoriesTable)
        .where(eq(publicMenuCategoriesTable.publicMenuId, menu.id))
        .orderBy(publicMenuCategoriesTable.sortOrder);
      
      if (categories.length > 0) {
        const catIds = categories.map(c => c.id);
        products = await db.select().from(publicMenuProductsTable)
          .where(and(inArray(publicMenuProductsTable.publicMenuCategoryId, catIds), eq(publicMenuProductsTable.isAvailable, true)))
          .orderBy(publicMenuProductsTable.name);
      }
    }
  }

  if (categories.length === 0) {
    const stdCats = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.tenantId, tenant.id))
      .orderBy(categoriesTable.name);
    
    categories = stdCats.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
    }));

    const stdProds = await db.select().from(productsTable)
      .where(and(eq(productsTable.tenantId, tenant.id), eq(productsTable.isActive, true)))
      .orderBy(productsTable.name);

    products = stdProds.map(p => ({
      id: p.id,
      productId: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      promoPrice: null,
      imageUrl: p.imageUrl,
      isAvailable: p.isActive,
      stock: p.stock,
      variantSettings: p.variantSettings,
      publicMenuCategoryId: p.categoryId,
      isBestSeller: p.isBestSeller,
    }));
  } else {
    categories = categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
    }));

    products = products.map(p => ({
      id: p.id,
      productId: p.productId,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      promoPrice: p.promoPrice ? Number(p.promoPrice) : null,
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
      stock: p.stock,
      variantSettings: p.variantSettings,
      publicMenuCategoryId: p.publicMenuCategoryId,
      isBestSeller: false,
    }));
  }

  res.json({ categories, products });
});

router.post("/menu/:slug/orders", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant || tenant.status === "suspended") {
    res.status(404).json({ error: "Menu tidak ditemukan" }); return;
  }

  const { branchId, orderType, customerName, customerPhone, tableNumber,
    deliveryAddress, deliveryNotes, deliveryFee, paymentMethod, items, notes } = req.body;

  if (!customerName || !items || items.length === 0) {
    res.status(400).json({ error: "Nama pelanggan dan item pesanan wajib diisi" }); return;
  }

  let activeBranchId = Number(branchId);
  if (!activeBranchId) {
    const branches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenant.id)).limit(1);
    if (branches.length > 0) {
      activeBranchId = branches[0].id;
    } else {
      res.status(400).json({ error: "Tenant tidak memiliki cabang terdaftar" });
      return;
    }
  }

  const productIds = items.map((i: any) => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable)
        .where(and(inArray(productsTable.id, productIds), eq(productsTable.tenantId, tenant.id)))
    : [];
  const productMap = products.reduce((m: any, p) => { m[p.id] = p; return m; }, {});

  let subtotal = 0;
  const orderItems = items.map((i: any) => {
    const product = productMap[i.productId];
    const price = product ? Number(product.price) : Number(i.price ?? 0);
    const itemSubtotal = price * i.quantity;
    subtotal += itemSubtotal;
    return { productId: i.productId, productName: product?.name ?? String(i.productId), quantity: i.quantity, price: String(price), subtotal: String(itemSubtotal), notes: i.notes ?? null };
  });

  const fee = Number(deliveryFee ?? 0);
  const total = subtotal + fee;
  const orderNum = `MENU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const [order] = await db.insert(customerOrdersTable).values({
    orderNumber: orderNum, tenantId: tenant.id, branchId: activeBranchId,
    orderType: orderType ?? "dine_in", customerName,
    customerPhone: customerPhone ?? null, tableNumber: tableNumber ?? null,
    deliveryAddress: deliveryAddress ?? null, deliveryNotes: deliveryNotes ?? null,
    deliveryFee: String(fee), paymentMethod: paymentMethod ?? "cash",
    subtotal: String(subtotal), discount: "0", tax: "0", total: String(total),
    status: "pending", notes: notes ?? null,
  }).returning();

  const insertedItems = await db.insert(customerOrderItemsTable)
    .values(orderItems.map((i: any) => ({ ...i, customerOrderId: order.id, tenantId: tenant.id, branchId: activeBranchId }))).returning();

  const formatted = formatCustomerOrder(order, insertedItems);
  broadcastNewOrder(tenant.id, formatted);
  res.status(201).json(formatted);
});

router.get("/menu/:slug/orders/:id", async (req, res): Promise<void> => {
  const { slug, id } = req.params;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

  const [order] = await db.select().from(customerOrdersTable)
    .where(and(eq(customerOrdersTable.id, Number(id)), eq(customerOrdersTable.tenantId, tenant.id)));
  if (!order) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  const items = await db.select().from(customerOrderItemsTable)
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));
  res.json(formatCustomerOrder(order, items));
});

// ── Authenticated: customer orders management ─────────────────────────────────

router.get("/tenant/customer-orders", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { status, limit: limitQ, page: pageQ } = req.query as any;
  const limit = Math.min(Number(limitQ ?? 50), 100);
  const page = Number(pageQ ?? 1);
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(customerOrdersTable.tenantId, claims.tenantId)];
  if (status) conditions.push(eq(customerOrdersTable.status, status));

  const orders = await db.select().from(customerOrdersTable)
    .where(and(...conditions)).orderBy(desc(customerOrdersTable.createdAt))
    .limit(limit).offset(offset);

  const orderIds = orders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select().from(customerOrderItemsTable)
        .where(inArray(customerOrderItemsTable.customerOrderId, orderIds))
    : [];

  const itemsByOrder = items.reduce((acc: any, item) => {
    if (!acc[item.customerOrderId]) acc[item.customerOrderId] = [];
    acc[item.customerOrderId].push(item);
    return acc;
  }, {});

  res.json({ data: orders.map(o => formatCustomerOrder(o, itemsByOrder[o.id] ?? [])), total: orders.length, page, limit });
});

router.get("/tenant/customer-orders/:id", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = Number(req.params.id);
  const [order] = await db.select().from(customerOrdersTable)
    .where(and(eq(customerOrdersTable.id, orderId), eq(customerOrdersTable.tenantId, claims.tenantId)));
  if (!order) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  const items = await db.select().from(customerOrderItemsTable)
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));

  res.json(formatCustomerOrder(order, items));
});

router.patch("/tenant/customer-orders/:id/status", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = Number(req.params.id);
  const { status } = req.body;
  if (!status) { res.status(400).json({ error: "Status diperlukan" }); return; }

  const [order] = await db.update(customerOrdersTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(customerOrdersTable.id, orderId), eq(customerOrdersTable.tenantId, claims.tenantId)))
    .returning();
  if (!order) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  broadcastStatusUpdate(claims.tenantId, orderId, status);
  const items = await db.select().from(customerOrderItemsTable)
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));
  res.json(formatCustomerOrder(order, items));
});

// ── QR codes management ───────────────────────────────────────────────────────

router.get("/tenant/qr-codes", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId));
  const qrCodes = await db.select().from(tableQrCodesTable)
    .where(eq(tableQrCodesTable.tenantId, claims.tenantId))
    .orderBy(tableQrCodesTable.tableNumber);

  res.json({ slug: tenant?.slug ?? null, qrCodes });
});

router.post("/tenant/qr-codes", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { tableNumber, label } = req.body;
  if (!tableNumber) { res.status(400).json({ error: "Nomor meja diperlukan" }); return; }

  const [qr] = await db.insert(tableQrCodesTable).values({
    tenantId: claims.tenantId, tableNumber: String(tableNumber),
    label: label ?? null, isActive: true,
  }).returning();
  res.status(201).json(qr);
});

router.delete("/tenant/qr-codes/:id", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.delete(tableQrCodesTable)
    .where(and(eq(tableQrCodesTable.id, Number(req.params.id)), eq(tableQrCodesTable.tenantId, claims.tenantId)));
  res.json({ success: true });
});

// ── Tenant menu settings (slug + order types + payments) ──────────────────────

router.patch("/tenant/settings", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const allowed = [
    "slug", "enableDineIn", "enableTakeAway", "enableDelivery",
    "enableCash", "enableQris", "enableBankTransfer", "enableEwallet",
    "showVariants", "showToppings",
  ];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Tidak ada yang diubah" }); return; }

  if (updates.slug) {
    updates.slug = String(updates.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, updates.slug));
    if (existing.length > 0 && existing[0].id !== claims.tenantId) {
      res.status(409).json({ error: "Slug sudah digunakan" }); return;
    }
  }

  const [tenant] = await db.update(tenantsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tenantsTable.id, claims.tenantId))
    .returning();
  res.json(tenant);
});

export default router;
