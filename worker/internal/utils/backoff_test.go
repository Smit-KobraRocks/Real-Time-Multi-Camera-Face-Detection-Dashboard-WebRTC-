package utils

import (
	"math"
	"testing"
	"time"
)

func TestExponentialBackoffDuration(t *testing.T) {
	b := ExponentialBackoff{Base: time.Second, Max: 8 * time.Second}
	d1 := b.Duration(0)
	d2 := b.Duration(1)
	d3 := b.Duration(5)

	if d1 != time.Second {
		t.Fatalf("expected base duration, got %s", d1)
	}
	if d2 <= d1 {
		t.Fatalf("expected growth, got %s", d2)
	}
	if d3 > 8*time.Second {
		t.Fatalf("expected max cap, got %s", d3)
	}
}

func TestExponentialBackoffJitter(t *testing.T) {
	b := ExponentialBackoff{Base: time.Second, Max: 4 * time.Second, Jitter: true}

	d := b.Duration(2)
	if d < time.Second || d > 4*time.Second {
		t.Fatalf("duration out of bounds: %s", d)
	}
	if math.IsNaN(float64(d)) {
		t.Fatal("duration should be numeric")
	}
}
