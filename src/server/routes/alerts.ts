import { Hono } from 'hono';
import { z } from 'zod';
import prisma from '../prisma';
import { authMiddleware } from '../middleware/auth';
import type { AppBindings } from '../types';

const querySchema = z.object({
  cameraId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

const normalizeNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const MAX_ALERT_PAGE_SIZE = 100;

export const alertRoutes = new Hono<AppBindings>();

alertRoutes.use('*', authMiddleware);

alertRoutes.get('/', async (c) => {
  const parsedQuery = querySchema.safeParse({
    cameraId: c.req.query('cameraId') ?? undefined,
    page: c.req.query('page') ?? undefined,
    pageSize: c.req.query('pageSize') ?? undefined
  });

  if (!parsedQuery.success) {
    return c.json({ message: 'Invalid query parameters' }, 400);
  }

  const { cameraId, page: pageQuery, pageSize: pageSizeQuery } = parsedQuery.data;

  const page = normalizeNumber(pageQuery, 1);
  const pageSize = Math.min(normalizeNumber(pageSizeQuery, 20), MAX_ALERT_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where = cameraId ? { cameraId } : undefined;

  const [alerts, totalItems] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    }),
    prisma.alert.count({ where })
  ]);

  return c.json({
    data: alerts,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1
    }
  });
});
