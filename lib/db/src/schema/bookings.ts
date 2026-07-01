import { pgTable, serial, text, timestamp, integer, numeric, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { branchesTable } from "./branches";
import { customersTable } from "./customers";

export const bookingResourcesTable = pgTable("booking_resources", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // court, room, studio, table, vehicle, asset
  description: text("description"),
  status: text("status").notNull().default("active"), // active, inactive, maintenance
  priceWeekday: numeric("price_weekday", { precision: 10, scale: 2 }).notNull().default("0.00"),
  priceWeekend: numeric("price_weekend", { precision: 10, scale: 2 }).notNull().default("0.00"),
  priceMember: numeric("price_member", { precision: 10, scale: 2 }).notNull().default("0.00"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    tenantIdIdx: index("booking_resources_tenant_id_idx").on(table.tenantId),
  };
});

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  resourceId: integer("resource_id").notNull().references(() => bookingResourcesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  bookingDate: date("booking_date").notNull(),
  startTime: text("start_time").notNull(), // e.g., "08:00"
  endTime: text("end_time").notNull(),   // e.g., "09:00"
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, paid, partial
  status: text("status").notNull().default("confirmed"), // pending, confirmed, checked_in, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    tenantIdIdx: index("bookings_tenant_id_idx").on(table.tenantId),
    resourceIdIdx: index("bookings_resource_id_idx").on(table.resourceId),
    bookingDateIdx: index("bookings_booking_date_idx").on(table.bookingDate),
  };
});
