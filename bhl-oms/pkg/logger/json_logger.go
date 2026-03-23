package logger

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

type jsonLogger struct {
	out io.Writer
	lvl Level
	mu  sync.Mutex
}

// New creates a JSON structured logger writing to out.
func New(out io.Writer, minLevel Level) Logger {
	return &jsonLogger{out: out, lvl: minLevel}
}

func (l *jsonLogger) Debug(ctx context.Context, msg string, fields ...Field) {
	if l.lvl <= DEBUG {
		l.write(ctx, "DEBUG", msg, nil, fields)
	}
}

func (l *jsonLogger) Info(ctx context.Context, msg string, fields ...Field) {
	if l.lvl <= INFO {
		l.write(ctx, "INFO", msg, nil, fields)
	}
}

func (l *jsonLogger) Warn(ctx context.Context, msg string, fields ...Field) {
	if l.lvl <= WARN {
		l.write(ctx, "WARN", msg, nil, fields)
	}
}

func (l *jsonLogger) Error(ctx context.Context, msg string, err error, fields ...Field) {
	if l.lvl <= ERROR {
		l.write(ctx, "ERROR", msg, err, fields)
	}
}

func (l *jsonLogger) Fatal(ctx context.Context, msg string, err error, fields ...Field) {
	l.write(ctx, "FATAL", msg, err, fields)
	os.Exit(1)
}

func (l *jsonLogger) write(ctx context.Context, level, msg string, err error, fields []Field) {
	entry := map[string]any{
		"ts":      time.Now().UTC().Format(time.RFC3339Nano),
		"level":   level,
		"msg":     msg,
		"service": "bhl-oms",
	}

	if traceID := TraceIDFromCtx(ctx); traceID != "" {
		entry["trace_id"] = traceID
	}
	if userID := UserIDFromCtx(ctx); userID != "" {
		entry["user_id"] = userID
	}

	for _, f := range fields {
		entry[f.Key] = f.Value
	}

	if err != nil {
		entry["error"] = err.Error()
		entry["stack"] = captureStack()
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	_ = json.NewEncoder(l.out).Encode(entry)
}

func captureStack() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	lines := strings.Split(string(buf[:n]), "\n")
	// Skip the first 6 lines (runtime + logger internals)
	if len(lines) > 6 {
		lines = lines[6:]
	}
	return strings.Join(lines, "\n")
}
