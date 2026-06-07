import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable, subscriptionsTable } from "@workspace/db";
import {
  LoginBody,
  RegisterBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "flow-pos-secret-key-2024";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "flow-salt").digest("hex");
}

function signToken(payload: { userId: number; tenantId: number | null; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; tenantId: number | null; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; tenantId: number | null; role: string };
  } catch {
    return null;
  }
}

export function extractToken(req: any): { userId: number; tenantId: number | null; role: string } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const hash = hashPassword(password);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || user.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt },
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password, businessName, businessType, phone, address } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const [tenant] = await db.insert(tenantsTable).values({
    name: businessName,
    businessType,
    status: "trial",
    phone: phone ?? null,
    address: address ?? null,
    subscriptionPlan: "trial",
    subscriptionExpiresAt: expiresAt,
  }).returning();

  await db.insert(subscriptionsTable).values({
    tenantId: tenant.id,
    plan: "trial",
    status: "active",
    price: "0",
    expiresAt,
  });

  const hash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash: hash,
    role: "owner",
    tenantId: tenant.id,
  }).returning();

  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

export default router;
