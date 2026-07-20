import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, tenantsTable, subscriptionsTable, employeesTable, branchesTable, customRolesTable, platformSettingsTable, branchSettingsTable, publicMenusTable, userSessionsTable, subscriptionUpgradeRequestsTable } from "@workspace/db";
import nodemailer from "nodemailer";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { logActivity, createSession, endSession } from "./activity";
import { uploadTransferReceipt } from "../lib/storage";

const router: IRouter = Router();
const JWT_SECRET = process.env.SESSION_SECRET;

// Ensure SESSION_SECRET is set in production
if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
  throw new Error("CRITICAL: SESSION_SECRET is not configured in production environment!");
}

const JWT_SECRET_KEY = JWT_SECRET || "flow-pos-secret-key-2024";

export function hashPassword(password: string): string {
  return bcryptjs.hashSync(password, 10);
}

function legacyHashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "flow-salt").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcryptjs.compareSync(password, hash);
  }
  return legacyHashPassword(password) === hash;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(payload: { userId: number; tenantId: number | null; role: string }): string {
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; tenantId: number | null; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET_KEY) as { userId: number; tenantId: number | null; role: string };
  } catch {
    return null;
  }
}

export function extractToken(req: any): { userId: number; tenantId: number | null; role: string } | null {
  if (req.claims) return req.claims;
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

export async function verifySession(req: any): Promise<{ userId: number; tenantId: number | null; role: string } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  
  const token = auth.slice(7);
  const claims = verifyToken(token);
  if (!claims) return null;

  if ((claims as any).impersonating) {
    return claims;
  }

  const tokenHash = hashToken(token);

  // Verify the session in the database
  const [session] = await db
    .select()
    .from(userSessionsTable)
    .where(and(eq(userSessionsTable.tokenHash, tokenHash), eq(userSessionsTable.isActive, true)))
    .limit(1);

  if (!session) {
    return null;
  }

  // Asynchronously update last seen
  db.update(userSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessionsTable.id, session.id))
    .catch((err) => logger.error(err, "Failed to update session lastSeenAt"));

  return claims;
}

function getDefaultPermissions(role: string): string[] {
  const defaults: Record<string, string[]> = {
    manager: [
      "view_dashboard", "view_reports", "manage_inventory", "manage_employees",
      "manage_customers", "view_pos", "view_kitchen", "view_delivery", "view_activity_logs"
    ],
    cashier: [
      "view_pos", "manage_orders", "view_customers", "manage_customers"
    ],
    kitchen_staff: [
      "view_kitchen"
    ],
    delivery_staff: [
      "view_delivery"
    ],
    staff: [
      "view_pos", "manage_orders"
    ]
  };
  return defaults[role] || [];
}

export async function getUserExtraDetails(userId: number, role: string, tenantId: number | null) {
  if (!tenantId || role === "super_admin") {
    return { permissions: role === "super_admin" ? ["super_admin"] : [], branchId: null, branchName: null };
  }

  const [tenant] = await db
    .select({
      name: tenantsTable.name,
      businessType: tenantsTable.businessType,
      businessEngine: tenantsTable.businessEngine
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  const tenantName = tenant?.name || null;
  const businessType = tenant?.businessType || "fnb";
  const businessEngine = tenant?.businessEngine || "retail";
  
  if (role === "owner") {
    return {
      permissions: [
        "view_dashboard", "view_reports", "manage_inventory", "manage_employees",
        "manage_customers", "manage_branches", "manage_settings", "manage_qr_menu",
        "view_pos", "view_kitchen", "view_delivery", "view_activity_logs", "view_sessions"
      ],
      branchId: null,
      branchName: null,
      tenantName,
      businessType,
      businessEngine,
    };
  }

  // Find employee profile
  const [emp] = await db
    .select({
      employee: employeesTable,
      branchName: branchesTable.name,
      customRolePermissions: customRolesTable.permissions,
    })
    .from(employeesTable)
    .leftJoin(branchesTable, eq(employeesTable.branchId, branchesTable.id))
    .leftJoin(customRolesTable, eq(employeesTable.customRoleId, customRolesTable.id))
    .where(eq(employeesTable.userId, userId))
    .limit(1);

  if (!emp) {
    return { permissions: getDefaultPermissions(role), branchId: null, branchName: null, tenantName, businessType, businessEngine };
  }

  let permissions: string[] = [];
  if (emp.employee.customRoleId && emp.customRolePermissions) {
    permissions = emp.customRolePermissions;
  } else {
    permissions = getDefaultPermissions(emp.employee.role);
  }

  return {
    permissions,
    branchId: emp.employee.branchId,
    branchName: emp.branchName || null,
    tenantName,
    businessType,
    businessEngine,
  };
}

export async function getRequestedBranchId(
  req: any,
  claims: { userId: number; role: string; tenantId: number | null }
): Promise<number | null> {
  if (claims.role !== "owner" && claims.role !== "super_admin") {
    const [emp] = await db
      .select({ branchId: employeesTable.branchId })
      .from(employeesTable)
      .where(eq(employeesTable.userId, claims.userId))
      .limit(1);
    return emp?.branchId ?? null;
  }

  const headerVal = req.headers["x-branch-id"];
  if (headerVal === "all" || headerVal === "undefined" || !headerVal) {
    const queryVal = req.query.branchId || req.query.branch_id;
    if (queryVal && queryVal !== "all" && queryVal !== "undefined") {
      return Number(queryVal);
    }
    return null;
  }
  
  return Number(headerVal);
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;
  let user;

  const [foundUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (foundUser && verifyPassword(password, foundUser.passwordHash)) {
    user = foundUser;

    // Auto-upgrade password hash to bcryptjs if it is legacy (SHA-256)
    const isLegacy = !(
      foundUser.passwordHash.startsWith("$2a$") ||
      foundUser.passwordHash.startsWith("$2b$") ||
      foundUser.passwordHash.startsWith("$2y$")
    );
    if (isLegacy) {
      try {
        const newHash = hashPassword(password);
        await db
          .update(usersTable)
          .set({ passwordHash: newHash, updatedAt: new Date() })
          .where(eq(usersTable.id, foundUser.id));
        logger.info({ userId: foundUser.id }, "Auto-upgraded user password hash to bcryptjs");
      } catch (err) {
        logger.error(err, "Failed to auto-upgrade password hash");
      }
    }
  }

  if (!user) {
    // Log failed login attempt if the user exists
    const [attemptedUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (attemptedUser) {
      await logActivity({
        tenantId: attemptedUser.tenantId,
        userId: attemptedUser.id,
        userName: attemptedUser.name,
        userRole: attemptedUser.role,
        action: "failed_login",
        module: "auth",
        details: { email },
        ipAddress: req.ip,
      });
    }
    res.status(401).json({ error: "Email atau password salah" });
    return;
  }

  // If the user is an employee, verify their employee profile is active
  if (user.role !== "super_admin" && user.role !== "owner") {
    const [emp] = await db.select().from(employeesTable)
      .where(eq(employeesTable.userId, user.id))
      .limit(1);
    if (emp && !emp.isActive) {
      res.status(403).json({ error: "Akun karyawan Anda telah dinonaktifkan" });
      return;
    }
  }

  // Check if tenant is suspended or frozen
  if (user.role !== "super_admin" && user.tenantId) {
    const [tenant] = await db.select({ status: tenantsTable.status })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, user.tenantId))
      .limit(1);
    if (tenant && (tenant.status === "suspended" || tenant.status === "frozen")) {
      res.status(403).json({
        error: "tenant_blocked",
        message: tenant.status === "suspended"
          ? "Akun bisnis Anda sedang ditangguhkan (Suspended). Silakan hubungi dukungan FlowApp."
          : "Akun bisnis Anda sedang dibekukan (Frozen). Silakan hubungi dukungan FlowApp."
      });
      return;
    }
  }

  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });

  // Log login + create session
  await Promise.all([
    logActivity({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "login",
      module: "auth",
      ipAddress: req.ip,
    }),
    createSession({ userId: user.id, tenantId: user.tenantId, userRole: user.role, token, req }),
  ]);

  const extra = await getUserExtraDetails(user.id, user.role, user.tenantId);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      ...extra
    },
  });
});

function getEngineFromBusinessType(businessType: string): "retail" | "booking" | "appointment" | "service" {
  const bookingTypes = ['badminton', 'futsal', 'padel', 'tennis', 'music_studio', 'coworking', 'meeting_room', 'rental', 'venue'];
  const appointmentTypes = ['salon', 'barbershop', 'spa', 'clinic', 'doctor', 'psychologist', 'mua', 'photographer', 'consultant', 'tutor'];
  const serviceTypes = ['auto_repair', 'car_wash', 'laundry', 'ac_service', 'phone_service', 'cleaning_service'];
  
  if (bookingTypes.includes(businessType)) return 'booking';
  if (appointmentTypes.includes(businessType)) return 'appointment';
  if (serviceTypes.includes(businessType)) return 'service';
  return 'retail';
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, email, password, businessName, businessType, businessEngine, phone, address, plan, billingInterval, installments, transferReceipt } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) { res.status(400).json({ error: "Email sudah terdaftar" }); return; }

  const selectedPlan = plan || "trial";
  const dbPlan = selectedPlan === "custom" ? "enterprise" : selectedPlan;

  const planPrices: Record<string, { monthly: string; yearly: string }> = {
    trial: { monthly: "0", yearly: "0" },
    starter: { monthly: "249000", yearly: "2040000" },
    business: { monthly: "299000", yearly: "3000000" },
    pro: { monthly: "749000", yearly: "6741000" },
    enterprise: { monthly: "0", yearly: "0" },
  };

  const interval = billingInterval === "yearly" ? "yearly" : "monthly";
  const price = planPrices[dbPlan]?.[interval] || "0";
  const isPaidPlan = dbPlan === "starter" || dbPlan === "business";

  const expiresAt = new Date();
  if (dbPlan === "trial" || isPaidPlan) {
    expiresAt.setDate(expiresAt.getDate() + 7); // Uji coba gratis 7 hari
  } else if (billingInterval === "yearly") {
    expiresAt.setDate(expiresAt.getDate() + 365); // Tahunan 365 hari
  } else {
    expiresAt.setDate(expiresAt.getDate() + 30); // Bulanan 30 hari
  }

  const tenantStatus = "trial";
  const tenantPlan = isPaidPlan ? "trial" : dbPlan;
  const subPlan = isPaidPlan ? "trial" : dbPlan;
  const subPrice = isPaidPlan ? "0" : price;

  // Generate a unique slug based on business name
  const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  let slug = baseSlug || "tenant";
  let suffix = 1;
  while (true) {
    const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (existing.length === 0) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  const finalEngine = businessEngine || getEngineFromBusinessType(businessType);

  const [tenant] = await db.insert(tenantsTable).values({
    name: businessName,
    slug,
    businessType,
    businessEngine: finalEngine,
    status: tenantStatus,
    phone: phone ?? null,
    address: address ?? null,
    email: email.toLowerCase(),
    subscriptionPlan: tenantPlan,
    subscriptionExpiresAt: expiresAt,
  }).returning();

  // Create default branch
  const [branch] = await db.insert(branchesTable).values({
    tenantId: tenant.id,
    name: "Utama",
    address: address ?? null,
    phone: phone ?? null,
    status: "active",
  }).returning();

  // Create default branch settings
  await db.insert(branchSettingsTable).values({
    tenantId: tenant.id,
    branchId: branch.id,
    qrMenuEnabled: true,
    taxPercentage: "0.00",
    receiptFooter: "Terima kasih atas kunjungan Anda!",
    printerSettings: JSON.stringify({ paperSize: "80mm", type: "IP", ip: "192.168.1.100" }),
    paymentMethods: JSON.stringify(["cash", "qris"]),
  });

  // Create default public menu
  await db.insert(publicMenusTable).values({
    tenantId: tenant.id,
    branchId: branch.id,
    slug,
    name: businessName,
    isActive: true,
    enableDineIn: true,
    enableTakeAway: true,
    enableDelivery: false,
  });

  await db.insert(subscriptionsTable).values({
    tenantId: tenant.id,
    plan: subPlan,
    status: "active",
    price: subPrice,
    expiresAt,
  });

  if (isPaidPlan && transferReceipt) {
    try {
      const receiptUrl = await uploadTransferReceipt(transferReceipt, "receipt.png", tenant.id);
      await db.insert(subscriptionUpgradeRequestsTable).values({
        tenantId: tenant.id,
        requestedPlan: dbPlan,
        billingCycle: interval,
        status: "pending",
        transferReceipt: receiptUrl,
      });
      logger.info({ tenantId: tenant.id, plan: dbPlan, receiptUrl }, "Successfully created pending registration subscription request");
    } catch (err: any) {
      logger.error(err, "Failed to upload transfer receipt during registration");
    }
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role: "owner",
    tenantId: tenant.id,
  }).returning();

  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });

  await Promise.all([
    logActivity({ tenantId: user.tenantId, userId: user.id, userName: user.name, userRole: user.role, action: "register", module: "auth", ipAddress: req.ip }),
    createSession({ userId: user.id, tenantId: user.tenantId, userRole: user.role, token, req }),
  ]);

  const extra = await getUserExtraDetails(user.id, user.role, user.tenantId);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      ...extra
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  // If the user is an employee, verify their employee profile is active
  if (user.role !== "super_admin" && user.role !== "owner") {
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.userId, user.id)).limit(1);
    if (emp && !emp.isActive) {
      res.status(401).json({ error: "Akun karyawan dinonaktifkan" });
      return;
    }
  }

  const extra = await getUserExtraDetails(user.id, user.role, user.tenantId);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    ...extra
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.headers.authorization?.slice(7);
  const claims = token ? verifyToken(token) : null;
  if (claims && token) {
    await Promise.all([
      logActivity({ tenantId: claims.tenantId, userId: claims.userId, userName: "User", userRole: claims.role, action: "logout", module: "auth", ipAddress: req.ip }),
      endSession(token),
    ]);
  }
  res.json({ success: true });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Password saat ini dan password baru wajib diisi" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));
  if (!user) {
    res.status(404).json({ error: "Pengguna tidak ditemukan" });
    return;
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: "Password saat ini salah" });
    return;
  }
  await db.update(usersTable)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(usersTable.id, claims.userId));
  
  await logActivity({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "change_password",
    module: "auth",
    ipAddress: req.ip,
  });
  res.json({ success: true, message: "Password berhasil diubah" });
});

router.post("/auth/update-profile", async (req, res): Promise<void> => {
  const claims = extractToken(req);
  if (!claims) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, avatarUrl } = req.body;
  
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.userId));
  if (!user) {
    res.status(404).json({ error: "Pengguna tidak ditemukan" });
    return;
  }

  const updateData: any = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, claims.userId));
  
  await logActivity({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "update_profile",
    module: "auth",
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Profil berhasil diperbarui" });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email wajib diisi" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(404).json({ error: "Email tidak terdaftar" });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour
  
  await db.update(usersTable)
    .set({ resetPasswordToken: token, resetPasswordExpires: expires, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // Create link
  const origin = req.headers.referer || req.headers.origin || "http://localhost:3000";
  const baseUrl = new URL(origin).origin;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  logger.info(`Password reset link generated for ${user.email}: ${resetUrl}`);

  // Attempt to send email
  try {
    const [settings] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "global_config"));
    const emailConfig = (settings?.value as any)?.email;
    
    if (emailConfig && emailConfig.active) {
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost || "smtp.mailtrap.io",
        port: Number(emailConfig.smtpPort) || 2525,
        secure: Number(emailConfig.smtpPort) === 465,
        auth: emailConfig.smtpUser && emailConfig.smtpPass ? {
          user: emailConfig.smtpUser,
          pass: emailConfig.smtpPass,
        } : undefined,
      });

      const mailOptions = {
        from: '"Flow POS" <noreply@flowpos.com>',
        to: user.email,
        subject: "Reset Password Flow POS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1D4EF5; text-align: center;">Reset Password Flow POS</h2>
            <p>Halo, <strong>${user.name}</strong></p>
            <p>Anda menerima email ini karena ada permintaan untuk merubah password akun Flow POS Anda.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #1D4EF5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ganti Password Baru</a>
            </div>
            <p>Link ini akan kadaluarsa dalam <strong>1 jam</strong>.</p>
            <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              Jika Anda tidak meminta perubahan ini, abaikan saja email ini. Keamanan akun Anda tetap terjaga.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${user.email}`);
    }
  } catch (mailErr) {
    logger.error(mailErr, "Failed to send password reset email via SMTP");
  }

  res.json({ success: true, message: "Tautan reset password telah dikirim ke email Anda" });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: "Token dan password baru wajib diisi" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(
    and(
      eq(usersTable.resetPasswordToken, token),
      sql`${usersTable.resetPasswordExpires} > NOW()`
    )
  );
  if (!user) {
    res.status(400).json({ error: "Token reset password tidak valid atau telah kadaluarsa" });
    return;
  }
  
  await db.update(usersTable)
    .set({
      passwordHash: hashPassword(password),
      resetPasswordToken: null,
      resetPasswordExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  await logActivity({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "reset_password",
    module: "auth",
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Password berhasil diperbarui. Silakan login kembali." });
});

router.get("/auth/platform-settings", async (req, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "global_config"));
    
    // Default config if not set
    const defaultConfig = {
      branding: { title: "Flow POS Platform", primaryColor: "#1D4EF5" },
      engines: {
        retail: true,
        booking: false,
        appointment: false,
        service: false
      },
      categories: {
        retail: {
          fnb: true,
          restaurant: true,
          coffee_shop: true,
          bakery: true,
          fashion: true,
          boutique: true,
          minimarket: false,
          grocery: false,
          pet_shop: false,
          electronics: false,
          hardware_store: false,
          pharmacy: false
        },
        booking: {
          badminton: false,
          futsal: false,
          padel: false,
          tennis: false,
          music_studio: false,
          coworking: false,
          meeting_room: false,
          rental: false,
          venue: false
        },
        appointment: {
          salon: false,
          barbershop: false,
          spa: false,
          clinic: false,
          doctor: false,
          psychologist: false,
          mua: false,
          photographer: false,
          consultant: false,
          tutor: false
        },
        service: {
          auto_repair: false,
          car_wash: false,
          laundry: false,
          ac_service: false,
          phone_service: false,
          cleaning_service: false
        }
      }
    };

    if (!settings) {
      res.json(defaultConfig);
      return;
    }

    const value = settings.value as any;
    res.json({
      branding: value.branding || defaultConfig.branding,
      engines: value.engines || defaultConfig.engines,
      categories: value.categories || defaultConfig.categories
    });
  } catch (err: any) {
    logger.error(err, "Failed to get public platform settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

