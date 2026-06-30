import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  workOrdersTable,
  employeesTable,
} from "@workspace/db";
import {
  ListWorkOrdersQueryParams,
  CreateWorkOrderBody,
} from "@workspace/api-zod";
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

// ── Work Orders ──

router.get("/tenant/work-orders", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const parsedQuery = ListWorkOrdersQueryParams.safeParse(req.query);
  const filterStatus = parsedQuery.success ? parsedQuery.data.status : undefined;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(workOrdersTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(eq(workOrdersTable.branchId, branchId));
  }
  if (filterStatus) {
    conditions.push(eq(workOrdersTable.status, filterStatus));
  }

  const list = await db
    .select({
      wo: workOrdersTable,
      technicianName: employeesTable.name,
    })
    .from(workOrdersTable)
    .leftJoin(
      employeesTable,
      eq(workOrdersTable.technicianId, employeesTable.id)
    )
    .where(and(...conditions))
    .orderBy(desc(workOrdersTable.createdAt));

  res.json(
    list.map((item) => ({
      ...item.wo,
      technicianName: item.technicianName || "Unassigned",
      servicePrice: Number(item.wo.servicePrice),
      sparepartsPrice: Number(item.wo.sparepartsPrice),
      totalPrice: Number(item.wo.totalPrice),
      createdAt: item.wo.createdAt.toISOString(),
      updatedAt: item.wo.createdAt.toISOString(),
    }))
  );
});

router.post("/tenant/work-orders", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateWorkOrderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const branchId = await getRequestedBranchId(req, claims);

  // Calculate total price
  const svcPrice = Number(body.data.servicePrice || 0);
  const sparePrice = Number(body.data.sparepartsPrice || 0);
  const total = svcPrice + sparePrice;

  const [wo] = await db
    .insert(workOrdersTable)
    .values({
      ...body.data,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      servicePrice: String(svcPrice),
      sparepartsPrice: String(sparePrice),
      totalPrice: String(total),
    })
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "User",
    userRole: claims.role,
    action: "create_work_order",
    module: "service",
    details: { id: wo.id, device: wo.deviceName, customer: wo.customerName },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...wo,
    servicePrice: Number(wo.servicePrice),
    sparepartsPrice: Number(wo.sparepartsPrice),
    totalPrice: Number(wo.totalPrice),
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
  });
});

router.get("/tenant/work-orders/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [item] = await db
    .select({
      wo: workOrdersTable,
      technicianName: employeesTable.name,
    })
    .from(workOrdersTable)
    .leftJoin(
      employeesTable,
      eq(workOrdersTable.technicianId, employeesTable.id)
    )
    .where(
      and(
        eq(workOrdersTable.id, id),
        eq(workOrdersTable.tenantId, claims.tenantId!)
      )
    )
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Work order not found" });
    return;
  }

  res.json({
    ...item.wo,
    technicianName: item.technicianName || "Unassigned",
    servicePrice: Number(item.wo.servicePrice),
    sparepartsPrice: Number(item.wo.sparepartsPrice),
    totalPrice: Number(item.wo.totalPrice),
    createdAt: item.wo.createdAt.toISOString(),
    updatedAt: item.wo.updatedAt.toISOString(),
  });
});

router.patch("/tenant/work-orders/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);

  // Load existing details for pricing recalculation if needed
  const [existing] = await db
    .select({
      servicePrice: workOrdersTable.servicePrice,
      sparepartsPrice: workOrdersTable.sparepartsPrice,
    })
    .from(workOrdersTable)
    .where(eq(workOrdersTable.id, id))
    .limit(1);

  let extraUpdates: any = {};
  if (req.body.servicePrice !== undefined || req.body.sparepartsPrice !== undefined || existing) {
    const svcPrice = req.body.servicePrice !== undefined ? Number(req.body.servicePrice) : Number(existing?.servicePrice || 0);
    const sparePrice = req.body.sparepartsPrice !== undefined ? Number(req.body.sparepartsPrice) : Number(existing?.sparepartsPrice || 0);
    extraUpdates.totalPrice = String(svcPrice + sparePrice);
  }

  const [wo] = await db
    .update(workOrdersTable)
    .set({
      ...req.body,
      servicePrice: req.body.servicePrice !== undefined ? String(req.body.servicePrice) : undefined,
      sparepartsPrice: req.body.sparepartsPrice !== undefined ? String(req.body.sparepartsPrice) : undefined,
      ...extraUpdates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workOrdersTable.id, id),
        eq(workOrdersTable.tenantId, claims.tenantId!)
      )
    )
    .returning();

  if (!wo) {
    res.status(404).json({ error: "Work order not found" });
    return;
  }

  res.json({
    ...wo,
    servicePrice: Number(wo.servicePrice),
    sparepartsPrice: Number(wo.sparepartsPrice),
    totalPrice: Number(wo.totalPrice),
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
  });
});

router.delete("/tenant/work-orders/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  await db
    .delete(workOrdersTable)
    .where(
      and(
        eq(workOrdersTable.id, id),
        eq(workOrdersTable.tenantId, claims.tenantId!)
      )
    );

  res.sendStatus(204);
});

export default router;
