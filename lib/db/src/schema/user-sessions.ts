import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const userSessionsTable = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tenantId: integer("tenant_id"),
  userRole: text("user_role").notNull(),
  tokenHash: text("token_hash").notNull(),
  device: text("device"),
  ipAddress: text("ip_address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  loggedOutAt: timestamp("logged_out_at", { withTimezone: true }),
});

export type UserSession = typeof userSessionsTable.$inferSelect;
