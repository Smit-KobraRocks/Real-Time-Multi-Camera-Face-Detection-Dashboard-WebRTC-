package camera

import "image"

// FaceDetector detects faces in images.
type FaceDetector interface {
	Detect(img image.Image) (DetectionResult, error)
}
