import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  description: text("description"),
  price: numeric("price", { precision: 15, scale: 2 }).notNull().default("0"),
  costPrice: numeric("cost_price", { precision: 15, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  imageUrl: text("image_url"),
  categoryId: integer("category_id"),
  tenantId: integer("tenant_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  variantSettings: text("variant_settings"),
  prepTime: integer("prep_time").notNull().default(5), // preparation time in minutes
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
