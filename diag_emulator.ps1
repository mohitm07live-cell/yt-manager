$diag = [ordered]@{}

# 1. Hardware Specs & Display Refresh Rate
$cpu = Get-CimInstance Win32_Processor
$diag["CPU"] = "$($cpu.Name) ($($cpu.NumberOfCores) Cores / $($cpu.NumberOfLogicalProcessors) Threads)"
$diag["VirtualizationFirmwareEnabled"] = $cpu.VirtualizationFirmwareEnabled

# Display Resolution & Refresh Rate
$displays = Get-CimInstance -ClassName WmiMonitorListedSupportedSourceModes -Namespace root\wmi -ErrorAction SilentlyContinue
$dispRes = Get-CimInstance Win32_VideoController
$diag["GPU_List"] = ($dispRes | ForEach-Object { "$($_.Name) (Driver: $($_.DriverVersion))" }) -join " | "
$diag["Current_Resolution_Refresh"] = ($dispRes | ForEach-Object { "$($_.Name): $($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution) @ $($_.CurrentRefreshRate)Hz" }) -join " | "

# 2. Hyper-V, WSL, Virtual Machine Platform Windows Optional Features
$features = @("Microsoft-Hyper-V", "Microsoft-Hyper-V-All", "HypervisorPlatform", "VirtualMachinePlatform", "Microsoft-Windows-Subsystem-Linux")
$featStatus = @()
foreach ($f in $features) {
    $st = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue
    if ($st) {
        $featStatus += "$f = $($st.State)"
    }
}
$diag["Windows_Hypervisor_Features"] = $featStatus -join "; "

# 3. bcdedit hypervisorlaunchtype
$bcd = bcdedit /enum "{current}"
$diag["BCDEdit_HypervisorLaunchType"] = ($bcd | Select-String "hypervisorlaunchtype").Line.Trim()

# 4. Hardware-Accelerated GPU Scheduling (HAGS)
$hags = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name "HwSchMode" -ErrorAction SilentlyContinue).HwSchMode
$diag["HAGS_HwSchMode"] = if ($hags -eq 2) { "Enabled (2)" } elseif ($hags -eq 1) { "Disabled (1)" } else { "Not Set / $hags" }

# 5. NVIDIA Control Panel & Driver Details
$nvidiaSmi = Test-Path "C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe"
if (-not $nvidiaSmi) { $nvidiaSmi = Test-Path "C:\Windows\System32\nvidia-smi.exe" }
if ($nvidiaSmi) {
    $smiOut = & nvidia-smi --query-gpu=name,driver_version,power.management,temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>&1
    $diag["NVIDIA_GPU_Info"] = ($smiOut -join " | ").Trim()
} else {
    $diag["NVIDIA_GPU_Info"] = "nvidia-smi not available"
}

# 6. BlueStacks / MSI Detailed Engine Configuration
$confPaths = @(
    "C:\ProgramData\BlueStacks_msi5\bluestacks.conf",
    "C:\ProgramData\BlueStacks_nxt\bluestacks.conf",
    "C:\ProgramData\BlueStacks\bluestacks.conf"
)
foreach ($cp in $confPaths) {
    if (Test-Path $cp) {
        $diag["ConfPath_Found"] = $cp
        $content = Get-Content $cp
        $keys = @(
            "graphics_renderer",
            "graphics_engine",
            "gl_mode",
            "astc_decoding_mode",
            "enable_high_fps",
            "max_fps",
            "cpus",
            "ram",
            "dpi",
            "abi_list",
            "engine_type",
            "display_width",
            "display_height",
            "prefer_dedicated_gpu"
        )
        $confProps = @()
        foreach ($k in $keys) {
            $matches = $content | Where-Object { $_ -match "bst\..*$k" }
            if ($matches) {
                $confProps += ($matches -join "`n")
            }
        }
        $diag["Conf_Details"] = $confProps -join "`n"
        break
    }
}

# 7. Currently Running Processes (CPU / RAM hogs)
$topCpu = Get-Process | Sort-Object CPU -Descending | Select-Object -First 6 | ForEach-Object { "$($_.ProcessName) (CPU: $([math]::Round($_.CPU, 1))s, RAM: $([math]::Round($_.WorkingSet64/1MB, 1))MB)" }
$diag["Top_CPU_Processes"] = $topCpu -join " | "

# 8. Power Throttling / Battery / Energy Saver
$powerStatus = (Get-CimInstance -ClassName BatteryStatus -Namespace root\wmi -ErrorAction SilentlyContinue)
if ($powerStatus) {
    $diag["Battery_Charging"] = $powerStatus.Charging
    $diag["Battery_PowerOnline"] = $powerStatus.PowerOnline
}

$diag | ConvertTo-Json -Depth 5
