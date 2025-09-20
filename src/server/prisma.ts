import { PrismaClient } from '@prisma/client';
import env from './config/env';
import logger from './logger';

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

prisma.$on('error', (e) => {
  logger.error({ err: e }, 'Prisma error');
});

export default prisma;
