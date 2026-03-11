import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:tw1AUBHNCtD9RBNv@summitly-crm-instance-1.cz6ky2oakyaf.ca-central-1.rds.amazonaws.com:5432/summitly-crm',
  ssl: { rejectUnauthorized: false }
});
const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
console.log('Tables:', r.rows.map(x => x.table_name));
pool.end();
