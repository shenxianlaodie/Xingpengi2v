const { initDatabase } = require('./config/database');
const { start: startPoller } = require('./services/taskPoller');
const config = require('./config');

async function main() {
  // Initialize database before loading app (app requires db)
  await initDatabase();
  console.log('[db] Database initialized');

  const app = require('./app');

  const server = app.listen(config.port, () => {
    console.log(`[server] Running on http://localhost:${config.port}`);
    console.log(`[server] Environment: ${config.nodeEnv}`);

    // Start async task poller
    startPoller(10000);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
