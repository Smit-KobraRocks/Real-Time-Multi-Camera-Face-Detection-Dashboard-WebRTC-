package camera

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"

	"github.com/example/rt-face-worker/internal/config"
)

// CameraManager coordinates multiple camera workers.
type CameraManager struct {
	ctx        context.Context
	cancel     context.CancelFunc
	cfg        *config.Config
	logger     *logrus.Logger
	detector   FaceDetector
	dispatcher AlertDispatcher

	ffmpegBin string
	fps       int

	mu      sync.RWMutex
	workers map[string]*CameraWorker
}

// NewCameraManager constructs a new manager using the provided dependencies.
func NewCameraManager(parent context.Context, cfg *config.Config, detector FaceDetector, dispatcher AlertDispatcher, logger *logrus.Logger) *CameraManager {
	ctx, cancel := context.WithCancel(parent)
	return &CameraManager{
		ctx:        ctx,
		cancel:     cancel,
		cfg:        cfg,
		logger:     logger,
		detector:   detector,
		dispatcher: dispatcher,
		ffmpegBin:  cfg.FFmpegBin,
		fps:        cfg.ProcessingFPS,
		workers:    make(map[string]*CameraWorker),
	}
}

// StartCamera starts processing for a camera if not already running.
func (m *CameraManager) StartCamera(cameraID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.workers[cameraID]; ok {
		return fmt.Errorf("camera %s already running", cameraID)
	}

	camCfg, ok := m.cfg.CameraConfigs[cameraID]
	if !ok {
		return fmt.Errorf("camera %s not configured", cameraID)
	}

	outputURL := fmt.Sprintf("%s/%s", strings.TrimRight(m.cfg.MediaMTXURL, "/"), cameraID)
	worker := NewCameraWorker(cameraID, camCfg.RTSPURL, outputURL, m.ffmpegBin, m.fps, m.detector, m.dispatcher, m.logger)
	if err := worker.Start(m.ctx); err != nil {
		return err
	}

	m.workers[cameraID] = worker
	return nil
}

// StopCamera stops a running camera worker.
func (m *CameraManager) StopCamera(cameraID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if worker, ok := m.workers[cameraID]; ok {
		worker.Stop()
		delete(m.workers, cameraID)
	}
}

// ActiveCameras returns a snapshot of currently running cameras.
func (m *CameraManager) ActiveCameras() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.workers))
	for id := range m.workers {
		ids = append(ids, id)
	}
	return ids
}

// Shutdown stops all workers and releases resources.
func (m *CameraManager) Shutdown() {
	m.cancel()

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, worker := range m.workers {
		worker.Stop()
		delete(m.workers, id)
	}
}
