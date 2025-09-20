package utils

import (
	"math"
	"math/rand"
	"time"
)

// ExponentialBackoff calculates retry intervals with optional jitter.
type ExponentialBackoff struct {
	Base   time.Duration
	Max    time.Duration
	Jitter bool
}

// Duration returns the wait duration for the provided retry attempt (0-indexed).
func (b ExponentialBackoff) Duration(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}

	d := float64(b.Base) * math.Pow(2, float64(attempt))
	if b.Jitter {
		jitter := rand.Float64()*0.4 + 0.8 // 80%-120%
		d *= jitter
	}
	dur := time.Duration(d)
	if b.Max > 0 && dur > b.Max {
		dur = b.Max
	}
	return dur
}
