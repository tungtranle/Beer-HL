# ============================================================
# Inject GPS data into Redis for active trips on dispatch map
#
# Actual in-transit vehicles from DB:
#   Trip 5: e0000000-...-05 (14C-34567, TR-20260314-001)
#   Trip 6: e0000000-...-09 (14C-45678, TR-20260314-002)
#   Trip prod1: 00770000-...-01 (14C-50001, TR-20260315-0001)
#   Trip prod17: 00770000-...-17 (14C-50017, TR-20260315-0017)
# ============================================================

$redisHost = "localhost"
$redisPort = 6379

# Check if redis-cli is available
$redisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
if (-not $redisCli) {
    # Try docker exec
    $dockerRedis = docker ps --filter "name=redis" --format "{{.Names}}" 2>$null
    if ($dockerRedis) {
        $useDocker = $true
        $container = $dockerRedis.Trim()
        Write-Host "Using docker exec on container: $container"
    } else {
        Write-Host "redis-cli not found and no Redis container running."
        Write-Host "Trying direct TCP connection..."
        $useDocker = $false
        $useTcp = $true
    }
} else {
    $useDocker = $false
    $useTcp = $false
}

function Set-RedisGPS($vehicleId, $lat, $lng, $speed, $heading) {
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $json = "{`"lat`":$lat,`"lng`":$lng,`"speed`":$speed,`"heading`":$heading,`"ts`":`"$ts`"}"

    if ($useDocker) {
        docker exec $container redis-cli HSET "gps:latest" $vehicleId $json | Out-Null
    } elseif ($useTcp) {
        # Use raw TCP connection
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient($redisHost, $redisPort)
            $stream = $tcpClient.GetStream()
            $writer = New-Object System.IO.StreamWriter($stream)
            $reader = New-Object System.IO.StreamReader($stream)
            $writer.AutoFlush = $true

            # RESP protocol: HSET gps:latest <vehicleId> <json>
            $cmd = "*4`r`n`$4`r`nHSET`r`n`$10`r`ngps:latest`r`n`$$($vehicleId.Length)`r`n$vehicleId`r`n`$$($json.Length)`r`n$json`r`n"
            $writer.Write($cmd)
            Start-Sleep -Milliseconds 50
            $response = $reader.ReadLine()
            $tcpClient.Close()
        } catch {
            Write-Host "TCP connection failed: $_"
        }
    } else {
        redis-cli -h $redisHost -p $redisPort HSET "gps:latest" $vehicleId $json | Out-Null
    }
    Write-Host "  GPS set: $vehicleId -> ($lat, $lng) speed=$speed heading=$heading"
}

Write-Host "`n=== Injecting GPS data for 4 active in-transit vehicles ===`n"

# Vehicle 1: e0000000-0000-0000-0000-000000000005 (14C-34567, TR-20260314-001)
# Hạ Long area - heading towards Bãi Cháy
Set-RedisGPS "e0000000-0000-0000-0000-000000000005" 20.9565 107.0720 35.5 85

# Vehicle 2: e0000000-0000-0000-0000-000000000009 (14C-45678, TR-20260314-002)
# Hạ Long area - heading towards Hòn Gai
Set-RedisGPS "e0000000-0000-0000-0000-000000000009" 20.9480 107.0850 28.3 120

# Vehicle 3: 00770000-0000-0000-0000-000000000001 (14C-50001, TR-20260315-0001)
# Hải Phòng area - delivering in Kiến An
Set-RedisGPS "00770000-0000-0000-0000-000000000001" 20.8280 106.6850 22.0 210

# Vehicle 4: 00770000-0000-0000-0000-000000000017 (14C-50017, TR-20260315-0017)
# En route Đông Triều area
Set-RedisGPS "00770000-0000-0000-0000-000000000017" 21.0520 106.5480 45.0 270

# Set 24h expiry on the hash
if ($useDocker) {
    docker exec $container redis-cli EXPIRE "gps:latest" 86400 | Out-Null
} elseif (-not $useTcp) {
    redis-cli -h $redisHost -p $redisPort EXPIRE "gps:latest" 86400 | Out-Null
}

Write-Host "`n=== GPS injection complete! 3 vehicles on map ===`n"
Write-Host "Vehicles:"
Write-Host "  1. 14C-12349 (Trip TR-20260314-001) - Hạ Long nội thành"
Write-Host "  2. 15C-54101 (Trip TR-20260314-002) - Hải Phòng nội thành"
Write-Host "  3. 14C-12346 (Trip TR-20260314-003) - Đông Triều - Quảng Yên"
