import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, customersTable, employeesTable, branchesTable, publicMenuProductsTable } from "@workspace/db";
import { GetSalesReportQueryParams, GetSalesChartDataQueryParams } from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function startOf(unit: "day" | "week" | "month" | "year"): Date {
  const now = new Date();
  if (unit === "day") { now.setHours(0, 0, 0, 0); return now; }
  if (unit === "week") {
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (unit === "month") { now.setDate(1); now.setHours(0, 0, 0, 0); return now; }
  now.setMonth(0, 1); now.setHours(0, 0, 0, 0); return now;
}

// getRequestedBranchId helper imported from auth.ts

router.get("/reports/dashboard", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const todayStart = startOf("day");
  const weekStart = startOf("week");
  const monthStart = startOf("month");

  const branchId = await getRequestedBranchId(req, claims);
  const baseOrderConditions = [eq(ordersTable.tenantId, tid), eq(ordersTable.status, "completed")];
  if (branchId) {
    baseOrderConditions.push(eq(ordersTable.branchId, branchId));
  }

  const [todayOrders] = await db.select({ count: count() }).from(ordersTable)
    .where(and(...baseOrderConditions, gte(ordersTable.createdAt, todayStart)));

  const [todaySales] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable)
    .where(and(...baseOrderConditions, gte(ordersTable.createdAt, todayStart)));

  const [weekRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable)
    .where(and(...baseOrderConditions, gte(ordersTable.createdAt, weekStart)));

  const [monthRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable)
    .where(and(...baseOrderConditions, gte(ordersTable.createdAt, monthStart)));

  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const [lastMonthRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable)
    .where(and(...baseOrderConditions,
      gte(ordersTable.createdAt, lastMonthStart), lte(ordersTable.createdAt, monthStart)));

  let totalProductsCount = 0;
  let totalCustomersCount = 0;
  let lowStockCount = 0;

  if (branchId) {
    const [branchProds] = await db.select({ count: count() })
      .from(publicMenuProductsTable)
      .where(and(eq(publicMenuProductsTable.branchId, branchId), eq(publicMenuProductsTable.isAvailable, true)));
    totalProductsCount = branchProds?.count ?? 0;

    const [branchCusts] = await db.select({ count: count() })
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tid), eq(customersTable.branchId, branchId)));
    totalCustomersCount = branchCusts?.count ?? 0;

    const branchInventory = await db.select({
      productStock: productsTable.stock,
      branchStock: publicMenuProductsTable.stock,
      minStock: productsTable.minStock
    })
    .from(productsTable)
    .leftJoin(
      publicMenuProductsTable,
      and(
        eq(productsTable.id, publicMenuProductsTable.productId),
        eq(publicMenuProductsTable.branchId, branchId)
      )
    )
    .where(eq(productsTable.tenantId, tid));

    lowStockCount = branchInventory.filter(p => {
      const stock = p.branchStock !== null ? p.branchStock : p.productStock;
      return stock <= p.minStock;
    }).length;
  } else {
    const [totalProducts] = await db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.tenantId, tid), eq(productsTable.isActive, true)));
    totalProductsCount = totalProducts.count;

    const [totalCustomers] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.tenantId, tid));
    totalCustomersCount = totalCustomers.count;

    const inventory = await db.select({ stock: productsTable.stock, minStock: productsTable.minStock })
      .from(productsTable).where(eq(productsTable.tenantId, tid));
    lowStockCount = inventory.filter(p => p.stock <= p.minStock).length;
  }

  const currentMonth = Number(monthRevenue.total) || 0;
  const prevMonth = Number(lastMonthRevenue.total) || 0;
  const growth = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;

  res.json({
    todaySales: Number(todaySales.total) || 0,
    todayOrders: todayOrders.count,
    totalProducts: totalProductsCount,
    totalCustomers: totalCustomersCount,
    lowStockCount,
    monthlyRevenue: currentMonth,
    weeklyRevenue: Number(weekRevenue.total) || 0,
    revenueGrowth: Math.round(growth * 100) / 100,
  });
});

router.get("/reports/sales", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const qp = GetSalesReportQueryParams.safeParse(req.query);
  const period = qp.success ? qp.data.period : "month";

  let dateFrom: Date;
  let dateTo = new Date();

  if (qp.success && qp.data.dateFrom) {
    dateFrom = new Date(qp.data.dateFrom);
  } else {
    if (period === "today") dateFrom = startOf("day");
    else if (period === "week") dateFrom = startOf("week");
    else if (period === "year") dateFrom = startOf("year");
    else dateFrom = startOf("month");
  }
  if (qp.success && qp.data.dateTo) dateTo = new Date(qp.data.dateTo);

  const branchId = await getRequestedBranchId(req, claims);
  const conditions = [
    eq(ordersTable.tenantId, tid),
    eq(ordersTable.status, "completed"),
    gte(ordersTable.createdAt, dateFrom),
    lte(ordersTable.createdAt, dateTo),
  ];
  if (branchId) {
    conditions.push(eq(ordersTable.branchId, branchId));
  }
  const where = and(...conditions);

  const [agg] = await db.select({
    totalRevenue: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
    totalOrders: count(),
    totalItems: sql<number>`COALESCE(SUM(CAST(subtotal AS DECIMAL)), 0)`,
  }).from(ordersTable).where(where);

  const avgVal = agg.totalOrders > 0 ? Number(agg.totalRevenue) / agg.totalOrders : 0;

  // Top products
  const topRows = await db.select({
    productId: productsTable.id,
    name: productsTable.name,
    imageUrl: productsTable.imageUrl,
    totalSold: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`,
    revenue: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`,
  })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(where)
    .groupBy(productsTable.id)
    .orderBy(desc(sql`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`))
    .limit(5);

  // By payment method
  const payRows = await db.select({
    method: ordersTable.paymentMethod,
    count: count(),
    total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
  }).from(ordersTable).where(where).groupBy(ordersTable.paymentMethod);

  res.json({
    totalRevenue: Number(agg.totalRevenue) || 0,
    totalOrders: agg.totalOrders,
    totalItems: Number(agg.totalItems) || 0,
    averageOrderValue: Math.round(avgVal * 100) / 100,
    topProducts: topRows.map(r => ({
      productId: r.productId ?? 0,
      name: r.name ?? "Unknown",
      imageUrl: r.imageUrl ?? null,
      totalSold: Number(r.totalSold),
      revenue: Number(r.revenue),
    })),
    byPaymentMethod: payRows.map(r => ({
      method: r.method,
      count: r.count,
      total: Number(r.total),
    })),
  });
});

router.get("/reports/sales/chart", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const qp = GetSalesChartDataQueryParams.safeParse(req.query);
  const period = (qp.success ? qp.data.period : "month") ?? "month";

  const now = new Date();
  const points: { label: string; from: Date; to: Date }[] = [];

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const from = new Date(d); from.setHours(0, 0, 0, 0);
      const to = new Date(d); to.setHours(23, 59, 59, 999);
      points.push({ label: from.toLocaleDateString("id-ID", { weekday: "short" }), from, to });
    }
  } else if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const from = new Date(d); from.setHours(0, 0, 0, 0);
      const to = new Date(d); to.setHours(23, 59, 59, 999);
      points.push({ label: `${from.getDate()}/${from.getMonth() + 1}`, from, to });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0);
      const from = new Date(d);
      const to = new Date(d); to.setMonth(to.getMonth() + 1, 0); to.setHours(23, 59, 59, 999);
      points.push({ label: from.toLocaleDateString("id-ID", { month: "short" }), from, to });
    }
  }

  const branchId = await getRequestedBranchId(req, claims);
  const baseConditions = [
    eq(ordersTable.tenantId, tid),
    eq(ordersTable.status, "completed"),
  ];
  if (branchId) {
    baseConditions.push(eq(ordersTable.branchId, branchId));
  }

  const result = await Promise.all(points.map(async (pt) => {
    const [agg] = await db.select({
      revenue: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
      orders: count(),
    }).from(ordersTable).where(and(
      ...baseConditions,
      gte(ordersTable.createdAt, pt.from),
      lte(ordersTable.createdAt, pt.to),
    ));
    return { label: pt.label, revenue: Number(agg.revenue) || 0, orders: agg.orders };
  }));

  res.json(result);
});

router.get("/reports/branches-comparison", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  
  // Get all branches for this tenant
  const branches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tid));
  
  const monthStart = startOf("month");
  
  // Also count how many products are low stock
  const inventory = await db.select({ stock: productsTable.stock, minStock: productsTable.minStock })
    .from(productsTable).where(eq(productsTable.tenantId, tid));
  const lowStockCount = inventory.filter(p => p.stock <= p.minStock).length;
  
  const comparison = await Promise.all(branches.map(async (b) => {
    const [salesAgg] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
      transaksi: count()
    })
    .from(ordersTable)
    .where(and(
      eq(ordersTable.tenantId, tid),
      eq(ordersTable.branchId, b.id),
      eq(ordersTable.status, "completed"),
      gte(ordersTable.createdAt, monthStart)
    ));
    
    const [staffAgg] = await db.select({ count: count() })
      .from(employeesTable)
      .where(and(
        eq(employeesTable.tenantId, tid),
        eq(employeesTable.branchId, b.id)
      ));
      
    return {
      id: b.id,
      name: b.name,
      sales: Number(salesAgg.total) || 0,
      transaksi: Number(salesAgg.transaksi) || 0,
      staff: Number(staffAgg.count) || 0,
      stockAlerts: lowStockCount,
      status: b.status === "locked" ? "Terkunci" : "Aktif"
    };
  }));
  
  res.json(comparison);
});

export default router;
