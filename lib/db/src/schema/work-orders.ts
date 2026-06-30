import { pgTable, serial, text, timestamp, integer, numeric, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { branchesTable } from "./branches";
import { customersTable } from "./customers";
import { employeesTable } from "./employees";

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  technicianId: integer("technician_id").references(() => employeesTable.id),
  deviceName: text("device_name").notNull(), // e.g. Honda Vario, AC Panasonic, iPhone 13
  deviceIdentifier: text("device_identifier"), // License plate, Serial Number, IMEI
  problemDescription: text("problem_description").notNull(),
  servicePrice: numeric("service_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  sparepartsPrice: numeric("spareparts_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  sparepartsDetails: text("spareparts_details"),
  warrantyDays: integer("warranty_days").notNull().default(0),
  status: text("status").notNull().default("queue"), // queue, inspecting, repairing, testing, completed, cancelled
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, paid
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    tenantIdIdx: index("work_orders_tenant_id_idx").on(table.tenantId),
    technicianIdIdx: index("work_orders_technician_id_idx").on(table.technicianId),
    statusIdx: index("work_orders_status_idx").on(table.status),
  };
});
