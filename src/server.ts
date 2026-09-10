import 'dotenv/config';

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { ensureUploadRootExists } from './modules/files/file.storage.js';
import { logger } from './common/utils/logger.js';

const port = Number(process.env.PORT) || 3000;

const startServer = async (): Promise<void> => {
  await connectDatabase();
  await ensureUploadRootExists();

  const app = createApp();

  const server = app.listen(port, () => {
    logger.info('Server started', { port, env: process.env.NODE_ENV ?? 'development' });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Shutdown signal received', { signal });

    server.close(async (error) => {
      if (error) {
        logger.error('Error during server shutdown', { message: error.message });
        process.exit(1);
      }

      try {
        await disconnectDatabase();
        logger.info('Server closed gracefully');
        process.exit(0);
      } catch (disconnectError) {
        logger.error('Error closing database connection', {
          message:
            disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
        });
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

void startServer().catch((error) => {
  logger.error('Failed to start server', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
