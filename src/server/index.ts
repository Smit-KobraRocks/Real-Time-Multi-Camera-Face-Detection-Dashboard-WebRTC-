import { serve } from '@hono/node-server';
import { createApp } from './app';
import env from './config/env';
import logger from './logger';
import prisma from './prisma';

const app = createApp();

const port = env.PORT;

serve({
  fetch: app.fetch,
  port
});

logger.info({ port }, 'Server listening');

const gracefulShutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Received shutdown signal');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});
