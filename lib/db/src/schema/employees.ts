import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";
import { customRolesTable } from "./custom-roles";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default("cashier"), // manager, cashier, kitchen_staff, delivery_staff, staff
  isActive: boolean("is_active").notNull().default(true),
  tenantId: integer("tenant_id").notNull(),
  userId: integer("user_id"), // linked user account (if they can log in)
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  customRoleId: integer("custom_role_id").references(() => customRolesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
