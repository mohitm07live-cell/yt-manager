# Check bcdedit hypervisorlaunchtype
$bcd = bcdedit /enum "{current}" 2>&1
Write-Host "BCD OUTPUT:"
$bcd | ForEach-Object { Write-Host $_ }

# Check hyper-v services
Get-Service | Where-Object { $_.Name -like "*vmcompute*" -or $_.Name -like "*hvhost*" -or $_.Name -like "*vmic*" -or $_.Name -like "*wsl*" } | ForEach-Object { "$($_.Name): $($_.Status) ($($_.StartType))" }
