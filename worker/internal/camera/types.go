package camera

import "image"

// BoundingBox represents a detected face bounding box.
type BoundingBox struct {
	Rect  image.Rectangle
	Score float64
}

// DetectionResult groups the bounding boxes detected within a frame.
type DetectionResult struct {
	Boxes []BoundingBox
}
