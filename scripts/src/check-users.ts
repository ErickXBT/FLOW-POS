import { db, usersTable } from "@workspace/db";

async function main() {
  const users = await db.select().from(usersTable);
  console.log("Users in DB:", users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
