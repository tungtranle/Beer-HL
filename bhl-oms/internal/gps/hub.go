package gps

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"bhl-oms/internal/auth"
	"bhl-oms/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

const (
	// Redis channel for GPS updates
	GPSChannel = "gps:updates"

	// WebSocket config
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = 50 * time.Second
)

// GPSPoint represents a single GPS data point from a driver.
type GPSPoint struct {
	VehicleID  uuid.UUID `json:"vehicle_id"`
	DriverID   uuid.UUID `json:"driver_id,omitempty"`
	Lat        float64   `json:"lat"`
	Lng        float64   `json:"lng"`
	Speed      float64   `json:"speed"`
	Heading    float64   `json:"heading"`
	AccuracyM  float64   `json:"accuracy_m,omitempty"`
	RecordedAt string    `json:"recorded_at,omitempty"`
	Timestamp  time.Time `json:"ts"`
}

// GPSUpdate is broadcast to dispatcher WebSocket clients.
type GPSUpdate struct {
	Type      string    `json:"type"`
	VehicleID uuid.UUID `json:"vehicle_id"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Speed     float64   `json:"speed"`
	Heading   float64   `json:"heading"`
	Timestamp time.Time `json:"ts"`
}

// Hub manages WebSocket connections and Redis pub/sub for GPS.
type Hub struct {
	rdb     *redis.Client
	authSvc *auth.Service
	log     logger.Logger

	// Connected dispatcher WebSocket clients
	mu      sync.RWMutex
	clients map[*wsClient]bool
}

type wsClient struct {
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	role   string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS handled at Nginx level in production
	},
}

// NewHub creates a GPS hub with Redis pub/sub.
func NewHub(rdb *redis.Client, authSvc *auth.Service, log logger.Logger) *Hub {
	return &Hub{
		rdb:     rdb,
		authSvc: authSvc,
		log:     log,
		clients: make(map[*wsClient]bool),
	}
}

// Run starts the Redis subscriber goroutine. Call in a separate goroutine.
func (h *Hub) Run(ctx context.Context) {
	sub := h.rdb.Subscribe(ctx, GPSChannel)
	defer sub.Close()

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			h.broadcast([]byte(msg.Payload))
		}
	}
}

// PublishGPS publishes a GPS update to Redis for all subscribers.
func (h *Hub) PublishGPS(ctx context.Context, point GPSPoint) error {
	update := GPSUpdate{
		Type:      "gps_update",
		VehicleID: point.VehicleID,
		Lat:       point.Lat,
		Lng:       point.Lng,
		Speed:     point.Speed,
		Heading:   point.Heading,
		Timestamp: point.Timestamp,
	}

	data, err := json.Marshal(update)
	if err != nil {
		return err
	}

	// Store latest position in Redis hash for fast lookup
	locJSON, _ := json.Marshal(map[string]interface{}{
		"lat":     point.Lat,
		"lng":     point.Lng,
		"speed":   point.Speed,
		"heading": point.Heading,
		"ts":      point.Timestamp.Format(time.RFC3339),
	})
	h.rdb.HSet(ctx, "gps:latest", point.VehicleID.String(), string(locJSON))
	h.rdb.Expire(ctx, "gps:latest", 24*time.Hour)

	return h.rdb.Publish(ctx, GPSChannel, string(data)).Err()
}

// PublishBatch publishes multiple GPS points (for batch endpoint).
func (h *Hub) PublishBatch(ctx context.Context, driverID uuid.UUID, points []GPSPoint) error {
	for i := range points {
		points[i].DriverID = driverID
		if points[i].Timestamp.IsZero() {
			points[i].Timestamp = time.Now()
		}
		if err := h.PublishGPS(ctx, points[i]); err != nil {
			return err
		}
	}
	return nil
}

// GetLatestPositions returns all latest vehicle positions from Redis.
func (h *Hub) GetLatestPositions(ctx context.Context) (map[string]json.RawMessage, error) {
	result, err := h.rdb.HGetAll(ctx, "gps:latest").Result()
	if err != nil {
		return nil, err
	}

	positions := make(map[string]json.RawMessage, len(result))
	for vehicleID, data := range result {
		positions[vehicleID] = json.RawMessage(data)
	}
	return positions, nil
}

// HandleWebSocket is the Gin handler for the /ws/gps endpoint.
func (h *Hub) HandleWebSocket(c *gin.Context) {
	// Auth via query param token
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
		return
	}

	claims, err := h.authSvc.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.log.Error(c.Request.Context(), "websocket_upgrade_failed", err)
		return
	}

	client := &wsClient{
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: claims.UserID,
		role:   claims.Role,
	}

	h.addClient(client)

	go h.writePump(client)
	go h.readPump(client)
}

func (h *Hub) addClient(c *wsClient) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
	h.log.Info(context.Background(), "websocket_client_connected", logger.F("user_id", c.userID.String()), logger.F("role", c.role), logger.F("total_clients", len(h.clients)))
}

func (h *Hub) removeClient(c *wsClient) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
	h.mu.Unlock()
}

func (h *Hub) broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		select {
		case client.send <- msg:
		default:
			// Client too slow, drop
			go h.removeClient(client)
		}
	}
}

// writePump sends messages from the send channel to the WebSocket.
func (h *Hub) writePump(c *wsClient) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
		h.removeClient(c)
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from the WebSocket (handles driver GPS ingest).
func (h *Hub) readPump(c *wsClient) {
	defer func() {
		c.conn.Close()
		h.removeClient(c)
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		// If driver sends GPS via WebSocket (alternative to batch REST)
		if c.role == "driver" {
			var point GPSPoint
			if err := json.Unmarshal(msg, &point); err == nil {
				point.DriverID = c.userID
				if point.Timestamp.IsZero() {
					point.Timestamp = time.Now()
				}
				h.PublishGPS(context.Background(), point)
			}
		}
	}
}
