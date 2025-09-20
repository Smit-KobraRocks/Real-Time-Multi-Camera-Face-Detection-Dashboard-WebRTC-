import pino from 'pino';
import env from './config/env';

const logger = pino({
  level: env.LOG_LEVEL || 'info'
});

export default logger;
