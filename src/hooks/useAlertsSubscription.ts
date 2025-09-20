import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import type { CameraAlert } from '../types';
import { getEnvVar } from '../utils/env';

type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

type AlertsMap = Record<string, CameraAlert[]>;

const DEFAULT_WS_URL = 'ws://localhost:4000/ws';

export const useAlertsSubscription = (cameraIds: string[]) => {
  const { token } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertsMap>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Remove alerts for cameras that are no longer visible
    setAlerts((current) => {
      const next: AlertsMap = {};
      cameraIds.forEach((cameraId) => {
        if (current[cameraId]) {
          next[cameraId] = current[cameraId];
        }
      });
      return next;
    });
  }, [cameraIds]);

  useEffect(() => {
    if (!token || cameraIds.length === 0) {
      setStatus('idle');
      return;
    }

    const wsBase = getEnvVar('VITE_WS_BASE_URL', DEFAULT_WS_URL) ?? DEFAULT_WS_URL;
    const params = new URLSearchParams({ token, cameras: cameraIds.join(',') });
    const url = `${wsBase.replace(/\\/$/, '')}/alerts?${params.toString()}`;

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('open');
    ws.onclose = () => setStatus('closed');
    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket connection failed');
    };

    ws.onmessage = (event) => {
      try {
        const payload: CameraAlert = JSON.parse(event.data);
        if (!payload.cameraId) return;
        setAlerts((current) => {
          const existing = current[payload.cameraId] ?? [];
          const next = [payload, ...existing].slice(0, 10);
          return { ...current, [payload.cameraId]: next };
        });
      } catch (messageError) {
        console.error('Failed to parse alert payload', messageError);
      }
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
      wsRef.current = null;
    };
  }, [cameraIds, token]);

  const clearAlerts = useCallback((cameraId: string) => {
    setAlerts((current) => {
      const { [cameraId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const aggregatedAlerts = useMemo(() => alerts, [alerts]);

  return {
    alertsByCamera: aggregatedAlerts,
    status,
    error,
    clearAlerts
  };
};
