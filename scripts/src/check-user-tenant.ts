import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const users = await db.select().from(usersTable);
  console.log("=== USERS & TENANTS ===");
  for (const u of users) {
    const [t] = u.tenantId ? await db.select().from(tenantsTable).where(eq(tenantsTable.id, u.tenantId)) : [null];
    console.log(`User: ${u.name} | Email: ${u.email} | Role: ${u.role} | Tenant: ${t ? t.name : 'None'} (id: ${u.tenantId})`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
