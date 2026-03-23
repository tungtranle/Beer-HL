package logger

import (
	"context"
	"time"
)

// Logger interface — all modules MUST use this instead of log.Printf
type Logger interface {
	Debug(ctx context.Context, msg string, fields ...Field)
	Info(ctx context.Context, msg string, fields ...Field)
	Warn(ctx context.Context, msg string, fields ...Field)
	Error(ctx context.Context, msg string, err error, fields ...Field)
	Fatal(ctx context.Context, msg string, err error, fields ...Field)
}

// Field is a key-value pair for structured logging
type Field struct {
	Key   string
	Value any
}

// Level represents log severity
type Level int

const (
	DEBUG Level = iota
	INFO
	WARN
	ERROR
	FATAL
)

func ParseLevel(s string) Level {
	switch s {
	case "DEBUG", "debug":
		return DEBUG
	case "WARN", "warn":
		return WARN
	case "ERROR", "error":
		return ERROR
	case "FATAL", "fatal":
		return FATAL
	default:
		return INFO
	}
}

// --- Field helpers ---

func F(key string, value any) Field  { return Field{Key: key, Value: value} }
func Err(err error) Field            { return Field{Key: "error", Value: err.Error()} }
func Duration(d time.Duration) Field { return Field{Key: "duration_ms", Value: d.Milliseconds()} }
