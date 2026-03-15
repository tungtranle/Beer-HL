.PHONY: dev run build migrate seed keys docker-up docker-down test lint vet benchmark

# === Development ===
dev:
	go run cmd/server/main.go

run: docker-up migrate seed dev

build:
	go build -o bin/server cmd/server/main.go

# === CI ===
lint:
	golangci-lint run ./...

vet:
	go vet ./...

test:
	go test -race -coverprofile=coverage.out -timeout 120s ./...

test-coverage: test
	go tool cover -func=coverage.out | tail -1

# === Docker ===
docker-up:
	docker compose up -d postgres redis vrp

docker-down:
	docker compose down

docker-all:
	docker compose up -d

# === Database ===
migrate:
	@echo "Running migrations..."
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -p 5434 -f migrations/001_init.up.sql
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -p 5434 -f migrations/002_checklist.up.sql
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -p 5434 -f migrations/003_cutoff_consolidation.up.sql
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -p 5434 -f migrations/004_wms.up.sql

seed:
	@echo "Seeding demo data..."
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -f migrations/seed.sql

migrate-down:
	@PGPASSWORD=bhl_dev psql -h localhost -U bhl -d bhl_dev -f migrations/001_init.down.sql

# === JWT Keys ===
keys:
	@mkdir -p keys
	@openssl genrsa -out keys/private.pem 2048
	@openssl rsa -in keys/private.pem -pubout -out keys/public.pem
	@echo "JWT RS256 keys generated in ./keys/"

# === Benchmark ===
benchmark:
	@echo "Running VRP benchmark (1,000 orders + 100 vehicles)..."
	python vrp-solver/benchmark_vrp.py --url http://localhost:8090 --orders 1000 --vehicles 100

# === Test ===
# (moved to CI section above)

# === Help ===
help:
	@echo "BHL OMS-TMS-WMS Demo"
	@echo ""
	@echo "Quick start:"
	@echo "  1. make keys          - Generate JWT RS256 keys"
	@echo "  2. make docker-up     - Start PG + Redis + VRP"
	@echo "  3. make migrate       - Run DB migrations"
	@echo "  4. make seed          - Load demo data"
	@echo "  5. make dev           - Start Go API server"
	@echo ""
	@echo "  Or: make run          - Do steps 2-5 at once"
