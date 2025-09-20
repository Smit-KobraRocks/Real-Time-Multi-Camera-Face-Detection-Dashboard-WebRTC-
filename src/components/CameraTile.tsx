import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Alert as MuiAlert
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertsList } from './AlertsList';
import type { Camera, CameraAlert } from '../types';
import { useWebRTCStream } from '../hooks/useWebRTCStream';
import { startCameraStream, stopCameraStream } from '../api/cameras';

interface CameraTileProps {
  camera: Camera;
  alerts: CameraAlert[];
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
}

export const CameraTile: React.FC<CameraTileProps> = ({ camera, alerts, onEdit, onDelete }) => {
  const queryClient = useQueryClient();
  const { videoRef, start, stop, status, error } = useWebRTCStream(camera.id);

  const startMutation = useMutation({
    mutationFn: () => startCameraStream(camera.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const stopMutation = useMutation({
    mutationFn: () => stopCameraStream(camera.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync();
      await start();
    } catch (startError) {
      console.error(startError);
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync();
    } finally {
      stop();
    }
  };

  const isLoading = startMutation.isPending || stopMutation.isPending;
  const isStreaming = status === 'playing' || camera.isStreaming;

  return (
    <Card elevation={4} sx={{ backgroundColor: 'background.paper', height: '100%' }}>
      <CardHeader
        title={
          <Typography variant="h6" className="truncate">
            {camera.name}
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={camera.location} color="primary" variant="outlined" />
            {camera.lastHeartbeatAt ? (
              <Tooltip title={`Last heartbeat ${new Date(camera.lastHeartbeatAt).toLocaleString()}`}>
                <Chip size="small" label="Online" color="success" />
              </Tooltip>
            ) : (
              <Chip size="small" label="Heartbeat unavailable" variant="outlined" />
            )}
            <Chip
              size="small"
              color={status === 'error' ? 'error' : isStreaming ? 'success' : 'default'}
              label={status === 'connecting' ? 'Connecting' : isStreaming ? 'Streaming' : 'Stopped'}
            />
          </Stack>
        }
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit camera">
              <IconButton color="primary" onClick={() => onEdit(camera)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete camera">
              <IconButton color="error" onClick={() => onDelete(camera)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent>
        <Box className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted
            poster="https://placehold.co/600x400?text=Initializing"
          />
          {status === 'error' && (
            <Box className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Stack alignItems="center" spacing={1}>
                <ErrorOutlineIcon color="error" />
                <Typography color="error">{error ?? 'Unable to play stream'}</Typography>
              </Stack>
            </Box>
          )}
        </Box>
        <Box className="mt-4">
          <Typography variant="subtitle1" gutterBottom>
            Recent face detections
          </Typography>
          <AlertsList alerts={alerts} />
        </Box>
      </CardContent>
      <CardActions className="flex items-center justify-between px-4 pb-4">
        <Typography variant="body2" color="text.secondary">
          RTSP: {camera.rtspUrl}
        </Typography>
        <Stack direction="row" spacing={1}>
          {isStreaming ? (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StopIcon />}
              onClick={handleStop}
              disabled={isLoading}
            >
              Stop stream
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleStart}
              disabled={isLoading}
            >
              Start stream
            </Button>
          )}
        </Stack>
      </CardActions>
      {(startMutation.isError || stopMutation.isError) && (
        <Box className="px-4 pb-4">
          <MuiAlert severity="error">
            {startMutation.error instanceof Error
              ? startMutation.error.message
              : stopMutation.error instanceof Error
                ? stopMutation.error.message
                : 'Stream operation failed'}
          </MuiAlert>
        </Box>
      )}
    </Card>
  );
};
