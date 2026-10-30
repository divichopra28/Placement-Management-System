const config = require('./config/env');
const db = require('./config/db');
const app = require('./app');

async function start() {
  try {
    await db.initPool();
    const row = await db.queryOne('SELECT USER AS db_user FROM DUAL');
    console.log(`[db] Connected to Oracle as ${row.dbUser} (${config.db.connectString}, ${config.db.driverMode} mode)`);
  } catch (err) {
    console.error('[db] Could not connect to Oracle:', err.message.split('\n')[0]);
    console.error('     Check backend/.env and that the Oracle listener is running. See README.md.');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[api] Placement Management API listening on http://localhost:${config.port}/api`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    server.close();
    await db.closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
