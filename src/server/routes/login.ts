import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { signToken } from '../auth/jwt';
import prisma from '../prisma';
import logger from '../logger';
import { verifyPassword } from '../utils/password';

const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required')
});

export const loginRoutes = new Hono();

loginRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON payload' });
  });

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors[0]?.message ?? 'Invalid payload' });
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    logger.warn({ username }, 'Invalid login attempt: user not found');
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    logger.warn({ username }, 'Invalid login attempt: wrong password');
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  const token = signToken({ userId: user.id, username: user.username });

  logger.info({ userId: user.id, username }, 'User logged in');

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username
    }
  });
});
