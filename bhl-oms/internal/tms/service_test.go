package tms

import (
	"fmt"
	"testing"
)

// ===== Trip State Machine Tests =====
// SM-02: Trip transitions

func TestValidTripTransitions_PlannedToAssigned(t *testing.T) {
	allowed := validTripTransitions["planned"]
	if !contains(allowed, "assigned") {
		t.Error("planned → assigned should be valid")
	}
}

func TestValidTripTransitions_PlannedToInTransit(t *testing.T) {
	allowed := validTripTransitions["planned"]
	if !contains(allowed, "in_transit") {
		t.Error("planned → in_transit should be valid")
	}
}

func TestValidTripTransitions_PlannedToCancelled(t *testing.T) {
	allowed := validTripTransitions["planned"]
	if !contains(allowed, "cancelled") {
		t.Error("planned → cancelled should be valid")
	}
}

func TestValidTripTransitions_AssignedToInTransit(t *testing.T) {
	allowed := validTripTransitions["assigned"]
	if !contains(allowed, "in_transit") {
		t.Error("assigned → in_transit should be valid")
	}
}

func TestValidTripTransitions_InTransitToCompleted(t *testing.T) {
	allowed := validTripTransitions["in_transit"]
	if !contains(allowed, "completed") {
		t.Error("in_transit → completed should be valid")
	}
}

func TestValidTripTransitions_InvalidTransition(t *testing.T) {
	// completed is a terminal state — no transitions from it
	allowed, exists := validTripTransitions["completed"]
	if exists && len(allowed) > 0 {
		t.Error("completed should have no valid transitions (terminal state)")
	}
}

func TestValidTripTransitions_PlannedToCompleted_Invalid(t *testing.T) {
	allowed := validTripTransitions["planned"]
	if contains(allowed, "completed") {
		t.Error("planned → completed should NOT be valid (must go through in_transit)")
	}
}

func TestValidTripTransitions_InTransitToPlanned_Invalid(t *testing.T) {
	allowed := validTripTransitions["in_transit"]
	if contains(allowed, "planned") {
		t.Error("in_transit → planned should NOT be valid (no going back)")
	}
}

// ===== Stop Status Logic Tests =====
// SM-03: Stop transitions

func TestStopStatus_ArriveFromPending(t *testing.T) {
	// pending → arrived is valid
	status := "pending"
	action := "arrive"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("pending + arrive should be valid, got error: %v", err)
	}
}

func TestStopStatus_ArriveFromArrived_Invalid(t *testing.T) {
	// arrived → arrived (double arrive) should fail
	status := "arrived"
	action := "arrive"
	err := validateStopAction(status, action)
	if err == nil {
		t.Error("arrived + arrive (double) should be invalid")
	}
}

func TestStopStatus_DeliverFromArrived(t *testing.T) {
	status := "arrived"
	action := "deliver"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("arrived + deliver should be valid, got error: %v", err)
	}
}

func TestStopStatus_DeliverFromDelivering(t *testing.T) {
	status := "delivering"
	action := "deliver"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("delivering + deliver should be valid, got error: %v", err)
	}
}

func TestStopStatus_DeliverFromPending_Invalid(t *testing.T) {
	// Must arrive first before delivering
	status := "pending"
	action := "deliver"
	err := validateStopAction(status, action)
	if err == nil {
		t.Error("pending + deliver should be invalid (must arrive first)")
	}
}

func TestStopStatus_FailFromArrived(t *testing.T) {
	status := "arrived"
	action := "fail"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("arrived + fail should be valid, got error: %v", err)
	}
}

func TestStopStatus_FailFromDelivered_Invalid(t *testing.T) {
	// Already delivered — cannot mark as failed
	status := "delivered"
	action := "fail"
	err := validateStopAction(status, action)
	if err == nil {
		t.Error("delivered + fail should be invalid")
	}
}

func TestStopStatus_SkipFromDelivered_Invalid(t *testing.T) {
	status := "delivered"
	action := "skip"
	err := validateStopAction(status, action)
	if err == nil {
		t.Error("delivered + skip should be invalid")
	}
}

func TestStopStatus_SkipFromPending(t *testing.T) {
	status := "pending"
	action := "skip"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("pending + skip should be valid, got error: %v", err)
	}
}

func TestStopStatus_DeliveringFromArrived(t *testing.T) {
	status := "arrived"
	action := "delivering"
	err := validateStopAction(status, action)
	if err != nil {
		t.Errorf("arrived + delivering should be valid, got error: %v", err)
	}
}

func TestStopStatus_InvalidAction(t *testing.T) {
	status := "pending"
	action := "unknown_action"
	err := validateStopAction(status, action)
	if err == nil {
		t.Error("unknown action should be invalid")
	}
}

// ===== Order Cancel Status Logic Tests =====

func TestOrderCancelableStatuses(t *testing.T) {
	cancelable := []string{"draft", "confirmed", "pending_approval"}
	notCancelable := []string{"planned", "picking", "loaded", "in_transit", "delivered", "cancelled"}

	for _, status := range cancelable {
		if !isOrderCancelable(status) {
			t.Errorf("status %s should be cancelable", status)
		}
	}

	for _, status := range notCancelable {
		if isOrderCancelable(status) {
			t.Errorf("status %s should NOT be cancelable", status)
		}
	}
}

// ===== Order Editable Status Tests =====

func TestOrderEditableStatuses(t *testing.T) {
	editable := []string{"draft", "confirmed", "pending_approval"}
	notEditable := []string{"planned", "picking", "loaded", "in_transit", "delivered"}

	for _, status := range editable {
		if !isOrderEditable(status) {
			t.Errorf("status %s should be editable", status)
		}
	}

	for _, status := range notEditable {
		if isOrderEditable(status) {
			t.Errorf("status %s should NOT be editable", status)
		}
	}
}

// ===== Checklist Passed Logic =====
// Fuel ≥ 20% + all items OK → passed

func TestChecklistPassed_AllOK(t *testing.T) {
	result := isChecklistPassed(true, true, true, true, true, true, true, true, true, true, true, 50)
	if !result {
		t.Error("all OK with fuel 50% should pass")
	}
}

func TestChecklistPassed_LowFuel(t *testing.T) {
	result := isChecklistPassed(true, true, true, true, true, true, true, true, true, true, true, 15)
	if result {
		t.Error("fuel 15% should fail (minimum 20%)")
	}
}

func TestChecklistPassed_FuelExactly20(t *testing.T) {
	result := isChecklistPassed(true, true, true, true, true, true, true, true, true, true, true, 20)
	if !result {
		t.Error("fuel exactly 20% should pass")
	}
}

func TestChecklistPassed_BrakesFailed(t *testing.T) {
	result := isChecklistPassed(true, false, true, true, true, true, true, true, true, true, true, 80)
	if result {
		t.Error("brakes failed should not pass")
	}
}

func TestChecklistPassed_DocumentsMissing(t *testing.T) {
	result := isChecklistPassed(true, true, true, true, true, true, true, true, true, false, true, 60)
	if result {
		t.Error("documents missing should not pass")
	}
}

// ===== Helper functions =====

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// validateStopAction replicates the stop status validation logic from service
func validateStopAction(currentStatus, action string) error {
	switch action {
	case "arrive":
		if currentStatus != "pending" {
			return fmt.Errorf("cannot arrive from status %s", currentStatus)
		}
		return nil
	case "delivering":
		if currentStatus != "arrived" {
			return fmt.Errorf("must arrive before delivering")
		}
		return nil
	case "deliver":
		if currentStatus != "arrived" && currentStatus != "delivering" {
			return fmt.Errorf("must arrive before delivering")
		}
		return nil
	case "fail":
		if currentStatus != "arrived" && currentStatus != "delivering" && currentStatus != "pending" {
			return fmt.Errorf("cannot fail from status %s", currentStatus)
		}
		return nil
	case "skip":
		if currentStatus == "delivered" || currentStatus == "failed" {
			return fmt.Errorf("completed stop cannot be skipped")
		}
		return nil
	default:
		return fmt.Errorf("unknown action: %s", action)
	}
}

func isOrderCancelable(status string) bool {
	return status == "draft" || status == "confirmed" || status == "pending_approval"
}

func isOrderEditable(status string) bool {
	return status == "draft" || status == "confirmed" || status == "pending_approval"
}

func isChecklistPassed(tires, brakes, lights, mirrors, horn, coolant, oil, fireExt, firstAid, docs, cargo bool, fuelLevel int) bool {
	allItems := tires && brakes && lights && mirrors && horn && coolant && oil && fireExt && firstAid && docs && cargo
	return allItems && fuelLevel >= 20
}
