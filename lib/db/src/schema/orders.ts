import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("completed"), // pending, completed, cancelled, refunded
  paymentMethod: text("payment_method").notNull(), // cash, qris, bank_transfer, ewallet, credit_card
  notes: text("notes"),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  shiftId: integer("shift_id"),
  voidReason: text("void_reason"),
  voidedBy: integer("voided_by"),
  voidedByName: text("voided_by_name"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  isClaimReward: boolean("is_claim_reward").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  variantSelection: text("variant_selection"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
