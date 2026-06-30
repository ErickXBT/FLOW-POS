import { pgTable, serial, text, timestamp, integer, numeric, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { branchesTable } from "./branches";
import { customersTable } from "./customers";
import { employeesTable } from "./employees";

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // duration in minutes
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("0.00"), // in percentage (e.g. 10.00 for 10%)
  description: text("description"),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    tenantIdIdx: index("services_tenant_id_idx").on(table.tenantId),
  };
});

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  appointmentDate: date("appointment_date").notNull(),
  startTime: text("start_time").notNull(), // e.g. "10:00"
  endTime: text("end_time").notNull(),   // e.g. "11:00"
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  commissionPaid: numeric("commission_paid", { precision: 10, scale: 2 }).notNull().default("0.00"), // calculated commission
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, paid, partial
  status: text("status").notNull().default("confirmed"), // pending, confirmed, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    tenantIdIdx: index("appointments_tenant_id_idx").on(table.tenantId),
    employeeIdIdx: index("appointments_employee_id_idx").on(table.employeeId),
    appointmentDateIdx: index("appointments_date_idx").on(table.appointmentDate),
  };
});
