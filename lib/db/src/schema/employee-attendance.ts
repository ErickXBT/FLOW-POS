import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { employeesTable } from "./employees";
import { branchesTable } from "./branches";
import { employeeShiftsTable } from "./employee-shifts";

export const employeeAttendanceTable = pgTable("employee_attendance", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  employeeShiftId: integer("employee_shift_id").references(() => employeeShiftsTable.id, { onDelete: "set null" }),
  checkInTime: timestamp("check_in_time", { withTimezone: true }).notNull().defaultNow(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),
  checkInPhoto: text("check_in_photo").notNull(),
  checkOutPhoto: text("check_out_photo"),
  checkInStatus: text("check_in_status").notNull(), // "Tepat Waktu", "Terlambat", "Luar Shift"
  checkOutStatus: text("check_out_status"), // "Tepat Waktu", "Pulang Cepat", "Lembur"
  checkInNotes: text("check_in_notes"),
  checkOutNotes: text("check_out_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmployeeAttendanceSchema = createInsertSchema(employeeAttendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type EmployeeAttendance = typeof employeeAttendanceTable.$inferSelect;
