param(
  [string]$TargetTestDb = "restaurant_restore_test"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot "apps\api\.env"
if (-not (Test-Path $EnvFile)) {
  Write-Error "apps/api/.env tidak ditemukan."
  exit 1
}

$DbLine = Get-Content $EnvFile | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $DbLine) {
  Write-Error "DATABASE_URL tidak ditemukan di apps/api/.env."
  exit 1
}

$RawUrl = ($DbLine -replace "^DATABASE_URL=", "").Trim().Trim('"').Trim("'")
$Uri = [System.Uri]$RawUrl
$UserInfo = $Uri.UserInfo.Split(":", 2)
$DbUser = [System.Uri]::UnescapeDataString($UserInfo[0])
$DbPass = if ($UserInfo.Length -gt 1) { [System.Uri]::UnescapeDataString($UserInfo[1]) } else { "" }
$DbHost = $Uri.Host
$DbPort = if ($Uri.Port -gt 0) { $Uri.Port } else { 5432 }
$DbName = $Uri.AbsolutePath.TrimStart("/")

if ($TargetTestDb -notmatch '^[a-z_][a-z0-9_]{0,62}$' -or $TargetTestDb -in @("postgres", "template0", "template1") -or $TargetTestDb -eq $DbName) {
  Write-Error "TargetTestDb harus nama database uji yang aman dan berbeda dari database sumber."
  exit 1
}

$env:PGPASSWORD = $DbPass
try {
  $Ready = & pg_isready -h $DbHost -p $DbPort -U $DbUser 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error "PostgreSQL target ($DbHost`:$DbPort) tidak merespons. Pastikan container/service database aktif."
    exit 1
  }

  $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $BackupDir = Join-Path $RepoRoot ".local\backups"
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $DumpFile = Join-Path $BackupDir "restaurant_$Timestamp.dump"
  $MenuImgDir = Join-Path $RepoRoot ".local\menu-images"
  $MenuArchive = Join-Path $BackupDir "menu-images_$Timestamp.zip"

  $Sw = [System.Diagnostics.Stopwatch]::StartNew()
  Write-Host "[1/5] Menjalankan pg_dump ke $DumpFile ..."
  & pg_dump -h $DbHost -p $DbPort -U $DbUser -Fc -f $DumpFile $DbName
  if ($LASTEXITCODE -ne 0) { throw "pg_dump gagal." }

  if (Test-Path $MenuImgDir) {
    Write-Host "[2/5] Mengarsipkan foto menu ke $MenuArchive ..."
    Compress-Archive -Path (Join-Path $MenuImgDir "*") -DestinationPath $MenuArchive -Force -ErrorAction SilentlyContinue
  } else {
    Write-Host "[2/5] Direktori .local/menu-images belum ada, arsip dilewati."
  }

  Write-Host "[3/5] Menyiapkan database uji bersih '$TargetTestDb' ..."
  & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TargetTestDb;" | Out-Null
  & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $TargetTestDb;" | Out-Null

  Write-Host "[4/5] Menjalankan pg_restore ke '$TargetTestDb' ..."
  & pg_restore -h $DbHost -p $DbPort -U $DbUser -d $TargetTestDb --no-owner --no-privileges $DumpFile
  if ($LASTEXITCODE -ne 0) { throw "pg_restore gagal." }

  Write-Host "[5/5] Verifikasi tabel, jumlah baris, dan exclusion constraint ..."
  $VerifySql = @"
SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT conname FROM pg_constraint WHERE contype = 'x';
SELECT 'tenants' AS tbl, count(*) FROM tenants
UNION ALL SELECT 'outlets', count(*) FROM outlets
UNION ALL SELECT 'dining_tables', count(*) FROM dining_tables
UNION ALL SELECT 'menu_items', count(*) FROM menu_items
UNION ALL SELECT 'weekly_hours', count(*) FROM weekly_hours
UNION ALL SELECT 'reservations', count(*) FROM reservations
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'staff', count(*) FROM staff;
"@
  & psql -h $DbHost -p $DbPort -U $DbUser -d $TargetTestDb -v ON_ERROR_STOP=1 -c $VerifySql

  $Sw.Stop()
  Write-Host "Rehearsal backup & restore selesai dalam $([math]::Round($Sw.Elapsed.TotalSeconds, 2)) detik."
} finally {
  & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $TargetTestDb;" 2>$null | Out-Null
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
