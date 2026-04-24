// k6 load test for ML and Anomaly endpoints
// Run: k6 run --vus 20 --duration 2m tests/k6/ml_anomalies_load_test.js
// Sprint 1 W4 exit criteria: p95 < 500ms
//
// Auth: set BHL_TOKEN env var with admin access_token
//   $env:BHL_TOKEN=(curl -s -X POST http://localhost:8080/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"demo123"}' | jq -r '.data.tokens.access_token')

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BHL_BASE || 'http://localhost:8080';
const TOKEN = __ENV.BHL_TOKEN || '';
const NPP_CODE = __ENV.NPP_CODE || 'NPP001';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

const tNppHealth = new Trend('latency_npp_health_one');
const tNppHealthAll = new Trend('latency_npp_health_all');
const tSku = new Trend('latency_sku_suggestions');
const tAnomList = new Trend('latency_anomaly_list');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    latency_npp_health_one: ['p(95)<300'],
    latency_npp_health_all: ['p(95)<500'],
    latency_sku_suggestions: ['p(95)<400'],
    latency_anomaly_list: ['p(95)<300'],
  },
};

export default function () {
  // 1. NPP Health (single)
  let r = http.get(`${BASE}/v1/ml/npp/${NPP_CODE}/health`, { headers });
  tNppHealth.add(r.timings.duration);
  check(r, { 'npp_health_one 200': (x) => x.status === 200 || x.status === 404 });

  // 2. NPP Health (all)
  r = http.get(`${BASE}/v1/ml/npp/health?limit=50`, { headers });
  tNppHealthAll.add(r.timings.duration);
  check(r, { 'npp_health_all 200': (x) => x.status === 200 });

  // 3. SKU Suggestions
  r = http.get(`${BASE}/v1/ml/orders/suggestions?customer_code=${NPP_CODE}&items=SKU001,SKU002`, { headers });
  tSku.add(r.timings.duration);
  check(r, { 'sku_suggestions 200': (x) => x.status === 200 });

  // 4. Anomaly list
  r = http.get(`${BASE}/v1/anomalies?status=open&limit=50`, { headers });
  tAnomList.add(r.timings.duration);
  check(r, { 'anomaly_list 200': (x) => x.status === 200 });

  sleep(1);
}
