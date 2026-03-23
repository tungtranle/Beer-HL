package safego

import (
	"context"
	"fmt"
	"runtime/debug"

	"bhl-oms/pkg/logger"
)

// SafeGo runs fn in a goroutine with panic recovery and structured logging.
// v4 spec: KHÔNG dùng `go func()` trực tiếp — luôn dùng SafeGo.
//
// Usage:
//
//	safego.Run(ctx, log, "GenerateManifest", func(ctx context.Context) error {
//	    return manifestSvc.GenerateForTrip(ctx, tripID)
//	})
func Run(ctx context.Context, log logger.Logger, taskName string, fn func(ctx context.Context) error) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				log.Error(ctx, "safego_panic",
					fmt.Errorf("panic in %s: %v", taskName, r),
					logger.F("task", taskName),
					logger.F("stack", stack),
				)
			}
		}()

		if err := fn(ctx); err != nil {
			// Fire-and-forget: log error but don't propagate
			log.Error(ctx, "safego_error", err,
				logger.F("task", taskName),
			)
		}
	}()
}
