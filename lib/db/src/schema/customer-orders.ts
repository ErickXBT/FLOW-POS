import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customerOrdersTable = pgTable("customer_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  tenantId: integer("tenant_id").notNull(),
  orderType: text("order_type").notNull().default("dine_in"), // dine_in, take_away, delivery
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  tableNumber: text("table_number"),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),
  deliveryFee: numeric("delivery_fee", { precision: 15, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, qris, bank_transfer, ewallet
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"), // pending, confirmed, preparing, ready, on_delivery, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const customerOrderItemsTable = pgTable("customer_order_items", {
  id: serial("id").primaryKey(),
  customerOrderId: integer("customer_order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tableQrCodesTable = pgTable("table_qr_codes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  tableNumber: text("table_number").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerOrderSchema = createInsertSchema(customerOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerOrderItemSchema = createInsertSchema(customerOrderItemsTable).omit({ id: true, createdAt: true });
export const insertTableQrCodeSchema = createInsertSchema(tableQrCodesTable).omit({ id: true, createdAt: true });

export type CustomerOrder = typeof customerOrdersTable.$inferSelect;
export type CustomerOrderItem = typeof customerOrderItemsTable.$inferSelect;
export type TableQrCode = typeof tableQrCodesTable.$inferSelect;
export type InsertCustomerOrder = z.infer<typeof insertCustomerOrderSchema>;
