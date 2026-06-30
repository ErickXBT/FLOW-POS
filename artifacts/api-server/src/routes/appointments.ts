import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  servicesTable,
  appointmentsTable,
  employeesTable,
} from "@workspace/db";
import {
  ListAppointmentsQueryParams,
  CreateAppointmentBody,
  CreateServiceBody,
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

// ── Services ──

router.get("/tenant/services", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(servicesTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(eq(servicesTable.branchId, branchId));
  }

  const list = await db
    .select()
    .from(servicesTable)
    .where(and(...conditions))
    .orderBy(desc(servicesTable.createdAt));

  res.json(
    list.map((item) => ({
      ...item,
      price: Number(item.price),
      commissionRate: Number(item.commissionRate),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  );
});

router.post("/tenant/services", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const branchId = await getRequestedBranchId(req, claims);

  const [service] = await db
    .insert(servicesTable)
    .values({
      ...body.data,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      price: String(body.data.price),
      commissionRate: String(body.data.commissionRate),
    })
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "User",
    userRole: claims.role,
    action: "create_service",
    module: "appointment",
    details: { name: service.name, id: service.id },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...service,
    price: Number(service.price),
    commissionRate: Number(service.commissionRate),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  });
});

router.patch("/tenant/services/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [service] = await db
    .update(servicesTable)
    .set({
      ...req.body,
      price: req.body.price !== undefined ? String(req.body.price) : undefined,
      commissionRate: req.body.commissionRate !== undefined ? String(req.body.commissionRate) : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(eq(servicesTable.id, id), eq(servicesTable.tenantId, claims.tenantId!))
    )
    .returning();

  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json({
    ...service,
    price: Number(service.price),
    commissionRate: Number(service.commissionRate),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  });
});

router.delete("/tenant/services/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  await db
    .delete(servicesTable)
    .where(
      and(eq(servicesTable.id, id), eq(servicesTable.tenantId, claims.tenantId!))
    );

  res.sendStatus(204);
});

// ── Appointments ──

router.get("/tenant/appointments", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const parsedQuery = ListAppointmentsQueryParams.safeParse(req.query);
  const filterDate = parsedQuery.success ? parsedQuery.data.date : undefined;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(appointmentsTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(eq(appointmentsTable.branchId, branchId));
  }
  if (filterDate) {
    conditions.push(eq(appointmentsTable.appointmentDate, filterDate));
  }

  const list = await db
    .select({
      appointment: appointmentsTable,
      employeeName: employeesTable.name,
      serviceName: servicesTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(
      employeesTable,
      eq(appointmentsTable.employeeId, employeesTable.id)
    )
    .innerJoin(
      servicesTable,
      eq(appointmentsTable.serviceId, servicesTable.id)
    )
    .where(and(...conditions))
    .orderBy(desc(appointmentsTable.createdAt));

  res.json(
    list.map((item) => ({
      ...item.appointment,
      employeeName: item.employeeName,
      serviceName: item.serviceName,
      totalPrice: Number(item.appointment.totalPrice),
      commissionPaid: Number(item.appointment.commissionPaid),
      createdAt: item.appointment.createdAt.toISOString(),
      updatedAt: item.appointment.updatedAt.toISOString(),
    }))
  );
});

router.post("/tenant/appointments", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateAppointmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const branchId = await getRequestedBranchId(req, claims);

  // Validate double booking for employee
  const existing = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.employeeId, body.data.employeeId),
        eq(appointmentsTable.appointmentDate, body.data.appointmentDate),
        eq(appointmentsTable.startTime, body.data.startTime),
        eq(appointmentsTable.status, "confirmed")
      )
    );

  if (existing.length > 0) {
    res.status(400).json({ error: "Staff/Karyawan sudah memiliki janji temu di jam ini." });
    return;
  }

  // Get service details for automatic commission calculation
  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, body.data.serviceId))
    .limit(1);

  if (!service) {
    res.status(400).json({ error: "Layanan tidak ditemukan." });
    return;
  }

  // Calculate commission paid
  const basePrice = Number(body.data.totalPrice);
  const commissionRatePercent = Number(service.commissionRate);
  const calculatedCommission = (basePrice * commissionRatePercent) / 100;

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      ...body.data,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      totalPrice: String(body.data.totalPrice),
      commissionPaid: String(calculatedCommission),
    })
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "User",
    userRole: claims.role,
    action: "create_appointment",
    module: "appointment",
    details: { id: appointment.id, customer: appointment.customerName, date: appointment.appointmentDate },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...appointment,
    totalPrice: Number(appointment.totalPrice),
    commissionPaid: Number(appointment.commissionPaid),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  });
});

router.get("/tenant/appointments/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [item] = await db
    .select({
      appointment: appointmentsTable,
      employeeName: employeesTable.name,
      serviceName: servicesTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(
      employeesTable,
      eq(appointmentsTable.employeeId, employeesTable.id)
    )
    .innerJoin(
      servicesTable,
      eq(appointmentsTable.serviceId, servicesTable.id)
    )
    .where(
      and(
        eq(appointmentsTable.id, id),
        eq(appointmentsTable.tenantId, claims.tenantId!)
      )
    )
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json({
    ...item.appointment,
    employeeName: item.employeeName,
    serviceName: item.serviceName,
    totalPrice: Number(item.appointment.totalPrice),
    commissionPaid: Number(item.appointment.commissionPaid),
    createdAt: item.appointment.createdAt.toISOString(),
    updatedAt: item.appointment.updatedAt.toISOString(),
  });
});

router.patch("/tenant/appointments/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  
  // Re-calculate commission if totalPrice changes
  let extraUpdates: any = {};
  if (req.body.totalPrice !== undefined) {
    const [existing] = await db
      .select({ serviceId: appointmentsTable.serviceId })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .limit(1);

    if (existing) {
      const [service] = await db
        .select({ commissionRate: servicesTable.commissionRate })
        .from(servicesTable)
        .where(eq(servicesTable.id, existing.serviceId))
        .limit(1);

      if (service) {
        const basePrice = Number(req.body.totalPrice);
        const commissionRatePercent = Number(service.commissionRate);
        const calculatedCommission = (basePrice * commissionRatePercent) / 100;
        extraUpdates.commissionPaid = String(calculatedCommission);
      }
    }
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({
      ...req.body,
      totalPrice: req.body.totalPrice !== undefined ? String(req.body.totalPrice) : undefined,
      ...extraUpdates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointmentsTable.id, id),
        eq(appointmentsTable.tenantId, claims.tenantId!)
      )
    )
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json({
    ...appointment,
    totalPrice: Number(appointment.totalPrice),
    commissionPaid: Number(appointment.commissionPaid),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  });
});

router.delete("/tenant/appointments/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  await db
    .delete(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.id, id),
        eq(appointmentsTable.tenantId, claims.tenantId!)
      )
    );

  res.sendStatus(204);
});

export default router;
