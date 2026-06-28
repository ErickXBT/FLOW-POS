import { Router, type IRouter } from "express";
import { eq, and, ilike, count, sql, desc, or } from "drizzle-orm";
import { db, productsTable, categoriesTable, orderItemsTable, ordersTable, employeesTable, publicMenuProductsTable, publicMenusTable, publicMenuCategoriesTable, tenantsTable } from "@workspace/db";
import fs from "fs";
import path from "path";
import { uploadProductImage } from "../lib/storage";

import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetTopProductsQueryParams,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

async function ensureBranchProductMapping(tenantId: number, branchId: number, productId: number, globalCategoryId: number | null) {
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
  if (globalCategoryId) {
    const [globalCat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, globalCategoryId)).limit(1);
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
  return { menu, publicMenuCategoryId };
}

async function upsertBranchProduct(tenantId: number, branchId: number, productId: number, updates: { price?: number; promoPrice?: number; isAvailable?: boolean; stock?: number }) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) return;

  const { publicMenuCategoryId } = await ensureBranchProductMapping(tenantId, branchId, productId, product.categoryId);

  let [branchProd] = await db.select().from(publicMenuProductsTable)
    .where(and(
      eq(publicMenuProductsTable.productId, productId),
      eq(publicMenuProductsTable.branchId, branchId)
    ))
    .limit(1);

  if (branchProd) {
    const updatePayload: any = {
      updatedAt: new Date(),
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      variantSettings: product.variantSettings,
      publicMenuCategoryId,
    };
    if (updates.price !== undefined) updatePayload.price = String(updates.price);
    if (updates.promoPrice !== undefined) updatePayload.promoPrice = updates.promoPrice !== null ? String(updates.promoPrice) : null;
    if (updates.isAvailable !== undefined) updatePayload.isAvailable = updates.isAvailable;
    if (updates.stock !== undefined) updatePayload.stock = updates.stock;

    await db.update(publicMenuProductsTable)
      .set(updatePayload)
      .where(eq(publicMenuProductsTable.id, branchProd.id));
  } else {
    const insertPayload: any = {
      tenantId,
      branchId,
      publicMenuCategoryId,
      productId,
      name: product.name,
      description: product.description,
      price: updates.price !== undefined ? String(updates.price) : String(product.price),
      promoPrice: updates.promoPrice !== undefined ? (updates.promoPrice !== null ? String(updates.promoPrice) : null) : null,
      imageUrl: product.imageUrl,
      isAvailable: updates.isAvailable !== undefined ? updates.isAvailable : product.isActive,
      stock: updates.stock !== undefined ? updates.stock : product.stock,
      variantSettings: product.variantSettings,
    };

    await db.insert(publicMenuProductsTable).values(insertPayload);
  }
}

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatProduct(p: any, categoryName?: string | null, bp?: any) {
  const hasBranch = bp && bp.price !== null;
  return {
    ...p,
    price: hasBranch ? Number(bp.price) : Number(p.price),
    promoPrice: hasBranch && bp.promoPrice !== null ? Number(bp.promoPrice) : null,
    isActive: hasBranch && bp.isAvailable !== null ? bp.isAvailable : p.isActive,
    stock: hasBranch && bp.stock !== null ? bp.stock : p.stock,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    categoryName: categoryName ?? null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/products/scan-lookup", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { barcode, branchId } = req.query as any;
  if (!barcode) {
    res.status(400).json({ error: "Barcode atau SKU diperlukan" });
    return;
  }

  const activeBranchId = branchId ? Number(branchId) : await getRequestedBranchId(req, claims);

  const [row] = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      branchProduct: {
        price: publicMenuProductsTable.price,
        promoPrice: publicMenuProductsTable.promoPrice,
        isAvailable: publicMenuProductsTable.isAvailable,
        stock: publicMenuProductsTable.stock,
      }
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(
      publicMenuProductsTable,
      and(
        eq(productsTable.id, publicMenuProductsTable.productId),
        eq(publicMenuProductsTable.branchId, activeBranchId ? activeBranchId : -1)
      )
    )
    .where(and(
      eq(productsTable.tenantId, claims.tenantId!),
      or(eq(productsTable.barcode, barcode), eq(productsTable.sku, barcode))
    ))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: `Produk dengan barcode atau SKU "${barcode}" tidak ditemukan.` });
    return;
  }

  res.json(formatProduct(row.product, row.categoryName, row.branchProduct));
});

router.get("/products", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListProductsQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const categoryId = qp.success ? qp.data.categoryId : undefined;
  const page = (qp.success ? qp.data.page : 1) ?? 1;
  const limit = (qp.success ? qp.data.limit : 20) ?? 20;
  const offset = (page - 1) * limit;

  const branchId = await getRequestedBranchId(req, claims);

  const conditions = [eq(productsTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(productsTable).where(where);

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      branchProduct: {
        price: publicMenuProductsTable.price,
        promoPrice: publicMenuProductsTable.promoPrice,
        isAvailable: publicMenuProductsTable.isAvailable,
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
    .where(where)
    .limit(limit)
    .offset(offset);

  res.json({
    data: rows.map(r => formatProduct(r.product, r.categoryName, r.branchProduct)),
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

  const branchId = await getRequestedBranchId(req, claims);
  if (branchId) {
    await upsertBranchProduct(claims.tenantId!, branchId, product.id, {
      price: body.data.price,
      stock: body.data.stock ?? 0,
      isAvailable: true,
    });
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: claims.role === "owner" ? "Owner" : "Manager",
    userRole: claims.role,
    action: "create_product",
    module: "products",
    details: { productId: product.id, name: product.name, price: Number(product.price) },
    ipAddress: req.ip,
  });

  res.status(201).json(formatProduct(product));
});

router.get("/products/top", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = GetTopProductsQueryParams.safeParse(req.query);
  const limit = (qp.success ? qp.data.limit : 5) ?? 5;

  const branchId = await getRequestedBranchId(req, claims);

  const conditions = [
    eq(productsTable.tenantId, claims.tenantId!),
    eq(ordersTable.status, "completed")
  ];
  if (branchId) {
    conditions.push(eq(ordersTable.branchId, branchId));
  }

  const rows = await db
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
      totalSold: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(and(...conditions))
    .groupBy(productsTable.id)
    .orderBy(desc(sql`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`))
    .limit(limit);

  res.json(rows.map(r => ({
    productId: r.productId ?? 0,
    name: r.name ?? "Unknown",
    imageUrl: r.imageUrl ?? null,
    totalSold: Number(r.totalSold),
    revenue: Number(r.revenue),
  })));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = GetProductParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const branchId = await getRequestedBranchId(req, claims);

  const [row] = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      branchProduct: {
        price: publicMenuProductsTable.price,
        promoPrice: publicMenuProductsTable.promoPrice,
        isAvailable: publicMenuProductsTable.isAvailable,
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
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, claims.tenantId!)));

  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(row.product, row.categoryName, row.branchProduct));
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

  const branchId = await getRequestedBranchId(req, claims);
  if (branchId) {
    const updates: any = {};
    if (body.data.price !== undefined) updates.price = body.data.price;
    if (body.data.isActive !== undefined) updates.isAvailable = body.data.isActive;
    if (body.data.stock !== undefined) updates.stock = body.data.stock;
    
    await upsertBranchProduct(claims.tenantId!, branchId, params.data.id, updates);
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: claims.role === "owner" ? "Owner" : "Manager",
    userRole: claims.role,
    action: "edit_product",
    module: "products",
    details: { productId: product.id, name: product.name, price: Number(product.price) },
    ipAddress: req.ip,
  });

  if (branchId) {
    const [row] = await db
      .select({
        product: productsTable,
        categoryName: categoriesTable.name,
        branchProduct: {
          price: publicMenuProductsTable.price,
          promoPrice: publicMenuProductsTable.promoPrice,
          isAvailable: publicMenuProductsTable.isAvailable,
          stock: publicMenuProductsTable.stock,
        }
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(
        publicMenuProductsTable,
        and(
          eq(productsTable.id, publicMenuProductsTable.productId),
          eq(publicMenuProductsTable.branchId, branchId)
        )
      )
      .where(and(eq(productsTable.id, product.id), eq(productsTable.tenantId, claims.tenantId!)))
      .limit(1);

    if (row) {
      res.json(formatProduct(row.product, row.categoryName, row.branchProduct));
      return;
    }
  }

  res.json(formatProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = DeleteProductParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, claims.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: claims.role === "owner" ? "Owner" : "Manager",
    userRole: claims.role,
    action: "delete_product",
    module: "products",
    details: { productId: deleted.id, name: deleted.name },
    ipAddress: req.ip,
  });

  res.sendStatus(204);
});

router.post("/products/upload", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims || !claims.tenantId) return;

  const { name, base64 } = req.body;
  if (!name || !base64) {
    res.status(400).json({ error: "Nama file atau konten base64 tidak boleh kosong" });
    return;
  }

  try {
    const imageUrl = await uploadProductImage(base64, name, claims.tenantId);
    res.status(200).json({ imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal mengunggah gambar" });
  }
});

export default router;
