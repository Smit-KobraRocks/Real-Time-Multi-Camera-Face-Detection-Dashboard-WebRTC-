import { HTTPException } from 'hono/http-exception';
import { upgradeWebSocket } from 'hono/ws';
import type { Hono } from 'hono';
import type { WebSocket } from 'ws';
import { verifyToken } from '../auth/jwt';
import prisma from '../prisma';
import logger from '../logger';
import { realtimeHub } from '../realtime/hub';
import type { AppBindings } from '../types';

const WS_READY_STATE_OPEN = 1;

const sendMessage = (ws: WebSocket, event: string, payload: unknown) => {
  if (ws.readyState !== WS_READY_STATE_OPEN) {
    return;
  }

  const message = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString()
  });

  try {
    ws.send(message);
  } catch (error) {
    logger.error({ error }, 'Failed to send WebSocket message');
  }
};

const sendInitialSnapshot = async (ws: WebSocket) => {
  const [totalCameras, streamingCameras, latestAlerts] = await Promise.all([
    prisma.camera.count(),
    prisma.camera.count({ where: { isStreaming: true } }),
    prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    })
  ]);

  sendMessage(ws, 'camera-stats', {
    totalCameras,
    streamingCameras
  });

  if (latestAlerts.length > 0) {
    sendMessage(ws, 'recent-alerts', latestAlerts);
  }
};

const extractToken = (authorizationHeader: string | undefined, tokenQuery: string | null): string | undefined => {
  if (tokenQuery) {
    return tokenQuery;
  }

  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice(7);
  }

  return undefined;
};

export const registerWebSocketRoutes = (app: Hono<AppBindings>) => {
  app.get(
    '/ws',
    upgradeWebSocket((c) => {
      const token = extractToken(c.req.header('Authorization'), c.req.query('token'));

      if (!token) {
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      try {
        verifyToken(token);
      } catch (error) {
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      return {
        onOpen: async (_event, ws) => {
          const socket = ws as unknown as WebSocket;
          realtimeHub.registerClient(socket);
          try {
            await sendInitialSnapshot(socket);
          } catch (error) {
            logger.error({ error }, 'Failed to send initial snapshot to WebSocket client');
          }
        },
        onClose: (_event, ws) => {
          const socket = ws as unknown as WebSocket;
          realtimeHub.unregisterClient(socket);
        },
        onMessage: () => {
          // No-op. Clients only receive push messages.
        }
      };
    })
  );
};
