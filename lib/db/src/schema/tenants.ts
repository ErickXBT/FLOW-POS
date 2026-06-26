import { pgTable, serial, text, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  businessType: text("business_type").notNull(), // fnb, fashion, restaurant, cafe, salon, minimarket
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
  defaultCashierName: text("default_cashier_name").default("Kasir Utama"),
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
  showVariants: boolean("show_variants").notNull().default(true),
  showToppings: boolean("show_toppings").notNull().default(true),
  enableCustomerLogin: boolean("enable_customer_login").notNull().default(false),
  enableTax: boolean("enable_tax").notNull().default(false),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).notNull().default("10.00"),
  pointSystemConfig: jsonb("point_system_config").$type<{ pointsPerItem: number; minClaimPoints: number; rewardDescription: string }>().notNull().default({
    pointsPerItem: 10,
    minClaimPoints: 1000,
    rewardDescription: "Diskon 10% setiap kelipatan 100 poin, Grand Reward pada 1000 Poin"
  }),
  qrisId: text("qris_id"),
  qrisImageUrl: text("qris_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
