const pg = require('pg');

// We will try both port 5432 (session mode) and port 6543 (transaction mode)
const ports = [5432, 6543];

async function run() {
  for (const port of ports) {
    console.log(`Trying port ${port}...`);
    // Note: We use ssl: { rejectUnauthorized: false } because Supabase requires SSL but local certificates might not match
    const connectionString = `postgresql://postgres.qmelcqjbdmntdfplsayv:%40Erick037425@aws-0-ap-southeast-3.pooler.supabase.com:${port}/postgres?sslmode=require`;
    const client = new pg.Client({ 
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log(`SUCCESS connected on port ${port}!`);
      const res = await client.query('SELECT NOW()');
      console.log('Database time:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      console.error(`FAILED on port ${port}:`, err.message);
    }
  }
}

run();
