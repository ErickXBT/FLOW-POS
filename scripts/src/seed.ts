import { db, usersTable, tenantsTable, categoriesTable, productsTable, customersTable, employeesTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

function hash(password: string) {
  return crypto.createHash("sha256").update(password + "flow-salt").digest("hex");
}

async function main() {
  // Super admin
  const existing = await db.select().from(usersTable).where(eq(usersTable.role, "super_admin"));
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      name: "Super Admin",
      email: "andrijumawalsatria@gmail.com",
      passwordHash: hash("Ericksatria29"),
      role: "super_admin",
      tenantId: null,
    });
    console.log("Created super admin: andrijumawalsatria@gmail.com / Ericksatria29");
  } else {
    console.log("Super admin already exists");
  }

  // Demo tenant
  const existingTenant = await db.select().from(tenantsTable).where(eq(tenantsTable.name, "Demo Kafe"));
  if (existingTenant.length > 0) {
    console.log("Demo tenant already exists, skipping...");
    process.exit(0);
  }

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 3);

  const [tenant] = await db.insert(tenantsTable).values({
    name: "Demo Kafe",
    businessType: "cafe",
    status: "active",
    phone: "0812345678",
    email: "demo@kafe.com",
    address: "Jl. Sudirman No. 1, Jakarta",
    subscriptionPlan: "basic",
    subscriptionExpiresAt: expiry,
  }).returning();

  console.log(`Created tenant: ${tenant.name} (id: ${tenant.id})`);

  // Owner user
  await db.insert(usersTable).values({
    name: "Budi Santoso",
    email: "owner@demo.com",
    passwordHash: hash("owner123"),
    role: "owner",
    tenantId: tenant.id,
  });
  console.log("Created owner: owner@demo.com / owner123");

  // Subscription
  await db.insert(subscriptionsTable).values({
    tenantId: tenant.id,
    plan: "basic",
    status: "active",
    price: "149000",
    expiresAt: expiry,
  });

  // Categories
  const [catMinuman] = await db.insert(categoriesTable).values({ name: "Minuman", description: "Kopi, teh, jus", tenantId: tenant.id }).returning();
  const [catMakanan] = await db.insert(categoriesTable).values({ name: "Makanan", description: "Nasi, mie, roti", tenantId: tenant.id }).returning();
  const [catSnack] = await db.insert(categoriesTable).values({ name: "Snack", description: "Cemilan dan dessert", tenantId: tenant.id }).returning();
  console.log("Created categories");

  // Products
  await db.insert(productsTable).values([
    { name: "Americano", price: "25000", costPrice: "8000", stock: 100, minStock: 10, categoryId: catMinuman.id, tenantId: tenant.id },
    { name: "Cappuccino", price: "32000", costPrice: "10000", stock: 100, minStock: 10, categoryId: catMinuman.id, tenantId: tenant.id },
    { name: "Matcha Latte", price: "38000", costPrice: "12000", stock: 80, minStock: 10, categoryId: catMinuman.id, tenantId: tenant.id },
    { name: "Es Teh Manis", price: "10000", costPrice: "3000", stock: 200, minStock: 20, categoryId: catMinuman.id, tenantId: tenant.id },
    { name: "Lemon Tea", price: "22000", costPrice: "6000", stock: 100, minStock: 10, categoryId: catMinuman.id, tenantId: tenant.id },
    { name: "Kopi Susu", price: "28000", costPrice: "9000", stock: 3, minStock: 10, categoryId: catMinuman.id, tenantId: tenant.id }, // low stock
    { name: "Nasi Goreng", price: "35000", costPrice: "12000", stock: 50, minStock: 5, categoryId: catMakanan.id, tenantId: tenant.id },
    { name: "Mie Goreng", price: "30000", costPrice: "10000", stock: 50, minStock: 5, categoryId: catMakanan.id, tenantId: tenant.id },
    { name: "Roti Bakar", price: "18000", costPrice: "6000", stock: 30, minStock: 5, categoryId: catMakanan.id, tenantId: tenant.id },
    { name: "Keripik Kentang", price: "12000", costPrice: "5000", stock: 100, minStock: 10, categoryId: catSnack.id, tenantId: tenant.id },
    { name: "Brownie Coklat", price: "20000", costPrice: "8000", stock: 2, minStock: 5, categoryId: catSnack.id, tenantId: tenant.id }, // low stock
  ]);
  console.log("Created 11 products (2 low stock)");

  // Employees
  await db.insert(employeesTable).values([
    { name: "Ani Kartini", email: "ani@demo.com", role: "cashier", tenantId: tenant.id },
    { name: "Rizky Pratama", email: "rizky@demo.com", role: "manager", tenantId: tenant.id },
  ]);
  console.log("Created employees");

  // Customers
  await db.insert(customersTable).values([
    { name: "Sari Dewi", email: "sari@email.com", phone: "081200000001", loyaltyPoints: 150, totalSpent: "375000", totalOrders: 15, membershipLevel: "silver", tenantId: tenant.id },
    { name: "Ahmad Fauzi", email: "ahmad@email.com", phone: "081200000002", loyaltyPoints: 50, totalSpent: "125000", totalOrders: 5, membershipLevel: "regular", tenantId: tenant.id },
    { name: "Putri Rahayu", email: "putri@email.com", phone: "081200000003", loyaltyPoints: 500, totalSpent: "1500000", totalOrders: 50, membershipLevel: "gold", tenantId: tenant.id },
  ]);
  console.log("Created customers");

  console.log("\n✅ Seed complete!");
  console.log("  Super Admin: ericksatria91@gmail.com (Log in using Ericksatria29)");
  console.log("  Owner: owner@demo.com / owner123");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
