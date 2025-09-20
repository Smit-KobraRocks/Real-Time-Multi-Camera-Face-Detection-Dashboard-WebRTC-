package camera

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
)

// FFmpegFrameSource uses ffmpeg to pull frames from an RTSP stream.
type FFmpegFrameSource struct {
	ffmpegBin string
	rtspURL   string
	fps       int

	frames chan []byte
	errCh  chan error

	cmd    *exec.Cmd
	stdout io.ReadCloser
	mu     sync.Mutex
	once   sync.Once
}

// NewFFmpegFrameSource creates a frame source configured to read frames at the desired fps.
func NewFFmpegFrameSource(ffmpegBin, rtspURL string, fps int) *FFmpegFrameSource {
	return &FFmpegFrameSource{
		ffmpegBin: ffmpegBin,
		rtspURL:   rtspURL,
		fps:       fps,
	}
}

// Start launches the ffmpeg process and begins streaming frames.
func (s *FFmpegFrameSource) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.frames != nil {
		return errors.New("frame source already started")
	}

	args := []string{
		"-hide_banner",
		"-loglevel", "error",
		"-rtsp_transport", "tcp",
		"-i", s.rtspURL,
		"-an",
		"-vf", fmt.Sprintf("fps=%d", s.fps),
		"-f", "mjpeg",
		"pipe:1",
	}

	cmd := exec.CommandContext(ctx, s.ffmpegBin, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start ffmpeg: %w", err)
	}

	s.cmd = cmd
	s.stdout = stdout
	s.frames = make(chan []byte, 1)
	s.errCh = make(chan error, 1)

	go s.readLoop(ctx)
	return nil
}

// Frames returns the channel of raw JPEG frames.
func (s *FFmpegFrameSource) Frames() <-chan []byte {
	return s.frames
}

// Err returns channel with fatal errors from the ffmpeg process.
func (s *FFmpegFrameSource) Err() <-chan error {
	return s.errCh
}

// Close terminates the ffmpeg process.
func (s *FFmpegFrameSource) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var err error
	s.once.Do(func() {
		if s.stdout != nil {
			_ = s.stdout.Close()
		}
		if s.cmd != nil && s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
			err = s.cmd.Wait()
		}
	})
	return err
}

func (s *FFmpegFrameSource) readLoop(ctx context.Context) {
	defer func() {
		if s.frames != nil {
			close(s.frames)
		}
		if s.errCh != nil {
			close(s.errCh)
		}
	}()

	reader := bufio.NewReader(s.stdout)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		frame, err := readMJPEGFrame(reader)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				select {
				case s.errCh <- err:
				default:
				}
			}
			return
		}

		select {
		case <-ctx.Done():
			return
		case s.frames <- frame:
		default:
			// Drop frame if consumer is slow to keep realtime behavior.
		}
	}
}

func readMJPEGFrame(reader *bufio.Reader) ([]byte, error) {
	var frame []byte
	for {
		b, err := reader.ReadByte()
		if err != nil {
			return nil, err
		}
		if len(frame) == 0 {
			if b == 0xFF {
				next, err := reader.ReadByte()
				if err != nil {
					return nil, err
				}
				if next == 0xD8 {
					frame = append(frame, 0xFF, 0xD8)
					continue
				}
			}
			continue
		}

		frame = append(frame, b)
		if len(frame) >= 2 && frame[len(frame)-2] == 0xFF && frame[len(frame)-1] == 0xD9 {
			return frame, nil
		}
	}
}
