package logrus

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

type Level int

type Fields map[string]any

type Formatter interface{}

type JSONFormatter struct{}

type Logger struct {
	mu        sync.Mutex
	level     Level
	out       io.Writer
	formatter Formatter
}

type Entry struct {
	logger *Logger
	fields Fields
}

var std = New()

const (
	PanicLevel Level = iota
	FatalLevel
	ErrorLevel
	WarnLevel
	InfoLevel
	DebugLevel
)

func New() *Logger {
	return &Logger{level: InfoLevel, out: os.Stdout, formatter: &JSONFormatter{}}
}

func StandardLogger() *Logger {
	return std
}

func SetFormatter(f Formatter) {
	std.SetFormatter(f)
}

func SetLevel(level Level) {
	std.SetLevel(level)
}

func WithField(key string, value any) *Entry {
	return std.WithField(key, value)
}

func WithFields(fields Fields) *Entry {
	return std.WithFields(fields)
}

func WithError(err error) *Entry {
	return std.WithError(err)
}

func Info(args ...any) {
	std.log(InfoLevel, fmt.Sprint(args...), Fields{})
}

func Infof(format string, args ...any) {
	std.log(InfoLevel, fmt.Sprintf(format, args...), Fields{})
}

func Warn(args ...any) {
	std.log(WarnLevel, fmt.Sprint(args...), Fields{})
}

func Warnf(format string, args ...any) {
	std.log(WarnLevel, fmt.Sprintf(format, args...), Fields{})
}

func Fatal(args ...any) {
	std.log(FatalLevel, fmt.Sprint(args...), Fields{})
	os.Exit(1)
}

func Fatalf(format string, args ...any) {
	std.log(FatalLevel, fmt.Sprintf(format, args...), Fields{})
	os.Exit(1)
}

func ParseLevel(level string) (Level, error) {
	switch strings.ToLower(level) {
	case "panic":
		return PanicLevel, nil
	case "fatal":
		return FatalLevel, nil
	case "error":
		return ErrorLevel, nil
	case "warn", "warning":
		return WarnLevel, nil
	case "info":
		return InfoLevel, nil
	case "debug":
		return DebugLevel, nil
	default:
		return InfoLevel, fmt.Errorf("unknown level %s", level)
	}
}

func (l *Logger) SetFormatter(f Formatter) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.formatter = f
}

func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

func (l *Logger) WithField(key string, value any) *Entry {
	return l.WithFields(Fields{key: value})
}

func (l *Logger) WithFields(fields Fields) *Entry {
	copy := make(Fields, len(fields))
	for k, v := range fields {
		copy[k] = v
	}
	return &Entry{logger: l, fields: copy}
}

func (l *Logger) WithError(err error) *Entry {
	return l.WithField("error", err.Error())
}

func (l *Logger) log(level Level, msg string, fields Fields) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if level > l.level {
		return
	}
	payload := make(map[string]any, len(fields)+3)
	for k, v := range fields {
		payload[k] = v
	}
	payload["level"] = level.String()
	payload["msg"] = msg
	payload["time"] = time.Now().UTC().Format(time.RFC3339)
	data, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(l.out, "{\"level\":\"error\",\"msg\":%q}\n", err.Error())
		return
	}
	fmt.Fprintf(l.out, "%s\n", data)
}

func (l Level) String() string {
	switch l {
	case PanicLevel:
		return "panic"
	case FatalLevel:
		return "fatal"
	case ErrorLevel:
		return "error"
	case WarnLevel:
		return "warn"
	case InfoLevel:
		return "info"
	case DebugLevel:
		return "debug"
	default:
		return "info"
	}
}

func (e *Entry) WithField(key string, value any) *Entry {
	return e.WithFields(Fields{key: value})
}

func (e *Entry) WithFields(fields Fields) *Entry {
	merged := make(Fields, len(e.fields)+len(fields))
	for k, v := range e.fields {
		merged[k] = v
	}
	for k, v := range fields {
		merged[k] = v
	}
	return &Entry{logger: e.logger, fields: merged}
}

func (e *Entry) WithError(err error) *Entry {
	return e.WithField("error", err.Error())
}

func (e *Entry) log(level Level, msg string) {
	e.logger.log(level, msg, e.fields)
}

func (e *Entry) Info(msg string) {
	e.log(InfoLevel, msg)
}

func (e *Entry) Infof(format string, args ...any) {
	e.log(InfoLevel, fmt.Sprintf(format, args...))
}

func (e *Entry) Warn(msg string) {
	e.log(WarnLevel, msg)
}

func (e *Entry) Warnf(format string, args ...any) {
	e.log(WarnLevel, fmt.Sprintf(format, args...))
}

func (e *Entry) Fatal(msg string) {
	e.log(FatalLevel, msg)
	os.Exit(1)
}

func (e *Entry) Fatalf(format string, args ...any) {
	e.log(FatalLevel, fmt.Sprintf(format, args...))
	os.Exit(1)
}

func (l *Logger) Info(msg string) {
	l.log(InfoLevel, msg, Fields{})
}

func (l *Logger) Infof(format string, args ...any) {
	l.log(InfoLevel, fmt.Sprintf(format, args...), Fields{})
}

func (l *Logger) Warn(msg string) {
	l.log(WarnLevel, msg, Fields{})
}

func (l *Logger) Warnf(format string, args ...any) {
	l.log(WarnLevel, fmt.Sprintf(format, args...), Fields{})
}

func (l *Logger) Fatal(msg string) {
	l.log(FatalLevel, msg, Fields{})
	os.Exit(1)
}

func (l *Logger) Fatalf(format string, args ...any) {
	l.log(FatalLevel, fmt.Sprintf(format, args...), Fields{})
	os.Exit(1)
}
