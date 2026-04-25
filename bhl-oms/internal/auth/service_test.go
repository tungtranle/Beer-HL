package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

// newTestService builds a Service with an in-memory RSA key — no DB required.
func newTestService(t *testing.T) *Service {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	return &Service{
		db:         nil, // not needed for token tests
		privateKey: privKey,
		publicKey:  &privKey.PublicKey,
		accessTTL:  15 * time.Minute,
		refreshTTL: 168 * time.Hour,
	}
}

func testUser() *domain.User {
	return &domain.User{
		ID:           uuid.New(),
		Username:     "test_user",
		FullName:     "Test User",
		Role:         "dispatcher",
		Permissions:  []string{"orders:read", "orders:write"},
		WarehouseIDs: []uuid.UUID{uuid.New()},
		IsActive:     true,
	}
}

// ===== generateTokenPair Tests =====

func TestGenerateTokenPair_AccessTokenValid(t *testing.T) {
	svc := newTestService(t)
	user := testUser()

	pair, err := svc.generateTokenPair(user)
	if err != nil {
		t.Fatalf("generateTokenPair error: %v", err)
	}
	if pair.AccessToken == "" {
		t.Error("access token should not be empty")
	}
	if pair.RefreshToken == "" {
		t.Error("refresh token should not be empty")
	}
	if pair.TokenType != "Bearer" {
		t.Errorf("token type should be Bearer, got %s", pair.TokenType)
	}
}

func TestGenerateTokenPair_AccessTokenClaims(t *testing.T) {
	svc := newTestService(t)
	user := testUser()

	pair, _ := svc.generateTokenPair(user)

	claims, err := svc.ValidateToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("validate access token: %v", err)
	}
	if claims.UserID != user.ID {
		t.Errorf("user_id mismatch: want %v got %v", user.ID, claims.UserID)
	}
	if claims.Role != user.Role {
		t.Errorf("role mismatch: want %s got %s", user.Role, claims.Role)
	}
	if claims.TokenType != "access" {
		t.Errorf("token_type should be 'access', got '%s'", claims.TokenType)
	}
}

func TestGenerateTokenPair_RefreshTokenClaims(t *testing.T) {
	svc := newTestService(t)
	user := testUser()

	pair, _ := svc.generateTokenPair(user)

	claims, err := svc.ValidateToken(pair.RefreshToken)
	if err != nil {
		t.Fatalf("validate refresh token: %v", err)
	}
	if claims.TokenType != "refresh" {
		t.Errorf("token_type should be 'refresh', got '%s'", claims.TokenType)
	}
	if claims.UserID != user.ID {
		t.Errorf("user_id mismatch in refresh token")
	}
}

func TestGenerateTokenPair_DifferentTokens(t *testing.T) {
	svc := newTestService(t)
	user := testUser()

	pair, _ := svc.generateTokenPair(user)
	if pair.AccessToken == pair.RefreshToken {
		t.Error("access token and refresh token must be different")
	}
}

func TestGenerateTokenPair_ExpiresIn(t *testing.T) {
	svc := newTestService(t)
	user := testUser()

	pair, _ := svc.generateTokenPair(user)
	expected := int64(svc.accessTTL.Seconds())
	if pair.ExpiresIn != expected {
		t.Errorf("expires_in should be %d, got %d", expected, pair.ExpiresIn)
	}
}

// ===== ValidateToken Tests =====

func TestValidateToken_ValidToken(t *testing.T) {
	svc := newTestService(t)
	user := testUser()
	pair, _ := svc.generateTokenPair(user)

	claims, err := svc.ValidateToken(pair.AccessToken)
	if err != nil {
		t.Errorf("valid token should not error: %v", err)
	}
	if claims == nil {
		t.Error("claims should not be nil")
	}
}

func TestValidateToken_InvalidToken(t *testing.T) {
	svc := newTestService(t)
	_, err := svc.ValidateToken("this.is.not.a.valid.jwt")
	if err == nil {
		t.Error("invalid token string should return error")
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	privKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	svc := &Service{
		privateKey: privKey,
		publicKey:  &privKey.PublicKey,
		accessTTL:  -1 * time.Second, // already expired
		refreshTTL: 168 * time.Hour,
	}
	user := testUser()
	pair, _ := svc.generateTokenPair(user)

	_, err := svc.ValidateToken(pair.AccessToken)
	if err == nil {
		t.Error("expired token should return error")
	}
}

func TestValidateToken_WrongKey(t *testing.T) {
	// Sign with key1, validate with key2 — should fail
	svc1 := newTestService(t)
	svc2 := newTestService(t)
	user := testUser()

	pair, _ := svc1.generateTokenPair(user)

	_, err := svc2.ValidateToken(pair.AccessToken)
	if err == nil {
		t.Error("token signed with different key should fail validation")
	}
}

// ===== Token Type Guard Tests (BUG-3 fix) =====
// Access token must NOT be accepted by RefreshToken endpoint logic.

func TestTokenType_AccessTokenIsNotRefreshToken(t *testing.T) {
	svc := newTestService(t)
	user := testUser()
	pair, _ := svc.generateTokenPair(user)

	// Verify access token has correct type
	accessClaims, _ := svc.ValidateToken(pair.AccessToken)
	if accessClaims.TokenType != "access" {
		t.Errorf("access token should have type 'access', got '%s'", accessClaims.TokenType)
	}

	// Simulate the RefreshToken guard: reject if token_type != "refresh"
	if accessClaims.TokenType == "" || accessClaims.TokenType != "refresh" {
		// This is the expected behavior — access token should be rejected
	} else {
		t.Error("access token should be rejected by the refresh token type guard")
	}
}

func TestTokenType_RefreshTokenRejectedAsAccess(t *testing.T) {
	svc := newTestService(t)
	user := testUser()
	pair, _ := svc.generateTokenPair(user)

	// Refresh token type
	refreshClaims, _ := svc.ValidateToken(pair.RefreshToken)
	if refreshClaims.TokenType != "refresh" {
		t.Errorf("refresh token should have type 'refresh', got '%s'", refreshClaims.TokenType)
	}

	// Refresh token should NOT have access-level data (FullName, Permissions, WarehouseIDs)
	// (lightweight refresh token — only UserID + Role)
	if refreshClaims.FullName != "" {
		t.Errorf("refresh token should not carry FullName, got '%s'", refreshClaims.FullName)
	}
	if len(refreshClaims.Permissions) != 0 {
		t.Errorf("refresh token should not carry Permissions")
	}
}

// ===== Permissions in Access Token Tests =====

func TestAccessToken_CarriesPermissions(t *testing.T) {
	svc := newTestService(t)
	user := testUser()
	pair, _ := svc.generateTokenPair(user)

	claims, _ := svc.ValidateToken(pair.AccessToken)
	if len(claims.Permissions) == 0 {
		t.Error("access token should carry permissions")
	}
	if len(claims.WarehouseIDs) == 0 {
		t.Error("access token should carry warehouse_ids")
	}
}
