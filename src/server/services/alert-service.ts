import prisma from '../prisma';
import { realtimeHub } from '../realtime/hub';

export type CreateAlertInput = {
  cameraId: string;
  message: string;
  snapshotUrl?: string | null;
  metadata?: unknown;
};

export const createAlert = async (input: CreateAlertInput) => {
  const alert = await prisma.alert.create({
    data: {
      cameraId: input.cameraId,
      message: input.message,
      snapshotUrl: input.snapshotUrl ?? null,
      metadata: input.metadata ?? undefined
    },
    include: {
      camera: {
        select: {
          id: true,
          name: true,
          location: true
        }
      }
    }
  });

  realtimeHub.broadcastAlert(alert);
  return alert;
};
