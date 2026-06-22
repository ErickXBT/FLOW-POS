import { Router, type IRouter } from "express";
import { eq, and, ilike, count, desc, sql } from "drizzle-orm";
import { db, customersTable, tenantsTable, customerRetentionLogsTable, customerOrdersTable, customerOrderItemsTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
} from "@workspace/api-zod";
import { extractToken, getRequestedBranchId } from "./auth";
import * as jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "flow-pos-secret-key-2024";
const otpStorage = new Map<string, { code: string; expires: number }>();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "flow-salt").digest("hex");
}

function signCustomerToken(payload: { customerId: number; tenantId: number; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

function verifyCustomerToken(token: string): { customerId: number; tenantId: number; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.customerId) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function extractCustomerToken(req: any): { customerId: number; tenantId: number; role: string } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyCustomerToken(auth.slice(7));
}

function getMembershipLevel(points: number): string {
  if (points >= 1000) return "platinum";
  if (points >= 500) return "gold";
  if (points >= 100) return "silver";
  return "regular";
}

function requireTenant(req: any, res: any) {
  const claims = extractToken(req);
  if (!claims || !claims.tenantId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return claims;
}

function formatCustomer(c: any) {
  return {
    ...c,
    totalSpent: Number(c.totalSpent),
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

async function formatCustomerWithStats(c: any) {
  if (!c) return null;
  // Calculate favorite product based on completed order items quantity
  const [favProd] = await db
    .select({
      productName: customerOrderItemsTable.productName,
    })
    .from(customerOrderItemsTable)
    .innerJoin(customerOrdersTable, eq(customerOrderItemsTable.customerOrderId, customerOrdersTable.id))
    .where(
      and(
        eq(customerOrdersTable.tenantId, c.tenantId),
        eq(customerOrdersTable.customerPhone, c.phone),
        eq(customerOrdersTable.status, "completed")
      )
    )
    .groupBy(customerOrderItemsTable.productId, customerOrderItemsTable.productName)
    .orderBy(desc(sql`SUM(${customerOrderItemsTable.quantity})`))
    .limit(1);

  return {
    ...c,
    totalSpent: Number(c.totalSpent),
    totalOrders: Number(c.totalOrders),
    favoriteProduct: favProd ? favProd.productName : "Belum ada",
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

router.get("/customers", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const qp = ListCustomersQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const page = (qp.success ? qp.data.page : 1) ?? 1;
  const limit = (qp.success ? qp.data.limit : 20) ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(customersTable.tenantId, claims.tenantId!)];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  const where = and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(customersTable).where(where);
  const customers = await db.select().from(customersTable).where(where).limit(limit).offset(offset);

  res.json({
    data: customers.map(formatCustomer),
    total: totalResult.count,
    page,
    limit,
  });
});

router.post("/customers", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const body = CreateCustomerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const branchId = await getRequestedBranchId(req, claims);

  const [customer] = await db.insert(customersTable).values({
    ...body.data,
    tenantId: claims.tenantId!,
    branchId: branchId ?? null,
  }).returning();

  res.status(201).json(formatCustomer(customer));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = GetCustomerParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, claims.tenantId!)));

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(customer));
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const claims = requireTenant(req, res);
  if (!claims) return;

  const params = UpdateCustomerParams.safeParse({ id: req.params.id });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateCustomerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [customer] = await db.update(customersTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, claims.tenantId!)))
    .returning();

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(customer));
});

// ── CUSTOMER AUTHENTICATION ENDPOINTS ───────────────────────────────────────────

router.post("/customers/auth/register", async (req, res): Promise<void> => {
  const { slug, name, phone, password } = req.body;
  if (!slug || !name || !phone || !password) {
    res.status(400).json({ error: "Semua field (slug, nama, nomor telepon, password) wajib diisi" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug.toLowerCase()));
  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan" });
    return;
  }

  const [existing] = await db.select().from(customersTable)
    .where(and(eq(customersTable.phone, phone), eq(customersTable.tenantId, tenant.id)));

  if (existing) {
    if (!existing.passwordHash) {
      // If the customer record was created by a cashier (no password set),
      // allow setting name, password, and link it!
      const [updated] = await db.update(customersTable)
        .set({
          name: name || existing.name,
          passwordHash: hashPassword(password),
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, existing.id))
        .returning();
      
      const token = signCustomerToken({ customerId: updated.id, tenantId: tenant.id, role: "customer" });
      res.status(200).json({
        token,
        customer: await formatCustomerWithStats(updated),
      });
      return;
    }
    res.status(400).json({ error: "Nomor telepon sudah terdaftar untuk merchant ini" });
    return;
  }

  const [customer] = await db.insert(customersTable).values({
    name,
    phone,
    passwordHash: hashPassword(password),
    tenantId: tenant.id,
    membershipLevel: "regular",
    loyaltyPoints: 0,
    totalSpent: "0",
    totalOrders: 0,
  }).returning();

  const token = signCustomerToken({ customerId: customer.id, tenantId: tenant.id, role: "customer" });

  res.status(201).json({
    token,
    customer: await formatCustomerWithStats(customer),
  });
});

router.post("/customers/auth/login", async (req, res): Promise<void> => {
  const { slug, phone, password } = req.body;
  if (!slug || !phone || !password) {
    res.status(400).json({ error: "Slug, nomor telepon, dan password wajib diisi" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug.toLowerCase()));
  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan" });
    return;
  }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.phone, phone), eq(customersTable.tenantId, tenant.id)));

  if (!customer || customer.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Nomor telepon atau password salah" });
    return;
  }

  const token = signCustomerToken({ customerId: customer.id, tenantId: tenant.id, role: "customer" });

  res.json({
    token,
    customer: await formatCustomerWithStats(customer),
  });
});

router.get("/customers/auth/me", async (req, res): Promise<void> => {
  const claims = extractCustomerToken(req);
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, claims.customerId), eq(customersTable.tenantId, claims.tenantId)));

  if (!customer) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    return;
  }

  res.json(await formatCustomerWithStats(customer));
});

router.patch("/customers/auth/update-profile", async (req, res): Promise<void> => {
  const claims = extractCustomerToken(req);
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, phone, password, avatarUrl } = req.body;
  const updateData: any = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (password !== undefined && password !== "") updateData.passwordHash = hashPassword(password);
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  const [customer] = await db.update(customersTable)
    .set(updateData)
    .where(and(eq(customersTable.id, claims.customerId), eq(customersTable.tenantId, claims.tenantId)))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    return;
  }

  res.json(await formatCustomerWithStats(customer));
});

router.post("/customers/auth/forgot-password", async (req, res): Promise<void> => {
  const { slug, phone } = req.body;
  if (!slug || !phone) {
    res.status(400).json({ error: "Slug dan nomor telepon wajib diisi" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug.toLowerCase()));
  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan" });
    return;
  }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.phone, phone), eq(customersTable.tenantId, tenant.id)));

  if (!customer) {
    res.status(404).json({ error: "Nomor telepon tidak terdaftar untuk tenant ini" });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStorage.set(`${phone}-${tenant.id}`, { code, expires: Date.now() + 10 * 60 * 1000 });

  console.log(`[OTP VERIFICATION] Reset password code for phone ${phone} at tenant ${slug}: ${code}`);

  res.json({
    success: true,
    message: "Kode OTP telah dikirim",
    code,
  });
});

router.post("/customers/auth/reset-password", async (req, res): Promise<void> => {
  const { slug, phone, code, password } = req.body;
  if (!slug || !phone || !code || !password) {
    res.status(400).json({ error: "Semua field (slug, nomor telepon, kode OTP, password baru) wajib diisi" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug.toLowerCase()));
  if (!tenant) {
    res.status(404).json({ error: "Tenant tidak ditemukan" });
    return;
  }

  const otp = otpStorage.get(`${phone}-${tenant.id}`);
  if (!otp || otp.code !== code || otp.expires < Date.now()) {
    res.status(400).json({ error: "Kode verifikasi salah atau telah kadaluarsa" });
    return;
  }

  const hash = hashPassword(password);
  await db.update(customersTable)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(and(eq(customersTable.phone, phone), eq(customersTable.tenantId, tenant.id)));

  otpStorage.delete(`${phone}-${tenant.id}`);

  res.json({
    success: true,
    message: "Password berhasil diubah",
  });
});

router.post("/customers/upload", async (req, res): Promise<void> => {
  const claims = extractCustomerToken(req);
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, base64 } = req.body;
  if (!name || !base64) {
    res.status(400).json({ error: "Nama file atau konten base64 tidak boleh kosong" });
    return;
  }

  try {
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: "Format base64 gambar tidak valid" });
      return;
    }

    const fileBuffer = Buffer.from(matches[2], "base64");
    const extension = path.extname(name) || ".png";
    const fileName = `customer_${claims.customerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}${extension}`;
    
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, fileBuffer);

    const imageUrl = `/api/uploads/${fileName}`;
    res.status(200).json({ imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal mengunggah gambar" });
  }
});

// ── CLAIM REWARD ENDPOINT ──────────────────────────────────────────────────────────

router.post("/customers/:id/claim-reward", async (req, res): Promise<void> => {
  const adminClaims = extractToken(req);
  const customerClaims = extractCustomerToken(req);
  const customerId = Number(req.params.id);
  let tenantId: number | null = null;

  if (adminClaims && adminClaims.tenantId) {
    tenantId = adminClaims.tenantId;
  } else if (customerClaims && customerClaims.customerId === customerId) {
    tenantId = customerClaims.tenantId;
  }

  if (!tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId)));

  if (!customer) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    return;
  }

  if (customer.claimedDiscountActive) {
    res.status(400).json({ error: "Anda sudah memiliki klaim reward aktif yang belum digunakan." });
    return;
  }

  let milestone = Number(req.body.milestone);
  const claimedList = (customer.claimedMilestones as number[]) || [];
  const milestones = [100, 200, 300, 400, 500, 1000];
  const maxClaimed = claimedList.length > 0 ? Math.max(...claimedList) : 0;

  if (!milestone) {
    // Find the highest milestone the customer can claim based on points
    const claimable = milestones.filter(m => 
      customer.loyaltyPoints >= m && m > maxClaimed && (m === 1000 || !claimedList.includes(m))
    );
    if (claimable.length === 0) {
      res.status(400).json({ error: "Poin tidak mencukupi atau reward milestone sudah diklaim." });
      return;
    }
    milestone = Math.max(...claimable);
  } else {
    if (!milestones.includes(milestone)) {
      res.status(400).json({ error: "Milestone tidak valid." });
      return;
    }
    if (customer.loyaltyPoints < milestone) {
      res.status(400).json({ error: `Poin tidak mencukupi untuk klaim milestone ${milestone} poin.` });
      return;
    }
    if (milestone <= maxClaimed) {
      res.status(400).json({ error: `Anda tidak dapat mengklaim milestone ${milestone} karena sudah mengklaim milestone yang lebih tinggi (${maxClaimed} poin).` });
      return;
    }
    if (milestone < 1000 && claimedList.includes(milestone)) {
      res.status(400).json({ error: `Voucher milestone ${milestone} poin sudah pernah diklaim.` });
      return;
    }
  }

  let newPoints = customer.loyaltyPoints;
  let newClaimed = [...claimedList];
  let activeReward = "";

  if (milestone === 1000) {
    newPoints = 0; // reset to 0
    newClaimed = []; // reset cycle
    activeReward = "grand_reward";
  } else {
    newClaimed.push(milestone);
    activeReward = `discount_${milestone / 10}`; // e.g. discount_10, discount_20, etc.
  }

  const newLevel = getMembershipLevel(newPoints);

  const [updatedCustomer] = await db.update(customersTable)
    .set({
      loyaltyPoints: newPoints,
      membershipLevel: newLevel,
      claimedDiscountActive: true,
      activeReward: activeReward,
      claimedMilestones: newClaimed,
      updatedAt: new Date(),
    })
    .where(eq(customersTable.id, customer.id))
    .returning();

  res.json(formatCustomer(updatedCustomer));
});

// ── CUSTOMER RETENTION AUTOMATION ENDPOINTS ──────────────────────────────────────
router.post("/customers/retention/send", async (req, res): Promise<void> => {
  const adminClaims = requireTenant(req, res);
  if (!adminClaims) return;

  const { customerId, customerName, phone, message, couponCode } = req.body;
  if (!customerId || !customerName || !phone || !message || !couponCode) {
    res.status(400).json({ error: "Field customerId, customerName, phone, message, dan couponCode wajib diisi" });
    return;
  }

  // Insert log
  const [log] = await db.insert(customerRetentionLogsTable).values({
    tenantId: adminClaims.tenantId!,
    customerId: Number(customerId),
    customerName,
    phone,
    message,
    couponCode,
  }).returning();

  console.log(`[RETENTION AUTOMATION WHATSAPP] Sent message to ${customerName} (${phone}): "${message}" with coupon: ${couponCode}`);

  res.status(201).json(log);
});

router.get("/customers/retention/logs", async (req, res): Promise<void> => {
  const adminClaims = requireTenant(req, res);
  if (!adminClaims) return;

  const logs = await db.select().from(customerRetentionLogsTable)
    .where(eq(customerRetentionLogsTable.tenantId, adminClaims.tenantId!))
    .orderBy(desc(customerRetentionLogsTable.sentAt));

  res.json(logs);
});

export default router;
