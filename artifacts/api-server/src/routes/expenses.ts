import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import { z } from "zod/v4";
import { extractToken, getRequestedBranchId } from "./auth";
import { logActivity } from "./activity";

const router: IRouter = Router();

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return claims;
}

const createExpenseSchema = z.object({
  desc: z.string().min(1, "Deskripsi pengeluaran tidak boleh kosong"),
  category: z.string().min(1, "Kategori tidak boleh kosong"),
  amount: z.coerce.number().min(0, "Jumlah pengeluaran tidak boleh negatif"),
  branchId: z.coerce.number().optional().nullable(),
});

router.get("/expenses", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const tid = claims.tenantId!;
  const branchId = await getRequestedBranchId(req, claims);

  const conditions = [eq(expensesTable.tenantId, tid)];
  if (branchId) {
    conditions.push(eq(expensesTable.branchId, branchId));
  }

  try {
    const rows = await db
      .select()
      .from(expensesTable)
      .where(and(...conditions))
      .orderBy(desc(expensesTable.createdAt));

    res.json(
      rows.map(r => ({
        ...r,
        amount: Number(r.amount),
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal mengambil data pengeluaran" });
  }
});

router.post("/expenses", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = createExpenseSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message || "Input tidak valid" });
    return;
  }

  const branchId = body.data.branchId || await getRequestedBranchId(req, claims);

  try {
    const [expense] = await db
      .insert(expensesTable)
      .values({
        tenantId: claims.tenantId!,
        branchId: branchId || null,
        desc: body.data.desc,
        category: body.data.category,
        amount: String(body.data.amount),
      })
      .returning();

    await logActivity({
      tenantId: claims.tenantId,
      userId: claims.userId,
      userName: claims.role === "owner" ? "Owner" : "Manager",
      userRole: claims.role,
      action: "create_expense",
      module: "expenses",
      details: { expenseId: expense.id, desc: expense.desc, amount: Number(expense.amount) },
      ipAddress: req.ip,
    });

    res.status(201).json({
      ...expense,
      amount: Number(expense.amount),
      createdAt: expense.createdAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal mencatat pengeluaran" });
  }
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID tidak valid" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, claims.tenantId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Pengeluaran tidak ditemukan" });
      return;
    }

    await logActivity({
      tenantId: claims.tenantId,
      userId: claims.userId,
      userName: claims.role === "owner" ? "Owner" : "Manager",
      userRole: claims.role,
      action: "delete_expense",
      module: "expenses",
      details: { expenseId: deleted.id, desc: deleted.desc, amount: Number(deleted.amount) },
      ipAddress: req.ip,
    });

    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal menghapus pengeluaran" });
  }
});

export default router;
