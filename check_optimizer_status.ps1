$results = [ordered]@{}

# 1. MenuShowDelay & Timeouts
$results["MenuShowDelay"] = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "MenuShowDelay" -ErrorAction SilentlyContinue).MenuShowDelay
$results["WaitToKillAppTimeout"] = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "WaitToKillAppTimeout" -ErrorAction SilentlyContinue).WaitToKillAppTimeout

# 2. System Responsiveness & Network Throttling
$sysProf = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -ErrorAction SilentlyContinue
$results["SystemResponsiveness"] = if ($sysProf) { $sysProf.SystemResponsiveness } else { $null }
$results["NetworkThrottlingIndex"] = if ($sysProf) { $sysProf.NetworkThrottlingIndex } else { $null }

# 3. Games Priority Tasks
$gamesTask = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -ErrorAction SilentlyContinue
$results["Games_GPUPriority"] = if ($gamesTask) { $gamesTask."GPU Priority" } else { $null }
$results["Games_Priority"] = if ($gamesTask) { $gamesTask.Priority } else { $null }
$results["Games_SchedulingCategory"] = if ($gamesTask) { $gamesTask."Scheduling Category" } else { $null }
$results["Games_SFIOPriority"] = if ($gamesTask) { $gamesTask."SFIO Priority" } else { $null }

# 4. Quantum Boost (Win32PrioritySeparation)
$results["Win32PrioritySeparation"] = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -ErrorAction SilentlyContinue).Win32PrioritySeparation

# 5. GameDVR & Xbox Recording
$results["GameDVR_Enabled"] = (Get-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -ErrorAction SilentlyContinue).GameDVR_Enabled
$results["AllowGameDVR"] = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Name "AllowGameDVR" -ErrorAction SilentlyContinue).AllowGameDVR
$results["AppCaptureEnabled"] = (Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -ErrorAction SilentlyContinue).AppCaptureEnabled

# 6. Window & Taskbar Animations
$results["MinAnimate"] = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -ErrorAction SilentlyContinue).MinAnimate
$results["TaskbarAnimations"] = (Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarAnimations" -ErrorAction SilentlyContinue).TaskbarAnimations

# 7. Power Plan
$pScheme = (powercfg /getactivescheme)
$results["ActivePowerScheme"] = $pScheme

# 8. Network TCP Tuning
$tcp = netsh int tcp show global
$results["TCP_Autotuning"] = ($tcp | Select-String "Receive Window Auto-Tuning Level").Line.Trim()
$results["TCP_RSS"] = ($tcp | Select-String "Receive-Side Scaling State").Line.Trim()
$results["TCP_ECN"] = ($tcp | Select-String "ECN Capability").Line.Trim()
$results["TCP_FastOpen"] = ($tcp | Select-String "TCP Fast Open").Line.Trim()
$results["TCP_HyStart"] = ($tcp | Select-String "HyStart").Line.Trim()

# 9. DNS Servers
$dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 }
$results["Active_DNS"] = ($dns | ForEach-Object { "$($_.InterfaceAlias): $($_.ServerAddresses -join ', ')" }) -join "; "

# 10. Telemetry & Services
$diag = Get-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
$results["DiagTrack_Status"] = if ($diag) { "$($diag.Status) / $($diag.StartType)" } else { "Not Found" }
$wersvc = Get-Service -Name "WerSvc" -ErrorAction SilentlyContinue
$results["WerSvc_Status"] = if ($wersvc) { "$($wersvc.Status) / $($wersvc.StartType)" } else { "Not Found" }
$results["AllowTelemetry"] = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -ErrorAction SilentlyContinue).AllowTelemetry
$results["DODownloadMode"] = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" -Name "DODownloadMode" -ErrorAction SilentlyContinue).DODownloadMode

# 11. Core Isolation / HVCI
$hvci = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
$results["HVCI_CoreIsolation_Enabled"] = $hvci
$vbs = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard" -Name "EnableVirtualizationBasedSecurity" -ErrorAction SilentlyContinue).EnableVirtualizationBasedSecurity
$results["VBS_Enabled"] = $vbs

# 12. User GPU Preferences (DirectX)
$gpuPrefs = Get-ItemProperty -Path "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences" -ErrorAction SilentlyContinue
$results["UserGpuPreferences"] = if ($gpuPrefs) {
    ($gpuPrefs.PSObject.Properties | Where-Object { $_.Name -like "*HD-Player*" -or $_.Name -like "*BlueStacks*" -or $_.Name -like "*dnplayer*" } | ForEach-Object { "$($_.Name) => $($_.Value)" }) -join "`n"
} else { "None" }

# 13. IFEO CPU Priority for HD-Player.exe
$ifeo = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HD-Player.exe\PerfOptions" -ErrorAction SilentlyContinue
$results["HDPlayer_CpuPriorityClass"] = if ($ifeo) { $ifeo.CpuPriorityClass } else { $null }
$results["HDPlayer_IoPriority"] = if ($ifeo) { $ifeo.IoPriority } else { $null }

# 14. AppCompatFlags for HD-Player.exe
$compat = (Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" -ErrorAction SilentlyContinue)."C:\Program Files\BlueStacks_msi5\HD-Player.exe"
$results["HDPlayer_AppCompatFlags"] = $compat

# 15. Emulator Config Files (bluestacks.conf)
$confPaths = @(
    "C:\ProgramData\BlueStacks_msi5\bluestacks.conf",
    "C:\ProgramData\BlueStacks_nxt\bluestacks.conf",
    "C:\ProgramData\BlueStacks\bluestacks.conf"
)
foreach ($cp in $confPaths) {
    if (Test-Path $cp) {
        $lines = Get-Content $cp | Where-Object { $_ -match "max_fps" -or $_ -match "enable_high_fps" -or $_ -match "astc_decoding_mode" -or $_ -match "prefer_dedicated_gpu" -or $_ -match "cpus" -or $_ -match "ram" }
        $results["Conf_$($cp.Split('\')[2])"] = $lines -join " | "
    }
}

$results | ConvertTo-Json -Depth 5
