package camera

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/example/rt-face-worker/internal/utils"
)

// CameraWorker handles the end-to-end pipeline for a single camera stream.
type CameraWorker struct {
	cameraID   string
	rtspURL    string
	outputURL  string
	fps        int
	ffmpegBin  string
	logger     *logrus.Entry
	detector   FaceDetector
	dispatcher AlertDispatcher
	backoff    utils.ExponentialBackoff

	ctx     context.Context
	cancel  context.CancelFunc
	running atomic.Bool
	wg      sync.WaitGroup
}

// NewCameraWorker constructs a worker for a camera stream.
func NewCameraWorker(cameraID, rtspURL, outputURL, ffmpegBin string, fps int, detector FaceDetector, dispatcher AlertDispatcher, logger *logrus.Logger) *CameraWorker {
	return &CameraWorker{
		cameraID:   cameraID,
		rtspURL:    rtspURL,
		outputURL:  outputURL,
		fps:        fps,
		ffmpegBin:  ffmpegBin,
		detector:   detector,
		dispatcher: dispatcher,
		logger:     logger.WithField("cameraId", cameraID),
		backoff: utils.ExponentialBackoff{
			Base:   time.Second,
			Max:    30 * time.Second,
			Jitter: true,
		},
	}
}

// Start begins processing the camera stream.
func (w *CameraWorker) Start(parent context.Context) error {
	if !w.running.CompareAndSwap(false, true) {
		return fmt.Errorf("camera %s already running", w.cameraID)
	}

	w.ctx, w.cancel = context.WithCancel(parent)
	w.wg.Add(1)
	go w.run()
	w.logger.Info("camera worker started")
	return nil
}

// Stop terminates processing gracefully.
func (w *CameraWorker) Stop() {
	if !w.running.CompareAndSwap(true, false) {
		return
	}
	w.cancel()
	w.wg.Wait()
	w.logger.Info("camera worker stopped")
}

func (w *CameraWorker) run() {
	defer w.wg.Done()

	attempt := 0
	for {
		if err := w.processOnce(w.ctx); err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			w.logger.WithError(err).Warn("camera pipeline error, retrying")
			attempt++
			delay := w.backoff.Duration(attempt)
			select {
			case <-time.After(delay):
			case <-w.ctx.Done():
				return
			}
			continue
		}
		return
	}
}

func (w *CameraWorker) processOnce(ctx context.Context) error {
	source := NewFFmpegFrameSource(w.ffmpegBin, w.rtspURL, w.fps)
	publisher := NewFFmpegFramePublisher(w.ffmpegBin, w.outputURL, w.fps)

	if err := source.Start(ctx); err != nil {
		return fmt.Errorf("start source: %w", err)
	}
	if err := publisher.Start(ctx); err != nil {
		return fmt.Errorf("start publisher: %w", err)
	}
	defer source.Close()
	defer publisher.Close()

	fpsCounter := newFPSCounter()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err, ok := <-source.Err():
			if ok && err != nil {
				return fmt.Errorf("source error: %w", err)
			}
			return io.EOF
		case frame, ok := <-source.Frames():
			if !ok {
				return io.EOF
			}

			processed, detection, err := w.handleFrame(frame, fpsCounter)
			if err != nil {
				w.logger.WithError(err).Warn("process frame")
				continue
			}

			if len(detection.Boxes) > 0 {
				if err := w.sendAlert(ctx, processed, detection); err != nil {
					w.logger.WithError(err).Warn("send alert")
				}
			}

			if err := publisher.Publish(processed); err != nil {
				return fmt.Errorf("publish frame: %w", err)
			}
		}
	}
}

func (w *CameraWorker) handleFrame(frame []byte, counter *fpsCounter) ([]byte, DetectionResult, error) {
	img, err := jpeg.Decode(bytes.NewReader(frame))
	if err != nil {
		return nil, DetectionResult{}, fmt.Errorf("decode frame: %w", err)
	}

	rgba := image.NewRGBA(img.Bounds())
	draw.Draw(rgba, rgba.Bounds(), img, img.Bounds().Min, draw.Src)

	detection, err := w.detector.Detect(rgba)
	if err != nil {
		return nil, DetectionResult{}, fmt.Errorf("detect faces: %w", err)
	}

	w.drawDetections(rgba, detection)
	w.drawOverlayText(rgba, counter.Next())

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, rgba, &jpeg.Options{Quality: 85}); err != nil {
		return nil, DetectionResult{}, fmt.Errorf("encode frame: %w", err)
	}

	return buf.Bytes(), detection, nil
}

func (w *CameraWorker) drawDetections(img *image.RGBA, detection DetectionResult) {
	for _, box := range detection.Boxes {
		rect := box.Rect.Intersect(img.Bounds())
		if rect.Empty() {
			continue
		}
		clr := image.NewUniform(color.RGBA{R: 255, G: 0, B: 0, A: 255})

		top := rect.Min.Y
		bottom := rect.Max.Y - 1
		left := rect.Min.X
		right := rect.Max.X - 1

		for x := left; x <= right; x++ {
			img.Set(x, top, clr.C)
			img.Set(x, bottom, clr.C)
		}
		for y := top; y <= bottom; y++ {
			img.Set(left, y, clr.C)
			img.Set(right, y, clr.C)
		}
	}
}

func (w *CameraWorker) drawOverlayText(img *image.RGBA, fps float64) {
	textColor := color.RGBA{R: 255, G: 255, B: 255, A: 255}
	drawText(img, 10, 10, fmt.Sprintf("CAMERA: %s", strings.ToUpper(w.cameraID)), textColor)
	drawText(img, 10, 25, fmt.Sprintf("FPS: %.1f", fps), textColor)
}

func (w *CameraWorker) sendAlert(ctx context.Context, frame []byte, detection DetectionResult) error {
	snapshot := base64.StdEncoding.EncodeToString(frame)

	boxes := make([]BoundingBox, len(detection.Boxes))
	copy(boxes, detection.Boxes)

	alert := Alert{
		CameraID:   w.cameraID,
		Timestamp:  time.Now().Unix(),
		Detections: boxes,
		Snapshot:   snapshot,
	}
	return w.dispatcher.Dispatch(ctx, alert)
}

// fpsCounter keeps track of the current frame rate.
type fpsCounter struct {
	count     int
	lastReset time.Time
	fps       float64
}

func newFPSCounter() *fpsCounter {
	return &fpsCounter{lastReset: time.Now()}
}

func (c *fpsCounter) Next() float64 {
	c.count++
	delta := time.Since(c.lastReset)
	if delta >= time.Second {
		c.fps = float64(c.count) / delta.Seconds()
		c.count = 0
		c.lastReset = time.Now()
	} else if c.fps == 0 && delta > 0 {
		c.fps = float64(c.count) / delta.Seconds()
	}
	return c.fps
}
