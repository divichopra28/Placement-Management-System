const oracledb = require('oracledb');
const config = require('./env');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool = null;

function initDriver() {
  if (config.db.driverMode !== 'thick') return;
  const libDir = config.db.clientLibDir;
  if (libDir && process.platform === 'win32') {
    // On Windows the client DLL's dependencies are resolved through PATH,
    // so putting the directory first is more reliable than passing libDir.
    process.env.PATH = `${libDir};${process.env.PATH}`;
    oracledb.initOracleClient();
  } else if (libDir) {
    oracledb.initOracleClient({ libDir });
  } else {
    oracledb.initOracleClient();
  }
}

async function initPool() {
  if (pool) return pool;
  initDriver();
  pool = await oracledb.createPool({
    user: config.db.user,
    password: config.db.password,
    connectString: config.db.connectString,
    poolMin: config.db.poolMin,
    poolMax: config.db.poolMax,
    poolIncrement: 1,
  });
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close(5);
    pool = null;
  }
}

const toCamel = (key) => key.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function camelRows(rows = []) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
    return out;
  });
}

async function getConnection() {
  if (!pool) await initPool();
  return pool.getConnection();
}

/** Run one statement on an existing connection. Rows come back camelCased. */
async function run(conn, sql, binds = {}, options = {}) {
  const result = await conn.execute(sql, binds, options);
  return { ...result, rows: camelRows(result.rows) };
}

/** Run one auto-committed statement on a pooled connection. */
async function execute(sql, binds = {}, options = {}) {
  const conn = await getConnection();
  try {
    return await run(conn, sql, binds, { autoCommit: true, ...options });
  } finally {
    await conn.close();
  }
}

async function query(sql, binds = {}) {
  return (await execute(sql, binds)).rows;
}

async function queryOne(sql, binds = {}) {
  return (await query(sql, binds))[0] || null;
}

/** Run several statements atomically; rolls back if fn throws. */
async function withTransaction(fn) {
  const conn = await getConnection();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* connection may already be broken */ }
    throw err;
  } finally {
    await conn.close();
  }
}

module.exports = {
  oracledb,
  initPool,
  closePool,
  getConnection,
  run,
  execute,
  query,
  queryOne,
  withTransaction,
};
