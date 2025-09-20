export interface User {
  id: string;
  username: string;
  fullName?: string;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  rtspUrl: string;
  isStreaming: boolean;
  lastHeartbeatAt?: string;
}

export interface CameraAlert {
  id: string;
  cameraId: string;
  timestamp: string;
  faceThumbnailUrl: string;
  description?: string;
}

export interface CreateCameraPayload {
  name: string;
  location: string;
  rtspUrl: string;
}

export interface UpdateCameraPayload {
  name?: string;
  location?: string;
  rtspUrl?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
