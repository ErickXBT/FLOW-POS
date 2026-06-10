import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  businessType: text("business_type").notNull(), // restaurant, cafe, fashion, salon, minimarket
  status: text("status").notNull().default("trial"), // active, suspended, trial, expired
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#1D4EF5"),
  bannerUrl: text("banner_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  receiptFooter: text("receipt_footer"),
  subscriptionPlan: text("subscription_plan").default("trial"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  enableDineIn: boolean("enable_dine_in").notNull().default(true),
  enableTakeAway: boolean("enable_take_away").notNull().default(true),
  enableDelivery: boolean("enable_delivery").notNull().default(false),
  deliveryFeeNear: integer("delivery_fee_near").notNull().default(0),
  deliveryFeeFar: integer("delivery_fee_far").notNull().default(5000),
  enableCash: boolean("enable_cash").notNull().default(true),
  enableQris: boolean("enable_qris").notNull().default(true),
  enableBankTransfer: boolean("enable_bank_transfer").notNull().default(false),
  enableEwallet: boolean("enable_ewallet").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
