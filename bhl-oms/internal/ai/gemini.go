package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ─── Gemini Provider ─────────────────────────────────────────────────────────
// Uses Google Gemini 2.0 Flash free tier: 1,500 req/day, 1M token/month.
// BHL usage: ~50–70 req/day → well within quota.
// API key via env: GEMINI_API_KEY (get free at https://aistudio.google.com)

const (
	geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
	geminiTimeout  = 15 * time.Second
)

// GeminiProvider calls Google Gemini 2.0 Flash.
type GeminiProvider struct {
	apiKey string
	client *http.Client
}

// NewGeminiProvider returns a Gemini provider using GEMINI_API_KEY env var.
// If key is empty, returns a MockProvider that returns template-based responses.
func NewGeminiProvider() Provider {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		return &MockProvider{}
	}
	return &GeminiProvider{
		apiKey: key,
		client: &http.Client{Timeout: geminiTimeout},
	}
}

func (g *GeminiProvider) Name() string { return "gemini-2.0-flash" }

func (g *GeminiProvider) Generate(ctx context.Context, prompt string) (string, error) {
	body := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature":     0.7,
			"maxOutputTokens": 512,
		},
	}

	bs, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("gemini marshal: %w", err)
	}

	url := geminiEndpoint + "?key=" + g.apiKey
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bs))
	if err != nil {
		return "", fmt.Errorf("gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini call: %w", err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("gemini read: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(rawBody))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(rawBody, &result); err != nil {
		return "", fmt.Errorf("gemini parse: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini: empty response")
	}

	return strings.TrimSpace(result.Candidates[0].Content.Parts[0].Text), nil
}

// ─── Groq Fallback Provider ──────────────────────────────────────────────────
// Groq free tier: 14,400 req/day with Llama 3.1 / Qwen models.
// Activated when GROQ_API_KEY is set and Gemini fails.

const (
	groqEndpoint = "https://api.groq.com/openai/v1/chat/completions"
	groqModel    = "llama-3.1-8b-instant" // fast, good Vietnamese support
	groqTimeout  = 12 * time.Second
)

// GroqProvider calls Groq cloud (OpenAI-compatible API).
type GroqProvider struct {
	apiKey string
	client *http.Client
}

func NewGroqProvider() Provider {
	key := os.Getenv("GROQ_API_KEY")
	if key == "" {
		return &MockProvider{}
	}
	return &GroqProvider{
		apiKey: key,
		client: &http.Client{Timeout: groqTimeout},
	}
}

func (g *GroqProvider) Name() string { return "groq-llama-3.1" }

func (g *GroqProvider) Generate(ctx context.Context, prompt string) (string, error) {
	body := map[string]any{
		"model": groqModel,
		"messages": []map[string]any{
			{"role": "user", "content": prompt},
		},
		"max_tokens":  512,
		"temperature": 0.7,
	}

	bs, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqEndpoint, bytes.NewReader(bs))
	if err != nil {
		return "", fmt.Errorf("groq request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.apiKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq call: %w", err)
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq status %d: %s", resp.StatusCode, string(rawBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(rawBody, &result); err != nil {
		return "", fmt.Errorf("groq parse: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("groq: empty response")
	}
	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

// ─── Mock Provider ───────────────────────────────────────────────────────────
// Used when no API key is configured.
// Returns deterministic template-based responses — still useful without key.

type MockProvider struct{}

func (m *MockProvider) Name() string { return "mock-rules" }

func (m *MockProvider) Generate(_ context.Context, prompt string) (string, error) {
	// Return a useful template response based on prompt keywords
	lower := strings.ToLower(prompt)
	switch {
	case strings.Contains(lower, "dispatch") || strings.Contains(lower, "điều phối"):
		return "Hệ thống đang hoạt động bình thường. Vui lòng cấu hình GROQ_API_KEY hoặc GEMINI_API_KEY để kích hoạt tóm tắt AI đầy đủ.", nil
	case strings.Contains(lower, "anomaly") || strings.Contains(lower, "bất thường"):
		return "Phát hiện hoạt động bất thường. Khuyến nghị: liên hệ tài xế xác nhận tình trạng.", nil
	case strings.Contains(lower, "npp") || strings.Contains(lower, "khách hàng"):
		return "NPP có dấu hiệu giảm hoạt động. Đề xuất DVKH chủ động liên hệ chăm sóc.", nil
	default:
		return "AI đang ở chế độ ngoại tuyến. Cấu hình GROQ_API_KEY hoặc GEMINI_API_KEY để bật đầy đủ tính năng.", nil
	}
}

// ─── Chained Provider (Gemini → Groq → Mock) ─────────────────────────────────

// ChainedProvider tries providers in order, falling back on error.
type ChainedProvider struct {
	providers []Provider
	mu        sync.RWMutex
	lastUsed  string
}

// NewDefaultProvider returns Gemini→Groq→Mock chain.
// Whichever keys are configured will be used; unset keys fall through to mock.
func NewDefaultProvider() Provider {
	primary := NewGeminiProvider()
	fallback := NewGroqProvider()
	return &ChainedProvider{providers: []Provider{primary, fallback}}
}

func (c *ChainedProvider) Name() string {
	c.mu.RLock()
	lastUsed := c.lastUsed
	c.mu.RUnlock()
	if lastUsed != "" {
		return lastUsed
	}
	names := make([]string, 0, len(c.providers))
	for _, p := range c.providers {
		if _, isMock := p.(*MockProvider); isMock {
			continue
		}
		names = append(names, p.Name())
	}
	if len(names) == 0 {
		return (&MockProvider{}).Name()
	}
	return strings.Join(names, "→")
}

func (c *ChainedProvider) setLastUsed(name string) {
	c.mu.Lock()
	c.lastUsed = name
	c.mu.Unlock()
}

func (c *ChainedProvider) Generate(ctx context.Context, prompt string) (string, error) {
	var lastErr error
	for _, p := range c.providers {
		// Skip mock in chain — only use as final fallback
		if _, isMock := p.(*MockProvider); isMock {
			continue
		}
		for attempt := 0; attempt < 2; attempt++ {
			text, err := p.Generate(ctx, prompt)
			if err == nil && text != "" {
				c.setLastUsed(p.Name())
				return text, nil
			}
			lastErr = err
			// 429 rate-limit: no point retrying immediately — skip to next provider
			if err != nil && strings.Contains(err.Error(), "429") {
				break
			}
		}
	}
	// All real providers failed — use mock
	_ = lastErr
	c.setLastUsed((&MockProvider{}).Name())
	return (&MockProvider{}).Generate(ctx, prompt)
}
