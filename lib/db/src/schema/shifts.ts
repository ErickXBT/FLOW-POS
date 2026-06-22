import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { branchesTable } from "./branches";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cashierName: text("cashier_name").notNull(),
  openingCash: numeric("opening_cash", { precision: 15, scale: 2 }).notNull().default("0"),
  closingCash: numeric("closing_cash", { precision: 15, scale: 2 }),
  expectedCash: numeric("expected_cash", { precision: 15, scale: 2 }),
  actualCash: numeric("actual_cash", { precision: 15, scale: 2 }),
  discrepancy: numeric("discrepancy", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("open"), // open, closed
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  notes: text("notes"),
});

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({ id: true, openedAt: true, closedAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;
