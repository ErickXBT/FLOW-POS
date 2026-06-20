import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  totalSpent: numeric("total_spent", { precision: 15, scale: 2 }).notNull().default("0"),
  totalOrders: integer("total_orders").notNull().default(0),
  membershipLevel: text("membership_level").notNull().default("regular"), // regular, silver, gold, platinum
  notes: text("notes"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
