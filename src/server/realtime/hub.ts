import type { WebSocket } from 'ws';
import logger from '../logger';

const WS_READY_STATE_OPEN = 1;

type RealtimeEvent = {
  event: string;
  payload: unknown;
  timestamp: string;
};

export type CameraStatsPayload = {
  cameraId?: string;
  isStreaming?: boolean;
  totalCameras: number;
  streamingCameras: number;
};

export class RealtimeHub {
  private readonly clients = new Set<WebSocket>();

  registerClient(client: WebSocket) {
    this.clients.add(client);
    logger.debug({ clientCount: this.clients.size }, 'WebSocket client connected');
  }

  unregisterClient(client: WebSocket) {
    this.clients.delete(client);
    logger.debug({ clientCount: this.clients.size }, 'WebSocket client disconnected');
  }

  broadcast(event: string, payload: unknown) {
    const message: RealtimeEvent = {
      event,
      payload,
      timestamp: new Date().toISOString()
    };

    const serialized = JSON.stringify(message);

    for (const client of this.clients) {
      if ((client as WebSocket).readyState !== WS_READY_STATE_OPEN) {
        continue;
      }

      try {
        client.send(serialized);
      } catch (error) {
        logger.error({ error }, 'Failed to send WebSocket message');
      }
    }
  }

  broadcastAlert(payload: unknown) {
    this.broadcast('alert', payload);
  }

  broadcastCameraStats(payload: CameraStatsPayload) {
    this.broadcast('camera-stats', payload);
  }
}

export const realtimeHub = new RealtimeHub();
