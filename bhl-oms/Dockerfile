# Build stage
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

ARG APP_VERSION=1.0.0
ARG BUILD_COMMIT_SHA=unknown
ARG BUILD_TIME=unknown
ARG BUILD_BRANCH=unknown

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X main.appVersion=${APP_VERSION} -X main.buildCommit=${BUILD_COMMIT_SHA} -X main.buildTime=${BUILD_TIME} -X main.buildBranch=${BUILD_BRANCH}" -o /server ./cmd/server

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
