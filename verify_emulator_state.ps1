$audit = [ordered]@{}

# 1. Renderer in bluestacks.conf
$confPaths = @(
    "C:\ProgramData\BlueStacks_msi5\bluestacks.conf",
    "C:\ProgramData\BlueStacks_nxt\bluestacks.conf",
    "C:\ProgramData\BlueStacks\bluestacks.conf"
)
foreach ($cp in $confPaths) {
    if (Test-Path $cp) {
        $content = Get-Content $cp
        $audit["Conf_$($cp.Split('\')[2])_Renderer"] = ($content | Where-Object { $_ -match "graphics_renderer" }) -join " | "
        $audit["Conf_$($cp.Split('\')[2])_MaxFPS"] = ($content | Where-Object { $_ -match "max_fps" }) -join " | "
        $audit["Conf_$($cp.Split('\')[2])_DedicatedGPU"] = ($content | Where-Object { $_ -match "prefer_dedicated_gpu" }) -join " | "
        $audit["Conf_$($cp.Split('\')[2])_ASTC"] = ($content | Where-Object { $_ -match "astc_decoding_mode" }) -join " | "
    }
}

# 2. DirectX Discrete GPU Lock (UserGpuPreferences for NVIDIA RTX 4050)
$gpuPrefs = Get-ItemProperty -Path "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences" -ErrorAction SilentlyContinue
$audit["UserGpuPreferences_HDPlayer"] = if ($gpuPrefs) {
    ($gpuPrefs.PSObject.Properties | Where-Object { $_.Name -like "*HD-Player*" -or $_.Name -like "*BlueStacks*" -or $_.Name -like "*HD-GLCheck*" } | ForEach-Object { "$($_.Name) => $($_.Value)" }) -join "`n"
} else { "Not Set" }

# 3. HAGS (Hardware-Accelerated GPU Scheduling)
$hags = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "HwSchMode" -ErrorAction SilentlyContinue).HwSchMode
$audit["HAGS_Status"] = if ($hags -eq 2) { "Enabled (Mode 2 - RTX 4050 GPU Scheduling Active)" } else { "Disabled / $hags" }

# 4. Windows Power Throttling
$pt = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling" -Name "PowerThrottlingOff" -ErrorAction SilentlyContinue).PowerThrottlingOff
$audit["PowerThrottlingOff"] = if ($pt -eq 1) { "1 (Power Throttling Disabled for Max GPU/CPU Clock)" } else { "$pt" }

# 5. Hypervisor & HvHost Service
$hvHost = Get-Service -Name "HvHost" -ErrorAction SilentlyContinue
$audit["HvHost_Service"] = if ($hvHost) { "$($hvHost.Status) / Startup: $($hvHost.StartType)" } else { "Not Found" }
$audit["HvHost_Registry_Start"] = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\HvHost" -Name "Start" -ErrorAction SilentlyContinue).Start

# 6. Core Isolation (HVCI) & VBS
$audit["HVCI_CoreIsolation"] = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
$audit["VBS_Status"] = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard" -Name "EnableVirtualizationBasedSecurity" -ErrorAction SilentlyContinue).EnableVirtualizationBasedSecurity

# 7. HD-Player IFEO CPU Priority
$ifeo = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HD-Player.exe\PerfOptions" -ErrorAction SilentlyContinue
$audit["HDPlayer_CpuPriorityClass"] = if ($ifeo) { $ifeo.CpuPriorityClass } else { $null }
$audit["HDPlayer_IoPriority"] = if ($ifeo) { $ifeo.IoPriority } else { $null }

# 8. HD-Player Running Process Info
$proc = Get-Process -Name "HD-Player" -ErrorAction SilentlyContinue
if ($proc) {
    $audit["HDPlayer_Running_PID"] = $proc.Id
    $audit["HDPlayer_WorkingSet_MB"] = [math]::Round($proc.WorkingSet64 / 1MB, 1)
} else {
    $audit["HDPlayer_Running"] = "Not Running Currently"
}

$audit | ConvertTo-Json -Depth 5
