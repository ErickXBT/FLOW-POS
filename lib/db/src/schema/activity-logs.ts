import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(), // login, logout, create_order, cancel_order, edit_product, adjust_stock, failed_login, etc.
  module: text("module"), // pos, inventory, orders, products, customers, etc.
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
