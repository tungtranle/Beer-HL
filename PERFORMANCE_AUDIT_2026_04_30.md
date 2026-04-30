# PERFORMANCE AUDIT — bhl.symper.us

> **Ngày:** 30/04/2026  
> **Phạm vi:** Web (Next.js 14), API (Go/Gin), Nginx, Postgres 16, Mac mini production  
> **Mục tiêu:** Đưa First Load TTI và navigation tới chuẩn world-class (LCP < 2.5s 4G, navigation < 500ms, repeat visit < 1s).  
> **Trạng thái hiện tại (ước lượng từ cấu hình):** First Load LCP 6–12s (4G VN), Repeat visit 4–8s — **không đạt** chuẩn world-class.

---

## 0. TL;DR — 5 nguyên nhân chính khiến lần đầu chậm

| # | Nguyên nhân | Tác động ước lượng | Độ khó fix |
|---|-------------|---------------------|------------|
| 1 | Header `Cache-Control: no-cache, no-store` áp cho **tất cả** path, kể cả `/_next/static/*` (chunks JS/CSS đã content-hash, lẽ ra phải `immutable`) | Mỗi navigation **re-download toàn bộ** ~1–3 MB JS/CSS. Repeat visit không có lợi ích cache. | **Rất dễ** — sửa 5 dòng [next.config.js](bhl-oms/web/next.config.js#L14-L23) |
| 2 | Nginx **không** bật `gzip`/`brotli`, **không** bật `http2`, **không** cache `/_next/static` | Bundle gửi raw, mỗi request 1 TCP/TLS handshake không multiplex. Người dùng VN qua Mac mini 1 server-thread → waterfall dài | **Rất dễ** — thêm ~30 dòng [nginx.conf](bhl-oms/nginx/nginx.conf) |
| 3 | `leaflet.css` + `maplibre-gl.css` load từ **`unpkg.com`** trong [layout.tsx](bhl-oms/web/src/app/layout.tsx#L17-L25) — render-blocking, áp **mọi page** kể cả `/login` | Thêm 200–600ms DNS+TLS+download mỗi cold visit; CDN unpkg không có node VN | **Dễ** — self-host qua npm + dynamic import chỉ ở page bản đồ |
| 4 | Sentry **Replay + BrowserTracing eager** + **Microsoft Clarity** load song song trên mọi page | +120–180 KB JS, +CPU long-tasks ngay từ Time-to-Interactive; trên page login càng vô lý | **Dễ** — lazy/defer + tách flag |
| 5 | Backend Go **không bật gzip**, dashboard widget gọi `/dashboard/stats` **sequential N+1**, không cache Redis | Response JSON 30–80 KB raw + DB scan vài count(*) → API ~600–1500ms | **Trung bình** — gzip middleware + Redis cache 30s |

> Riêng việc fix #1 + #2 + #3 đã có thể đưa **First Contentful Paint** từ ~4–6s xuống **~1.5–2.5s**, và repeat visit xuống **< 1s** mà không cần đụng business code.

---

## 1. Phương pháp đánh giá

- Đọc trực tiếp cấu hình build/runtime: [next.config.js](bhl-oms/web/next.config.js), [layout.tsx](bhl-oms/web/src/app/layout.tsx#L1-L42), [Dockerfile](bhl-oms/web/Dockerfile), [docker-compose.prod.yml](bhl-oms/docker-compose.prod.yml), [nginx.conf](bhl-oms/nginx/nginx.conf), [sentry.client.config.ts](bhl-oms/web/sentry.client.config.ts), [sw.js](bhl-oms/web/public/sw.js), [package.json](bhl-oms/web/package.json), [api.ts](bhl-oms/web/src/lib/api.ts), [main.go](bhl-oms/cmd/server/main.go#L142-L200), [db.go](bhl-oms/pkg/db/db.go).
- So chuẩn với Core Web Vitals 2026 (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) + RAIL model.
- Chưa chạy Lighthouse/WebPageTest thực tế — nếu cần, mục §10 đề xuất công cụ đo cụ thể trước khi triển khai.

---

## 2. FRONTEND (Next.js 14)

### 2.1 🔴 Cache headers triệt tiêu mọi tối ưu của Next.js — **P0**

**File:** [next.config.js](bhl-oms/web/next.config.js#L14-L23)

```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
  }]
}
```

**Vấn đề:**
- Áp cho **mọi URL** — gồm `/_next/static/chunks/*.js` (đã có content-hash trong tên file → bất biến vĩnh viễn), `/_next/static/css/*`, `/_next/image`, `/manifest.json`, `/icon-*.svg`, `/sw.js`.
- Browser **không bao giờ** dùng disk cache → mỗi lần navigate giữa trang phải tải lại toàn bộ chunk dùng chung (`framework-*.js`, `main-*.js`, layout chunks…).
- Service Worker `cache-first` ([sw.js](bhl-oms/web/public/sw.js#L36-L42)) **cũng vô hiệu** vì `no-store` báo browser không được lưu.
- Mục đích ban đầu (theo comment) là "deploy mới có hiệu lực ngay" — nhưng Next.js đã giải bài này bằng content-hash filename + revalidation HTML. Header đang dùng là dùng dao mổ trâu giết kiến.

**Sửa (giữ HTML không cache, static immutable):**

```js
async headers() {
  return [
    // HTML pages — no cache để deploy mới có hiệu lực ngay
    {
      source: '/((?!_next/static|_next/image|icon-|manifest|sw\\.js).*)',
      headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
    },
    // Static chunks — content-hashed → cache vĩnh viễn
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    // Optimized images
    {
      source: '/_next/image(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
    },
    // Icons / manifest — short cache
    {
      source: '/(icon-.*|manifest\\.json)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
    },
    // Service worker — không cache, để update ngay
    {
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ]
}
```

**Tác động dự kiến:** Repeat visit từ ~4–8s → **< 1s** (chỉ tải HTML + payload mới).

---

### 2.2 🔴 CSS bản đồ load qua unpkg trên mọi page — **P0**

**File:** [layout.tsx](bhl-oms/web/src/app/layout.tsx#L17-L25)

```tsx
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css" />
```

**Vấn đề:**
1. `<link rel="stylesheet">` trong `<head>` → **render-blocking**.
2. unpkg.com không có CDN node Việt Nam, không HTTP/3 — DNS + TLS + 2× HTTP cost (~150–500ms phụ thuộc network).
3. **Áp dụng cho `/login`, `/dashboard`, mọi route** — kể cả 90% page không có bản đồ.
4. Không pin SRI hash → rủi ro security supply-chain.

**Sửa:**

```bash
# Đã có leaflet + maplibre-gl trong package.json — chỉ cần import CSS local
```

Tại các page bản đồ (`/dashboard/map`, `/dashboard/control-tower`, `/dashboard/planning`):

```tsx
import 'leaflet/dist/leaflet.css'         // bundled local, có hash, immutable cache
import 'maplibre-gl/dist/maplibre-gl.css'
```

Bỏ 2 thẻ `<link>` khỏi root layout.

**Tác động:** Cold load mọi page giảm 200–500ms; loại 2 round-trip cross-origin.

---

### 2.3 🟡 Sentry Replay + BrowserTracing tải eager — **P1**

**File:** [sentry.client.config.ts](bhl-oms/web/sentry.client.config.ts)

```ts
tracesSampleRate: 0.3,
replaysSessionSampleRate: 0.1,
integrations: [Sentry.replayIntegration(), Sentry.browserTracingIntegration()],
```

**Vấn đề:**
- `replayIntegration` thêm ~70 KB gzipped + worker → CPU cost ngay từ paint đầu.
- 30% trace sampling → mọi navigation/route change tạo span object + send.
- Tải đồng thời với `main` chunk → cạnh tranh với render.

**Sửa:**

```ts
// Production only — bỏ trên dev/login
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: '...',
    tracesSampleRate: 0.05,           // hạ xuống 5%
    replaysSessionSampleRate: 0,       // KHÔNG record mặc định
    replaysOnErrorSampleRate: 1.0,     // chỉ khi có lỗi
    integrations: [
      Sentry.browserTracingIntegration(),
      // Replay đẩy sang lazy load:
    ],
  })

  // Lazy add replay sau khi page idle (3s) — không ảnh hưởng TTI
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(async () => {
      const Replay = (await import('@sentry/nextjs')).replayIntegration
      Sentry.addIntegration(Replay({ maskAllText: false, blockAllMedia: true }))
    }, { timeout: 5000 })
  }
}
```

Không init Sentry trên route `/login` (thêm guard theo `pathname`).

**Tác động:** TTI giảm 300–600ms trên thiết bị tầm trung.

---

### 2.4 🟡 Microsoft Clarity — phân tích trùng lặp với Sentry — **P2**

**File:** [ClarityClient.tsx](bhl-oms/web/src/components/ClarityClient.tsx)

- Đã đặt sau consent + chỉ trên `bhl.symper.us` ✅
- Nhưng vẫn thêm 50–80 KB script bên thứ ba.

**Khuyến nghị:** Quyết định 1 trong 2 (Sentry Replay HOẶC Clarity). Trùng tính năng record session → tốn cả tiền lẫn ngân sách performance. Đề xuất: **giữ Sentry Replay onError**, **bỏ Clarity** (hoặc ngược lại nếu sản phẩm cần heatmap UX).

---

### 2.5 🟡 Bundle bloat — không tối ưu lucide-react & Sentry imports — **P1**

**File:** [layout.tsx](bhl-oms/web/src/app/dashboard/layout.tsx#L9-L16) — import 30+ icon từ `lucide-react` trong file `'use client'`. Mỗi page dashboard kéo theo cả tree này.

**Sửa [next.config.js](bhl-oms/web/next.config.js):**

```js
const nextConfig = {
  output: '...',
  reactStrictMode: true,
  swcMinify: true,
  compress: true,                    // gzip Node-side (fallback nếu nginx tắt)
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@sentry/nextjs',
      'react-leaflet',
    ],
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
}
```

**Tác động:** Giảm ~80–150 KB JS trên dashboard.

---

### 2.6 🟡 Dashboard layout `'use client'` toàn bộ + AI widgets eager — **P1**

**File:** [dashboard/layout.tsx](bhl-oms/web/src/app/dashboard/layout.tsx#L1) — cả navigation tree là client-side. AI widgets (`AIInboxPanel`, `DispatchBriefCard`, `OutreachQueueWidget`) trong [page.tsx](bhl-oms/web/src/app/dashboard/page.tsx) cũng eager.

**Sửa:**
1. Chuyển sidebar/nav sang Server Component nếu có thể; chỉ phần dropdown user và collapse state cần `'use client'` (extract thành `<UserMenu />`).
2. AI widgets chỉ thực sự hữu ích khi có flag bật → dynamic import:

```tsx
const AIInboxPanel = dynamic(
  () => import('@/components/ai').then(m => m.AIInboxPanel),
  { ssr: false, loading: () => <Skeleton /> }
)
```

Tuân theo nguyên tắc CLAUDE.md §8: **AI là progressive enhancement** — baseline UX phải render trước, AI không được block.

---

### 2.7 🟡 Dashboard stats fetch sequential, không có streaming — **P1**

**File:** [dashboard/page.tsx](bhl-oms/web/src/app/dashboard/page.tsx#L84-L96)

```ts
useEffect(() => {
  apiFetch('/dashboard/stats').then(...).finally(() => setLoading(false))
}, [])
```

Cả page chờ 1 promise → blank skeleton tới khi xong.

**Sửa:** Dùng React Server Component + `Suspense` streaming, hoặc tách 5 widget thành 5 promise song song và `Promise.allSettled` để widget nào xong trước render trước.

---

### 2.8 🟢 Service Worker chưa thực sự hoạt động — **P2**

**File:** [sw.js](bhl-oms/web/public/sw.js)

- `cache-first` cho static — bị vô hiệu do header `no-store` (xem §2.1). Sau khi fix §2.1 SW sẽ hoạt động.
- Pre-cache 4 page (`/dashboard`, `/driver`, `/warehouse`, `/pda-scanner`) — OK, nhưng Next.js HTML có CSRF token / hydration data → cần invalidate khi build SHA đổi. Thêm version từ env:

```js
const CACHE_NAME = 'bhl-' + (self.__BHL_BUILD__ || 'dev');
```

---

## 3. NGINX (đường vào critical path)

**File:** [nginx.conf](bhl-oms/nginx/nginx.conf)

### 3.1 🔴 Thiếu gzip/brotli, HTTP/2, cache static — **P0**

**Vấn đề:** Cấu hình hiện tại không có 1 dòng nào về compression hay HTTP/2. Toàn bộ JS bundle đi raw qua HTTP/1.1.

**Sửa — block `http {}` thêm:**

```nginx
http {
  # ===== Compression =====
  gzip on;
  gzip_vary on;
  gzip_proxied any;
  gzip_comp_level 6;
  gzip_min_length 1024;
  gzip_types
    text/plain text/css text/xml text/javascript
    application/javascript application/json application/xml
    application/xml+rss application/wasm image/svg+xml font/woff2;

  # Brotli (nếu compile module ngx_brotli — Mac mini build từ source hoặc dùng image openresty)
  # brotli on;
  # brotli_comp_level 5;
  # brotli_types <same as gzip_types>;

  # ===== Performance =====
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout 65;
  keepalive_requests 1000;

  # ===== Proxy buffers (tránh request lớn fall back disk) =====
  proxy_buffering on;
  proxy_buffer_size 16k;
  proxy_buffers 8 16k;
  proxy_busy_buffers_size 32k;
}
```

### 3.2 🔴 Bật HTTP/2 + cache cho `/_next/static` — **P0**

**Sửa — server block 443:**

```nginx
server {
  listen 443 ssl http2;            # ← thêm http2
  # listen 443 quic reuseport;     # ← HTTP/3 nếu nginx ≥ 1.25
  server_name oms.bhl.vn bhl.symper.us;

  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_session_tickets off;
  ssl_stapling on;
  ssl_stapling_verify on;

  # Static chunks — bypass Next, serve trực tiếp & cache 1 năm
  location /_next/static/ {
    proxy_pass http://web;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    add_header X-Cache-Status $upstream_cache_status always;
    expires 1y;
    access_log off;
  }

  location ~* \.(woff2|ttf|otf)$ {
    proxy_pass http://web;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    expires 1y;
  }

  # ... existing /v1/, /, /ws/ ...
}
```

Thêm `proxy_cache_path` ở `http {}`:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:50m max_size=2g inactive=30d use_temp_path=off;
```

### 3.3 🟡 Đặt Cloudflare phía trước (free tier) — **P1**

Mac mini ở mạng FPT/Viettel:
- Băng thông upstream cá nhân giới hạn (~100Mbps), 1 user concurrent download bundle = nghẽn cho user khác.
- TLS handshake cost cao với client xa.

**Đề xuất:**
- Cloudflare Free → cho `bhl.symper.us`
  - Auto HTTP/3 + 0-RTT TLS resumption
  - PoP HCM/SG cache static
  - Brotli auto
  - DDoS protect, rate limit
  - Origin: Mac mini IP, dùng Argo Tunnel để không lộ IP (free)
- Sau Cloudflare, nginx chỉ cần phục vụ HTML + API; static `/_next/static/*` được cache toàn cầu.

**Tác động:** Time-to-First-Byte cho user VN giảm từ 200–500ms → 30–80ms. Repeat visit ~50% từ edge cache.

### 3.4 🟡 Không loại bỏ `_next/webpack-hmr` location ở production — **P2**

Comment trong file đã ghi "remove in production" nhưng chưa làm. Để nguyên không hỏng nhưng làm rò bề mặt. Xoá khi go-live ổn định.

---

## 4. BACKEND (Go / Gin)

### 4.1 🟡 Chưa bật gzip middleware — **P1**

**File:** [main.go](bhl-oms/cmd/server/main.go#L142-L160)

```go
r := gin.Default()
r.Use(corsMiddleware())
// ... không có gzip
```

**Sửa:**
```go
import "github.com/gin-contrib/gzip"

r := gin.Default()
r.Use(gzip.Gzip(gzip.DefaultCompression, gzip.WithExcludedExtensions([]string{".pdf", ".png", ".jpg"})))
r.Use(corsMiddleware())
```

API `/dashboard/stats`, `/orders`, `/trips` trả JSON 20–80 KB → giảm ~70%.

> Lưu ý: nếu nginx đã gzip thì có thể chỉ cần ở 1 layer. Nhưng vì web container và api container đứng cạnh nhau, nginx → api proxy hiện không gzip-on-proxy. Bật ở Gin an toàn hơn.

### 4.2 🟡 `/dashboard/stats` không cache — **P1**

5 widget metrics → nhiều `COUNT(*)` trên `sales_orders`, `shipments`, `trips`. Mỗi user dashboard refresh là 1 lần scan.

**Sửa:** Cache Redis 30s, key theo `role + warehouse + month`:
```go
cacheKey := fmt.Sprintf("stats:%s:%s:%s", role, warehouseID, monthYYYYMM)
if v, err := redis.Get(ctx, cacheKey).Result(); err == nil { return v }
// ... query DB ...
redis.SetEx(ctx, cacheKey, json, 30*time.Second)
```

Cache invalidate event-driven khi có order mới (publish `stats.invalidate`).

### 4.3 🟢 Connection pool — OK nhưng có thể tăng — **P2**

[pkg/db/db.go](bhl-oms/pkg/db/db.go#L16) `MaxConns = 20`. Mac mini 8 core có thể nâng lên 30–40 nếu Postgres `max_connections=200` (đang đúng).

Thêm:
```go
config.MinConns = 5
config.MaxConnIdleTime = 5 * time.Minute
config.MaxConnLifetime = 1 * time.Hour
config.HealthCheckPeriod = 30 * time.Second
```

### 4.4 🟢 `AuditLog` middleware ghi DB synchronous — **P2**

**File:** [main.go](bhl-oms/cmd/server/main.go#L188) `v1.Use(middleware.AuditLog(pool))` — nếu ghi đồng bộ trên mọi request authenticated thì mỗi API có thêm 1 INSERT. Cần kiểm tra middleware có async/buffer không. Nếu sync → đẩy qua channel + worker batched 200ms.

### 4.5 🟢 API rewrites đi qua Node middleware — **P2**

[next.config.js](bhl-oms/web/next.config.js#L26-L37) rewrite `/api/* → http://api:8080/v1/*`. Mỗi request browser → Next.js Node → Go API. Thêm 1 hop in-cluster (~5–15ms) và memory pressure trên Node container.

**Tốt hơn:** browser gọi thẳng `https://bhl.symper.us/v1/*` (đã có nginx route). Sửa `API_BASE` trong [api.ts](bhl-oms/web/src/lib/api.ts#L1):

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/v1';
```

Bỏ rewrite trong next.config.js. Cùng origin nên không cần CORS thay đổi.

---

## 5. POSTGRES

**File:** [docker-compose.prod.yml](bhl-oms/docker-compose.prod.yml#L97-L106)

```yaml
-c shared_buffers=256MB
-c effective_cache_size=768MB
-c work_mem=4MB
-c maintenance_work_mem=64MB
```

**Đánh giá Mac mini 16GB RAM:**
- `shared_buffers` 256MB → có thể tăng **1–2 GB** (12% RAM).
- `effective_cache_size` → **6–8 GB**.
- `work_mem` 4MB hơi thấp — query VRP/dashboard sort lớn dễ tràn disk → tăng **16MB**.
- Thêm `random_page_cost=1.1` (SSD), `effective_io_concurrency=200`, `wal_compression=on`, `checkpoint_completion_target=0.9`.

**Index audit cần làm tay:**
```sql
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0; -- index thừa
```

→ ưu tiên kiểm `sales_orders(delivery_date, status)`, `shipments(planned_delivery_date, status)`, `trips(status, depot_id)`, `gps_traces(driver_id, ts DESC)`.

**Bonus:** đã bật `pg_stat_statements` ✅ và `log_min_duration_statement=500` ✅ — tốt. Cần định kỳ review qua `/dashboard/settings/health` (đã có endpoint slow-queries).

---

## 6. MAP / GPS — phần nặng nhất của UX dashboard

- **Leaflet + MapLibre GL cùng tồn tại** trong dependency → bundle gấp đôi map runtime. Chọn **1**:
  - MapLibre GL (~250KB gz) cho vector map hiện đại.
  - Leaflet (~40KB gz) đơn giản, raster tile.
  - Đề xuất: thống nhất MapLibre cho `/dashboard/map`, `/dashboard/control-tower`, `/dashboard/planning`. Bỏ react-leaflet nếu không dùng.
- Dynamic import map component:
```tsx
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })
```
- Cluster marker khi > 200 điểm GPS (`supercluster`).
- WebSocket GPS update phải `requestAnimationFrame` debounce — không re-render mỗi tick.

---

## 7. ASSETS & FONT

- Không thấy `next/font` → kiểm tra có Google Fonts CDN không. Nếu có → chuyển self-hosted via `next/font/google` (auto subset, font-display: swap, preload, inline CSS).
- `public/` chỉ có 2 SVG icon — OK. Logo nên dùng `<Image priority />` cho LCP.

---

## 8. METRICS & MONITORING

Đã có Prometheus + Grafana + Sentry → dùng:

**Cần thêm dashboard Grafana:**
1. **Web Vitals** (LCP, INP, CLS) gửi từ frontend qua Sentry hoặc beacon → API.
2. **Nginx** access log → log_format JSON → tail vào Promtail/Loki hoặc Sentry → đo p95 TTFB theo route.
3. **API histogram** đã có `PrometheusMiddleware` → dashboard p50/p95/p99 theo handler.
4. **DB**: postgres-exporter đã có → panel `pg_stat_statements top time`, `cache hit ratio` (mục tiêu > 99%), `connection wait`.
5. **Synthetic test** hàng giờ: Playwright headless chạy login → dashboard, ghi LCP/TTI vào Prom (script ngắn 30 dòng).

---

## 9. ROADMAP THỰC THI (đề xuất ưu tiên)

### Sprint 1 (1–2 ngày, không-đụng-business-logic) — **bắt buộc**

| Task | File | Effort | Impact |
|------|------|--------|--------|
| Fix `Cache-Control` cho `/_next/static` immutable | [next.config.js](bhl-oms/web/next.config.js) | 30 phút | 🔥🔥🔥 |
| Bật gzip + HTTP/2 + proxy_cache trong nginx | [nginx.conf](bhl-oms/nginx/nginx.conf) | 1 giờ | 🔥🔥🔥 |
| Self-host leaflet/maplibre CSS, bỏ unpkg | [layout.tsx](bhl-oms/web/src/app/layout.tsx), pages bản đồ | 30 phút | 🔥🔥 |
| `optimizePackageImports` + `modularizeImports` lucide | [next.config.js](bhl-oms/web/next.config.js) | 15 phút | 🔥🔥 |
| Bật `gzip` middleware Go | [main.go](bhl-oms/cmd/server/main.go) | 15 phút | 🔥 |
| Sentry: replay onError-only + lazy init | [sentry.client.config.ts](bhl-oms/web/sentry.client.config.ts) | 30 phút | 🔥 |
| Bỏ rewrite `/api → /v1`, gọi thẳng | [next.config.js](bhl-oms/web/next.config.js), [api.ts](bhl-oms/web/src/lib/api.ts) | 30 phút | 🔥 |

→ Test: chạy Lighthouse trước/sau, mục tiêu LCP `bhl.symper.us/login` từ ~5s → < 2.5s.

### Sprint 2 (3–5 ngày)

| Task | Impact |
|------|--------|
| Đặt Cloudflare trước Mac mini (Argo Tunnel) | 🔥🔥🔥 |
| Redis cache 30s cho `/dashboard/stats`, `/orders/control-desk/stats` | 🔥🔥 |
| Dynamic import AI widgets, map components | 🔥🔥 |
| Postgres tuning + index audit từ `pg_stat_statements` | 🔥🔥 |
| Synthetic test Playwright LCP định kỳ vào Grafana | 🔥 |

### Sprint 3 (1–2 tuần)

| Task | Impact |
|------|--------|
| Convert dashboard layout sang RSC partial; chỉ giữ `'use client'` cho `<UserMenu />`, `<NotificationBell />` | 🔥🔥 |
| Streaming dashboard với Suspense (5 widget song song) | 🔥 |
| Quyết định Sentry Replay vs Clarity, gỡ 1 cái | 🔥 |
| Self-host font qua `next/font` | 🔥 |
| Audit log middleware → async batch | 🔥 |

---

## 10. ĐO LƯỜNG TRƯỚC/SAU (định nghĩa thành công)

| Metric | Hiện tại (ước) | Sprint 1 | Sprint 2 | Mục tiêu world-class |
|--------|----------------|----------|----------|----------------------|
| LCP `/login` (4G VN) | 5–8s | 2.0–2.5s | 1.2–1.8s | **< 2.5s p75** |
| LCP `/dashboard` cold | 8–12s | 3.5–4.5s | 2.0–3.0s | **< 2.5s p75** |
| Repeat visit TTI | 4–8s | 0.6–1.0s | 0.3–0.6s | **< 1s** |
| API `/dashboard/stats` p95 | 800–1500ms | 600–900ms | 80–150ms (cache) | **< 200ms** |
| Total JS dashboard (gzipped) | ~700–900 KB | ~400–500 KB | ~300–400 KB | **< 350 KB** |
| INP (interaction) | ~250–500ms | 150–250ms | 80–150ms | **< 200ms p75** |
| CLS | TBD | – | – | **< 0.1** |

**Công cụ đo:**
- `npx @lhci/cli autorun` (Lighthouse CI)
- WebPageTest từ HCM/Hà Nội (https://webpagetest.org, chọn Asia node)
- `npx @next/bundle-analyzer` để soi chunk
- `web-vitals` library bắn về Sentry (đã có DSN)

---

## 11. RỦI RO & LƯU Ý KHI TRIỂN KHAI

1. **Sửa Cache-Control:** sau khi deploy, user đang mở tab cũ phải reload — không nguy hiểm. Service worker mới sẽ activate ở lần mở thứ 2. Có thể thêm version banner "Có bản mới — tải lại" qua SW `controllerchange`.
2. **Bật HTTP/2 nginx:** Mac mini cần restart container — theo policy của user [restart-services.bat](bhl-oms/restart-services.bat), chạy double-click chứ không qua VS Code terminal. Hoặc deploy qua GitHub Actions.
3. **Cloudflare:** cần update DNS A → CF, bật proxy. Mất 5–30 phút propagation. Origin SSL phải hợp lệ (đã có Let's Encrypt). Không giảm bảo mật vì có Origin Pull Cert.
4. **Bỏ rewrite `/api`:** kiểm tra mọi `apiFetch('...')` trong [src/](bhl-oms/web/src) đang dùng path tương đối — nếu đang dùng base `/api`, đổi cùng lúc.
5. **Sentry hạ sample 30%→5%:** mất 6× span data — chấp nhận đổi lấy CPU. Có thể giữ 30% trong 24h sau release lớn rồi hạ.
6. **Không refactor code cũ** ngoài các file ở §9 — tuân CLAUDE.md §4. Mọi thay đổi áp dụng theo nguyên tắc additive (thêm header/middleware), không đụng business handler.
7. **AQF gate (CLAUDE.md §7):** sau Sprint 1, chạy:
   - G0 build (FE + BE compile)
   - G1 fast tests (unit + lint)
   - G2 smoke: `/v1/health`, `/v1/app/version`, login → dashboard, load `/dashboard/orders` 1 page
   - G4 production watch: theo dõi Sentry error rate + LCP 24h sau deploy

---

## 12. CHỖ ĐỂ BỔ SUNG TỪ BẢN PHÂN TÍCH KHÁC CỦA NGƯỜI DÙNG

> **Người dùng sẽ gửi bản phân tích thứ 2.** Tôi sẽ đọc, đối chiếu, và bổ sung vào file này ở các mục sau:
>
> - [ ] Khác biệt findings (mục nào bản kia phát hiện mà bản này bỏ sót)
> - [ ] Khác biệt mức ưu tiên (P0/P1/P2)
> - [ ] Bổ sung số liệu đo thực tế nếu bản kia có
> - [ ] Bổ sung phương án mà bản kia đề xuất khác
> - [ ] Cập nhật roadmap §9 nếu thay đổi thứ tự

---

## Phụ lục A — Lệnh nhanh để verify sau khi sửa

```bash
# Đo cache header
curl -I https://bhl.symper.us/_next/static/chunks/main.js
# Phải thấy: cache-control: public, max-age=31536000, immutable

# Đo gzip
curl -H "Accept-Encoding: gzip,br" -I https://bhl.symper.us/v1/dashboard/stats
# Phải thấy: content-encoding: gzip (hoặc br)

# Đo HTTP/2
curl -I --http2 https://bhl.symper.us/ -v 2>&1 | grep -i "HTTP/2"

# Lighthouse
npx lighthouse https://bhl.symper.us/login --preset=desktop --output=html
npx lighthouse https://bhl.symper.us/login --form-factor=mobile --throttling.cpuSlowdownMultiplier=4

# Bundle analysis
ANALYZE=true npm run build  # cần thêm @next/bundle-analyzer
```

## Phụ lục B — Checklist Reviewer

- [ ] §2.1 cache header sửa và verify bằng curl
- [ ] §2.2 unpkg link đã xoá khỏi root layout
- [ ] §2.3 Sentry Replay không còn eager
- [ ] §2.5 `optimizePackageImports` thêm
- [ ] §3.1 nginx gzip on
- [ ] §3.2 nginx http2 + proxy_cache static
- [ ] §4.1 Go gzip middleware on
- [ ] §4.2 dashboard/stats có Redis cache
- [ ] §4.5 rewrite `/api` đã bỏ
- [ ] CHANGELOG.md, CURRENT_STATE.md cập nhật theo doc-update-rules
- [ ] Lighthouse trước/sau attached
