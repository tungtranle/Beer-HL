#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Download and prepare Vietnam OSM data for OSRM routing engine.
.DESCRIPTION
    This script downloads the latest Vietnam OpenStreetMap data from Geofabrik,
    then runs OSRM extract, partition, and customize steps to prepare the data
    for the MLD routing algorithm.
.NOTES
    Run this ONCE before starting the OSRM service in docker-compose.
    Total disk space required: ~2GB for Vietnam data.
    Processing time: 10-30 minutes depending on hardware.
#>

$ErrorActionPreference = "Stop"
$OSRM_IMAGE = "osrm/osrm-backend:v5.25.0"
$DATA_DIR = Join-Path $PSScriptRoot "osrm-data"
$PBF_URL = "https://download.geofabrik.de/asia/vietnam-latest.osm.pbf"
$PBF_FILE = "vietnam-latest.osm.pbf"

Write-Host "=== BHL OSRM Data Preparation ===" -ForegroundColor Cyan
Write-Host ""

# Create data directory
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR | Out-Null
    Write-Host "[1/5] Created osrm-data directory" -ForegroundColor Green
} else {
    Write-Host "[1/5] osrm-data directory exists" -ForegroundColor Yellow
}

# Check if already prepared
$osrmFile = Join-Path $DATA_DIR "vietnam-latest.osrm"
if (Test-Path $osrmFile) {
    Write-Host ""
    Write-Host "OSRM data already prepared. To re-process, delete osrm-data/ and run again." -ForegroundColor Yellow
    exit 0
}

# Download Vietnam PBF
$pbfPath = Join-Path $DATA_DIR $PBF_FILE
if (-not (Test-Path $pbfPath)) {
    Write-Host "[2/5] Downloading Vietnam OSM data (~120MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $PBF_URL -OutFile $pbfPath -UseBasicParsing
    Write-Host "       Download complete" -ForegroundColor Green
} else {
    Write-Host "[2/5] PBF file already downloaded" -ForegroundColor Yellow
}

# Pull OSRM image
Write-Host "[3/5] Pulling OSRM Docker image..." -ForegroundColor Cyan
docker pull $OSRM_IMAGE

# Extract
Write-Host "[4/5] Extracting road network (this takes several minutes)..." -ForegroundColor Cyan
docker run --rm -t `
    -v "${DATA_DIR}:/data" `
    $OSRM_IMAGE `
    osrm-extract -p /opt/car.lua "/data/$PBF_FILE"

# Partition
Write-Host "       Partitioning..." -ForegroundColor Cyan
docker run --rm -t `
    -v "${DATA_DIR}:/data" `
    $OSRM_IMAGE `
    osrm-partition "/data/vietnam-latest.osrm"

# Customize
Write-Host "       Customizing..." -ForegroundColor Cyan
docker run --rm -t `
    -v "${DATA_DIR}:/data" `
    $OSRM_IMAGE `
    osrm-customize "/data/vietnam-latest.osrm"

Write-Host ""
Write-Host "[5/5] OSRM data preparation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now start the full stack:" -ForegroundColor Cyan
Write-Host "  docker compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "Test OSRM routing:" -ForegroundColor Cyan
Write-Host "  curl 'http://localhost:5000/route/v1/driving/106.6297,10.8231;106.7009,10.7769'" -ForegroundColor White
