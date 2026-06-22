import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";

export const customerRetentionLogsTable = pgTable("customer_retention_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  couponCode: text("coupon_code").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerRetentionLogSchema = createInsertSchema(customerRetentionLogsTable).omit({ id: true, sentAt: true });
export type InsertCustomerRetentionLog = z.infer<typeof insertCustomerRetentionLogSchema>;
export type CustomerRetentionLog = typeof customerRetentionLogsTable.$inferSelect;
