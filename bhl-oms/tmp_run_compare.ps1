$ErrorActionPreference = 'Stop'
$LogFile = "$env:TEMP\v03_log.txt"
"=== run start $(Get-Date -Format o) ===" | Out-File -Encoding utf8 $LogFile
function L($m) { Add-Content -Path $LogFile -Value $m -Encoding utf8; Write-Host $m }

$env:PGPASSWORD = 'bhl_dev'
$ships  = @(Get-Content "$env:TEMP\v03_ships.txt"  | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$trucks = @(Get-Content "$env:TEMP\v03_trucks.txt" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$wh     = 'a0000000-0000-0000-0000-000000000001'
L "ships=$($ships.Count) trucks=$($trucks.Count) wh=$wh"
L "first ship='$($ships[0])'  len=$($ships[0].Length)"
L "first truck='$($trucks[0])' len=$($trucks[0].Length)"

$loginBody = '{"username":"admin","password":"demo123"}'
$tok = (Invoke-RestMethod -Uri 'http://localhost:8080/v1/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody).data.tokens.access_token
$headers = @{ Authorization = "Bearer $tok" }
L "token len=$($tok.Length)"

$today = (Get-Date).ToString('yyyy-MM-dd')

function Invoke-Compare($mode, $forced) {
  $obj = [ordered]@{
    warehouse_id  = $wh
    delivery_date = $today
    shipment_ids  = $ships
    vehicle_ids   = $trucks
    criteria      = [ordered]@{
      max_capacity     = 1
      min_vehicles     = 0
      cluster_region   = 0
      min_distance     = 1
      round_trip       = 1
      time_limit       = 0
      max_trip_minutes = 720
      cost_optimize    = $true
      optimize_for     = $mode
    }
  }
  if ($forced -and $forced.Count -gt 0) { $obj['force_delivery_shipment_ids'] = $forced }
  $j = $obj | ConvertTo-Json -Depth 8 -Compress
  $bodyFile = "$env:TEMP\v03_body_$mode.json"
  [System.IO.File]::WriteAllText($bodyFile, $j, [System.Text.UTF8Encoding]::new($false))
  L "[$mode] body bytes=$((Get-Item $bodyFile).Length)"
  L "[$mode] body head: $($j.Substring(0,[Math]::Min(300,$j.Length)))"

  $r = Invoke-RestMethod -Uri 'http://localhost:8080/v1/planning/run-vrp' -Method Post -Headers $headers -ContentType 'application/json' -InFile $bodyFile
  $jid = $r.data.job_id
  L "[$mode] job=$jid"
  if (-not $jid) { throw "[$mode] missing job id" }

  $deadline = (Get-Date).AddSeconds(360)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep 4
    $st = Invoke-RestMethod -Uri "http://localhost:8080/v1/planning/jobs/$jid" -Headers $headers
    L "[$mode] poll status=$($st.data.status) stage=$($st.data.stage) pct=$($st.data.pct)"
    if ($st.data.status -in @('completed','failed','no_solution')) { return $st.data }
  }
  throw "[$mode] timeout"
}

$cost = Invoke-Compare 'cost' $null
$delivered = @()
foreach ($t in $cost.trips) { foreach ($s in $t.stops) { if ($s.shipment_id) { $delivered += $s.shipment_id } } }
L "COST delivered: $($delivered.Count)  dropped: $($cost.unassigned_shipments.Count)"
$time = Invoke-Compare 'time' $null    # NO force — let TIME pick its own subset

L ""
L "=== RESULT (DEMO-VRP-03 trade-off) ==="
L "Mode  | cost_vnd | duration_min | distance_km | trips | assigned"
L "COST  | $($cost.summary.total_cost_vnd) | $($cost.summary.total_duration_min) | $($cost.summary.total_distance_km) | $($cost.trips.Count) | $($cost.summary.total_shipments_assigned)"
L "TIME  | $($time.summary.total_cost_vnd) | $($time.summary.total_duration_min) | $($time.summary.total_distance_km) | $($time.trips.Count) | $($time.summary.total_shipments_assigned)"

$cost | ConvertTo-Json -Depth 10 | Set-Content "$env:TEMP\v03_cost.json" -Encoding utf8
$time | ConvertTo-Json -Depth 10 | Set-Content "$env:TEMP\v03_time.json" -Encoding utf8
L "Saved JSON"
