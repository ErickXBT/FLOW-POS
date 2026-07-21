const pg = require('pg');

async function run() {
  const fs = require('fs');
  const path = require('path');
  let envDbUrl = '';
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) envDbUrl = match[1].trim();
  } catch (e) {}

  const connectionString = envDbUrl || process.env.DATABASE_URL || 'postgresql://postgres.qmelcqjbdmntdfplsayv:%40Erick037425@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Successfully connected to Supabase PostgreSQL database.');
    
    // Add cover_url and bio if they don't exist
    console.log('Applying migration: adding cover_url and bio columns...');
    await client.query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS cover_url text,
      ADD COLUMN IF NOT EXISTS bio text;
    `);

    console.log('Applying migration: adding delivery_fee_near and delivery_fee_far columns to tenants...');
    await client.query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS delivery_fee_near integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivery_fee_far integer NOT NULL DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS enable_delivery_near boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS enable_delivery_far boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS enable_delivery_flat boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS delivery_fee_flat integer NOT NULL DEFAULT 10000;
    `);

    console.log('Applying migration: adding enable_tax and tax_percentage columns to tenants...');
    await client.query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS enable_tax boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS tax_percentage numeric(5, 2) NOT NULL DEFAULT 10.00;
    `);

    console.log('Applying migration: adding google_maps_location column to customer_orders...');
    await client.query(`
      ALTER TABLE customer_orders
      ADD COLUMN IF NOT EXISTS google_maps_location text;
    `);

    console.log('Applying migration: adding claimed_discount_active, active_reward, and claimed_milestones to customers, and is_claim_reward to orders...');
    await client.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS claimed_discount_active boolean NOT NULL DEFAULT false;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS active_reward text;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS claimed_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS is_claim_reward boolean NOT NULL DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_claim_reward boolean NOT NULL DEFAULT false;
    `);
    
    console.log('Applying migration: adding bank details columns to tenants...');
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_name text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_account_name text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_account_number text;
    `);

    console.log('Migration completed successfully!');
    
    // Verify columns exist
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name IN ('cover_url', 'bio', 'delivery_fee_near', 'delivery_fee_far', 'enable_tax', 'tax_percentage');
    `);
    console.log('Verification: tenants columns in database:', res.rows);

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_orders' AND column_name IN ('google_maps_location');
    `);
    console.log('Verification: customer_orders columns in database:', res2.rows);
    
    await client.end();
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
