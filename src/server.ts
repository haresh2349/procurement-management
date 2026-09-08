import 'dotenv/config';

import { createApp } from './app.js';
import { logger } from './common/utils/logger.js';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  logger.info('Server started', { port, env: process.env.NODE_ENV ?? 'development' });
});

const shutdown = (signal: string): void => {
  logger.info('Shutdown signal received', { signal });

  server.close((error) => {
    if (error) {
      logger.error('Error during server shutdown', { message: error.message });
      process.exit(1);
    }

    logger.info('Server closed gracefully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  process.exit(1);
});
