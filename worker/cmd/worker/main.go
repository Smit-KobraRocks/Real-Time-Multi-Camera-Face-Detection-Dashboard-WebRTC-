package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/sirupsen/logrus"

	"github.com/example/rt-face-worker/internal/api"
	"github.com/example/rt-face-worker/internal/camera"
	"github.com/example/rt-face-worker/internal/config"
	"github.com/example/rt-face-worker/internal/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		logrus.Fatalf("load config: %v", err)
	}

	logger, err := logging.Setup(cfg.LogLevel)
	if err != nil {
		logrus.Fatalf("init logger: %v", err)
	}

	detector, err := camera.NewPigoDetector()
	if err != nil {
		logger.Fatalf("init detector: %v", err)
	}

	dispatcher := camera.NewHTTPAlertDispatcher(cfg.BackendBaseURL, cfg.BackendAlertEndpoint)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	manager := camera.NewCameraManager(ctx, cfg, detector, dispatcher, logger)

	for id := range cfg.CameraConfigs {
		if err := manager.StartCamera(id); err != nil {
			logger.WithError(err).Warn("failed to start camera")
		}
	}

	server := api.NewServer(manager, logger)
	logger.Infof("starting API server on %s", cfg.APIAddress)
	if err := server.Run(ctx, cfg.APIAddress); err != nil {
		logger.WithError(err).Fatal("server error")
	}

	manager.Shutdown()
	logger.Info("worker exiting")
}
