import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from './types';
import logger from './logger';
import { registerRoutes } from './routes';

export const createApp = () => {
  const app = new Hono<AppBindings>();

  app.use('*', async (c, next) => {
    const start = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      logger.info(
        {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          duration
        },
        'Request completed'
      );
    }
  });

  app.onError((err, c) => {
    logger.error({ err, path: c.req.path }, 'Unhandled error');
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    return c.json({ message: 'Internal Server Error' }, 500);
  });

  app.notFound((c) => c.json({ message: 'Not Found' }, 404));

  app.get('/health', (c) => c.json({ status: 'ok' }));

  registerRoutes(app);

  return app;
};

export type App = ReturnType<typeof createApp>;
