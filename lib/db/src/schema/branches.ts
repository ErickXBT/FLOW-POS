import { pgTable, serial, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  status: text("status").notNull().default("active"), // active, inactive, locked
  franchiseeId: integer("franchisee_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const branchUsersTable = pgTable("branch_users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branchSettingsTable = pgTable("branch_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  qrMenuEnabled: boolean("qr_menu_enabled").notNull().default(true),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  receiptFooter: text("receipt_footer"),
  printerSettings: text("printer_settings"), // JSON string
  paymentMethods: text("payment_methods"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const branchSubscriptionsTable = pgTable("branch_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branchActivityLogsTable = pgTable("branch_activity_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;
export type BranchUser = typeof branchUsersTable.$inferSelect;
export type BranchSetting = typeof branchSettingsTable.$inferSelect;
export type BranchSubscription = typeof branchSubscriptionsTable.$inferSelect;
export type BranchActivityLog = typeof branchActivityLogsTable.$inferSelect;

