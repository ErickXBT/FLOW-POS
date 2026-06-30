import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray, ilike, or } from "drizzle-orm";
import crypto from "crypto";
import {
  db, tenantsTable, categoriesTable, productsTable,
  customerOrdersTable, customerOrderItemsTable, tableQrCodesTable,
  publicMenusTable, branchesTable, customerSessionsTable, customerCartsTable,
  publicMenuCategoriesTable, publicMenuProductsTable, branchSettingsTable,
  customersTable, usersTable, employeesTable,
} from "@workspace/db";
import { extractToken, getRequestedBranchId } from "./auth";
import { deductBranchStock } from "./orders";

const router: IRouter = Router();

type SseClient = { id: string; tenantId: number; res: any };
const sseClients: SseClient[] = [];

export function broadcastNewOrder(tenantId: number, order: any) {
  const clients = sseClients.filter(c => c.tenantId === tenantId);
  const data = `data: ${JSON.stringify({ type: "new_order", order })}\n\n`;
  clients.forEach(c => { try { c.res.write(data); } catch {} });
}

export function broadcastStatusUpdate(tenantId: number, orderId: number, status: string, paymentStatus?: string) {
  const clients = sseClients.filter(c => c.tenantId === tenantId);
  const data = `data: ${JSON.stringify({ type: "status_update", orderId, status, paymentStatus })}\n\n`;
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
    serviceCharge: Number(order.serviceCharge || 0),
    cashReceived: Number(order.cashReceived || 0),
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

async function resolveTenantAndMenu(slug: string, branchIdParam?: number | null) {
  // 1. Try to find the public menu by slug directly
  let [menu] = await db.select().from(publicMenusTable)
    .where(and(eq(publicMenusTable.slug, slug), eq(publicMenusTable.isActive, true)))
    .limit(1);

  let tenant = null;
  let branch = null;

  if (menu) {
    [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, menu.tenantId)).limit(1);
    
    // If a branchIdParam was explicitly passed, override the branch and find the menu for that branch
    if (branchIdParam && branchIdParam !== menu.branchId) {
      const [customBranch] = await db.select().from(branchesTable)
        .where(and(eq(branchesTable.id, branchIdParam), eq(branchesTable.tenantId, tenant.id)))
        .limit(1);
      if (customBranch) {
        branch = customBranch;
        // Find menu for this specific branch
        const [branchMenu] = await db.select().from(publicMenusTable)
          .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.branchId, branch.id), eq(publicMenusTable.isActive, true)))
          .limit(1);
        if (branchMenu) {
          menu = branchMenu;
        }
      }
    }
    
    if (!branch) {
      [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, menu.branchId)).limit(1);
    }

    return { tenant, menu, branch };
  }

  // 2. Fall back to finding tenant by slug
  [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug)).limit(1);
  if (tenant) {
    const activeBranchId = branchIdParam;
    if (activeBranchId) {
      [branch] = await db.select().from(branchesTable)
        .where(and(eq(branchesTable.id, activeBranchId), eq(branchesTable.tenantId, tenant.id)))
        .limit(1);
    }
    if (!branch) {
      // Default to first branch
      const tenantBranches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenant.id)).limit(1);
      if (tenantBranches.length > 0) {
        branch = tenantBranches[0];
      }
    }

    if (branch) {
      // Find existing public menu for this branch
      [menu] = await db.select().from(publicMenusTable)
        .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.branchId, branch.id), eq(publicMenusTable.isActive, true)))
        .limit(1);

      // If no menu exists, create a default active public menu on-the-fly for this specific branch
      if (!menu) {
        const suffix = branch.name.toLowerCase() === "utama" ? "" : `-${branch.id}`;
        const [newMenu] = await db.insert(publicMenusTable).values({
          tenantId: tenant.id,
          branchId: branch.id,
          slug: `${tenant.slug}${suffix}`,
          name: `${tenant.name} - ${branch.name}`,
          isActive: true,
          enableDineIn: tenant.enableDineIn ?? true,
          enableTakeAway: tenant.enableTakeAway ?? true,
          enableDelivery: tenant.enableDelivery ?? false,
        }).returning();
        menu = newMenu;
      }
    }

    return { tenant, menu, branch };
  }

  return { tenant: null, menu: null, branch: null };
}

router.get("/menu/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const branchIdParam = req.query.branch_id ? Number(req.query.branch_id) : null;

  const { tenant, menu, branch } = await resolveTenantAndMenu(slug, branchIdParam);
  if (!tenant || tenant.status === "suspended" || tenant.status === "frozen" || !menu || !branch) {
    res.status(404).json({ error: "Menu tidak ditemukan" }); return;
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
      enableCustomerLogin: (tenant as any).enableCustomerLogin ?? false,
      enableTax: (tenant as any).enableTax ?? false,
      taxPercentage: tenant.taxPercentage !== undefined ? Number(tenant.taxPercentage) : 10,
      enableServiceCharge: (tenant as any).enableServiceCharge ?? false,
      serviceChargePercentage: (tenant as any).serviceChargePercentage !== undefined ? Number((tenant as any).serviceChargePercentage) : 10,
      pointSystemConfig: (tenant as any).pointSystemConfig ?? null,
      qrisId: (tenant as any).qrisId ?? null,
      qrisImageUrl: (tenant as any).qrisImageUrl ?? null,
      qrisPayload: (tenant as any).qrisPayload ?? null,
      showDeliveryInfo: (tenant as any).showDeliveryInfo ?? true,
      estimatedDeliveryTime: (tenant as any).estimatedDeliveryTime ?? "25-35 menit",
      enableOpsHours: (tenant as any).enableOpsHours ?? false,
      opsOpeningTime: (tenant as any).opsOpeningTime ?? "10:00",
      opsClosingTime: (tenant as any).opsClosingTime ?? "22:00",
      bankName: (tenant as any).bankName ?? null,
      bankAccountName: (tenant as any).bankAccountName ?? null,
      bankAccountNumber: (tenant as any).bankAccountNumber ?? null,
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

  const { tenant } = await resolveTenantAndMenu(slug);
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
  const { slug } = req.params;
  const { menu_session_id } = req.query;
  if (!menu_session_id) { res.status(400).json({ error: "menu_session_id diperlukan" }); return; }

  const { tenant } = await resolveTenantAndMenu(slug);
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

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
  const { slug } = req.params;
  const { menuSessionId, cartData } = req.body;
  if (!menuSessionId) { res.status(400).json({ error: "menuSessionId diperlukan" }); return; }

  const { tenant } = await resolveTenantAndMenu(slug);
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

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

  const { tenant } = await resolveTenantAndMenu(slug, branchId);
  if (!tenant) { res.status(404).json({ error: "Tenant tidak ditemukan" }); return; }

  // 1. Fetch all active global categories for this tenant
  const stdCats = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.tenantId, tenant.id))
    .orderBy(categoriesTable.name);

  // 2. Fetch all active global products for this tenant
  const stdProds = await db.select().from(productsTable)
    .where(and(eq(productsTable.tenantId, tenant.id), eq(productsTable.isActive, true)))
    .orderBy(productsTable.name);

  const categories = stdCats.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
  }));

  let products: any[] = [];

  if (branchId) {
    const [menu] = await db.select().from(publicMenusTable)
      .where(and(
        eq(publicMenusTable.tenantId, tenant.id),
        eq(publicMenusTable.branchId, branchId),
        eq(publicMenusTable.isActive, true)
      ))
      .limit(1);

    if (menu) {
      // Fetch branch-specific categories
      const customCats = await db.select().from(publicMenuCategoriesTable)
        .where(eq(publicMenuCategoriesTable.publicMenuId, menu.id));

      // Map customCategoryId -> globalCategoryId by name match
      const customToGlobalCatIdMap: Record<number, number> = {};
      for (const cCat of customCats) {
        const matchedGlobal = stdCats.find(gCat => gCat.name.toLowerCase() === cCat.name.toLowerCase());
        if (matchedGlobal) {
          customToGlobalCatIdMap[cCat.id] = matchedGlobal.id;
        }
      }

      // Fetch branch-specific product overrides
      const branchProds = await db.select().from(publicMenuProductsTable)
        .where(eq(publicMenuProductsTable.branchId, branchId));

      const branchProdMap = new Map<number, typeof publicMenuProductsTable.$inferSelect>();
      for (const bp of branchProds) {
        branchProdMap.set(bp.productId, bp);
      }

      for (const p of stdProds) {
        const bp = branchProdMap.get(p.id);
        if (bp) {
          // If explicitly marked unavailable for this branch, exclude it from menu
          if (bp.isAvailable === false) {
            continue;
          }
          const mappedCatId = customToGlobalCatIdMap[bp.publicMenuCategoryId] ?? p.categoryId;
          products.push({
            id: bp.id,
            productId: p.id,
            name: bp.name || p.name,
            description: bp.description || p.description,
            price: Number(bp.price),
            promoPrice: bp.promoPrice ? Number(bp.promoPrice) : null,
            imageUrl: bp.imageUrl || p.imageUrl,
            isAvailable: bp.isAvailable,
            stock: bp.stock,
            variantSettings: bp.variantSettings || p.variantSettings,
            publicMenuCategoryId: mappedCatId,
            isBestSeller: p.isBestSeller,
          });
        } else {
          // No override exists, use global active product directly
          products.push({
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
          });
        }
      }
    } else {
      // Menu not found, use global active products directly
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
    }
  } else {
    // No branchId provided, use global active products directly
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
  }

  res.json({ categories, products });
});

router.post("/menu/:slug/orders", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const { branchId, orderType, customerName, customerPhone, tableNumber,
    deliveryAddress, deliveryNotes, deliveryFee, paymentMethod, items, notes } = req.body;

  const { tenant } = await resolveTenantAndMenu(slug, branchId ? Number(branchId) : null);
  if (!tenant || tenant.status === "suspended" || tenant.status === "frozen") {
    res.status(404).json({ error: "Menu tidak ditemukan" }); return;
  }

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
    return { 
      productId: i.productId, 
      productName: product?.name ?? String(i.productId), 
      quantity: i.quantity, 
      price: String(price), 
      subtotal: String(itemSubtotal), 
      notes: i.notes ?? null,
      variantSelection: i.variantSelection ?? null
    };
  });
  const { customerId } = req.body;
  let isClaimReward = false;
  let discountAmount = 0;
  let finalCustomer = null;

  if (customerId) {
    const [cust] = await db.select().from(customersTable)
      .where(and(eq(customersTable.id, Number(customerId)), eq(customersTable.tenantId, tenant.id)));
    if (cust) {
      finalCustomer = cust;
      if (cust.claimedDiscountActive) {
        isClaimReward = true;
        if (cust.activeReward === "grand_reward") {
          // Grand Reward: Free 1 Minuman & 1 Toast
          // Fetch categories of this tenant to identify drinks
          const drinksCategoryIds = (await db.select().from(categoriesTable)
            .where(and(
              eq(categoriesTable.tenantId, tenant.id),
              sql`name ILIKE '%minuman%' OR name ILIKE '%drink%' OR name ILIKE '%beverage%' OR name ILIKE '%coffee%' OR name ILIKE '%tea%' OR name ILIKE '%kopi%'`
            )))
            .map(c => c.id);

          const drinkPrices: number[] = [];
          const toastPrices: number[] = [];

          for (const item of orderItems) {
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

          discountAmount = freeDrinkDiscount + freeToastDiscount;
        } else {
          let discountPercent = 0.1;
          if (cust.activeReward === "discount_20") discountPercent = 0.2;
          else if (cust.activeReward === "discount_30") discountPercent = 0.3;
          else if (cust.activeReward === "discount_40") discountPercent = 0.4;
          else if (cust.activeReward === "discount_50") discountPercent = 0.5;

          discountAmount = subtotal * discountPercent;
        }
      }
    }
  }

  let orderNotesWithReward = notes ?? null;
  if (isClaimReward && finalCustomer && finalCustomer.activeReward) {
    const rewardTag = `[REWARD:${finalCustomer.activeReward}]`;
    orderNotesWithReward = orderNotesWithReward
      ? `${orderNotesWithReward} ${rewardTag}`
      : rewardTag;
  }

  const fee = Number(deliveryFee ?? 0);
  const enableServiceCharge = (tenant as any).enableServiceCharge ?? false;
  const serviceChargePercentage = enableServiceCharge ? Number((tenant as any).serviceChargePercentage ?? 10) : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const serviceChargeAmount = subtotalAfterDiscount * (serviceChargePercentage / 100);

  const enableTax = (tenant as any).enableTax ?? false;
  const taxPercentage = enableTax ? Number(tenant.taxPercentage ?? 10) : 0;
  const taxAmount = (subtotalAfterDiscount + serviceChargeAmount) * (taxPercentage / 100);

  const total = subtotalAfterDiscount + serviceChargeAmount + taxAmount + fee;
  const orderNum = `MENU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const maxPrepTime = products.length > 0 ? Math.max(...products.map(p => (p as any).prepTime || 5)) : 5;
  const totalItemsCount = orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const estimatedTime = maxPrepTime + (totalItemsCount - 1) * 1;

  const autoPaidMethods = ["qris", "bank_transfer", "ewallet"];
  const paymentStatus = autoPaidMethods.includes(paymentMethod ?? "cash") ? "paid" : "unpaid";

  const [order] = await db.insert(customerOrdersTable).values({
    orderNumber: orderNum, tenantId: tenant.id, branchId: activeBranchId,
    orderType: orderType ?? "dine_in", customerName,
    customerPhone: customerPhone ?? null, tableNumber: tableNumber ?? null,
    deliveryAddress: deliveryAddress ?? null, deliveryNotes: deliveryNotes ?? null,
    deliveryFee: String(fee), paymentMethod: paymentMethod ?? "cash",
    subtotal: String(subtotal), discount: String(discountAmount), tax: String(taxAmount),
    serviceCharge: String(serviceChargeAmount), total: String(total),
    status: "pending", paymentStatus, notes: orderNotesWithReward,
    priority: "normal",
    estimatedTime: estimatedTime,
    isClaimReward: isClaimReward,
  }).returning();

  const insertedItems = await db.insert(customerOrderItemsTable)
    .values(orderItems.map((i: any) => ({ ...i, customerOrderId: order.id, tenantId: tenant.id, branchId: activeBranchId }))).returning();

  const insertedItemsWithImage = insertedItems.map((i: any) => ({
    ...i,
    imageUrl: productMap[i.productId]?.imageUrl ?? null,
  }));

  // Deduct stock for online orders
  try {
    for (const item of items) {
      if (activeBranchId) {
        await deductBranchStock(tenant.id, activeBranchId, item.productId, item.quantity);
      } else {
        await db.execute(sql`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId} AND tenant_id = ${tenant.id}`);
      }
    }
  } catch (stockErr) {
    console.error("Failed to deduct stock for online order:", stockErr);
  }

  // Credit points and update stats for logged in customer
  if (finalCustomer) {
    const pointsPerItem = (tenant.pointSystemConfig as any)?.pointsPerItem ?? 10;
    const totalItems = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const pointsEarned = totalItems * pointsPerItem;
    const newPoints = finalCustomer.loyaltyPoints + pointsEarned;
    
    const getMembershipLevel = (pts: number) => {
      if (pts >= 1000) return "platinum";
      if (pts >= 500) return "gold";
      if (pts >= 100) return "silver";
      return "regular";
    };
    const newLevel = getMembershipLevel(newPoints);

    await db.update(customersTable)
      .set({
        totalSpent: String(Number(finalCustomer.totalSpent) + total),
        totalOrders: finalCustomer.totalOrders + 1,
        loyaltyPoints: newPoints,
        membershipLevel: newLevel,
        claimedDiscountActive: false,
        activeReward: null,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, finalCustomer.id));
  }

  const formatted = formatCustomerOrder(order, insertedItemsWithImage);
  broadcastNewOrder(tenant.id, formatted);
  res.status(201).json(formatted);
});

router.get("/menu/:slug/orders/:id", async (req, res): Promise<void> => {
  const { slug, id } = req.params;
  const { tenant } = await resolveTenantAndMenu(slug);
  if (!tenant) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

  const [orderWithBranch] = await db.select({
    order: customerOrdersTable,
    branchName: branchesTable.name
  })
  .from(customerOrdersTable)
  .leftJoin(branchesTable, eq(customerOrdersTable.branchId, branchesTable.id))
  .where(and(eq(customerOrdersTable.id, Number(id)), eq(customerOrdersTable.tenantId, tenant.id)))
  .limit(1);

  if (!orderWithBranch) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  const order = {
    ...orderWithBranch.order,
    branchName: orderWithBranch.branchName
  };

  const items = await db.select({
      id: customerOrderItemsTable.id,
      tenantId: customerOrderItemsTable.tenantId,
      branchId: customerOrderItemsTable.branchId,
      customerOrderId: customerOrderItemsTable.customerOrderId,
      productId: customerOrderItemsTable.productId,
      productName: customerOrderItemsTable.productName,
      quantity: customerOrderItemsTable.quantity,
      price: customerOrderItemsTable.price,
      subtotal: customerOrderItemsTable.subtotal,
      notes: customerOrderItemsTable.notes,
      variantSelection: customerOrderItemsTable.variantSelection,
      createdAt: customerOrderItemsTable.createdAt,
      imageUrl: productsTable.imageUrl,
    })
    .from(customerOrderItemsTable)
    .leftJoin(productsTable, eq(customerOrderItemsTable.productId, productsTable.id))
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));
  res.json(formatCustomerOrder(order, items));
});

// ── Authenticated: customer orders management ─────────────────────────────────

router.get("/tenant/customer-orders", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { status, limit: limitQ, page: pageQ, search, branchId: queryBranchId, employeeId, paymentMethod, isClaimReward, startDate, endDate } = req.query as any;
  const limit = Math.min(Number(limitQ ?? 20), 100);
  const page = Number(pageQ ?? 1);
  const offset = (page - 1) * limit;

  const conditions: any[] = [eq(customerOrdersTable.tenantId, claims.tenantId)];
  
  if (status) {
    if (status.includes(",")) {
      conditions.push(inArray(customerOrdersTable.status, status.split(",")));
    } else {
      conditions.push(eq(customerOrdersTable.status, status));
    }
  }

  // Handle branch filter
  const branchId = queryBranchId ? Number(queryBranchId) : await getRequestedBranchId(req, claims);
  if (branchId) {
    conditions.push(eq(customerOrdersTable.branchId, branchId));
  }

  // Cashier filter
  if (employeeId) {
    conditions.push(eq(customerOrdersTable.employeeId, Number(employeeId)));
  }

  // Payment method filter
  if (paymentMethod) {
    conditions.push(eq(customerOrdersTable.paymentMethod, paymentMethod));
  }

  // Promo/Reward filter
  if (isClaimReward === "true" || isClaimReward === "1") {
    conditions.push(eq(customerOrdersTable.isClaimReward, true));
  } else if (isClaimReward === "false" || isClaimReward === "0") {
    conditions.push(eq(customerOrdersTable.isClaimReward, false));
  }

  // Date range filters
  if (startDate) {
    conditions.push(sql`created_at >= ${new Date(startDate)}`);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(sql`created_at <= ${end}`);
  }

  // Search keyword (matches orderNumber or customerName)
  if (search && search.trim()) {
    const keyword = `%${search.trim()}%`;
    conditions.push(
      sql`(${customerOrdersTable.orderNumber} ILIKE ${keyword} OR ${customerOrdersTable.customerName} ILIKE ${keyword})`
    );
  }

  // Get total count of matching entries
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerOrdersTable)
    .where(and(...conditions));
  const total = Number(countResult?.count ?? 0);

  const ordersWithBranch = await db.select({
    order: customerOrdersTable,
    branchName: branchesTable.name
  })
  .from(customerOrdersTable)
  .leftJoin(branchesTable, eq(customerOrdersTable.branchId, branchesTable.id))
  .where(and(...conditions)).orderBy(desc(customerOrdersTable.createdAt))
  .limit(limit).offset(offset);

  const orders = ordersWithBranch.map(owb => ({
    ...owb.order,
    branchName: owb.branchName
  }));

  const orderIds = orders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select({
        id: customerOrderItemsTable.id,
        tenantId: customerOrderItemsTable.tenantId,
        branchId: customerOrderItemsTable.branchId,
        customerOrderId: customerOrderItemsTable.customerOrderId,
        productId: customerOrderItemsTable.productId,
        productName: customerOrderItemsTable.productName,
        quantity: customerOrderItemsTable.quantity,
        price: customerOrderItemsTable.price,
        subtotal: customerOrderItemsTable.subtotal,
        notes: customerOrderItemsTable.notes,
        variantSelection: customerOrderItemsTable.variantSelection,
        imageUrl: productsTable.imageUrl,
      })
      .from(customerOrderItemsTable)
      .leftJoin(productsTable, eq(customerOrderItemsTable.productId, productsTable.id))
      .where(inArray(customerOrderItemsTable.customerOrderId, orderIds))
    : [];

  const itemsByOrder = items.reduce((acc: any, item) => {
    if (!acc[item.customerOrderId]) acc[item.customerOrderId] = [];
    acc[item.customerOrderId].push(item);
    return acc;
  }, {});

  res.json({ data: orders.map(o => formatCustomerOrder(o, itemsByOrder[o.id] ?? [])), total, page, limit });
});

router.get("/tenant/customer-orders/:id", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = Number(req.params.id);
  const [orderWithBranch] = await db.select({
    order: customerOrdersTable,
    branchName: branchesTable.name
  })
  .from(customerOrdersTable)
  .leftJoin(branchesTable, eq(customerOrdersTable.branchId, branchesTable.id))
  .where(and(eq(customerOrdersTable.id, orderId), eq(customerOrdersTable.tenantId, claims.tenantId)))
  .limit(1);

  if (!orderWithBranch) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  const order = {
    ...orderWithBranch.order,
    branchName: orderWithBranch.branchName
  };

  const items = await db.select({
      id: customerOrderItemsTable.id,
      tenantId: customerOrderItemsTable.tenantId,
      branchId: customerOrderItemsTable.branchId,
      customerOrderId: customerOrderItemsTable.customerOrderId,
      productId: customerOrderItemsTable.productId,
      productName: customerOrderItemsTable.productName,
      quantity: customerOrderItemsTable.quantity,
      price: customerOrderItemsTable.price,
      subtotal: customerOrderItemsTable.subtotal,
      notes: customerOrderItemsTable.notes,
      variantSelection: customerOrderItemsTable.variantSelection,
      createdAt: customerOrderItemsTable.createdAt,
      imageUrl: productsTable.imageUrl,
    })
    .from(customerOrderItemsTable)
    .leftJoin(productsTable, eq(customerOrderItemsTable.productId, productsTable.id))
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));

  res.json(formatCustomerOrder(order, items));
});

router.post("/tenant/customer-orders/scan-checkout", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { barcode, branchId } = req.body;
  if (!barcode) { res.status(400).json({ error: "Barcode atau SKU produk diperlukan" }); return; }

  // 1. Find product by barcode or SKU
  const [product] = await db.select().from(productsTable)
    .where(and(
      eq(productsTable.tenantId, claims.tenantId),
      or(eq(productsTable.barcode, barcode), eq(productsTable.sku, barcode))
    ))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: `Produk dengan barcode atau SKU "${barcode}" tidak ditemukan.` });
    return;
  }

  // 2. Fetch tenant settings
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId)).limit(1);
  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan." });
    return;
  }

  // 3. Resolve active branch ID
  let activeBranchId = Number(branchId);
  if (!activeBranchId) {
    const branches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, claims.tenantId)).limit(1);
    if (branches.length > 0) {
      activeBranchId = branches[0].id;
    } else {
      res.status(400).json({ error: "Tenant tidak memiliki cabang terdaftar." });
      return;
    }
  }

  // 4. Calculate prices
  const quantity = 1;
  const subtotal = Number(product.price) * quantity;
  const discountAmount = 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  
  const enableServiceCharge = (tenant as any).enableServiceCharge ?? false;
  const serviceChargePercentage = enableServiceCharge ? Number((tenant as any).serviceChargePercentage ?? 10) : 0;
  const serviceChargeAmount = subtotalAfterDiscount * (serviceChargePercentage / 100);

  const enableTax = (tenant as any).enableTax ?? false;
  const taxPercentage = enableTax ? Number(tenant.taxPercentage ?? 10) : 0;
  const taxAmount = (subtotalAfterDiscount + serviceChargeAmount) * (taxPercentage / 100);

  const total = subtotalAfterDiscount + serviceChargeAmount + taxAmount;
  const orderNum = `SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 5. Get employee details
  let cashierId: number | null = null;
  let cashierName: string | null = null;
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.userId, claims.userId)).limit(1);
  if (employee) {
    cashierId = employee.id;
    cashierName = employee.name;
  } else {
    const [userRec] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId)).limit(1);
    if (userRec) {
      cashierName = userRec.name;
    }
  }

  // 6. Create customer order in database
  const [order] = await db.insert(customerOrdersTable).values({
    orderNumber: orderNum,
    tenantId: claims.tenantId,
    branchId: activeBranchId,
    orderType: "take_away", // default order type: Ambil di Toko / take_away
    customerName: "Scan Barcode",
    customerPhone: null,
    tableNumber: null,
    deliveryAddress: null,
    deliveryNotes: null,
    deliveryFee: "0",
    paymentMethod: "cashier", // customer pays at cashier
    subtotal: String(subtotal),
    discount: String(discountAmount),
    tax: String(taxAmount),
    serviceCharge: String(serviceChargeAmount),
    total: String(total),
    status: "pending",
    paymentStatus: "unpaid",
    notes: "Checkout otomatis via scan barcode",
    employeeId: cashierId,
    employeeName: cashierName,
    priority: "normal",
    estimatedTime: 5,
    isClaimReward: false,
  }).returning();

  // 7. Create customer order item
  const [insertedItem] = await db.insert(customerOrderItemsTable).values({
    tenantId: claims.tenantId,
    branchId: activeBranchId,
    customerOrderId: order.id,
    productId: product.id,
    productName: product.name,
    quantity: quantity,
    price: String(product.price),
    subtotal: String(subtotal),
    notes: null,
    variantSelection: null,
  }).returning();

  // 8. Deduct branch stock
  try {
    if (activeBranchId) {
      await deductBranchStock(claims.tenantId, activeBranchId, product.id, quantity);
    } else {
      await db.execute(sql`UPDATE products SET stock = stock - ${quantity} WHERE id = ${product.id} AND tenant_id = ${claims.tenantId}`);
    }
  } catch (stockErr) {
    console.error("Failed to deduct stock for scan checkout order:", stockErr);
  }

  // 9. Format response & broadcast via SSE
  const insertedItemsWithImage = [{
    ...insertedItem,
    imageUrl: product.imageUrl ?? null
  }];
  const formatted = formatCustomerOrder(order, insertedItemsWithImage);
  broadcastNewOrder(claims.tenantId, formatted);
  
  res.status(201).json(formatted);
});

router.patch("/tenant/customer-orders/:id/status", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orderId = Number(req.params.id);
  const { status, paymentStatus } = req.body;
  if (!status && !paymentStatus) { res.status(400).json({ error: "Status atau Status Pembayaran diperlukan" }); return; }

  // Resolve cashier processing this update
  let cashierId: number | null = null;
  let cashierName: string | null = null;
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.userId, claims.userId)).limit(1);
  if (employee) {
    cashierId = employee.id;
    cashierName = employee.name;
  } else {
    const [userRec] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId)).limit(1);
    if (userRec) {
      cashierName = userRec.name;
    }
  }

  const updateData: any = { updatedAt: new Date() };
  if (status) updateData.status = status;
  if (paymentStatus) updateData.paymentStatus = paymentStatus;
  if (cashierId) updateData.employeeId = cashierId;
  if (cashierName) updateData.employeeName = cashierName;

  const [order] = await db.update(customerOrdersTable)
    .set(updateData)
    .where(and(eq(customerOrdersTable.id, orderId), eq(customerOrdersTable.tenantId, claims.tenantId)))
    .returning();
  if (!order) { res.status(404).json({ error: "Pesanan tidak ditemukan" }); return; }

  broadcastStatusUpdate(claims.tenantId, orderId, order.status, order.paymentStatus);
  const items = await db.select({
      id: customerOrderItemsTable.id,
      tenantId: customerOrderItemsTable.tenantId,
      branchId: customerOrderItemsTable.branchId,
      customerOrderId: customerOrderItemsTable.customerOrderId,
      productId: customerOrderItemsTable.productId,
      productName: customerOrderItemsTable.productName,
      quantity: customerOrderItemsTable.quantity,
      price: customerOrderItemsTable.price,
      subtotal: customerOrderItemsTable.subtotal,
      notes: customerOrderItemsTable.notes,
      variantSelection: customerOrderItemsTable.variantSelection,
      createdAt: customerOrderItemsTable.createdAt,
      imageUrl: productsTable.imageUrl,
    })
    .from(customerOrderItemsTable)
    .leftJoin(productsTable, eq(customerOrderItemsTable.productId, productsTable.id))
    .where(eq(customerOrderItemsTable.customerOrderId, order.id));
  res.json(formatCustomerOrder(order, items));
});

// ── QR codes management ───────────────────────────────────────────────────────

router.get("/tenant/qr-codes", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId));
  const qrCodes = await db.select().from(tableQrCodesTable)
    .where(eq(tableQrCodesTable.tenantId, claims.tenantId))
    .orderBy(tableQrCodesTable.tableNumber);

  let menuSlug = tenant?.slug ?? null;
  if (branchId && tenant) {
    let [menu] = await db.select().from(publicMenusTable)
      .where(and(eq(publicMenusTable.tenantId, tenant.id), eq(publicMenusTable.branchId, branchId)));
    if (!menu) {
      // Find branch details to construct default slug/name
      const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId));
      if (branch) {
        const suffix = branch.name.toLowerCase() === "utama" ? "" : `-${branch.id}`;
        [menu] = await db.insert(publicMenusTable).values({
          tenantId: tenant.id,
          branchId: branch.id,
          slug: `${tenant.slug}${suffix}`,
          name: `${tenant.name} - ${branch.name}`,
          isActive: true,
          enableDineIn: tenant.enableDineIn ?? true,
          enableTakeAway: tenant.enableTakeAway ?? true,
          enableDelivery: tenant.enableDelivery ?? false,
        }).returning();
      }
    }
    if (menu) {
      menuSlug = menu.slug;
    }
  }

  res.json({ slug: menuSlug, qrCodes });
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

  const branchId = req.body.branchId ? Number(req.body.branchId) : null;

  const allowed = [
    "slug", "enableDineIn", "enableTakeAway", "enableDelivery",
    "enableCash", "enableQris", "enableBankTransfer", "enableEwallet",
    "showVariants", "showToppings", "defaultCashierName",
    "showDeliveryInfo", "estimatedDeliveryTime", "enableOpsHours", "opsOpeningTime", "opsClosingTime",
  ];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Tidak ada yang diubah" }); return; }

  if (updates.slug) {
    updates.slug = String(updates.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    
    // Check if the slug is already in use by another tenant
    const existingTenant = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, updates.slug));
    if (existingTenant.length > 0 && existingTenant[0].id !== claims.tenantId) {
      res.status(409).json({ error: "Slug sudah digunakan" }); return;
    }

    // Check if the slug is already in use by another public menu not belonging to this tenant
    const existingMenu = await db.select().from(publicMenusTable).where(eq(publicMenusTable.slug, updates.slug));
    if (existingMenu.length > 0 && existingMenu[0].tenantId !== claims.tenantId) {
      res.status(409).json({ error: "Slug sudah digunakan" }); return;
    }
  }

  // Update the main tenant record
  const [tenant] = await db.update(tenantsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tenantsTable.id, claims.tenantId))
    .returning();

  // Sync to publicMenusTable if relevant fields are updated
  const menuUpdates: Record<string, any> = {};
  if (updates.slug !== undefined) menuUpdates.slug = updates.slug;
  if (updates.enableDineIn !== undefined) menuUpdates.enableDineIn = updates.enableDineIn;
  if (updates.enableTakeAway !== undefined) menuUpdates.enableTakeAway = updates.enableTakeAway;
  if (updates.enableDelivery !== undefined) menuUpdates.enableDelivery = updates.enableDelivery;

  if (Object.keys(menuUpdates).length > 0) {
    if (branchId) {
      // Find or create the public menu for this branch, then update it
      const [existingBranchMenu] = await db.select().from(publicMenusTable)
        .where(and(eq(publicMenusTable.tenantId, claims.tenantId), eq(publicMenusTable.branchId, branchId)));
      
      if (existingBranchMenu) {
        await db.update(publicMenusTable)
          .set(menuUpdates)
          .where(and(eq(publicMenusTable.tenantId, claims.tenantId), eq(publicMenusTable.branchId, branchId)));
      } else {
        await db.insert(publicMenusTable).values({
          tenantId: claims.tenantId,
          branchId,
          slug: updates.slug || tenant.slug,
          name: tenant.name,
          isActive: true,
          enableDineIn: updates.enableDineIn !== undefined ? updates.enableDineIn : (tenant.enableDineIn ?? true),
          enableTakeAway: updates.enableTakeAway !== undefined ? updates.enableTakeAway : (tenant.enableTakeAway ?? true),
          enableDelivery: updates.enableDelivery !== undefined ? updates.enableDelivery : (tenant.enableDelivery ?? false),
        });
      }
    } else {
      // Fallback: update all branches
      await db.update(publicMenusTable)
        .set(menuUpdates)
        .where(eq(publicMenusTable.tenantId, claims.tenantId));
    }
  }

  res.json(tenant);
});

router.get("/menu/:slug/customer-orders-history", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const { phone } = req.query;
  if (!phone) {
    res.status(400).json({ error: "Nomor telepon diperlukan" });
    return;
  }
  const { tenant } = await resolveTenantAndMenu(slug);
  if (!tenant) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

  const orders = await db.select().from(customerOrdersTable)
    .where(and(eq(customerOrdersTable.customerPhone, String(phone)), eq(customerOrdersTable.tenantId, tenant.id)))
    .orderBy(desc(customerOrdersTable.createdAt));

  res.json(orders);
});

export default router;
