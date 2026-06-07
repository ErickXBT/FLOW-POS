import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryAdjustmentsTable = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  productName: text("product_name"),
  type: text("type").notNull(), // stock_in, stock_out, adjustment
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  tenantId: integer("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryAdjustmentSchema = createInsertSchema(inventoryAdjustmentsTable).omit({ id: true, createdAt: true });
export type InsertInventoryAdjustment = z.infer<typeof insertInventoryAdjustmentSchema>;
export type InventoryAdjustment = typeof inventoryAdjustmentsTable.$inferSelect;
