import { HTTPException } from 'hono/http-exception';
import { createMiddleware } from 'hono/factory';
import { verifyToken } from '../auth/jwt';
import type { AppBindings } from '../types';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header('Authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: UNAUTHORIZED_MESSAGE });
  }

  const token = authorization.replace('Bearer ', '');
  try {
    const payload = verifyToken(token);
    c.set('user', payload);
  } catch (error) {
    throw new HTTPException(401, { message: UNAUTHORIZED_MESSAGE });
  }

  await next();
});
