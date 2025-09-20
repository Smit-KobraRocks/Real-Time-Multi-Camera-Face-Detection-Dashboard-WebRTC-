import { useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraTile } from '../components/CameraTile';
import { CameraFormDialog } from '../components/CameraFormDialog';
import { createCamera, deleteCamera, getCameras, updateCamera } from '../api/cameras';
import type { Camera, CameraAlert, CreateCameraPayload } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useAlertsSubscription } from '../hooks/useAlertsSubscription';
import { getRecentAlerts } from '../api/alerts';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);

  const camerasQuery = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras
  });

  const cameras = camerasQuery.data ?? [];
  const cameraIds = useMemo(() => cameras.map((camera) => camera.id), [cameras]);

  const alertsQuery = useQuery({
    queryKey: ['alerts', cameraIds],
    queryFn: () => getRecentAlerts(),
    enabled: cameraIds.length > 0
  });

  const { alertsByCamera, status: alertsStatus, error: alertsError } = useAlertsSubscription(cameraIds);

  const createMutation = useMutation({
    mutationFn: (payload: CreateCameraPayload) => createCamera(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsDialogOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: CreateCameraPayload }) => updateCamera(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsDialogOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const initialAlertsMap = useMemo(() => {
    const allAlerts = alertsQuery.data ?? [];
    return allAlerts.reduce<Record<string, CameraAlert[]>>((accumulator, alert) => {
      if (!accumulator[alert.cameraId]) {
        accumulator[alert.cameraId] = [];
      }
      accumulator[alert.cameraId].push(alert);
      return accumulator;
    }, {});
  }, [alertsQuery.data]);

  const mergedAlerts = useMemo(() => {
    const result: Record<string, CameraAlert[]> = {};
    cameras.forEach((camera) => {
      const initial = initialAlertsMap[camera.id] ?? [];
      const live = alertsByCamera[camera.id] ?? [];
      const combined = [...live, ...initial.filter((alert) => !live.some((liveAlert) => liveAlert.id === alert.id))];
      result[camera.id] = combined.slice(0, 10);
    });
    return result;
  }, [alertsByCamera, cameras, initialAlertsMap]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCamera(null);
  };

  const handleCreateOrUpdate = async (payload: CreateCameraPayload) => {
    if (editingCamera) {
      await updateMutation.mutateAsync({ id: editingCamera.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDeleteCamera = async (camera: Camera) => {
    const confirmed = window.confirm(`Delete camera "${camera.name}"?`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(camera.id);
  };

  return (
    <Box className="min-h-screen bg-slate-950 text-white">
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Toolbar className="flex items-center justify-between">
          <Box>
            <Typography variant="h5">Live camera dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor real-time streams and face detection alerts
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            {alertsStatus === 'open' ? (
              <Tooltip title="Alerts stream connected">
                <Chip color="success" size="small" label="Alerts live" />
              </Tooltip>
            ) : alertsStatus === 'connecting' ? (
              <Tooltip title="Connecting to alert stream">
                <Chip color="warning" size="small" label="Alerts connecting" />
              </Tooltip>
            ) : alertsStatus === 'error' ? (
              <Tooltip title={alertsError ?? 'Alerts unavailable'}>
                <Chip color="error" size="small" label="Alerts offline" />
              </Tooltip>
            ) : null}
            <Box className="text-right">
              <Typography variant="subtitle2">{user?.fullName ?? user?.username}</Typography>
              <Typography variant="caption" color="text.secondary">
                Operator
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton color="inherit" onClick={logout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} className="mb-6">
          <Typography variant="h5">Cameras</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingCamera(null);
              setIsDialogOpen(true);
            }}
          >
            Add camera
          </Button>
        </Stack>

        {camerasQuery.isLoading ? (
          <Box className="flex h-64 items-center justify-center">
            <CircularProgress />
          </Box>
        ) : camerasQuery.isError ? (
          <Alert severity="error">Failed to load cameras. Please retry.</Alert>
        ) : cameras.length === 0 ? (
          <Box className="flex h-64 flex-col items-center justify-center space-y-3 rounded-lg border border-dashed border-slate-700 p-8 text-center">
            <Typography variant="h6">No cameras yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first RTSP camera to start streaming and receiving alerts.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsDialogOpen(true)}>
              Add camera
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {cameras.map((camera) => (
              <Grid key={camera.id} item xs={12} md={6} xl={4}>
                <CameraTile
                  camera={camera}
                  alerts={mergedAlerts[camera.id] ?? []}
                  onEdit={(selected) => {
                    setEditingCamera(selected);
                    setIsDialogOpen(true);
                  }}
                  onDelete={handleDeleteCamera}
                />
              </Grid>
            ))}
          </Grid>
        )}
        {alertsStatus === 'error' && alertsError ? (
          <Box className="mt-6">
            <Alert severity="warning">{alertsError}</Alert>
          </Box>
        ) : null}
      </Container>

      <CameraFormDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleCreateOrUpdate}
        initialValues={editingCamera}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </Box>
  );
};

export default DashboardPage;
