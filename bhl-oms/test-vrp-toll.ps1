$warehouse_id = "a0000000-0000-0000-0000-000000000002"
$body = @{ warehouse_id=$warehouse_id; delivery_date="2026-05-03"; include_overdue=$true; optimize_for="cost" } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "http://localhost:8080/v1/auth/login" -Method POST -Body (@{username="admin"; password="demo123"} | ConvertTo-Json) -Headers @{"Content-Type"="application/json"} -UseBasicParsing
$token = ($r.Content | ConvertFrom-Json).data.tokens.access_token

$r = Invoke-WebRequest -Uri "http://localhost:8080/v1/planning/solve-vrp" -Method POST -Body $body -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -UseBasicParsing 2>&1
$data = $r.Content | ConvertFrom-Json
Write-Host "Job ID: $($data.data.job_id)"

Start-Sleep -Seconds 4

$r2 = Invoke-WebRequest -Uri "http://localhost:8080/v1/planning/vrp-result/$($data.data.job_id)" -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing
$result = $r2.Content | ConvertFrom-Json

Write-Host "Status: $($result.data.status)"
Write-Host "Routes: $($result.data.routes.Count)"
Write-Host ""
Write-Host "First 3 routes:" -ForegroundColor Green
for ($i = 0; $i -lt [Math]::Min(3, $result.data.routes.Count); $i++) {
  $r = $result.data.routes[$i]
  Write-Host ("Route {0}: shipments={1}, distance={2}km, fuel={3}, toll={4}, total={5}" -f $i, $r.shipments.Count, $r.distance_km, $r.fuel_cost_vnd, $r.toll_cost_vnd, $r.total_cost_vnd)
}
