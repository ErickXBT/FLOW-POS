import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { branchesTable } from "./branches";
import { productsTable } from "./products";

// 1. public_menus
export const publicMenusTable = pgTable("public_menus", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  themeSettings: text("theme_settings"), // JSON string: primary color, typography, themes
  isActive: boolean("is_active").notNull().default(true),
  enableDineIn: boolean("enable_dine_in").notNull().default(true),
  enableTakeAway: boolean("enable_take_away").notNull().default(true),
  enableDelivery: boolean("enable_delivery").notNull().default(true),
  estimatedDeliveryTime: text("estimated_delivery_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 2. public_menu_categories
export const publicMenuCategoriesTable = pgTable("public_menu_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  publicMenuId: integer("public_menu_id").notNull().references(() => publicMenusTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 3. public_menu_products
export const publicMenuProductsTable = pgTable("public_menu_products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  publicMenuCategoryId: integer("public_menu_category_id").notNull().references(() => publicMenuCategoriesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  promoPrice: numeric("promo_price", { precision: 15, scale: 2 }),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  stock: integer("stock").notNull().default(0),
  variantSettings: text("variant_settings"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 4. customer_sessions
export const customerSessionsTable = pgTable("customer_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  sessionId: text("session_id").notNull(),
  tableId: text("table_id"),
  menuSessionId: text("menu_session_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// 5. customer_carts
export const customerCartsTable = pgTable("customer_carts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerSessionId: integer("customer_session_id").notNull().references(() => customerSessionsTable.id, { onDelete: "cascade" }),
  cartData: text("cart_data").notNull(), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 6. customer_orders
export const customerOrdersTable = pgTable("customer_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  orderType: text("order_type").notNull().default("dine_in"), // dine_in, take_away, delivery
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  tableNumber: text("table_number"),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),
  googleMapsLocation: text("google_maps_location"),
  deliveryFee: numeric("delivery_fee", { precision: 15, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"), // cash, cashier, qris, bank_transfer, ewallet
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"), // pending, confirmed, preparing, ready, on_delivery, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 7. customer_order_items
export const customerOrderItemsTable = pgTable("customer_order_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  variantSelection: text("variant_selection"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8. customer_addresses
export const customerAddressesTable = pgTable("customer_addresses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  fullAddress: text("full_address").notNull(),
  deliveryNotes: text("delivery_notes"),
  googleMapsLocation: text("google_maps_location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 9. delivery_orders
export const deliveryOrdersTable = pgTable("delivery_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  deliveryMethod: text("delivery_method").notNull(), // nearby, long_distance, manual, distance_based
  distance: numeric("distance", { precision: 8, scale: 2 }),
  deliveryFee: numeric("delivery_fee", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"), // pending, assigned, picked_up, delivered, failed
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  deliveryAddress: text("delivery_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 10. payment_transactions
export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, success, failed, expired
  transactionReference: text("transaction_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// 11. qr_codes (renamed from table_qr_codes)
export const qrCodesTable = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  qrType: text("qr_type").notNull(), // store, table, branch, category
  tableId: text("table_id"),
  categoryId: integer("category_id"),
  code: text("code").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 12. order_status_logs
export const orderStatusLogsTable = pgTable("order_status_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  branchId: integer("branch_id").notNull(),
  customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  notes: text("notes"),
  updatedBy: text("updated_by").notNull(), // customer, cashier, kitchen, driver, system
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
export const insertQrCodeSchema = createInsertSchema(qrCodesTable).omit({ id: true, createdAt: true });
export const insertTableQrCodeSchema = insertQrCodeSchema; // alias

export type CustomerOrder = typeof customerOrdersTable.$inferSelect;
export type CustomerOrderItem = typeof customerOrderItemsTable.$inferSelect;
export type QrCode = typeof qrCodesTable.$inferSelect;
export type InsertCustomerOrder = z.infer<typeof insertCustomerOrderSchema>;
