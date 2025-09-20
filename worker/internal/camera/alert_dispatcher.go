package camera

import "context"

// Alert represents a detected face alert payload.
type Alert struct {
	CameraID   string         `json:"cameraId"`
	Timestamp  int64          `json:"timestamp"`
	Detections []BoundingBox  `json:"detections"`
	Snapshot   string         `json:"snapshot"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// AlertDispatcher sends alerts to the backend API.
type AlertDispatcher interface {
	Dispatch(ctx context.Context, alert Alert) error
}
