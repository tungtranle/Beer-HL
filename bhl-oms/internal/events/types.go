package events

import (
	"fmt"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

// Event type constants
const (
	// Order lifecycle
	OrderCreated             = "order.created"
	OrderConfirmedByCustomer = "order.confirmed_by_customer"
	OrderRejectedByCustomer  = "order.rejected_by_customer"
	OrderAutoConfirmed       = "order.auto_confirmed"
	OrderApproved            = "order.approved"
	OrderCancelled           = "order.cancelled"
	OrderUpdated             = "order.updated"
	OrderPlanned             = "order.planned"
	OrderPicking             = "order.picking"
	OrderLoaded              = "order.loaded"
	OrderInTransit           = "order.in_transit"
	OrderDelivered           = "order.delivered"
	OrderPartialDelivered    = "order.partial_delivered"
	OrderDeliveryRejected    = "order.delivery_rejected"
	OrderDeliveryConfirmed   = "order.delivery_confirmed"
	OrderDeliveryDisputed    = "order.delivery_disputed"
	OrderNoteAdded           = "order.note_added"
	OrderZaloSent            = "order.zalo_sent"
	OrderConfirmationExpired = "order.confirmation_expired"
	OrderRedeliveryCreated   = "order.redelivery_created"

	// Trip lifecycle
	TripCreated   = "trip.created"
	TripStarted   = "trip.started"
	TripCompleted = "trip.completed"
)

// Builder helpers — create domain.EntityEvent with proper fields

func OrderCreatedEvent(orderID uuid.UUID, userID *uuid.UUID, userName, orderNumber, customerName string, totalAmount float64) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderCreated,
		ActorType:  "user",
		ActorID:    userID,
		ActorName:  userName,
		Title:      fmt.Sprintf("Tạo đơn hàng %s cho %s", orderNumber, customerName),
		Detail:     Detail("order_number", orderNumber, "customer_name", customerName, "total_amount", totalAmount),
	}
}

func OrderConfirmedByCustomerEvent(orderID uuid.UUID, orderNumber, customerName string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderConfirmedByCustomer,
		ActorType:  "customer",
		ActorName:  customerName,
		Title:      fmt.Sprintf("Khách hàng %s xác nhận đơn %s", customerName, orderNumber),
		Detail:     Detail("order_number", orderNumber),
	}
}

func OrderRejectedByCustomerEvent(orderID uuid.UUID, orderNumber, customerName, reason string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderRejectedByCustomer,
		ActorType:  "customer",
		ActorName:  customerName,
		Title:      fmt.Sprintf("Khách hàng %s từ chối đơn %s", customerName, orderNumber),
		Detail:     Detail("order_number", orderNumber, "reason", reason),
	}
}

func OrderAutoConfirmedEvent(orderID uuid.UUID, orderNumber string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderAutoConfirmed,
		ActorType:  "cron",
		ActorName:  "Hệ thống (tự động 2h)",
		Title:      fmt.Sprintf("Đơn hàng %s tự động xác nhận sau 2 giờ", orderNumber),
		Detail:     Detail("order_number", orderNumber),
	}
}

func OrderApprovedEvent(orderID uuid.UUID, approverID *uuid.UUID, approverName, orderNumber string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderApproved,
		ActorType:  "user",
		ActorID:    approverID,
		ActorName:  approverName,
		Title:      fmt.Sprintf("%s duyệt công nợ đơn %s", approverName, orderNumber),
		Detail:     Detail("order_number", orderNumber),
	}
}

func OrderCancelledEvent(orderID uuid.UUID, userID *uuid.UUID, userName, orderNumber, reason string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderCancelled,
		ActorType:  actorType(userID),
		ActorID:    userID,
		ActorName:  userName,
		Title:      fmt.Sprintf("%s hủy đơn hàng %s", userName, orderNumber),
		Detail:     Detail("order_number", orderNumber, "reason", reason),
	}
}

func OrderStatusChangedEvent(orderID uuid.UUID, userID *uuid.UUID, userName, orderNumber, oldStatus, newStatus string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  "order.status_changed",
		ActorType:  actorType(userID),
		ActorID:    userID,
		ActorName:  userName,
		Title:      fmt.Sprintf("Đơn %s chuyển trạng thái: %s → %s", orderNumber, viStatus(oldStatus), viStatus(newStatus)),
		Detail:     Detail("order_number", orderNumber, "old_status", oldStatus, "new_status", newStatus),
	}
}

func OrderDeliveryConfirmedEvent(orderID uuid.UUID, customerName, orderNumber string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderDeliveryConfirmed,
		ActorType:  "customer",
		ActorName:  customerName,
		Title:      fmt.Sprintf("Khách hàng %s xác nhận giao hàng đơn %s", customerName, orderNumber),
		Detail:     Detail("order_number", orderNumber),
	}
}

func OrderDeliveryDisputedEvent(orderID uuid.UUID, customerName, orderNumber, reason string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderDeliveryDisputed,
		ActorType:  "customer",
		ActorName:  customerName,
		Title:      fmt.Sprintf("Khách hàng %s khiếu nại đơn %s: %s", customerName, orderNumber, reason),
		Detail:     Detail("order_number", orderNumber, "reason", reason),
	}
}

func OrderNoteEvent(orderID uuid.UUID, userID *uuid.UUID, userName, content, noteType string) domain.EntityEvent {
	if noteType == "" {
		noteType = "internal"
	}
	labelMap := map[string]string{
		"internal":     "ghi chú nội bộ",
		"npp_feedback": "phản hồi NPP",
		"driver_note":  "ghi chú tài xế",
		"system":       "ghi chú hệ thống",
	}
	label := labelMap[noteType]
	if label == "" {
		label = "ghi chú"
	}
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderNoteAdded,
		ActorType:  "user",
		ActorID:    userID,
		ActorName:  userName,
		Title:      fmt.Sprintf("%s thêm %s", userName, label),
		Detail:     Detail("content", content, "note_type", noteType),
	}
}

func OrderZaloSentEvent(orderID uuid.UUID, orderNumber, customerName string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderZaloSent,
		ActorType:  "system",
		ActorName:  "Hệ thống",
		Title:      fmt.Sprintf("Gửi xác nhận Zalo đơn %s cho %s", orderNumber, customerName),
		Detail:     Detail("order_number", orderNumber, "customer_name", customerName),
	}
}

func OrderRedeliveryCreatedEvent(orderID uuid.UUID, userID *uuid.UUID, userName, orderNumber string, attemptNumber int, reason string) domain.EntityEvent {
	return domain.EntityEvent{
		EntityType: "order",
		EntityID:   orderID,
		EventType:  OrderRedeliveryCreated,
		ActorType:  actorType(userID),
		ActorID:    userID,
		ActorName:  userName,
		Title:      fmt.Sprintf("Tạo giao lại lần %d cho đơn %s", attemptNumber, orderNumber),
		Detail:     Detail("attempt_number", attemptNumber, "reason", reason, "order_number", orderNumber),
	}
}

// helper
func actorType(userID *uuid.UUID) string {
	if userID == nil {
		return "system"
	}
	return "user"
}

func viStatus(s string) string {
	labels := map[string]string{
		"draft": "Nháp", "pending_customer_confirm": "Chờ KH xác nhận", "pending_approval": "Chờ duyệt",
		"confirmed": "Đã xác nhận", "planned": "Đã lên KH", "picking": "Đang soạn hàng",
		"loaded": "Đã xếp xe", "in_transit": "Đang giao", "delivered": "Đã giao",
		"partial_delivered": "Giao một phần", "rejected": "Từ chối", "re_delivery": "Giao lại",
		"on_credit": "Ghi nợ", "cancelled": "Đã hủy",
	}
	if v, ok := labels[s]; ok {
		return v
	}
	return s
}
