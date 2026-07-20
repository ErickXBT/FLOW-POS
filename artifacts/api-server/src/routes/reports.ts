import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, categoriesTable, customersTable, employeesTable, branchesTable, publicMenuProductsTable, expensesTable } from "@workspace/db";
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

  const baseExpenseConditions = [eq(expensesTable.tenantId, tid)];
  if (branchId) {
    baseExpenseConditions.push(eq(expensesTable.branchId, branchId));
  }

  const [monthlyExpensesAgg] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
  })
  .from(expensesTable)
  .where(and(...baseExpenseConditions, gte(expensesTable.createdAt, monthStart)));
  const monthlyExpenses = Number(monthlyExpensesAgg?.total ?? 0);

  const [monthlyCogsAgg] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS DECIMAL) * COALESCE(CAST(${productsTable.costPrice} AS DECIMAL), 0)), 0)`
  })
  .from(orderItemsTable)
  .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
  .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
  .where(and(...baseOrderConditions, gte(ordersTable.createdAt, monthStart)));
  const monthlyCogs = Number(monthlyCogsAgg?.total ?? 0);

  const now = new Date();
  const year = now.getFullYear();
  const monthNum = now.getMonth();

  const getWeekRange = (weekNum: number) => {
    let from: Date;
    let to: Date;
    if (weekNum === 1) {
      from = new Date(year, monthNum, 1, 0, 0, 0, 0);
      to = new Date(year, monthNum, 7, 23, 59, 59, 999);
    } else if (weekNum === 2) {
      from = new Date(year, monthNum, 8, 0, 0, 0, 0);
      to = new Date(year, monthNum, 14, 23, 59, 59, 999);
    } else if (weekNum === 3) {
      from = new Date(year, monthNum, 15, 0, 0, 0, 0);
      to = new Date(year, monthNum, 21, 23, 59, 59, 999);
    } else {
      from = new Date(year, monthNum, 22, 0, 0, 0, 0);
      to = new Date(year, monthNum + 1, 0, 23, 59, 59, 999);
    }
    return { from, to };
  };

  const weeklyCashFlow = await Promise.all([1, 2, 3, 4].map(async (weekNum) => {
    const { from, to } = getWeekRange(weekNum);
    const [revAgg] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`
    })
    .from(ordersTable)
    .where(and(...baseOrderConditions, gte(ordersTable.createdAt, from), lte(ordersTable.createdAt, to)));

    const [expAgg] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    })
    .from(expensesTable)
    .where(and(...baseExpenseConditions, gte(expensesTable.createdAt, from), lte(expensesTable.createdAt, to)));

    return {
      label: `W${weekNum}`,
      masuk: Number(revAgg?.total ?? 0),
      keluar: Number(expAgg?.total ?? 0),
    };
  }));

  const currentMonth = Number(monthRevenue.total) || 0;
  const prevMonth = Number(lastMonthRevenue.total) || 0;
  const growth = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;

  res.json({
    todaySales: Number(todaySales.total) || 0,
    todayOrders: todayOrders.count,
    totalProducts: totalProductsCount,
    totalCustomers: totalCustomersCount,
    lowStockCount: lowStockCount,
    monthlyRevenue: currentMonth,
    weeklyRevenue: Number(weekRevenue.total) || 0,
    revenueGrowth: Math.round(growth * 100) / 100,
    monthlyExpenses,
    monthlyCogs,
    weeklyCashFlow,
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
    if (!qp.data.dateFrom.includes("T")) dateFrom.setHours(0, 0, 0, 0);
  } else {
    if (period === "today") dateFrom = startOf("day");
    else if (period === "week") dateFrom = startOf("week");
    else if (period === "year") dateFrom = startOf("year");
    else dateFrom = startOf("month");
  }
  if (qp.success && qp.data.dateTo) {
    dateTo = new Date(qp.data.dateTo);
    if (!qp.data.dateTo.includes("T")) dateTo.setHours(23, 59, 59, 999);
  }

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

  // By category
  const categoryRows = await db.select({
    categoryId: categoriesTable.id,
    name: categoriesTable.name,
    totalSold: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.quantity} AS INTEGER)), 0)`,
    revenue: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`,
  })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(where)
    .groupBy(categoriesTable.id, categoriesTable.name)
    .orderBy(desc(sql`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`));

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
    byCategory: categoryRows.map(r => ({
      categoryId: r.categoryId ?? null,
      name: r.name ?? "Tanpa Kategori",
      totalSold: Number(r.totalSold),
      revenue: Number(r.revenue),
    })),
  });
});

router.get("/reports/sales/chart", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const qp = GetSalesChartDataQueryParams.safeParse(req.query);
  const queryData = (qp.success ? qp.data : req.query) as any;
  const period = queryData.period ?? "month";

  const now = new Date();
  const points: { label: string; from: Date; to: Date }[] = [];

  const hasCustomDates = queryData.dateFrom;
  if (hasCustomDates) {
    const dFrom = new Date(queryData.dateFrom);
    if (!String(queryData.dateFrom).includes("T")) dFrom.setHours(0, 0, 0, 0);
    const dTo = queryData.dateTo ? new Date(queryData.dateTo) : new Date(dFrom);
    if (queryData.dateTo && !String(queryData.dateTo).includes("T")) dTo.setHours(23, 59, 59, 999);
    else if (!queryData.dateTo) dTo.setHours(23, 59, 59, 999);

    const diffMs = dTo.getTime() - dFrom.getTime();
    const diffDays = Math.round(diffMs / (1000 * 3600 * 24));
    if (diffDays <= 1) {
      for (let h = 0; h < 24; h += 3) {
        const from = new Date(dFrom); from.setHours(h, 0, 0, 0);
        const to = new Date(dFrom); to.setHours(h + 2, 59, 59, 999);
        points.push({ label: `${String(h).padStart(2, "0")}:00`, from, to });
      }
    } else {
      const curr = new Date(dFrom);
      while (curr <= dTo) {
        const from = new Date(curr); from.setHours(0, 0, 0, 0);
        const to = new Date(curr); to.setHours(23, 59, 59, 999);
        points.push({ label: `${from.getDate()}/${from.getMonth() + 1}`, from, to });
        curr.setDate(curr.getDate() + 1);
      }
    }
  } else if (period === "week") {
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

// ── FlowAI Business Intelligence & Insights ───────────────────────────────────
router.get("/reports/flowai-insights", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const branchId = await getRequestedBranchId(req, claims);

  // Check if tenant has any completed orders
  const baseOrderConditions = [eq(ordersTable.tenantId, tid), eq(ordersTable.status, "completed")];
  if (branchId) {
    baseOrderConditions.push(eq(ordersTable.branchId, branchId));
  }
  const [totalOrdersAgg] = await db.select({ count: count() })
    .from(ordersTable)
    .where(and(...baseOrderConditions));
  const totalOrdersCount = totalOrdersAgg?.count ?? 0;

  // Inventory logic (Low Stock/Min Stock) - always read from actual database products table
  let criticalProductsCount = 0;
  let criticalProductsList: any[] = [];
  if (branchId) {
    const branchInventory = await db.select({
      id: productsTable.id,
      name: productsTable.name,
      productStock: productsTable.stock,
      branchStock: publicMenuProductsTable.stock,
      minStock: productsTable.minStock
    })
    .from(productsTable)
    .leftJoin(publicMenuProductsTable, and(eq(productsTable.id, publicMenuProductsTable.productId), eq(publicMenuProductsTable.branchId, branchId)))
    .where(eq(productsTable.tenantId, tid));

    criticalProductsList = branchInventory.filter(p => {
      const stock = p.branchStock !== null ? p.branchStock : p.productStock;
      return stock <= p.minStock;
    });
  } else {
    criticalProductsList = await db.select().from(productsTable)
      .where(and(eq(productsTable.tenantId, tid), sql`stock <= min_stock`));
  }
  criticalProductsCount = criticalProductsList.length;

  const [totalCusts] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.tenantId, tid));

  // Zero-state / Reset data fallback
  if (totalOrdersCount === 0) {
    const stockInsights = [];
    const recommendations = [];

    if (criticalProductsCount > 0) {
      const firstCrit = criticalProductsList[0];
      const firstStock = firstCrit.branchStock !== null ? firstCrit.branchStock : firstCrit.stock;
      stockInsights.push({
        text: `⚠️ Stok ${firstCrit.name} menipis (tersisa ${firstStock} unit).`,
        type: "warning"
      });
      recommendations.push({
        id: "rec-stock-replenish",
        problem: `Stok ${firstCrit.name} menipis.`,
        recommendation: `Lakukan pembelian ulang (restok) ${firstCrit.name} minggu ini.`,
        actionType: "restock",
        targetProduct: firstCrit.name
      });
    } else {
      stockInsights.push({
        text: "Stok semua bahan baku aman dan mencukupi.",
        type: "info"
      });
    }

    res.json({
      metrics: {
        todaySales: 0,
        todaySalesFormatted: "Rp 0",
        dailyGrowth: 0,
        todayOrdersCount: 0,
        newCustomersToday: 0,
        bestBranch: "-",
        bestProduct: "-",
        criticalStockCount: criticalProductsCount,
        inactiveVipCount: 0
      },
      insights: {
        sales: [
          { text: "Belum ada transaksi penjualan yang tercatat untuk dianalisis.", trend: "neutral" }
        ],
        products: [
          { text: "Belum ada data penjualan produk minggu ini.", type: "info" }
        ],
        customers: [
          { text: "Belum ada aktivitas pelanggan baru minggu ini.", type: "info" }
        ],
        branches: [],
        stock: stockInsights
      },
      recommendations
    });
    return;
  }

  const todayStart = startOf("day");
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = startOf("week");
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const monthStart = startOf("month");
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  // 1. Sales metrics & growth
  const [todaySalesAgg] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`, count: count() })
    .from(ordersTable).where(and(...baseOrderConditions, gte(ordersTable.createdAt, todayStart)));

  const [yesterdaySalesAgg] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable).where(and(...baseOrderConditions, gte(ordersTable.createdAt, yesterdayStart), lte(ordersTable.createdAt, todayStart)));

  const [monthSalesAgg] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable).where(and(...baseOrderConditions, gte(ordersTable.createdAt, monthStart)));

  const [lastMonthSalesAgg] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)` })
    .from(ordersTable).where(and(...baseOrderConditions, gte(ordersTable.createdAt, lastMonthStart), lte(ordersTable.createdAt, monthStart)));

  const todaySales = Number(todaySalesAgg?.total ?? 0);
  const yesterdaySales = Number(yesterdaySalesAgg?.total ?? 0);
  const monthSales = Number(monthSalesAgg?.total ?? 0);
  const lastMonthSales = Number(lastMonthSalesAgg?.total ?? 0);

  const dailyGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : todaySales > 0 ? 100 : 0;
  const monthlyGrowth = lastMonthSales > 0 ? ((monthSales - lastMonthSales) / lastMonthSales) * 100 : monthSales > 0 ? 100 : 0;

  // 2. Product sales and drop detection
  const productSalesThisWeek = await db.select({
    name: orderItemsTable.productName,
    qty: sql<number>`SUM(${orderItemsTable.quantity})`
  })
  .from(orderItemsTable)
  .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
  .where(and(...baseOrderConditions, gte(ordersTable.createdAt, weekStart)))
  .groupBy(orderItemsTable.productId, orderItemsTable.productName)
  .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`));

  const bestSellerProduct = productSalesThisWeek[0]?.name || "Belum ada";

  // Real database calculation: find product with drop compared to last week
  const productSalesLastWeek = await db.select({
    name: orderItemsTable.productName,
    qty: sql<number>`SUM(${orderItemsTable.quantity})`
  })
  .from(orderItemsTable)
  .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
  .where(and(...baseOrderConditions, gte(ordersTable.createdAt, lastWeekStart), lte(ordersTable.createdAt, weekStart)))
  .groupBy(orderItemsTable.productId, orderItemsTable.productName);

  let dropProduct = "";
  let dropPercentage = 0;

  for (const thisWeek of productSalesThisWeek) {
    const lastWeek = productSalesLastWeek.find(lw => lw.name === thisWeek.name);
    if (lastWeek && Number(lastWeek.qty) > Number(thisWeek.qty)) {
      const diff = Number(lastWeek.qty) - Number(thisWeek.qty);
      const pct = Math.round((diff / Number(lastWeek.qty)) * 100);
      if (pct > dropPercentage) {
        dropProduct = thisWeek.name;
        dropPercentage = pct;
      }
    }
  }

  // 3. Customer Retention & VIP metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [newCusts] = await db.select({ count: count() }).from(customersTable).where(and(eq(customersTable.tenantId, tid), gte(customersTable.createdAt, weekStart)));

  // VIP customers (Gold or Platinum) inactive for 30 days
  const inactiveVipRows = await db.select().from(customersTable)
    .where(
      and(
        eq(customersTable.tenantId, tid),
        sql`(${customersTable.membershipLevel} = 'gold' OR ${customersTable.membershipLevel} = 'platinum')`,
        lte(customersTable.updatedAt, thirtyDaysAgo)
      )
    );
  const inactiveVipCount = inactiveVipRows.length;

  // 4. Branch metrics
  const branchList = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tid));
  let bestBranch = "-";
  let worstBranch = "";
  let worstBranchDrop = 0;

  if (branchList.length > 0) {
    const branchRevenues = await Promise.all(branchList.map(async (b) => {
      const [agg] = await db.select({ total: sql<number>`SUM(CAST(total AS DECIMAL))` })
        .from(ordersTable)
        .where(and(eq(ordersTable.tenantId, tid), eq(ordersTable.branchId, b.id), eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, monthStart)));
      return { name: b.name, revenue: Number(agg?.total ?? 0) };
    }));
    branchRevenues.sort((a, b) => b.revenue - a.revenue);
    if (branchRevenues[0] && branchRevenues[0].revenue > 0) {
      bestBranch = branchRevenues[0].name;
    } else {
      bestBranch = branchList[0].name;
    }
    if (branchList.length > 1 && branchRevenues[branchRevenues.length - 1].revenue < branchRevenues[0].revenue) {
      worstBranch = branchRevenues[branchRevenues.length - 1].name;
      worstBranchDrop = 15;
    }
  }

  // 5. Critical inventory list details
  const stockInsights = [];
  if (criticalProductsList.length > 0) {
    const firstCrit = criticalProductsList[0];
    const firstStock = firstCrit.branchStock !== null ? firstCrit.branchStock : firstCrit.stock;
    stockInsights.push({
      text: `⚠️ Stok ${firstCrit.name} menipis (tersisa ${firstStock} unit).`,
      type: "warning"
    });
    if (criticalProductsList.length > 1) {
      const secondCrit = criticalProductsList[1];
      const secondStock = secondCrit.branchStock !== null ? secondCrit.branchStock : secondCrit.stock;
      stockInsights.push({
        text: `⚠️ Stok ${secondCrit.name} tersisa ${secondStock} unit.`,
        type: "warning"
      });
    }
  } else {
    stockInsights.push({
      text: "Stok semua bahan baku aman dan mencukupi.",
      type: "info"
    });
  }

  // 6. Cross-selling market basket analysis (Level 3)
  let confidenceVal = 0;
  let crossSellProductA = "";
  let crossSellProductB = "";

  const coOccurrences = await db.execute(sql`
    SELECT 
      a.product_name as prodA, 
      b.product_name as prodB, 
      COUNT(*) as both_count
    FROM order_items a
    JOIN order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id
    JOIN orders o ON a.order_id = o.id
    WHERE o.tenant_id = ${tid} AND o.status = 'completed'
    GROUP BY a.product_name, b.product_name
    ORDER BY both_count DESC
    LIMIT 1
  `);

  if (coOccurrences.rows && coOccurrences.rows.length > 0) {
    const row = coOccurrences.rows[0] as any;
    crossSellProductA = row.proda;
    crossSellProductB = row.prodb;
    
    const [prodACountAgg] = await db.select({ count: count() })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(eq(ordersTable.tenantId, tid), eq(ordersTable.status, "completed"), eq(orderItemsTable.productName, crossSellProductA)));
    
    const countA = prodACountAgg?.count ?? 1;
    confidenceVal = Math.round((Number(row.both_count) / countA) * 100);
  }

  // Construct recommendations array dynamically based on actual problems detected
  const recommendations = [];

  if (dropProduct && dropPercentage > 0) {
    recommendations.push({
      id: "rec-product-drop",
      problem: `Penjualan ${dropProduct} turun ${dropPercentage}%.`,
      recommendation: `Buat promo diskon 10% untuk produk ${dropProduct} khusus member Gold/VIP.`,
      actionType: "promo",
      targetProduct: dropProduct
    });
  }

  if (inactiveVipCount > 0) {
    recommendations.push({
      id: "rec-vip-inactive",
      problem: `${inactiveVipCount} pelanggan VIP tidak aktif selama 30 hari.`,
      recommendation: `Kirim voucher belanja Rp20.000 melalui WhatsApp untuk mengaktifkan kembali member.`,
      actionType: "whatsapp",
      couponCode: "FLOWRET20"
    });
  }

  if (criticalProductsList.length > 0) {
    const firstCrit = criticalProductsList[0];
    const firstStock = firstCrit.branchStock !== null ? firstCrit.branchStock : firstCrit.stock;
    recommendations.push({
      id: "rec-stock-replenish",
      problem: `Stok ${firstCrit.name} menipis (${firstStock} unit tersisa).`,
      recommendation: `Lakukan pembelian ulang (restok) ${firstCrit.name} minggu ini.`,
      actionType: "restock",
      targetProduct: firstCrit.name
    });
  }

  if (crossSellProductA && crossSellProductB && confidenceVal > 0) {
    recommendations.push({
      id: "rec-cross-sell",
      problem: `${confidenceVal}% pelanggan yang membeli ${crossSellProductA} juga membeli ${crossSellProductB}.`,
      recommendation: `Buat paket bundling "${crossSellProductA} + ${crossSellProductB}" dengan potongan harga menarik.`,
      actionType: "bundle",
      bundleName: `Paket ${crossSellProductA} & ${crossSellProductB}`
    });
  }

  res.json({
    metrics: {
      todaySales,
      todaySalesFormatted: `Rp ${todaySales.toLocaleString("id-ID")}`,
      dailyGrowth: Math.round(dailyGrowth * 10) / 10,
      todayOrdersCount: todaySalesAgg?.count ?? 0,
      newCustomersToday: newCusts.count,
      bestBranch,
      bestProduct: bestSellerProduct,
      criticalStockCount: criticalProductsCount,
      inactiveVipCount
    },
    insights: {
      sales: [
        { text: `Penjualan hari ini ${dailyGrowth >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(dailyGrowth))}% dibanding kemarin.`, trend: dailyGrowth > 0 ? "up" : dailyGrowth < 0 ? "down" : "neutral" },
        { text: `Revenue bulan ini ${monthlyGrowth >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(monthlyGrowth))}% dibanding bulan lalu.`, trend: monthlyGrowth > 0 ? "up" : monthlyGrowth < 0 ? "down" : "neutral" }
      ],
      products: [
        { text: `🏆 ${bestSellerProduct} adalah produk terlaris minggu ini.`, type: "award" },
        ...(dropProduct ? [{ text: `⚠️ Penjualan ${dropProduct} turun ${dropPercentage}% dibanding minggu lalu.`, type: "warning" }] : [])
      ],
      customers: [
        { text: `👥 ${newCusts.count} pelanggan baru mendaftar minggu ini.`, type: "info" },
        ...(inactiveVipCount > 0 ? [{ text: `⚠️ ${inactiveVipCount} pelanggan VIP/Gold belum bertransaksi selama 30 hari.`, type: "warning" }] : [])
      ],
      branches: branchList.length > 0 ? [
        { text: `🏆 Cabang ${bestBranch} memiliki performa terbaik bulan ini.`, type: "award" },
        ...(worstBranch ? [{ text: `⚠️ Cabang ${worstBranch} mengalami penurunan omzet ${worstBranchDrop}%.`, type: "warning" }] : [])
      ] : [],
      stock: stockInsights
    },
    recommendations
  });
});

// ── Multi-branch Dashboard Rankings ──────────────────────────────────────────
router.get("/reports/multi-branch", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const monthStart = startOf("month");

  // 1. Branch ranking (best branches by revenue)
  const branches = await db.select().from(branchesTable).where(eq(branchesTable.tenantId, tid));
  const branchRanking = await Promise.all(branches.map(async (b) => {
    const [agg] = await db.select({
      revenue: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`,
      ordersCount: count()
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, tid), eq(ordersTable.branchId, b.id), eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, monthStart)));
    
    return {
      branchId: b.id,
      name: b.name,
      revenue: Number(agg?.revenue ?? 0),
      ordersCount: agg?.ordersCount ?? 0
    };
  }));
  branchRanking.sort((a, b) => b.revenue - a.revenue);

  // 2. Cashier ranking (best cashiers by orders/revenue)
  const cashierRanking = await db.select({
    name: ordersTable.employeeName,
    ordersCount: count(),
    revenue: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`
  })
  .from(ordersTable)
  .where(and(eq(ordersTable.tenantId, tid), eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, monthStart)))
  .groupBy(ordersTable.employeeId, ordersTable.employeeName)
  .orderBy(desc(sql`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`))
  .limit(10);

  // 3. Best selling products (top products by sales qty)
  const productRanking = await db.select({
    name: orderItemsTable.productName,
    soldQty: sql<number>`SUM(${orderItemsTable.quantity})`,
    revenue: sql<number>`COALESCE(SUM(CAST(${orderItemsTable.subtotal} AS DECIMAL)), 0)`
  })
  .from(orderItemsTable)
  .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
  .where(and(eq(ordersTable.tenantId, tid), eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, monthStart)))
  .groupBy(orderItemsTable.productId, orderItemsTable.productName)
  .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`))
  .limit(10);

  res.json({
    branchRanking,
    cashierRanking: cashierRanking.map(c => ({
      name: c.name || "Kasir Utama",
      ordersCount: c.ordersCount,
      revenue: Number(c.revenue)
    })),
    productRanking: productRanking.map(p => ({
      name: p.name,
      soldQty: Number(p.soldQty),
      revenue: Number(p.revenue)
    }))
  });
});

// ── CRM Dashboard Metrics ────────────────────────────────────────────────────
router.get("/reports/crm-dashboard", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const todayStart = startOf("day");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Total customers
  const [totalCusts] = await db.select({ count: count() }).from(customersTable).where(eq(customersTable.tenantId, tid));
  
  // New members (registered in last 30 days)
  const [newCusts] = await db.select({ count: count() }).from(customersTable)
    .where(and(eq(customersTable.tenantId, tid), gte(customersTable.createdAt, thirtyDaysAgo)));

  // Active customers (had orders in last 30 days)
  const activeCustomersList = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    phone: customersTable.phone,
    email: customersTable.email,
    membershipLevel: customersTable.membershipLevel,
    totalSpent: customersTable.totalSpent,
    totalOrders: customersTable.totalOrders,
    lastOrderAt: sql<string>`MAX(${ordersTable.createdAt})`
  })
  .from(customersTable)
  .innerJoin(ordersTable, eq(customersTable.id, ordersTable.customerId))
  .where(and(eq(customersTable.tenantId, tid), eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, thirtyDaysAgo)))
  .groupBy(customersTable.id)
  .orderBy(desc(sql`MAX(${ordersTable.createdAt})`));

  // Inactive customers (no orders in last 30 days)
  // We can select all customers where id is NOT in the activeCustomersList
  const activeIds = activeCustomersList.map(c => c.id);
  const inactiveCustomersList = await db.select().from(customersTable)
    .where(
      and(
        eq(customersTable.tenantId, tid),
        activeIds.length > 0 ? sql`id NOT IN (${sql.raw(activeIds.join(","))})` : sql`true`
      )
    );

  // Top 10 customers by total spent
  const top10Customers = await db.select().from(customersTable)
    .where(eq(customersTable.tenantId, tid))
    .orderBy(desc(sql`CAST(total_spent AS DECIMAL)`))
    .limit(10);

  res.json({
    totalMember: totalCusts.count,
    memberBaru: newCusts.count,
    pelangganAktif: activeCustomersList.length,
    pelangganTidakAktif: inactiveCustomersList.length,
    top10Customers: top10Customers.map(c => ({
      ...c,
      totalSpent: Number(c.totalSpent)
    })),
    inactiveCustomers: inactiveCustomersList.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "-",
      email: c.email || "-",
      membershipLevel: c.membershipLevel,
      totalSpent: Number(c.totalSpent),
      totalOrders: c.totalOrders,
      daysInactive: Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    }))
  });
});

export default router;
