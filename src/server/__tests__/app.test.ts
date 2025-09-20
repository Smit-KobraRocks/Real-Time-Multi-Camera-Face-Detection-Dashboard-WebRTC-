/**
 * @jest-environment node
 */

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'silent';

jest.mock('../prisma', () => {
  const user = { findUnique: jest.fn() };
  const camera = {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };
  const alert = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn()
  };

  return {
    __esModule: true,
    default: {
      user,
      camera,
      alert,
      $on: jest.fn(),
      $disconnect: jest.fn()
    }
  };
});

import { createApp } from '../app';
import prisma from '../prisma';
import { hashPassword } from '../utils/password';
import { signToken } from '../auth/jwt';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates a user and returns a JWT', async () => {
    const passwordHash = await hashPassword('password123');

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const app = createApp();

    const response = await app.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'password123' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.token).toBeDefined();
    expect(payload.user).toMatchObject({ id: 'user-1', username: 'admin' });
  });

  it('rejects unauthorized camera creation', async () => {
    const app = createApp();
    const response = await app.request('/cameras', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cam', rtspUrl: 'rtsp://cam', location: 'HQ' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(401);
  });

  it('creates a camera when authorized', async () => {
    mockedPrisma.camera.create.mockResolvedValue({
      id: 'cam-1',
      name: 'Cam',
      rtspUrl: 'rtsp://cam',
      location: 'HQ',
      isStreaming: false,
      createdAt: new Date(),
      updatedAt: new Date()
    } as never);
    mockedPrisma.camera.count.mockResolvedValue(1);

    const token = signToken({ userId: 'user-1', username: 'admin' });

    const app = createApp();

    const response = await app.request('/cameras', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cam', rtspUrl: 'rtsp://cam', location: 'HQ' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({ id: 'cam-1', name: 'Cam' });
    expect(mockedPrisma.camera.create).toHaveBeenCalledWith({ data: { name: 'Cam', rtspUrl: 'rtsp://cam', location: 'HQ' } });
  });

  it('lists alerts with camera filter', async () => {
    mockedPrisma.alert.findMany.mockResolvedValue([
      {
        id: 'alert-1',
        cameraId: 'cam-1',
        message: 'Face detected',
        snapshotUrl: null,
        metadata: null,
        createdAt: new Date(),
        camera: {
          id: 'cam-1',
          name: 'Cam',
          location: 'HQ'
        }
      }
    ] as never);
    mockedPrisma.alert.count.mockResolvedValue(1);

    const token = signToken({ userId: 'user-1', username: 'admin' });
    const app = createApp();

    const response = await app.request('/alerts?cameraId=cam-1', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.meta).toMatchObject({ page: 1, totalItems: 1 });
    expect(mockedPrisma.alert.findMany).toHaveBeenCalledWith({
      where: { cameraId: 'cam-1' },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
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
  });
});
