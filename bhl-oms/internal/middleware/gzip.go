package middleware

import (
	"compress/gzip"
	"io"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// gzipPool reuses gzip.Writer instances to reduce GC pressure.
var gzipPool = sync.Pool{
	New: func() interface{} {
		gz, _ := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		return gz
	},
}

type gzipWriter struct {
	gz *gzip.Writer
	gin.ResponseWriter
}

func (g *gzipWriter) Write(b []byte) (int, error) {
	return g.gz.Write(b)
}

func (g *gzipWriter) WriteString(s string) (int, error) {
	return g.gz.Write([]byte(s))
}

// WriteHeader removes Content-Length before writing status because gzip
// changes the body size.
func (g *gzipWriter) WriteHeader(code int) {
	g.ResponseWriter.Header().Del("Content-Length")
	g.ResponseWriter.WriteHeader(code)
}

// GzipMiddleware compresses responses when the client advertises gzip support.
// All Go API responses are JSON/text, so we always compress when the header
// is present — no content-type gating needed.
func GzipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.Contains(c.Request.Header.Get("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		gz := gzipPool.Get().(*gzip.Writer)
		gz.Reset(c.Writer)

		c.Header("Content-Encoding", "gzip")
		c.Header("Vary", "Accept-Encoding")

		original := c.Writer
		c.Writer = &gzipWriter{gz: gz, ResponseWriter: original}

		c.Next()

		gz.Close()
		gz.Reset(io.Discard)
		gzipPool.Put(gz)
		c.Writer = original
	}
}
