import apiClient from './client';
import type { Camera, CreateCameraPayload, UpdateCameraPayload } from '../types';

export const getCameras = async (): Promise<Camera[]> => {
  const { data } = await apiClient.get<Camera[]>('/cameras');
  return data;
};

export const createCamera = async (payload: CreateCameraPayload): Promise<Camera> => {
  const { data } = await apiClient.post<Camera>('/cameras', payload);
  return data;
};

export const updateCamera = async (id: string, payload: UpdateCameraPayload): Promise<Camera> => {
  const { data } = await apiClient.put<Camera>(`/cameras/${id}`, payload);
  return data;
};

export const deleteCamera = async (id: string): Promise<void> => {
  await apiClient.delete(`/cameras/${id}`);
};

export const startCameraStream = async (id: string): Promise<void> => {
  await apiClient.post(`/cameras/${id}/stream/start`);
};

export const stopCameraStream = async (id: string): Promise<void> => {
  await apiClient.post(`/cameras/${id}/stream/stop`);
};

export interface WebRTCOfferResponse {
  sdp: string;
  type: RTCSdpType;
}

export const exchangeWebRTCOffer = async (
  id: string,
  offer: RTCSessionDescriptionInit
): Promise<WebRTCOfferResponse> => {
  const { data } = await apiClient.post<WebRTCOfferResponse>(`/cameras/${id}/webrtc/offer`, offer);
  return data;
};

export const sendIceCandidate = async (id: string, candidate: RTCIceCandidateInit): Promise<void> => {
  await apiClient.post(`/cameras/${id}/webrtc/ice`, candidate);
};
