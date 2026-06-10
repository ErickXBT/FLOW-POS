import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
await client.connect();

try {
  await client.query("BEGIN");

  console.log("Updating user Erick (id=4) to tenant_id=5...");
  await client.query("UPDATE users SET tenant_id = 5 WHERE id = 4");

  console.log("Updating branch Cabang Utama (id=3) under tenant_id=5 to match Fresh Mood details...");
  await client.query(`
    UPDATE branches 
    SET name = 'Fresh Mood', 
        address = 'Jl. Melati Bawah Kota Ende', 
        phone = '082229132624' 
    WHERE id = 3
  `);

  console.log("Cleaning up duplicate tenant_id=3 resources...");
  
  // Delete duplicate branch for tenant 3
  await client.query("DELETE FROM branches WHERE tenant_id = 3");

  // Delete duplicate subscription for tenant 3
  await client.query("DELETE FROM subscriptions WHERE tenant_id = 3");

  // Move user_sessions and activity_logs from tenant 3 to 5
  await client.query("UPDATE user_sessions SET tenant_id = 5 WHERE tenant_id = 3");
  await client.query("UPDATE activity_logs SET tenant_id = 5 WHERE tenant_id = 3");

  // Delete duplicate tenant 3
  await client.query("DELETE FROM tenants WHERE id = 3");

  await client.query("COMMIT");
  console.log("Migration completed successfully!");

} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migration failed, rolled back changes:", error);
} finally {
  await client.end();
}
