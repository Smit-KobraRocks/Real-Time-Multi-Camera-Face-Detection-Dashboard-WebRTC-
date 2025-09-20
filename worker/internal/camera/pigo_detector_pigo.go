//go:build pigo

package camera

import (
	"image"
	"sync"

	pigo "github.com/esimov/pigo/core"
	"github.com/pigo/data"
)

// PigoDetector implements FaceDetector using the Pigo library.
type PigoDetector struct {
	classifier *pigo.Pigo
	params     pigo.CascadeParams
	mu         sync.Mutex
}

// NewPigoDetector loads the cascade and prepares the detector.
func NewPigoDetector() (*PigoDetector, error) {
	cascade, err := data.Cascade()
	if err != nil {
		return nil, err
	}

	p := pigo.NewPigo()
	classifier, err := p.Unpack(cascade)
	if err != nil {
		return nil, err
	}

	return &PigoDetector{
		classifier: classifier,
		params: pigo.CascadeParams{
			MinSize:     100,
			MaxSize:     1000,
			ShiftFactor: 0.1,
			ScaleFactor: 1.1,
		},
	}, nil
}

// Detect runs the cascade and returns detected faces.
func (d *PigoDetector) Detect(img image.Image) (DetectionResult, error) {
	bounds := img.Bounds()
	cols := bounds.Dx()
	rows := bounds.Dy()
	pixels := make([]uint8, cols*rows)

	idx := 0
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			gray := uint8((299*r + 587*g + 114*b + 500) / 1000 >> 8)
			pixels[idx] = gray
			idx++
		}
	}

	params := d.params
	params.ImageParams = pigo.ImageParams{
		Pixels: pixels,
		Rows:   rows,
		Cols:   cols,
		Dim:    cols,
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	dets := d.classifier.RunCascade(params, 0.0)
	dets = d.classifier.ClusterDetections(dets, 0.2)

	result := DetectionResult{Boxes: make([]BoundingBox, 0, len(dets))}
	for _, det := range dets {
		if det.Q < 5.0 {
			continue
		}

		radius := det.Scale / 2
		x0 := int(det.Col - radius)
		y0 := int(det.Row - radius)
		x1 := int(det.Col + radius)
		y1 := int(det.Row + radius)

		result.Boxes = append(result.Boxes, BoundingBox{
			Rect:  image.Rect(x0, y0, x1, y1),
			Score: det.Q,
		})
	}

	return result, nil
}
