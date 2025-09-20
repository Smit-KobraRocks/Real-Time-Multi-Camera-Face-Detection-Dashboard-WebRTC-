import apiClient from './client';
import type { LoginCredentials, LoginResponse } from '../types';

export const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return data;
};
