package gps

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"bhl-oms/internal/auth"
	"bhl-oms/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
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
	VehicleID    uuid.UUID `json:"vehicle_id"`
	DriverID     uuid.UUID `json:"driver_id,omitempty"`
	VehiclePlate string    `json:"vehicle_plate,omitempty"`
	DriverName   string    `json:"driver_name,omitempty"`
	TripStatus   string    `json:"trip_status,omitempty"`
	Lat          float64   `json:"lat"`
	Lng          float64   `json:"lng"`
	Speed        float64   `json:"speed"`
	Heading      float64   `json:"heading"`
	AccuracyM    float64   `json:"accuracy_m,omitempty"`
	RecordedAt   string    `json:"recorded_at,omitempty"`
	Timestamp    time.Time `json:"ts"`
}

// GPSUpdate is broadcast to dispatcher WebSocket clients.
type GPSUpdate struct {
	Type         string    `json:"type"`
	VehicleID    uuid.UUID `json:"vehicle_id"`
	VehiclePlate string    `json:"vehicle_plate,omitempty"`
	DriverName   string    `json:"driver_name,omitempty"`
	TripStatus   string    `json:"trip_status,omitempty"`
	Lat          float64   `json:"lat"`
	Lng          float64   `json:"lng"`
	Speed        float64   `json:"speed"`
	Heading      float64   `json:"heading"`
	Timestamp    time.Time `json:"ts"`
}

// Hub manages WebSocket connections and Redis pub/sub for GPS.
type Hub struct {
	rdb     *redis.Client
	db      *pgxpool.Pool
	authSvc *auth.Service
	log     logger.Logger

	// Connected dispatcher WebSocket clients
	mu      sync.RWMutex
	clients map[*wsClient]bool

	// HIGH-007: allowed WebSocket origins
	allowedOrigins []string

	// F7 anomaly detection hook (optional, async per-point).
	detector PointDetector
}

// PointDetector is invoked for every received GPS point (best-effort, async).
// Implemented by internal/anomaly.Service to avoid import cycles.
type PointDetector interface {
	DetectPoint(ctx context.Context, vehicleID uuid.UUID, driverID *uuid.UUID, lat, lng, speedKmh float64, at time.Time)
}

type wsClient struct {
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	role   string
}

// upgrader is created per-Hub via newUpgrader() to support per-config origin check.
func (h *Hub) newUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		// HIGH-007: whitelist origins; fall back to allow-all in dev/empty config
		CheckOrigin: func(r *http.Request) bool {
			if len(h.allowedOrigins) == 0 {
				return true // dev mode — no restriction
			}
			origin := r.Header.Get("Origin")
			for _, allowed := range h.allowedOrigins {
				if strings.EqualFold(origin, allowed) {
					return true
				}
			}
			return false
		},
	}
}

// NewHub creates a GPS hub with Redis pub/sub.
func NewHub(rdb *redis.Client, authSvc *auth.Service, log logger.Logger, db *pgxpool.Pool, allowedOrigins []string) *Hub {
	return &Hub{
		rdb:            rdb,
		db:             db,
		authSvc:        authSvc,
		log:            log,
		clients:        make(map[*wsClient]bool),
		allowedOrigins: allowedOrigins,
	}
}

// lookupDriverVehicle returns the vehicle_id of the trip currently in_transit for a driver.
// CRIT-007: used to override client-supplied vehicle_id to prevent GPS spoofing.
func (h *Hub) lookupDriverVehicle(ctx context.Context, driverID uuid.UUID) (uuid.UUID, error) {
	var vehicleID uuid.UUID
	err := h.db.QueryRow(ctx,
		`SELECT t.vehicle_id FROM trips t
		 JOIN drivers d ON d.id = t.driver_id
		 WHERE d.user_id = $1
		   AND t.status::text IN ('in_transit', 'started')
		 ORDER BY t.started_at DESC NULLS LAST
		 LIMIT 1`,
		driverID,
	).Scan(&vehicleID)
	if err != nil {
		return uuid.Nil, err
	}
	return vehicleID, nil
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
		Type:         "position",
		VehicleID:    point.VehicleID,
		VehiclePlate: point.VehiclePlate,
		DriverName:   point.DriverName,
		TripStatus:   point.TripStatus,
		Lat:          point.Lat,
		Lng:          point.Lng,
		Speed:        point.Speed,
		Heading:      point.Heading,
		Timestamp:    point.Timestamp,
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
		// F7: feed point to anomaly detector (async, non-blocking).
		if h.detector != nil {
			p := points[i]
			driverPtr := &driverID
			go h.detector.DetectPoint(context.Background(), p.VehicleID, driverPtr, p.Lat, p.Lng, p.Speed, p.Timestamp)
		}
	}
	return nil
}

// SetDetector wires the anomaly detector. Call once at startup.
func (h *Hub) SetDetector(d PointDetector) {
	h.detector = d
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

	upg := h.newUpgrader()
	conn, err := upg.Upgrade(c.Writer, c.Request, nil)
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

// broadcast sends msg to all connected clients.
// LOW-001: collect slow clients while holding read lock, then remove them after
// releasing the lock — avoids sending on a closed channel and prevents race.
func (h *Hub) broadcast(msg []byte) {
	var toRemove []*wsClient

	h.mu.RLock()
	for client := range h.clients {
		select {
		case client.send <- msg:
		default:
			toRemove = append(toRemove, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range toRemove {
		h.removeClient(client)
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
				// CRIT-007: override vehicle_id from driver's active trip — prevent GPS spoofing
				if h.db != nil {
					if vid, err := h.lookupDriverVehicle(context.Background(), c.userID); err == nil {
						point.VehicleID = vid
					} else {
						h.log.Warn(context.Background(), "gps_ws_no_active_trip", logger.F("driver_id", c.userID.String()))
						continue // drop point — driver has no active trip
					}
				}
				h.PublishGPS(context.Background(), point)
			}
		}
	}
}
