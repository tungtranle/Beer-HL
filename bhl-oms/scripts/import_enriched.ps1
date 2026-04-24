#requires -Version 5.1
<#
.SYNOPSIS
  Import enriched ML data CSVs into ml_features.* schema.
.DESCRIPTION
  Sprint 0 task S0.7. Reads 4 CSVs from D:\Xu ly Data cho BHL\output\enriched
  and bulk-loads via COPY FROM into postgres container.

  Idempotent: TRUNCATE before each load (read-only feature tables, safe).

  Reference: docs/specs/DATA_DICTIONARY.md, migration 036_ml_features_schema.up.sql
#>
[CmdletBinding()]
param(
    [string]$Container = 'bhl-oms-postgres-1',
    [string]$User      = 'bhl',
    [string]$Database  = 'bhl_dev',
    [string]$SourceDir = 'D:\Xu ly Data cho BHL\output\enriched'
)

$ErrorActionPreference = 'Stop'

function Invoke-Psql {
    param([string]$Sql)
    $sql | docker exec -i $Container psql -U $User -d $Database -v ON_ERROR_STOP=1
}

function Copy-CsvToContainer {
    param([string]$LocalPath, [string]$RemotePath)
    if (-not (Test-Path $LocalPath)) { throw "Missing CSV: $LocalPath" }
    docker cp $LocalPath "${Container}:${RemotePath}" | Out-Null
}

function Import-Csv-Into {
    param(
        [string]$Csv,
        [string]$Table,
        [string]$Columns
    )
    $remote = "/tmp/$([System.IO.Path]::GetFileName($Csv))"
    Write-Host "-> Importing $Csv -> $Table" -ForegroundColor Cyan
    Copy-CsvToContainer -LocalPath $Csv -RemotePath $remote
    $sql = "TRUNCATE TABLE $Table CASCADE; \copy $Table ($Columns) FROM '$remote' WITH (FORMAT csv, HEADER true, NULL ''); SELECT COUNT(*) AS rows FROM $Table;"
    $sql | docker exec -i $Container psql -U $User -d $Database -v ON_ERROR_STOP=1
}

# ---- 1. NPP Health Scores ----
$nppCols = 'npp_code,ten_npp_chuan,recency_days,frequency_orders,monetary_units,last_order,first_order,n_skus,r_score,f_score,m_score,rfm_total,health_score_0_100,segment,risk_band,ten_npp_raw,tinh,lat,lon,doanh_thu_2022,doanh_thu_2023'
Import-Csv-Into -Csv (Join-Path $SourceDir 'npp_health_scores.csv') -Table 'ml_features.npp_health_scores' -Columns $nppCols

# ---- 2. SKU Forecastability ----
$skuCols = 'sku_chuan,n_active_days,total_qty,first_seen,last_seen,forecast_method,tet_share,is_tet_only'
Import-Csv-Into -Csv (Join-Path $SourceDir 'sku_forecastability.csv') -Table 'ml_features.sku_forecastability' -Columns $skuCols

# ---- 3. Basket Rules ----
# CSV id-less; skip serial id column.
$basketCols = 'antecedent,consequent,pair_count,antecedent_count,support,confidence,lift'
Import-Csv-Into -Csv (Join-Path $SourceDir 'basket_rules.csv') -Table 'ml_features.basket_rules' -Columns $basketCols

# ---- 4. Travel Time Matrix ----
$matrixCols = 'start_name,end_name,hour_bucket,n_obs,km_avg,dur_min_avg,dur_min_p50,dur_min_p90,speed_kmh'
Import-Csv-Into -Csv (Join-Path $SourceDir 'travel_time_matrix.csv') -Table 'ml_features.travel_time_matrix' -Columns $matrixCols

Write-Host "`nImport complete. Validating counts..." -ForegroundColor Green
$validateSql = "SELECT 'npp_health_scores' AS tbl, COUNT(*) AS rows FROM ml_features.npp_health_scores UNION ALL SELECT 'sku_forecastability', COUNT(*) FROM ml_features.sku_forecastability UNION ALL SELECT 'basket_rules', COUNT(*) FROM ml_features.basket_rules UNION ALL SELECT 'travel_time_matrix', COUNT(*) FROM ml_features.travel_time_matrix;"
Invoke-Psql $validateSql
