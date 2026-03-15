package notification

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
	hub  *Hub
}

func NewService(repo *Repository, hub *Hub) *Service {
	return &Service{repo: repo, hub: hub}
}

// Send creates a notification and pushes it via WebSocket to the user.
func (s *Service) Send(ctx context.Context, userID uuid.UUID, title, body, category string, link *string) error {
	n := &domain.Notification{
		UserID:   userID,
		Title:    title,
		Body:     body,
		Category: category,
		Link:     link,
	}

	if err := s.repo.Create(ctx, n); err != nil {
		return err
	}

	// Push via WebSocket
	s.hub.SendToUser(userID, n)
	return nil
}

// SendToRole sends a notification to all users with the given role.
func (s *Service) SendToRole(ctx context.Context, role, title, body, category string, link *string) error {
	ids, err := s.repo.GetUserIDsByRole(ctx, role)
	if err != nil {
		log.Printf("notification: failed to get users by role %s: %v", role, err)
		return err
	}
	for _, uid := range ids {
		_ = s.Send(ctx, uid, title, body, category, link)
	}
	return nil
}

func (s *Service) GetNotifications(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]domain.Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.GetByUser(ctx, userID, unreadOnly, limit)
}

func (s *Service) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.MarkRead(ctx, id, userID)
}

func (s *Service) MarkAllRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.MarkAllRead(ctx, userID)
}

func (s *Service) UnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.UnreadCount(ctx, userID)
}

// ── WebSocket Hub for Notifications ─────────────────

type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID][]chan []byte
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[uuid.UUID][]chan []byte),
	}
}

// Register adds a client channel for the given user.
func (h *Hub) Register(userID uuid.UUID, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[userID] = append(h.clients[userID], ch)
}

// Unregister removes a client channel.
func (h *Hub) Unregister(userID uuid.UUID, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	channels := h.clients[userID]
	for i, c := range channels {
		if c == ch {
			h.clients[userID] = append(channels[:i], channels[i+1:]...)
			break
		}
	}
	if len(h.clients[userID]) == 0 {
		delete(h.clients, userID)
	}
}

// SendToUser pushes a notification to all WebSocket connections for that user.
func (h *Hub) SendToUser(userID uuid.UUID, n *domain.Notification) {
	data, err := json.Marshal(map[string]interface{}{
		"type": "notification",
		"data": n,
	})
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, ch := range h.clients[userID] {
		select {
		case ch <- data:
		default:
			// channel full, skip
		}
	}
}
