package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"github.com/example/rt-face-worker/internal/camera"
)

// Server exposes HTTP endpoints to manage camera processing.
type Server struct {
	router  *gin.Engine
	manager *camera.CameraManager
	logger  *logrus.Logger
}

// NewServer creates the REST API server.
func NewServer(manager *camera.CameraManager, logger *logrus.Logger) *Server {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		logger.WithFields(logrus.Fields{
			"method":   c.Request.Method,
			"path":     c.FullPath(),
			"status":   c.Writer.Status(),
			"duration": duration.String(),
		}).Info("http request")
	})

	srv := &Server{router: r, manager: manager, logger: logger}

	r.GET("/health", srv.health)
	r.POST("/start/:cameraId", srv.startCamera)
	r.POST("/stop/:cameraId", srv.stopCamera)

	return srv
}

// Handler returns the underlying Gin engine.
func (s *Server) Handler() http.Handler {
	return s.router
}

// Run starts the HTTP server and blocks until context is canceled.
func (s *Server) Run(ctx context.Context, addr string) error {
	httpServer := &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func (s *Server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "cameras": s.manager.ActiveCameras()})
}

func (s *Server) startCamera(c *gin.Context) {
	cameraID := c.Param("cameraId")
	if err := s.manager.StartCamera(cameraID); err != nil {
		s.logger.WithError(err).Warn("failed to start camera")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusAccepted)
}

func (s *Server) stopCamera(c *gin.Context) {
	cameraID := c.Param("cameraId")
	s.manager.StopCamera(cameraID)
	c.Status(http.StatusAccepted)
}
