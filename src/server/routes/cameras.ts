import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import prisma from '../prisma';
import { authMiddleware } from '../middleware/auth';
import type { AppBindings } from '../types';
import logger from '../logger';
import { realtimeHub } from '../realtime/hub';

const cameraCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  rtspUrl: z.string().min(1, 'rtspUrl is required'),
  location: z.string().min(1, 'location is required')
});

const cameraUpdateSchema = cameraCreateSchema.partial();

const parseJsonBody = async (c: Context<AppBindings>) => {
  try {
    return await c.req.json();
  } catch (error) {
    throw new HTTPException(400, { message: 'Invalid JSON payload' });
  }
};

const normalizePagination = (value: string | undefined, fallback: number): number => {
  const numeric = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
};

const MAX_PAGE_SIZE = 100;

const buildCameraStatsPayload = async (payload: { cameraId?: string; isStreaming?: boolean }) => {
  const [totalCameras, streamingCameras] = await Promise.all([
    prisma.camera.count(),
    prisma.camera.count({ where: { isStreaming: true } })
  ]);

  return {
    ...payload,
    totalCameras,
    streamingCameras
  };
};

const broadcastCameraStats = async (payload: { cameraId?: string; isStreaming?: boolean }) => {
  const stats = await buildCameraStatsPayload(payload);
  realtimeHub.broadcastCameraStats(stats);
};

export const cameraRoutes = new Hono<AppBindings>();

cameraRoutes.use('*', authMiddleware);

cameraRoutes.post('/', async (c) => {
  const body = await parseJsonBody(c);
  const parsed = cameraCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors[0]?.message ?? 'Invalid payload' });
  }

  const camera = await prisma.camera.create({
    data: parsed.data
  });

  logger.info({ cameraId: camera.id }, 'Camera created');
  await broadcastCameraStats({ cameraId: camera.id, isStreaming: camera.isStreaming });

  return c.json(camera, 201);
});

cameraRoutes.get('/', async (c) => {
  const page = normalizePagination(c.req.query('page'), 1);
  const pageSizeRaw = normalizePagination(c.req.query('pageSize'), 20);
  const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);

  const skip = (page - 1) * pageSize;

  const [items, totalItems] = await Promise.all([
    prisma.camera.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.camera.count()
  ]);

  return c.json({
    data: items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1
    }
  });
});

cameraRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await parseJsonBody(c);
  const parsed = cameraUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.errors[0]?.message ?? 'Invalid payload' });
  }

  if (Object.keys(parsed.data).length === 0) {
    throw new HTTPException(400, { message: 'No fields provided for update' });
  }

  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    throw new HTTPException(404, { message: 'Camera not found' });
  }

  const updated = await prisma.camera.update({
    where: { id },
    data: parsed.data
  });

  logger.info({ cameraId: updated.id }, 'Camera updated');
  await broadcastCameraStats({ cameraId: updated.id, isStreaming: updated.isStreaming });

  return c.json(updated);
});

cameraRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    throw new HTTPException(404, { message: 'Camera not found' });
  }

  await prisma.camera.delete({ where: { id } });

  logger.info({ cameraId: id }, 'Camera deleted');
  await broadcastCameraStats({ cameraId: id, isStreaming: false });

  return c.body(null, 204);
});

cameraRoutes.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    throw new HTTPException(404, { message: 'Camera not found' });
  }

  if (camera.isStreaming) {
    return c.json(camera);
  }

  const updated = await prisma.camera.update({
    where: { id },
    data: { isStreaming: true }
  });

  logger.info({ cameraId: updated.id }, 'Camera stream started');
  await broadcastCameraStats({ cameraId: updated.id, isStreaming: true });

  return c.json(updated);
});

cameraRoutes.post('/:id/stop', async (c) => {
  const id = c.req.param('id');
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    throw new HTTPException(404, { message: 'Camera not found' });
  }

  if (!camera.isStreaming) {
    return c.json(camera);
  }

  const updated = await prisma.camera.update({
    where: { id },
    data: { isStreaming: false }
  });

  logger.info({ cameraId: updated.id }, 'Camera stream stopped');
  await broadcastCameraStats({ cameraId: updated.id, isStreaming: false });

  return c.json(updated);
});
