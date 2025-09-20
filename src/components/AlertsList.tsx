import {
  Avatar,
  Box,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography
} from '@mui/material';
import type { CameraAlert } from '../types';

interface AlertsListProps {
  alerts: CameraAlert[];
}

export const AlertsList: React.FC<AlertsListProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <Box className="flex h-full items-center justify-center py-6">
        <Typography variant="body2" color="text.secondary">
          No face detections yet.
        </Typography>
      </Box>
    );
  }

  return (
    <List dense sx={{ maxHeight: 220, overflowY: 'auto' }}>
      {alerts.map((alert) => (
        <ListItem key={alert.id} alignItems="flex-start">
          <ListItemAvatar>
            <Avatar variant="rounded" src={alert.faceThumbnailUrl} alt="Face thumbnail" />
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box className="flex items-center justify-between">
                <Typography variant="subtitle2" color="text.primary">
                  {new Date(alert.timestamp).toLocaleString()}
                </Typography>
                {alert.description ? <Chip label={alert.description} size="small" /> : null}
              </Box>
            }
            secondary={
              alert.description ? (
                <Typography variant="body2" color="text.secondary">
                  {alert.description}
                </Typography>
              ) : undefined
            }
          />
        </ListItem>
      ))}
    </List>
  );
};
