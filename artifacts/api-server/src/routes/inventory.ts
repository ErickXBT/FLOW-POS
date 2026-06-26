import { Router, type IRouter } from "express";
import { eq, and, ilike, desc } from "drizzle-orm";
import { db, productsTable, categoriesTable, inventoryAdjustmentsTable, publicMenuProductsTable, publicMenusTable, publicMenuCategoriesTable, tenantsTable } from "@workspace/db";
import {
  ListInventoryQueryParams,
  CreateInventoryAdjustmentBody,
  ListInventoryAdjustmentsQueryParams,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

router.get("/inventory", async (req: any, res: any): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListInventoryQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const lowStock = qp.success ? qp.data.lowStock : undefined;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions = [eq(productsTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      branchProduct: {
        stock: publicMenuProductsTable.stock,
      }
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(
      publicMenuProductsTable,
      and(
        eq(productsTable.id, publicMenuProductsTable.productId),
        eq(publicMenuProductsTable.branchId, branchId ? branchId : -1)
      )
    )
    .where(and(...conditions));

  const result = rows.map(r => {
    const stock = (branchId && r.branchProduct && r.branchProduct.stock !== null) ? r.branchProduct.stock : r.product.stock;
    return {
      productId: r.product.id,
      productName: r.product.name,
      sku: r.product.sku,
      stock: stock,
      minStock: r.product.minStock,
      isLowStock: stock <= r.product.minStock,
      categoryName: r.categoryName ?? null,
      tenantId: r.product.tenantId,
    };
  });

  const filtered = lowStock === true || lowStock === "true" as any
    ? result.filter(i => i.isLowStock)
    : result;

  res.json(filtered);
});

router.post("/inventory/adjustments", async (req: any, res: any): Promise<void> => {
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

  const branchId = await getRequestedBranchId(req, claims);
  if (branchId) {
    const [branchProd] = await db.select().from(publicMenuProductsTable)
      .where(and(
        eq(publicMenuProductsTable.productId, body.data.productId),
        eq(publicMenuProductsTable.branchId, branchId)
      ))
      .limit(1);

    const currentStock = branchProd && branchProd.stock !== null ? branchProd.stock : product.stock;
    const newStock = Math.max(0, currentStock + delta);

    if (branchProd) {
      await db.update(publicMenuProductsTable)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(publicMenuProductsTable.id, branchProd.id));
    } else {
      let [menu] = await db.select().from(publicMenusTable)
        .where(and(eq(publicMenusTable.branchId, branchId), eq(publicMenusTable.tenantId, claims.tenantId!)))
        .limit(1);
      if (!menu) {
        const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId!)).limit(1);
        const slug = tenant ? `${tenant.slug}-${branchId}` : `branch-${branchId}`;
        [menu] = await db.insert(publicMenusTable).values({
          tenantId: claims.tenantId!,
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
            tenantId: claims.tenantId!,
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
            tenantId: claims.tenantId!,
            branchId,
            publicMenuId: menu.id,
            name: "Umum",
            sortOrder: 0,
          }).returning();
        }
        publicMenuCategoryId = menuCat.id;
      }

      await db.insert(publicMenuProductsTable).values({
        tenantId: claims.tenantId!,
        branchId,
        publicMenuCategoryId,
        productId: product.id,
        name: product.name,
        description: product.description,
        price: String(product.price),
        promoPrice: null,
        imageUrl: product.imageUrl,
        isAvailable: product.isActive,
        stock: newStock,
        variantSettings: product.variantSettings,
      });
    }
  } else {
    const newStock = Math.max(0, product.stock + delta);
    await db.update(productsTable)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(productsTable.id, product.id));
  }

  const [adj] = await db.insert(inventoryAdjustmentsTable).values({
    productId: body.data.productId,
    productName: product.name,
    type: body.data.type,
    quantity: body.data.quantity,
    notes: body.data.notes ?? null,
    tenantId: claims.tenantId!,
    branchId: branchId ?? null,
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

router.get("/inventory/adjustments/list", async (req: any, res: any): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListInventoryAdjustmentsQueryParams.safeParse(req.query);
  const productId = qp.success ? qp.data.productId : undefined;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions = [eq(inventoryAdjustmentsTable.tenantId, claims.tenantId!)];
  if (productId) conditions.push(eq(inventoryAdjustmentsTable.productId, productId));
  if (branchId) conditions.push(eq(inventoryAdjustmentsTable.branchId, branchId));

  const adjustments = await db.select().from(inventoryAdjustmentsTable)
    .where(and(...conditions))
    .orderBy(desc(inventoryAdjustmentsTable.createdAt))
    .limit(50);

  res.json(adjustments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

// 4. Stock Transfer between branches / centers
router.post("/inventory/transfer", async (req: any, res: any): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { productId, type, sourceBranchId, targetBranchId, quantity, notes } = req.body;
  if (!productId || !type || !quantity || Number(quantity) <= 0) {
    res.status(400).json({ error: "Input tidak valid. Product, Type, dan Qty wajib diisi." });
    return;
  }

  const qty = Number(quantity);

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, Number(productId)), eq(productsTable.tenantId, claims.tenantId!)))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "Produk tidak ditemukan" });
    return;
  }

  // A. Decrease Source Stock
  if (type === "ambil_pusat") {
    // Source is Pusat
    const currentPusatStock = product.stock ?? 0;
    if (currentPusatStock < qty) {
      res.status(400).json({ error: `Stok Gudang Pusat tidak mencukupi (Tersisa: ${currentPusatStock})` });
      return;
    }
    await db.update(productsTable)
      .set({ stock: currentPusatStock - qty, updatedAt: new Date() })
      .where(eq(productsTable.id, product.id));
  } else {
    // Source is a branch (kembali_pusat or kirim_cabang)
    if (!sourceBranchId) {
      res.status(400).json({ error: "Cabang asal harus ditentukan" });
      return;
    }
    const [branchProd] = await db.select().from(publicMenuProductsTable)
      .where(and(
        eq(publicMenuProductsTable.productId, product.id),
        eq(publicMenuProductsTable.branchId, Number(sourceBranchId))
      ))
      .limit(1);

    const currentSourceStock = branchProd?.stock ?? 0;
    if (currentSourceStock < qty) {
      res.status(400).json({ error: `Stok Cabang Asal tidak mencukupi (Tersisa: ${currentSourceStock})` });
      return;
    }
    await db.update(publicMenuProductsTable)
      .set({ stock: currentSourceStock - qty, updatedAt: new Date() })
      .where(eq(publicMenuProductsTable.id, branchProd.id));
  }

  // B. Increase Target Stock
  if (type === "kembali_pusat") {
    // Target is Pusat
    const currentPusatStock = product.stock ?? 0;
    await db.update(productsTable)
      .set({ stock: currentPusatStock + qty, updatedAt: new Date() })
      .where(eq(productsTable.id, product.id));
  } else {
    // Target is a branch (ambil_pusat or kirim_cabang)
    const targetId = Number(targetBranchId);
    if (!targetBranchId) {
      res.status(400).json({ error: "Cabang tujuan harus ditentukan" });
      return;
    }

    const [branchProd] = await db.select().from(publicMenuProductsTable)
      .where(and(
        eq(publicMenuProductsTable.productId, product.id),
        eq(publicMenuProductsTable.branchId, targetId)
      ))
      .limit(1);

    if (branchProd) {
      await db.update(publicMenuProductsTable)
        .set({ stock: (branchProd.stock ?? 0) + qty, updatedAt: new Date() })
        .where(eq(publicMenuProductsTable.id, branchProd.id));
    } else {
      // Find or create publicMenu
      let [menu] = await db.select().from(publicMenusTable)
        .where(and(eq(publicMenusTable.branchId, targetId), eq(publicMenusTable.tenantId, claims.tenantId!)))
        .limit(1);
      if (!menu) {
        const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, claims.tenantId!)).limit(1);
        const slug = tenant ? `${tenant.slug}-${targetId}` : `branch-${targetId}`;
        [menu] = await db.insert(publicMenusTable).values({
          tenantId: claims.tenantId!,
          branchId: targetId,
          slug,
          name: tenant?.name || "Cabang",
          isActive: true,
          enableDineIn: true,
          enableTakeAway: true,
          enableDelivery: true,
        }).returning();
      }

      // Find category
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
            tenantId: claims.tenantId!,
            branchId: targetId,
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
            tenantId: claims.tenantId!,
            branchId: targetId,
            publicMenuId: menu.id,
            name: "Umum",
            sortOrder: 0,
          }).returning();
        }
        publicMenuCategoryId = menuCat.id;
      }

      // Create product in branch
      await db.insert(publicMenuProductsTable).values({
        tenantId: claims.tenantId!,
        branchId: targetId,
        publicMenuCategoryId,
        productId: product.id,
        name: product.name,
        description: product.description,
        price: String(product.price),
        imageUrl: product.imageUrl,
        isAvailable: product.isActive,
        stock: qty,
        variantSettings: product.variantSettings,
      });
    }
  }

  // C. Write adjustments to database for audit logs
  // 1. Stock Out from source
  await db.insert(inventoryAdjustmentsTable).values({
    productId: product.id,
    productName: product.name,
    type: "stock_out",
    quantity: qty,
    notes: `Transfer Keluar (${type.replace("_", " ")}): ${notes || "Pemindahan Stok"}`,
    tenantId: claims.tenantId!,
    branchId: sourceBranchId ? Number(sourceBranchId) : null,
  });

  // 2. Stock In to target
  await db.insert(inventoryAdjustmentsTable).values({
    productId: product.id,
    productName: product.name,
    type: "stock_in",
    quantity: qty,
    notes: `Transfer Masuk (${type.replace("_", " ")}): ${notes || "Pemindahan Stok"}`,
    tenantId: claims.tenantId!,
    branchId: targetBranchId ? Number(targetBranchId) : null,
  });

  // D. Log User Activity
  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: claims.role === "owner" ? "Owner" : "Manager",
    userRole: claims.role,
    action: "transfer_stock",
    module: "inventory",
    details: { productId: product.id, productName: product.name, type, quantity: qty, sourceBranchId, targetBranchId },
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, message: "Pemindahan stok berhasil diselesaikan" });
});

export default router;

