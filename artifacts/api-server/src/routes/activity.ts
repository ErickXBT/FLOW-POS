import { Router, type IRouter } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db, activityLogsTable, userSessionsTable } from "@workspace/db";
import { extractToken } from "./auth";
import * as crypto from "crypto";

const router: IRouter = Router();

function requireOwnerOrManager(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  if (!["owner", "manager", "super_admin"].includes(claims.role)) {
    res.status(403).json({ error: "Acesso ditolak" }); return null;
  }
  return claims;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function logActivity(params: {
  tenantId: number | null;
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  module?: string;
  details?: any;
  ipAddress?: string;
}) {
  if (params.userName && params.userName.startsWith("Preview:")) {
    return;
  }
  try {
    await db.insert(activityLogsTable).values({
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      module: params.module ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch {}
}

export async function createSession(params: {
  userId: number;
  tenantId: number | null;
  userRole: string;
  token: string;
  req: any;
}) {
  try {
    const tokenHash = hashToken(params.token);
    const ua = params.req.headers["user-agent"] || null;
    const ip = params.req.ip || params.req.connection?.remoteAddress || null;
    await db.insert(userSessionsTable).values({
      userId: params.userId,
      tenantId: params.tenantId,
      userRole: params.userRole,
      tokenHash,
      device: ua,
      ipAddress: ip,
      isActive: true,
    });
  } catch {}
}

export async function endSession(token: string) {
  try {
    const tokenHash = hashToken(token);
    await db.update(userSessionsTable)
      .set({ isActive: false, loggedOutAt: new Date() })
      .where(and(eq(userSessionsTable.tokenHash, tokenHash), eq(userSessionsTable.isActive, true)));
  } catch {}
}

// ── GET /activity-logs ─────────────────────────────────────────────────────────
router.get("/activity-logs", async (req, res): Promise<void> => {
  const claims = requireOwnerOrManager(req, res);
  if (!claims) return;

  const { limit: limitQ, page: pageQ, module, action } = req.query as any;
  const limit = Math.min(Number(limitQ ?? 50), 100);
  const page = Math.max(Number(pageQ ?? 1), 1);
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (claims.role !== "super_admin") conditions.push(eq(activityLogsTable.tenantId, claims.tenantId!));
  if (module) conditions.push(eq(activityLogsTable.module, module));
  if (action) conditions.push(eq(activityLogsTable.action, action));

  const logs = await db.select().from(activityLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit).offset(offset);

  res.json({ data: logs, page, limit });
});

// ── GET /sessions ──────────────────────────────────────────────────────────────
router.get("/sessions", async (req, res): Promise<void> => {
  const claims = requireOwnerOrManager(req, res);
  if (!claims) return;

  const conditions: any[] = [eq(userSessionsTable.isActive, true)];
  if (claims.role !== "super_admin") conditions.push(eq(userSessionsTable.tenantId, claims.tenantId!));

  const sessions = await db.select().from(userSessionsTable)
    .where(and(...conditions))
    .orderBy(desc(userSessionsTable.lastSeenAt))
    .limit(50);

  res.json(sessions);
});

export default router;
