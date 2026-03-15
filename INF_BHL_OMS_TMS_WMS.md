# INFRASTRUCTURE & DEVOPS GUIDE — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | SAD v2.1 §8, INT v1.0 |

---

# MỤC LỤC

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Docker Compose — Development](#2-docker-compose--development)
3. [Docker Compose — Production](#3-docker-compose--production)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Environment Configuration](#5-environment-configuration)
6. [Monitoring Stack](#6-monitoring-stack)
7. [Logging](#7-logging)
8. [Backup & Disaster Recovery](#8-backup--disaster-recovery)
9. [SSL & Domain](#9-ssl--domain)
10. [Security Hardening](#10-security-hardening)
11. [Runbook — Common Operations](#11-runbook--common-operations)
12. [Capacity Planning](#12-capacity-planning)

---

# 1. INFRASTRUCTURE OVERVIEW

## 1.1 Architecture Diagram

```
                    Internet
                       │
              ┌────────┴────────┐
              │   Nginx Proxy   │ :80 / :443  (SSL termination)
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────┴────┐  ┌─────┴─────┐  ┌───┴────┐
    │ Go API  │  │ Next.js   │  │ VRP    │
    │ :8080   │  │ :3000     │  │ :8090  │
    └────┬────┘  └───────────┘  └────────┘
         │
    ┌────┼────────────┬──────────────┐
    │         │            │         │
┌───┴───┐ ┌──┴──┐ ┌───────┴──┐ ┌───┴───┐
│ PG 16 │ │Redis│ │  MinIO   │ │ OSRM  │
│ :5432 │ │:6379│ │:9000/9001│ │ :5000 │
└───────┘ └─────┘ └──────────┘ └───────┘
```

## 1.2 Server Requirements

| Env | Servers | Specs | Cost Estimate |
|-----|---------|-------|---------------|
| **Development** | Local machine | Docker Desktop | Free |
| **Staging** | 1 VM | 4 vCPU, 8GB RAM, 100GB SSD | ~$30/mo |
| **Production** | 2 VMs | **VM1** (App): 8 vCPU, 16GB RAM, 200GB SSD; **VM2** (DB): 4 vCPU, 16GB RAM, 500GB SSD | ~$120/mo |

> BHL on-premise VM → cost = electricity + hardware (existing infrastructure).

---

# 2. DOCKER COMPOSE — DEVELOPMENT

```yaml
# docker-compose.dev.yml
version: "3.9"

services:
  # ===== APPLICATION =====
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    ports:
      - "8080:8080"
    volumes:
      - .:/app
    environment:
      - ENV=development
      - DB_URL=postgres://bhl:bhl_dev@postgres:5432/bhl_dev?sslmode=disable
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      - OSRM_URL=http://osrm:5000
      - JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
      - JWT_PUBLIC_KEY_PATH=/app/keys/public.pem
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: ["air", "-c", ".air.toml"]  # hot-reload

  web:
    build:
      context: ./web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./web:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080

  vrp:
    build:
      context: ./vrp
      dockerfile: Dockerfile
    ports:
      - "8090:8090"
    environment:
      - OSRM_URL=http://osrm:5000

  # ===== DATA STORES =====
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: bhl
      POSTGRES_PASSWORD: bhl_dev
      POSTGRES_DB: bhl_dev
    ports:
      - "5432:5432"
    volumes:
      - pg-data-dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bhl"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # ===== INFRASTRUCTURE =====
  minio:
    image: minio/minio:RELEASE.2024-01-01T00-00-00Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio_dev
      MINIO_ROOT_PASSWORD: minio_dev_secret
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data-dev:/data

  osrm:
    image: osrm/osrm-backend:v5.27.1
    volumes:
      - ./osrm-data:/data
    command: osrm-routed --algorithm mld /data/vietnam-latest.osrm
    ports:
      - "5000:5000"

  # ===== MONITORING (dev optional) =====
  # prometheus / grafana / loki omitted in dev — enable via profile
  # docker compose --profile monitoring up

volumes:
  pg-data-dev:
  minio-data-dev:
```

**Start dev:**

```bash
docker compose -f docker-compose.dev.yml up -d
# Run migrations
go run cmd/migrate/main.go up
# Seed data
go run cmd/seed/main.go
```

---

# 3. DOCKER COMPOSE — PRODUCTION

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  # ===== REVERSE PROXY =====
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - web-static:/usr/share/nginx/html
    depends_on:
      - api
      - web
    restart: always

  # ===== APPLICATION =====
  api:
    image: ${REGISTRY}/bhl-api:${TAG:-latest}
    expose:
      - "8080"
    env_file:
      - .env.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "2"
          memory: 2G
    restart: always
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    image: ${REGISTRY}/bhl-web:${TAG:-latest}
    expose:
      - "3000"
    env_file:
      - .env.prod
    restart: always

  vrp:
    image: ${REGISTRY}/bhl-vrp:${TAG:-latest}
    expose:
      - "8090"
    env_file:
      - .env.prod
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 4G
    restart: always

  # ===== WORKER (ASYNQ) =====
  worker:
    image: ${REGISTRY}/bhl-api:${TAG:-latest}
    command: ["./bhl-api", "worker"]
    env_file:
      - .env.prod
    depends_on:
      - redis
      - postgres
    deploy:
      replicas: 2
    restart: always

  # ===== DATA STORES =====
  postgres:
    image: postgres:16-alpine
    env_file:
      - .env.prod
    volumes:
      - pg-data-prod:/var/lib/postgresql/data
      - ./pg-conf/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    shm_size: 256m
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 8G
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data-prod:/data
    deploy:
      resources:
        limits:
          memory: 1G
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
    restart: always

  minio:
    image: minio/minio:RELEASE.2024-01-01T00-00-00Z
    command: server /data --console-address ":9001"
    env_file:
      - .env.prod
    volumes:
      - minio-data-prod:/data
    restart: always

  osrm:
    image: osrm/osrm-backend:v5.27.1
    volumes:
      - ./osrm-data:/data
    command: osrm-routed --algorithm mld /data/vietnam-latest.osrm
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G
    restart: always

  # ===== MONITORING =====
  prometheus:
    image: prom/prometheus:v2.48.0
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prom-data:/prometheus
    restart: always

  grafana:
    image: grafana/grafana:10.2.0
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    restart: always

  loki:
    image: grafana/loki:2.9.0
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/config.yml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/config.yml
    restart: always

  tempo:
    image: grafana/tempo:2.3.0
    volumes:
      - ./monitoring/tempo-config.yml:/etc/tempo/config.yml:ro
    command: -config.file=/etc/tempo/config.yml
    restart: always

volumes:
  pg-data-prod:
  redis-data-prod:
  minio-data-prod:
  web-static:
  prom-data:
  grafana-data:
  loki-data:
```

---

# 4. CI/CD PIPELINE

## 4.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  GO_VERSION: "1.22"
  NODE_VERSION: "20"

jobs:
  # ===== LINT =====
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
      - name: golangci-lint
        uses: golangci/golangci-lint-action@v3
        with:
          version: v1.55
      - name: gosec
        run: |
          go install github.com/securego/gosec/v2/cmd/gosec@latest
          gosec ./...

  # ===== TEST =====
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: bhl_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
      - name: Run tests
        run: |
          go test -race -coverprofile=coverage.out ./...
          go tool cover -func=coverage.out
        env:
          DB_URL: postgres://test:test@localhost:5432/bhl_test?sslmode=disable
          REDIS_URL: redis://localhost:6379/0
      - name: Check coverage
        run: |
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Coverage: ${COVERAGE}%"

  # ===== BUILD =====
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - name: Build API image
        run: docker build -t bhl-api:${{ github.sha }} .
      - name: Build Web image
        run: docker build -t bhl-web:${{ github.sha }} ./web
      - name: Build VRP image
        run: docker build -t bhl-vrp:${{ github.sha }} ./vrp
      - name: Scan images (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: bhl-api:${{ github.sha }}
          severity: CRITICAL,HIGH

  # ===== DEPLOY STAGING =====
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/bhl
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec api ./bhl-api migrate up

  # ===== DEPLOY PRODUCTION =====
  deploy-prod:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production  # requires manual approval
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/bhl
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --no-deps api worker
            docker compose -f docker-compose.prod.yml exec api ./bhl-api migrate up
```

## 4.2 Dockerfile (Go API)

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o bhl-api ./cmd/api

# Dev stage (hot-reload)
FROM golang:1.22-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY . .
CMD ["air"]

# Production stage
FROM alpine:3.19 AS prod
RUN apk --no-cache add ca-certificates tzdata wget
WORKDIR /app
COPY --from=builder /app/bhl-api .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
USER nobody
CMD ["./bhl-api", "serve"]
```

## 4.3 Branch Strategy

```
main ─────────────────────────────────────── (production)
  │                                    ▲
  └──develop ──────────────────────────┤── (staging)
       │        ▲       ▲       ▲     │
       ├─feat/──┘       │       │     │
       ├─feat/──────────┘       │     │
       └─fix/───────────────────┘     │
                                      │
       hotfix/────────────────────────┘ (direct to main)
```

---

# 5. ENVIRONMENT CONFIGURATION

## 5.1 .env.prod Template

```bash
# Database
POSTGRES_USER=bhl_prod
POSTGRES_PASSWORD=<STRONG_PASSWORD>
POSTGRES_DB=bhl_prod
DB_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable

# Redis  
REDIS_PASSWORD=<STRONG_PASSWORD>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# JWT
JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/public.pem
JWT_ACCESS_EXPIRY=30m
JWT_REFRESH_EXPIRY=7d

# MinIO
MINIO_ROOT_USER=<STRONG_USER>
MINIO_ROOT_PASSWORD=<STRONG_PASSWORD>
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=bhl-files

# OSRM
OSRM_URL=http://osrm:5000

# VRP
VRP_URL=http://vrp:8090
VRP_TIMEOUT=120s

# External APIs
BRAVO_API_URL=https://bravo.bhl.com.vn/api
BRAVO_API_KEY=<BRAVO_KEY>
DMS_API_URL=https://dms.bhl.com.vn/api
DMS_API_KEY=<DMS_KEY>
ZALO_OA_ID=<ZALO_OA_ID>
ZALO_ACCESS_TOKEN=<encrypted_in_redis>
ZALO_REFRESH_TOKEN=<ZALO_REFRESH>

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=/app/keys/firebase-service-account.json

# Monitoring
GRAFANA_PASSWORD=<STRONG_PASSWORD>
SENTRY_DSN=<SENTRY_DSN>

# App
APP_ENV=production
APP_PORT=8080
LOG_LEVEL=info
CORS_ORIGINS=https://bhl-ops.vn,https://www.bhl-ops.vn
```

## 5.2 PostgreSQL Tuning (pg-conf/postgresql.conf)

```ini
# Memory
shared_buffers = 4GB           # 25% of 16GB RAM
effective_cache_size = 12GB    # 75% of 16GB RAM
work_mem = 64MB
maintenance_work_mem = 512MB

# WAL
wal_buffers = 64MB
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9

# Query planner
random_page_cost = 1.1         # SSD
effective_io_concurrency = 200 # SSD

# Connections
max_connections = 100
idle_in_transaction_session_timeout = 60000  # 1 min

# Logging
log_min_duration_statement = 200  # Log queries > 200ms
log_checkpoints = on
log_lock_waits = on

# Autovacuum
autovacuum_max_workers = 4
autovacuum_naptime = 30s
```

---

# 6. MONITORING STACK

## 6.1 Prometheus Config

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "bhl-api"
    static_configs:
      - targets: ["api:8080"]
    metrics_path: /metrics

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
```

## 6.2 Alert Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: bhl-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API error rate > 5% for 5 minutes"

      - alert: SlowQueries
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning

      - alert: DatabaseDown
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical

      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical

      - alert: DiskSpaceHigh
        expr: node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} < 0.15
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk space < 15% remaining"

      - alert: HighMemoryUsage
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 5m
        labels:
          severity: warning

      - alert: DLQBuildup
        expr: integration_dlq_size > 10
        for: 30m
        labels:
          severity: warning
```

## 6.3 Grafana Dashboards

| Dashboard | Panels |
|-----------|--------|
| **API Overview** | Request rate, Error rate, P95 latency, Active connections |
| **Database** | QPS, Slow queries, Connection pool, Table sizes, Replication lag |
| **Integration** | Bravo/DMS/Zalo push rate, Error rate, DLQ size, Retry count |
| **Business** | Orders/day, Trips/day, GPS active vehicles, Deliveries completed |

---

# 7. LOGGING

## 7.1 Log Format (zerolog → JSON)

```json
{
  "level": "info",
  "time": "2026-04-15T10:30:00+07:00",
  "caller": "handler/order.go:45",
  "request_id": "req-uuid-001",
  "user_id": "user-uuid-001",
  "method": "POST",
  "path": "/v1/orders",
  "status": 201,
  "latency_ms": 45,
  "msg": "order created"
}
```

## 7.2 Log Levels

| Level | Use |
|-------|-----|
| `debug` | Development only |
| `info` | Normal operations (order created, trip started) |
| `warn` | Non-critical issues (slow query, retry) |
| `error` | Failures requiring attention |
| `fatal` | Application cannot continue |

Production: `LOG_LEVEL=info`

## 7.3 Log Pipeline

```
App (zerolog JSON) → stdout → Docker log driver → Loki → Grafana
```

Loki config: retain 30 days, index by labels (service, level, request_id).

---

# 8. BACKUP & DISASTER RECOVERY

## 8.1 Backup Schedule

| Data | Method | Frequency | Retention | Storage |
|------|--------|-----------|-----------|---------|
| PostgreSQL | `pg_dump` (full) | Daily 03:00 | 30 days | External NAS / S3 |
| PostgreSQL | WAL archiving (continuous) | Continuous | 7 days | Local + NAS |
| Redis | RDB snapshot | Every 15 min | 7 days | Docker volume |
| MinIO (files) | Rsync to NAS | Daily 04:00 | 90 days | External NAS |
| Config files | Git repository | Every change | Infinite | GitHub |

## 8.2 Backup Script

```bash
#!/bin/bash
# scripts/backup.sh
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/bhl"
DB_CONTAINER="bhl-postgres-1"

# PostgreSQL full dump
echo "[$(date)] Starting PostgreSQL backup..."
docker exec ${DB_CONTAINER} pg_dump -U ${POSTGRES_USER} -Fc ${POSTGRES_DB} \
  > "${BACKUP_DIR}/pg_${TIMESTAMP}.dump"

# Compress
gzip "${BACKUP_DIR}/pg_${TIMESTAMP}.dump"

# Keep only 30 days
find ${BACKUP_DIR} -name "pg_*.dump.gz" -mtime +30 -delete

# Copy to NAS (rsync)
rsync -az "${BACKUP_DIR}/" nas:/backup/bhl/

echo "[$(date)] Backup completed: pg_${TIMESTAMP}.dump.gz"
```

**Crontab:**

```
0 3 * * * /opt/bhl/scripts/backup.sh >> /var/log/bhl-backup.log 2>&1
```

## 8.3 Restore Procedure

```bash
# 1. Stop application
docker compose -f docker-compose.prod.yml stop api worker

# 2. Restore PostgreSQL
docker exec -i bhl-postgres-1 pg_restore -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  --clean --if-exists < /backup/bhl/pg_YYYYMMDD_HHMMSS.dump

# 3. Verify data integrity
docker exec bhl-postgres-1 psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} \
  -c "SELECT count(*) FROM sales_orders; SELECT count(*) FROM customers;"

# 4. Restart application
docker compose -f docker-compose.prod.yml start api worker
```

## 8.4 RTO / RPO

| Metric | Target |
|--------|--------|
| RPO (data loss) | < 1 hour (WAL archiving) |
| RTO (recovery time) | < 1 hour |
| Backup verification | Monthly restore test on staging |

---

# 9. SSL & DOMAIN

## 9.1 Nginx Config

```nginx
# nginx/nginx.conf
upstream api_backend {
    server api:8080;
}

upstream web_backend {
    server web:3000;
}

server {
    listen 80;
    server_name bhl-ops.vn www.bhl-ops.vn;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bhl-ops.vn www.bhl-ops.vn;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API
    location /api/ {
        proxy_pass http://api_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (GPS, notifications)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Web frontend
    location / {
        proxy_pass http://web_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # File uploads (pre-signed URL goes directly to MinIO)
    client_max_body_size 10m;

    # Static assets cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        proxy_pass http://web_backend;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 9.2 SSL Certificate

| Option | Recommendation |
|--------|---------------|
| Let's Encrypt (free) | Recommended — certbot auto-renew |
| BHL purchased cert | Use if BHL prefers |

```bash
# Let's Encrypt setup
apt install certbot
certbot certonly --standalone -d bhl-ops.vn -d www.bhl-ops.vn
# Auto-renew cron
0 0 */60 * * certbot renew --deploy-hook "docker exec nginx nginx -s reload"
```

---

# 10. SECURITY HARDENING

| Area | Action |
|------|--------|
| SSH | Key-only auth, disable password, change port from 22 |
| Firewall (UFW) | Allow only 80, 443, SSH port; deny all else |
| Docker | Non-root containers (`USER nobody`), read-only filesystem where possible |
| Secrets | `.env` file 600 permissions, never in Git |
| DB | No public exposure (Docker internal network only) |
| Redis | Password required, no public port |
| MinIO | Internal network only, pre-signed URL for uploads |
| OS | Auto security updates (`unattended-upgrades`) |
| Images | Alpine-based (minimal attack surface) + Trivy scan |
| Logs | No passwords/tokens in logs (zerolog field filtering) |

---

# 11. RUNBOOK — COMMON OPERATIONS

## 11.1 Deploy New Version

```bash
cd /opt/bhl
git pull origin main
docker compose -f docker-compose.prod.yml build api web vrp
docker compose -f docker-compose.prod.yml up -d --no-deps api worker web vrp
docker compose -f docker-compose.prod.yml exec api ./bhl-api migrate up
# Verify
curl -s https://bhl-ops.vn/api/health | jq .
```

## 11.2 View Logs

```bash
# API logs (last 100 lines)
docker compose -f docker-compose.prod.yml logs --tail=100 api

# Error logs only
docker compose -f docker-compose.prod.yml logs api | grep '"level":"error"'

# Follow logs real-time
docker compose -f docker-compose.prod.yml logs -f api worker
```

## 11.3 Database Operations

```bash
# Connect to psql
docker compose exec postgres psql -U bhl_prod -d bhl_prod

# Check slow queries
SELECT query, calls, mean_exec_time, total_exec_time 
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

## 11.4 Redis Operations

```bash
# Connect to redis-cli
docker compose exec redis redis-cli -a ${REDIS_PASSWORD}

# Check memory
INFO memory

# Check Asynq queues
# Use asynq CLI or web UI
docker run --network bhl_default hibiken/asynqmon --redis-addr=redis:6379 --redis-password=${REDIS_PASSWORD}
```

## 11.5 Emergency: Rollback

```bash
# Rollback API to previous version
docker compose -f docker-compose.prod.yml stop api worker
docker tag bhl-api:previous bhl-api:latest
docker compose -f docker-compose.prod.yml up -d api worker

# Rollback database migration
docker compose exec api ./bhl-api migrate down 1
```

---

# 12. CAPACITY PLANNING

## 12.1 Current Scale

| Metric | Daily | Peak (Tết) |
|--------|-------|------------|
| Orders | 1,000 | 5,000 |
| Trips | 70 | 150 |
| GPS points | 70 vehicles × 2/min × 10h = 84,000 | 168,000 |
| ePOD photos | 500 × 3 = 1,500 files (7.5 GB) | 15 GB |
| DB growth | ~50 MB/day | ~200 MB/day |

## 12.2 Storage Projection (1 year)

| Component | Estimate |
|-----------|----------|
| PostgreSQL | ~20 GB (với partitioning + archive) |
| MinIO (photos) | ~3 TB |
| Logs (Loki) | ~10 GB (30-day retention) |
| Redis | < 1 GB (cache only, volatile) |
| **Total** | ~3.1 TB |

## 12.3 Scaling Triggers

| Trigger | Action |
|---------|--------|
| DB disk > 80% | Add disk / archive old partitions |
| API P95 > 1s sustained | Add API replica |
| VRP timeout > 120s regularly | Batch smaller / add VRP instances |
| Redis memory > 80% | Increase maxmemory / eviction policy review |

---

**=== HẾT TÀI LIỆU INF v1.0 ===**

*Infrastructure & DevOps Guide v1.0 — Docker Compose (dev+prod), CI/CD, monitoring, backup/DR, nginx, security, runbook.*
