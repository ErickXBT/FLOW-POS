const pg = require('pg');

const project = 'qmelcqjbdmntdfplsayv';
const password = '@Erick037425';
const prefixes = ['aws-0', 'aws-1'];
const regions = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'sa-east-1'
];

async function checkRegion(prefix, region) {
  const host = `${prefix}-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.${project}:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    console.log(`SUCCESS: Found correct region: ${prefix}-${region}`);
    await client.end();
    return true;
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (msg.includes('enotfound') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('econnreset')) {
      // Ignore network resolution or connection failures
    } else if (msg.includes('not found') || msg.includes('tenant')) {
      // Wrong region (e.g. tenant or user not found)
    } else {
      console.log(`FOUND region: ${prefix}-${region} with message: ${err.message}`);
      return true;
    }
  }
  return false;
}

async function main() {
  for (const prefix of prefixes) {
    for (const region of regions) {
      const found = await checkRegion(prefix, region);
      if (found) {
        return;
      }
    }
  }
  console.log('Finished scanning.');
}

main();
