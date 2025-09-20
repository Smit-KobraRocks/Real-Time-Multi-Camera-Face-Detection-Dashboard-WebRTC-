package camera

import "image"

// Stub detector used when the pigo build tag is not enabled.
type PigoDetector struct{}

// NewPigoDetector returns a stub detector that performs no detection.
func NewPigoDetector() (*PigoDetector, error) {
	return &PigoDetector{}, nil
}

// Detect satisfies the FaceDetector interface by returning no detections.
func (d *PigoDetector) Detect(img image.Image) (DetectionResult, error) {
	return DetectionResult{}, nil
}
