package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// CameraConfig holds per camera configuration values.
type CameraConfig struct {
	ID      string
	RTSPURL string
}

// Config describes the worker configuration loaded from environment variables.
type Config struct {
	AppEnv               string
	LogLevel             string
	FFmpegBin            string
	ProcessingFPS        int
	BackendBaseURL       string
	BackendAlertEndpoint string
	MediaMTXURL          string
	APIAddress           string
	CameraConfigs        map[string]CameraConfig
}

// Load reads configuration from environment variables and optional .env files.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:               getEnv("APP_ENV", "development"),
		LogLevel:             getEnv("LOG_LEVEL", "info"),
		FFmpegBin:            getEnv("FFMPEG_BIN", "ffmpeg"),
		BackendBaseURL:       getEnv("BACKEND_BASE_URL", "http://localhost:8081"),
		BackendAlertEndpoint: getEnv("BACKEND_ALERT_ENDPOINT", "/alerts"),
		MediaMTXURL:          getEnv("MEDIAMTX_URL", "rtsp://localhost:8554"),
		APIAddress:           getEnv("API_ADDRESS", ":8080"),
	}

	fps, err := strconv.Atoi(getEnv("PROCESSING_FPS", "15"))
	if err != nil || fps <= 0 {
		return nil, fmt.Errorf("invalid PROCESSING_FPS value: %w", err)
	}
	cfg.ProcessingFPS = fps

	cameraCfg := getEnv("CAMERA_CONFIGS", "")
	configs, err := parseCameraConfigs(cameraCfg)
	if err != nil {
		return nil, err
	}
	cfg.CameraConfigs = configs

	return cfg, nil
}

func parseCameraConfigs(val string) (map[string]CameraConfig, error) {
	configs := make(map[string]CameraConfig)
	if val == "" {
		return configs, nil
	}

	entries := strings.Split(val, ";")
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid camera config entry: %s", entry)
		}
		id := strings.TrimSpace(parts[0])
		url := strings.TrimSpace(parts[1])
		if id == "" || url == "" {
			return nil, fmt.Errorf("invalid camera config entry: %s", entry)
		}
		configs[id] = CameraConfig{ID: id, RTSPURL: url}
	}
	return configs, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
