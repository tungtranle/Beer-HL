// Authorization Matrix Tests — AQF G2
// Tests 9 roles × critical endpoints theo aqf/golden/permissions.matrix.yml
// INV-RBAC-01: Mọi role không được truy cập endpoint ngoài quyền
//
// Chạy: go test -v -run "AuthMatrix" ./internal/aqf/

package aqf

import (
	"os"
	"testing"

	"gopkg.in/yaml.v3"
)

// ─────────────────────────────────────────────────────────────
// PERMISSION MATRIX — load từ golden file
// ─────────────────────────────────────────────────────────────

type PermissionsMatrix struct {
	Version           string                       `yaml:"version"`
	Updated           string                       `yaml:"updated"`
	CriticalEndpoints map[string]map[string]string `yaml:"critical_endpoints"`
}

func loadPermissionsMatrix(t *testing.T) *PermissionsMatrix {
	t.Helper()
	path := goldenDir(t) + "/permissions.matrix.yml"
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("không đọc được permissions.matrix.yml: %v", err)
	}

	var matrix PermissionsMatrix
	if err := yaml.Unmarshal(data, &matrix); err != nil {
		t.Fatalf("parse YAML thất bại: %v", err)
	}
	return &matrix
}

// ─────────────────────────────────────────────────────────────
// Helper: permission decision
// ─────────────────────────────────────────────────────────────

// hasPermission mô phỏng middleware permission check
// ALLOW → true, DENY / ALLOW_OWN (khi acccess other's data) → false
func hasPermission(perm string) bool {
	return perm == "ALLOW" || perm == "ALLOW_OWN"
}

// ─────────────────────────────────────────────────────────────
// TEST: Authorization Matrix từ golden dataset
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_AllRoles_CriticalEndpoints(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	if len(matrix.CriticalEndpoints) == 0 {
		t.Fatal("permissions.matrix.yml rỗng hoặc không có critical_endpoints")
	}

	// Validate matrix completeness: mọi endpoint phải có entry cho tất cả 9 roles
	requiredRoles := []string{
		"admin", "dispatcher", "driver", "warehouse_handler",
		"accountant", "management", "dvkh", "security", "workshop",
	}

	for endpoint, roleMap := range matrix.CriticalEndpoints {
		for _, role := range requiredRoles {
			perm, exists := roleMap[role]
			if !exists {
				t.Errorf(
					"MATRIX INCOMPLETE: endpoint %q thiếu permission cho role %q",
					endpoint, role,
				)
				continue
			}

			// Validate permission value
			validPerms := map[string]bool{
				"ALLOW": true, "DENY": true, "ALLOW_OWN": true,
			}
			if !validPerms[perm] {
				t.Errorf(
					"INVALID PERMISSION VALUE: endpoint %q, role %q → %q (must be ALLOW/DENY/ALLOW_OWN)",
					endpoint, role, perm,
				)
			}
		}
	}

	t.Logf("AuthMatrix: validated %d endpoints × %d roles", len(matrix.CriticalEndpoints), len(requiredRoles))
}

// ─────────────────────────────────────────────────────────────
// TEST: Driver không được tạo orders
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_Driver_CannotCreateOrder(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	endpoint := "POST /v1/orders"
	roleMap, ok := matrix.CriticalEndpoints[endpoint]
	if !ok {
		t.Skipf("endpoint %q không có trong matrix (OK nếu API thay đổi)", endpoint)
	}

	driverPerm := roleMap["driver"]
	if driverPerm != "DENY" {
		t.Errorf(
			"INV-RBAC-01: Driver KHÔNG được tạo orders. Got permission=%q, want=DENY",
			driverPerm,
		)
	}
}

// ─────────────────────────────────────────────────────────────
// TEST: Chỉ admin được xóa user
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_OnlyAdmin_CanDeleteUser(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	endpoint := "DELETE /v1/admin/users/:id"
	roleMap, ok := matrix.CriticalEndpoints[endpoint]
	if !ok {
		t.Skipf("endpoint %q không có trong matrix", endpoint)
	}

	// Admin phải ALLOW
	if roleMap["admin"] != "ALLOW" {
		t.Errorf("Admin phải có quyền DELETE user, got %q", roleMap["admin"])
	}

	// Tất cả role khác phải DENY
	for _, role := range []string{"dispatcher", "driver", "warehouse_handler", "accountant", "dvkh", "security", "workshop"} {
		if roleMap[role] != "DENY" {
			t.Errorf(
				"INV-RBAC-01: role %q không được xóa user. Got %q, want DENY",
				role, roleMap[role],
			)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// TEST: Approve order chỉ admin và accountant
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_ApproveOrder_OnlyAdminAndAccountant(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	endpoint := "POST /v1/orders/:id/approve"
	roleMap, ok := matrix.CriticalEndpoints[endpoint]
	if !ok {
		t.Skipf("endpoint %q không có trong matrix", endpoint)
	}

	// Admin và accountant phải có quyền
	for _, role := range []string{"admin", "accountant"} {
		if roleMap[role] != "ALLOW" {
			t.Errorf(
				"Role %q phải có quyền approve order, got %q",
				role, roleMap[role],
			)
		}
	}

	// Các role khác phải DENY
	for _, role := range []string{"dispatcher", "driver", "warehouse_handler", "dvkh", "security", "workshop"} {
		if roleMap[role] != "DENY" {
			t.Errorf(
				"INV-RBAC-01: role %q không được approve order. Got %q, want DENY",
				role, roleMap[role],
			)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// TEST: VRP planning chỉ dispatcher/admin/management
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_VRP_OnlyAuthorizedRoles(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	endpoint := "POST /v1/planning/vrp"
	roleMap, ok := matrix.CriticalEndpoints[endpoint]
	if !ok {
		t.Skipf("endpoint %q không có trong matrix", endpoint)
	}

	// Authorized roles
	for _, role := range []string{"admin", "dispatcher", "management"} {
		if roleMap[role] != "ALLOW" {
			t.Errorf(
				"Role %q phải được dùng VRP, got %q",
				role, roleMap[role],
			)
		}
	}

	// Driver không được chạy VRP planning
	if roleMap["driver"] != "DENY" {
		t.Errorf(
			"Driver không được chạy VRP planning, got %q",
			roleMap["driver"],
		)
	}
}

// ─────────────────────────────────────────────────────────────
// TEST: Không có endpoint nào có permission rỗng
// ─────────────────────────────────────────────────────────────

func TestAuthMatrix_NoEmptyPermissions(t *testing.T) {
	matrix := loadPermissionsMatrix(t)

	for endpoint, roleMap := range matrix.CriticalEndpoints {
		for role, perm := range roleMap {
			if perm == "" {
				t.Errorf(
					"MATRIX ERROR: endpoint %q, role %q có permission rỗng",
					endpoint, role,
				)
			}
		}
	}
}
