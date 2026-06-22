import { Router, type IRouter } from "express";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";
import { db, shiftsTable, ordersTable, usersTable, branchesTable } from "@workspace/db";
import { extractToken, getRequestedBranchId } from "./auth";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return claims;
}

// 1. Get currently active shift
router.get("/shifts/active", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = await getRequestedBranchId(req, claims);
  if (!branchId) {
    res.status(400).json({ error: "Branch ID diperlukan untuk melihat shift kasir" });
    return;
  }

  const [activeShift] = await db
    .select()
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.tenantId, claims.tenantId!),
        eq(shiftsTable.branchId, branchId),
        eq(shiftsTable.userId, claims.userId),
        eq(shiftsTable.status, "open")
      )
    )
    .limit(1);

  if (!activeShift) {
    res.json(null);
  } else {
    // Also calculate current expected cash sales so far
    const [cashSalesAgg] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.tenantId, claims.tenantId!),
          eq(ordersTable.branchId, branchId),
          eq(ordersTable.shiftId, activeShift.id),
          eq(ordersTable.status, "completed"),
          eq(ordersTable.paymentMethod, "cash")
        )
      );

    const cashSales = Number(cashSalesAgg?.total ?? 0);
    const expectedCash = Number(activeShift.openingCash) + cashSales;

    res.json({
      ...activeShift,
      expectedCash,
      cashSales
    });
  }
});

// 2. Start new shift
router.post("/shifts/start", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { openingCash, branchId, cashierName } = req.body;
  if (!branchId) {
    res.status(400).json({ error: "Branch ID diperlukan untuk memulai shift" });
    return;
  }

  // Check if there is already an active shift for this user & branch
  const [existing] = await db
    .select()
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.tenantId, claims.tenantId!),
        eq(shiftsTable.branchId, Number(branchId)),
        eq(shiftsTable.userId, claims.userId),
        eq(shiftsTable.status, "open")
      )
    )
    .limit(1);

  if (existing) {
    res.status(400).json({ error: "Anda sudah memiliki shift yang aktif di cabang ini" });
    return;
  }

  const [newShift] = await db
    .insert(shiftsTable)
    .values({
      tenantId: claims.tenantId!,
      branchId: Number(branchId),
      userId: claims.userId,
      cashierName: cashierName || "Kasir",
      openingCash: String(openingCash || 0),
      status: "open",
    })
    .returning();

  res.status(201).json(newShift);
});

// 3. End shift
router.post("/shifts/end", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const { shiftId, closingCash, actualCash, notes } = req.body;
  if (!shiftId) {
    res.status(400).json({ error: "Shift ID diperlukan untuk mengakhiri shift" });
    return;
  }

  const [shift] = await db
    .select()
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.id, Number(shiftId)),
        eq(shiftsTable.tenantId, claims.tenantId!),
        eq(shiftsTable.status, "open")
      )
    )
    .limit(1);

  if (!shift) {
    res.status(404).json({ error: "Shift aktif tidak ditemukan" });
    return;
  }

  // Calculate expected cash = openingCash + sum(cash completed orders)
  const [cashSalesAgg] = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(total AS DECIMAL)), 0)`
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, claims.tenantId!),
        eq(ordersTable.branchId, shift.branchId),
        eq(ordersTable.shiftId, shift.id),
        eq(ordersTable.status, "completed"),
        eq(ordersTable.paymentMethod, "cash")
      )
    );

  const cashSales = Number(cashSalesAgg?.total ?? 0);
  const expectedCash = Number(shift.openingCash) + cashSales;
  const discrepancy = Number(actualCash || 0) - expectedCash;

  const [updatedShift] = await db
    .update(shiftsTable)
    .set({
      closingCash: String(closingCash || 0),
      expectedCash: String(expectedCash),
      actualCash: String(actualCash || 0),
      discrepancy: String(discrepancy),
      status: "closed",
      closedAt: new Date(),
      notes: notes || null
    })
    .where(eq(shiftsTable.id, shift.id))
    .returning();

  res.json(updatedShift);
});

// 4. Get shifts history/reports
router.get("/shifts/reports", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions = [eq(shiftsTable.tenantId, claims.tenantId!)];

  if (branchId) {
    conditions.push(eq(shiftsTable.branchId, branchId));
  }

  const reports = await db
    .select({
      id: shiftsTable.id,
      branchName: branchesTable.name,
      cashierName: shiftsTable.cashierName,
      openingCash: shiftsTable.openingCash,
      closingCash: shiftsTable.closingCash,
      expectedCash: shiftsTable.expectedCash,
      actualCash: shiftsTable.actualCash,
      discrepancy: shiftsTable.discrepancy,
      status: shiftsTable.status,
      openedAt: shiftsTable.openedAt,
      closedAt: shiftsTable.closedAt,
      notes: shiftsTable.notes
    })
    .from(shiftsTable)
    .innerJoin(branchesTable, eq(shiftsTable.branchId, branchesTable.id))
    .where(and(...conditions))
    .orderBy(desc(shiftsTable.openedAt));

  // Format response numbers
  const formatted = reports.map(r => ({
    ...r,
    openingCash: Number(r.openingCash),
    closingCash: r.closingCash ? Number(r.closingCash) : null,
    expectedCash: r.expectedCash ? Number(r.expectedCash) : null,
    actualCash: r.actualCash ? Number(r.actualCash) : null,
    discrepancy: r.discrepancy ? Number(r.discrepancy) : null,
  }));

  res.json(formatted);
});

// 5. Get detail of specific shift
router.get("/shifts/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const [shift] = await db
    .select()
    .from(shiftsTable)
    .where(
      and(
        eq(shiftsTable.id, Number(req.params.id)),
        eq(shiftsTable.tenantId, claims.tenantId!)
      )
    )
    .limit(1);

  if (!shift) {
    res.status(404).json({ error: "Shift tidak ditemukan" });
    return;
  }

  // Fetch orders in this shift
  const shiftOrders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, claims.tenantId!),
        eq(ordersTable.shiftId, shift.id)
      )
    )
    .orderBy(desc(ordersTable.createdAt));

  res.json({
    shift: {
      ...shift,
      openingCash: Number(shift.openingCash),
      closingCash: shift.closingCash ? Number(shift.closingCash) : null,
      expectedCash: shift.expectedCash ? Number(shift.expectedCash) : null,
      actualCash: shift.actualCash ? Number(shift.actualCash) : null,
      discrepancy: shift.discrepancy ? Number(shift.discrepancy) : null,
    },
    orders: shiftOrders.map(o => ({
      ...o,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      tax: Number(o.tax),
      total: Number(o.total),
    }))
  });
});

export default router;
