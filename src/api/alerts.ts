import apiClient from './client';
import type { CameraAlert } from '../types';

export const getRecentAlerts = async (cameraId?: string): Promise<CameraAlert[]> => {
  const { data } = await apiClient.get<CameraAlert[]>('/alerts/recent', {
    params: cameraId ? { cameraId } : undefined
  });
  return data;
};
