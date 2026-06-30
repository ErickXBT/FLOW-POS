import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  bookingResourcesTable,
  bookingsTable,
  customersTable,
} from "@workspace/db";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  CreateBookingResourceBody,
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

// ── Booking Resources ──

router.get("/tenant/booking-resources", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(bookingResourcesTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(eq(bookingResourcesTable.branchId, branchId));
  }

  const list = await db
    .select()
    .from(bookingResourcesTable)
    .where(and(...conditions))
    .orderBy(desc(bookingResourcesTable.createdAt));

  res.json(
    list.map((item) => ({
      ...item,
      priceWeekday: Number(item.priceWeekday),
      priceWeekend: Number(item.priceWeekend),
      priceMember: Number(item.priceMember),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  );
});

router.post("/tenant/booking-resources", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateBookingResourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const branchId = await getRequestedBranchId(req, claims);

  const [resource] = await db
    .insert(bookingResourcesTable)
    .values({
      ...body.data,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      priceWeekday: String(body.data.priceWeekday),
      priceWeekend: String(body.data.priceWeekend),
      priceMember: String(body.data.priceMember),
    })
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "User",
    userRole: claims.role,
    action: "create_booking_resource",
    module: "booking",
    details: { name: resource.name, id: resource.id },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...resource,
    priceWeekday: Number(resource.priceWeekday),
    priceWeekend: Number(resource.priceWeekend),
    priceMember: Number(resource.priceMember),
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  });
});

router.patch("/tenant/booking-resources/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [resource] = await db
    .update(bookingResourcesTable)
    .set({
      ...req.body,
      priceWeekday: req.body.priceWeekday !== undefined ? String(req.body.priceWeekday) : undefined,
      priceWeekend: req.body.priceWeekend !== undefined ? String(req.body.priceWeekend) : undefined,
      priceMember: req.body.priceMember !== undefined ? String(req.body.priceMember) : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookingResourcesTable.id, id),
        eq(bookingResourcesTable.tenantId, claims.tenantId!)
      )
    )
    .returning();

  if (!resource) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  res.json({
    ...resource,
    priceWeekday: Number(resource.priceWeekday),
    priceWeekend: Number(resource.priceWeekend),
    priceMember: Number(resource.priceMember),
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  });
});

router.delete("/tenant/booking-resources/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);

  // Check if there are active bookings for this resource
  const activeBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.resourceId, id),
        eq(bookingsTable.status, "confirmed")
      )
    );

  if (activeBookings.length > 0) {
    res.status(400).json({ error: "Cannot delete resource with active bookings." });
    return;
  }

  await db
    .delete(bookingResourcesTable)
    .where(
      and(
        eq(bookingResourcesTable.id, id),
        eq(bookingResourcesTable.tenantId, claims.tenantId!)
      )
    );

  res.sendStatus(204);
});

// ── Bookings ──

router.get("/tenant/bookings", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const parsedQuery = ListBookingsQueryParams.safeParse(req.query);
  const filterDate = parsedQuery.success ? parsedQuery.data.date : undefined;

  const branchId = await getRequestedBranchId(req, claims);
  const conditions: any[] = [eq(bookingsTable.tenantId, claims.tenantId!)];
  if (branchId) {
    conditions.push(eq(bookingsTable.branchId, branchId));
  }
  if (filterDate) {
    conditions.push(eq(bookingsTable.bookingDate, filterDate));
  }

  const list = await db
    .select({
      booking: bookingsTable,
      resourceName: bookingResourcesTable.name,
    })
    .from(bookingsTable)
    .innerJoin(
      bookingResourcesTable,
      eq(bookingsTable.resourceId, bookingResourcesTable.id)
    )
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.createdAt));

  res.json(
    list.map((item) => ({
      ...item.booking,
      resourceName: item.resourceName,
      totalPrice: Number(item.booking.totalPrice),
      createdAt: item.booking.createdAt.toISOString(),
      updatedAt: item.booking.updatedAt.toISOString(),
    }))
  );
});

router.post("/tenant/bookings", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const branchId = await getRequestedBranchId(req, claims);

  // Check if slot is already occupied
  const existing = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.resourceId, body.data.resourceId),
        eq(bookingsTable.bookingDate, body.data.bookingDate),
        eq(bookingsTable.startTime, body.data.startTime),
        eq(bookingsTable.status, "confirmed")
      )
    );

  if (existing.length > 0) {
    res.status(400).json({ error: "Jadwal slot waktu ini sudah dipesan." });
    return;
  }

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      ...body.data,
      tenantId: claims.tenantId!,
      branchId: branchId ?? null,
      totalPrice: String(body.data.totalPrice),
    })
    .returning();

  await logActivity({
    tenantId: claims.tenantId,
    userId: claims.userId,
    userName: "User",
    userRole: claims.role,
    action: "create_booking",
    module: "booking",
    details: { id: booking.id, customer: booking.customerName, date: booking.bookingDate },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  });
});

router.get("/tenant/bookings/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [item] = await db
    .select({
      booking: bookingsTable,
      resourceName: bookingResourcesTable.name,
    })
    .from(bookingsTable)
    .innerJoin(
      bookingResourcesTable,
      eq(bookingsTable.resourceId, bookingResourcesTable.id)
    )
    .where(
      and(
        eq(bookingsTable.id, id),
        eq(bookingsTable.tenantId, claims.tenantId!)
      )
    )
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json({
    ...item.booking,
    resourceName: item.resourceName,
    totalPrice: Number(item.booking.totalPrice),
    createdAt: item.booking.createdAt.toISOString(),
    updatedAt: item.booking.updatedAt.toISOString(),
  });
});

router.patch("/tenant/bookings/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [booking] = await db
    .update(bookingsTable)
    .set({
      ...req.body,
      totalPrice: req.body.totalPrice !== undefined ? String(req.body.totalPrice) : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(eq(bookingsTable.id, id), eq(bookingsTable.tenantId, claims.tenantId!))
    )
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  });
});

router.delete("/tenant/bookings/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  await db
    .delete(bookingsTable)
    .where(
      and(eq(bookingsTable.id, id), eq(bookingsTable.tenantId, claims.tenantId!))
    );

  res.sendStatus(204);
});

router.post("/tenant/bookings/:id/check-in", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [booking] = await db
    .update(bookingsTable)
    .set({
      status: "checked_in",
      updatedAt: new Date(),
    })
    .where(
      and(eq(bookingsTable.id, id), eq(bookingsTable.tenantId, claims.tenantId!))
    )
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  });
});

router.post("/tenant/bookings/:id/complete", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const id = Number(req.params.id);
  const [booking] = await db
    .update(bookingsTable)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(eq(bookingsTable.id, id), eq(bookingsTable.tenantId, claims.tenantId!))
    )
    .returning();

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json({
    ...booking,
    totalPrice: Number(booking.totalPrice),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  });
});

export default router;
