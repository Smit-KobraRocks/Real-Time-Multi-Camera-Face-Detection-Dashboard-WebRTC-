import { useCallback, useEffect, useRef, useState } from 'react';
import { exchangeWebRTCOffer, sendIceCandidate } from '../api/cameras';

type StreamStatus = 'idle' | 'connecting' | 'playing' | 'stopped' | 'error';

interface UseWebRTCStreamResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  start: () => Promise<void>;
  stop: () => void;
  status: StreamStatus;
  error: string | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' }
];

export const useWebRTCStream = (cameraId: string): UseWebRTCStreamResult => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    const peer = peerConnectionRef.current;
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      const mediaStream = videoRef.current.srcObject as MediaStream | null;
      mediaStream?.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus('stopped');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (status === 'playing' || status === 'connecting') return;
    setStatus('connecting');
    setError(null);

    try {
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = peer;

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
      };

      peer.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await sendIceCandidate(cameraId, event.candidate.toJSON());
          } catch (candidateError) {
            console.warn('Failed to send ICE candidate', candidateError);
          }
        }
      };

      peer.onconnectionstatechange = () => {
        if (!peerConnectionRef.current) return;
        switch (peer.connectionState) {
          case 'connected':
            setStatus('playing');
            break;
          case 'failed':
          case 'disconnected':
            setStatus('error');
            setError('Connection lost');
            cleanup();
            break;
          case 'closed':
            setStatus('stopped');
            break;
          default:
            break;
        }
      };

      const offer = await peer.createOffer({ offerToReceiveVideo: true });
      await peer.setLocalDescription(offer);

      const answer = await exchangeWebRTCOffer(cameraId, offer);
      await peer.setRemoteDescription(answer);

      setStatus('playing');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to start stream');
      setStatus('error');
      cleanup();
      throw err;
    }
  }, [cameraId, cleanup, status]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  return {
    videoRef,
    start,
    stop,
    status,
    error
  };
};
