package core

// This package provides stub structures to allow building without the actual
// Pigo dependency. The implementation does not perform real face detection but
// matches the API required by the worker service. To enable the real detector,
// replace this stub with the upstream library and build with the `pigo` tag.

type ImageParams struct {
	Pixels []uint8
	Rows   int
	Cols   int
	Dim    int
}

type Detection struct {
	Row   int
	Col   int
	Scale int
	Q     float32
}

type CascadeParams struct {
	MinSize     int
	MaxSize     int
	ShiftFactor float64
	ScaleFactor float64
	ImageParams ImageParams
}

type Pigo struct{}

func NewPigo() *Pigo {
	return &Pigo{}
}

func (p *Pigo) Unpack(_ []byte) (*Pigo, error) {
	return p, nil
}

func (p *Pigo) RunCascade(_ CascadeParams, _ float64) []Detection {
	return nil
}

func (p *Pigo) ClusterDetections(dets []Detection, _ float64) []Detection {
	return dets
}
