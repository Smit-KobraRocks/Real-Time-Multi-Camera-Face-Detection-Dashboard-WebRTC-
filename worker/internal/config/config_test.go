package config

import "testing"

func TestParseCameraConfigs(t *testing.T) {
	configs, err := parseCameraConfigs("cam1=rtsp://one;cam2=rtsp://two")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(configs) != 2 {
		t.Fatalf("expected 2 configs, got %d", len(configs))
	}
	if configs["cam1"].RTSPURL != "rtsp://one" {
		t.Errorf("unexpected url for cam1: %s", configs["cam1"].RTSPURL)
	}
}

func TestParseCameraConfigsInvalid(t *testing.T) {
	if _, err := parseCameraConfigs("invalid"); err == nil {
		t.Fatalf("expected error for invalid entry")
	}
}
