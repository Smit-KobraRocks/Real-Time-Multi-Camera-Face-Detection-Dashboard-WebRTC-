package camera

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
)

// FFmpegFramePublisher pushes JPEG frames to MediaMTX using ffmpeg for transcoding.
type FFmpegFramePublisher struct {
	ffmpegBin string
	outputURL string
	fps       int

	cmd   *exec.Cmd
	stdin io.WriteCloser
	mu    sync.Mutex
}

// NewFFmpegFramePublisher creates a publisher that sends frames to MediaMTX.
func NewFFmpegFramePublisher(ffmpegBin, outputURL string, fps int) *FFmpegFramePublisher {
	return &FFmpegFramePublisher{
		ffmpegBin: ffmpegBin,
		outputURL: outputURL,
		fps:       fps,
	}
}

// Start initializes ffmpeg process for publishing.
func (p *FFmpegFramePublisher) Start(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.cmd != nil {
		return fmt.Errorf("publisher already started")
	}

	args := []string{
		"-hide_banner",
		"-loglevel", "error",
		"-f", "mjpeg",
		"-r", fmt.Sprintf("%d", p.fps),
		"-i", "pipe:0",
		"-an",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-tune", "zerolatency",
		"-f", "rtsp",
		"-rtsp_transport", "tcp",
		p.outputURL,
	}

	cmd := exec.CommandContext(ctx, p.ffmpegBin, args...)
	cmd.Stderr = os.Stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start ffmpeg publisher: %w", err)
	}

	p.cmd = cmd
	p.stdin = stdin
	go func() {
		<-ctx.Done()
		_ = p.Close()
	}()
	return nil
}

// Publish writes a JPEG frame to ffmpeg stdin.
func (p *FFmpegFramePublisher) Publish(frame []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.stdin == nil {
		return fmt.Errorf("publisher not started")
	}

	_, err := p.stdin.Write(frame)
	return err
}

// Close stops the ffmpeg process.
func (p *FFmpegFramePublisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	var err error
	if p.stdin != nil {
		err = p.stdin.Close()
		p.stdin = nil
	}
	if p.cmd != nil {
		_ = p.cmd.Process.Kill()
		err = p.cmd.Wait()
		p.cmd = nil
	}
	return err
}
