import axios from 'axios';
import { getEnvVar } from '../utils/env';

const apiClient = axios.create({
  baseURL: getEnvVar('VITE_API_BASE_URL', 'http://localhost:4000/api'),
  withCredentials: false
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export default apiClient;
