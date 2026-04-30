const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getSetting(key, fallback) {
  const r = await query('SELECT value FROM settings WHERE key=$1', [key]);
  if (r.rowCount === 0) return fallback;
  return r.rows[0].value;
}

module.exports = { pool, query, getSetting };
