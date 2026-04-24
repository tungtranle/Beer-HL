# Build stage
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata wget
ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app
COPY --from=builder /server .
COPY migrations ./migrations
COPY keys ./keys

EXPOSE 8080
USER nobody
CMD ["./server"]
