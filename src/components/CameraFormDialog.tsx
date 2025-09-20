import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField
} from '@mui/material';
import type { Camera, CreateCameraPayload } from '../types';

interface CameraFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateCameraPayload) => Promise<void> | void;
  loading?: boolean;
  initialValues?: Camera | null;
}

const DEFAULT_VALUES: CreateCameraPayload = {
  name: '',
  location: '',
  rtspUrl: ''
};

export const CameraFormDialog: React.FC<CameraFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  initialValues
}) => {
  const [values, setValues] = useState<CreateCameraPayload>(DEFAULT_VALUES);

  useEffect(() => {
    if (initialValues) {
      setValues({
        name: initialValues.name,
        location: initialValues.location,
        rtspUrl: initialValues.rtspUrl
      });
    } else {
      setValues(DEFAULT_VALUES);
    }
  }, [initialValues, open]);

  const handleChange = (field: keyof CreateCameraPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialValues ? 'Edit camera' : 'Add camera'}</DialogTitle>
        <DialogContent>
          <Box className="mt-2">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Camera name"
                  fullWidth
                  required
                  value={values.name}
                  onChange={handleChange('name')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Location"
                  fullWidth
                  required
                  value={values.location}
                  onChange={handleChange('location')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="RTSP URL"
                  fullWidth
                  required
                  value={values.rtspUrl}
                  onChange={handleChange('rtspUrl')}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {initialValues ? 'Save changes' : 'Add camera'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
