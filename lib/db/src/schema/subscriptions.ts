import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  plan: text("plan").notNull().default("trial"), // trial, basic, pro, enterprise
  status: text("status").notNull().default("active"), // active, expired, cancelled
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  durationDays: integer("duration_days").notNull().default(30),
  maxBranches: integer("max_branches"),
  features: text("features").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

export const subscriptionUpgradeRequestsTable = pgTable("subscription_upgrade_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  requestedPlan: text("requested_plan").notNull(), // trial, starter, business, pro, enterprise
  billingCycle: text("billing_cycle").notNull(), // monthly, yearly
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  transferReceipt: text("transfer_receipt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriptionUpgradeRequestSchema = createInsertSchema(subscriptionUpgradeRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionUpgradeRequest = z.infer<typeof insertSubscriptionUpgradeRequestSchema>;
export type SubscriptionUpgradeRequest = typeof subscriptionUpgradeRequestsTable.$inferSelect;

