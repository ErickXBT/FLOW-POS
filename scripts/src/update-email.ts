import { db, tenantsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

async function main() {
  console.log("Searching for tenant 'Fresh Mood'...");
  const tenants = await db.select().from(tenantsTable).where(ilike(tenantsTable.name, "%Fresh Mood%"));

  if (tenants.length === 0) {
    console.error("Tenant 'Fresh Mood' not found.");
    process.exit(1);
  }

  for (const tenant of tenants) {
    console.log(`Updating email for tenant '${tenant.name}' (ID: ${tenant.id}) to 'ericksatria91@gmail.com'...`);
    await db.update(tenantsTable)
      .set({ email: "ericksatria91@gmail.com" })
      .where(eq(tenantsTable.id, tenant.id));
  }

  console.log("Update completed successfully!");
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
