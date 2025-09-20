package camera

import "context"

// FramePublisher sends processed frames to MediaMTX.
type FramePublisher interface {
	Start(ctx context.Context) error
	Publish(frame []byte) error
	Close() error
}
