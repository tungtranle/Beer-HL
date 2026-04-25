package auth

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"bhl-oms/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db         *pgxpool.Pool
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	accessTTL  time.Duration
	refreshTTL time.Duration
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type Claims struct {
	jwt.RegisteredClaims
	UserID       uuid.UUID   `json:"user_id"`
	FullName     string      `json:"full_name"`
	Role         string      `json:"role"`
	Permissions  []string    `json:"permissions"`
	WarehouseIDs []uuid.UUID `json:"warehouse_ids"`
	TokenType    string      `json:"token_type,omitempty"` // "access" or "refresh"
}

func NewService(db *pgxpool.Pool, privKeyPath, pubKeyPath string, accessTTL, refreshTTL time.Duration) (*Service, error) {
	privKeyData, err := os.ReadFile(privKeyPath)
	if err != nil {
		return nil, fmt.Errorf("read private key: %w", err)
	}

	block, _ := pem.Decode(privKeyData)
	if block == nil {
		return nil, fmt.Errorf("invalid private key PEM")
	}

	privKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		// Try PKCS8
		key, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err2 != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		var ok bool
		privKey, ok = key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("key is not RSA")
		}
	}

	pubKeyData, err := os.ReadFile(pubKeyPath)
	if err != nil {
		return nil, fmt.Errorf("read public key: %w", err)
	}

	pubBlock, _ := pem.Decode(pubKeyData)
	if pubBlock == nil {
		return nil, fmt.Errorf("invalid public key PEM")
	}

	pubInterface, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse public key: %w", err)
	}

	pubKey, ok := pubInterface.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("key is not RSA public key")
	}

	return &Service{
		db:         db,
		privateKey: privKey,
		publicKey:  pubKey,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}

func (s *Service) GetPublicKey() *rsa.PublicKey {
	return s.publicKey
}

func (s *Service) Login(ctx context.Context, username, password string) (*domain.User, *TokenPair, error) {
	var user domain.User
	err := s.db.QueryRow(ctx, `
		SELECT id, username, email, password_hash, full_name, role, permissions, warehouse_ids, is_active
		FROM users WHERE username = $1
	`, username).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash,
		&user.FullName, &user.Role, &user.Permissions, &user.WarehouseIDs, &user.IsActive,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("user not found")
	}

	if !user.IsActive {
		return nil, nil, fmt.Errorf("account disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, fmt.Errorf("invalid password")
	}

	tokens, err := s.generateTokenPair(&user)
	if err != nil {
		return nil, nil, fmt.Errorf("generate tokens: %w", err)
	}

	// Update last login
	_, _ = s.db.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, user.ID)

	return &user, tokens, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	// Reject if caller passes an access token instead of refresh token
	if claims.TokenType != "" && claims.TokenType != "refresh" {
		return nil, fmt.Errorf("invalid refresh token")
	}

	var user domain.User
	err = s.db.QueryRow(ctx, `
		SELECT id, username, email, password_hash, full_name, role, permissions, warehouse_ids, is_active
		FROM users WHERE id = $1 AND is_active = true
	`, claims.UserID).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash,
		&user.FullName, &user.Role, &user.Permissions, &user.WarehouseIDs, &user.IsActive,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return s.generateTokenPair(&user)
}

func (s *Service) ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.publicKey, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

func (s *Service) generateTokenPair(user *domain.User) (*TokenPair, error) {
	now := time.Now()

	accessClaims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			Issuer:    "bhl-oms",
		},
		UserID:       user.ID,
		FullName:     user.FullName,
		Role:         user.Role,
		Permissions:  user.Permissions,
		WarehouseIDs: user.WarehouseIDs,
		TokenType:    "access",
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodRS256, accessClaims).SignedString(s.privateKey)
	if err != nil {
		return nil, err
	}

	refreshClaims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshTTL)),
			Issuer:    "bhl-oms",
		},
		UserID:    user.ID,
		Role:      user.Role,
		TokenType: "refresh",
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodRS256, refreshClaims).SignedString(s.privateKey)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.accessTTL.Seconds()),
		TokenType:    "Bearer",
	}, nil
}
