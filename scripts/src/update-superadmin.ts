import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

function hash(password: string) {
  return crypto.createHash("sha256").update(password + "flow-salt").digest("hex");
}

async function main() {
  await db.update(usersTable)
    .set({
      email: "ericksatria91@gmail.com.admin",
      passwordHash: hash("Ericksatria29")
    })
    .where(eq(usersTable.email, "admin@flow.com"));
  console.log("Updated super admin credentials!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
