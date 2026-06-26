import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const employeeShiftsTable = pgTable("employee_shifts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Shift Pagi", "Shift Sore"
  startTime: text("start_time").notNull(), // e.g., "08:00"
  endTime: text("end_time").notNull(), // e.g., "17:00"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmployeeShiftSchema = createInsertSchema(employeeShiftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type EmployeeShift = typeof employeeShiftsTable.$inferSelect;
