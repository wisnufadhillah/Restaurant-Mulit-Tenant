$ErrorActionPreference = "Stop"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ tenantSlug = "demo-padang"; email = $env:DEMO_STAFF_EMAIL; password = $env:DEMO_STAFF_PASSWORD } | ConvertTo-Json
$headers = @{ Origin = "http://127.0.0.1:3000" }
$login = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/staff/login" -Method Post -Headers $headers -ContentType "application/json" -Body $loginBody -WebSession $session
$catalogue = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/restaurant"
$id = $catalogue.data.outlets[0].menuItems[0].id
$updated = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/staff/demo-padang/menu/$id" -Method Patch -Headers $headers -ContentType "application/json" -Body (@{ isAvailable = $false } | ConvertTo-Json) -WebSession $session
$hours = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/staff/demo-padang/hours/1" -Method Put -Headers $headers -ContentType "application/json" -Body (@{ isOpen = $true; openMinutes = 600; closeMinutes = 1290 } | ConvertTo-Json) -WebSession $session
$logout = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/v1/staff/logout" -Method Post -Headers $headers -WebSession $session
if ($login.data.role -ne "owner" -or $updated.data.isAvailable -ne $false -or $hours.data.dayOfWeek -ne 1 -or $logout.data.loggedOut -ne $true) { throw "Staff API smoke failed" }
Write-Output "PASS staff login, tenant-scoped menu/table-hours API, and logout"
