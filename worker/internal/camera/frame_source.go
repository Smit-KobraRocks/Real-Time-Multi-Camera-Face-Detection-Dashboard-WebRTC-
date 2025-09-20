package camera

import "context"

// FrameSource streams encoded frames from a camera.
type FrameSource interface {
	Start(ctx context.Context) error
	Frames() <-chan []byte
	Err() <-chan error
	Close() error
}
