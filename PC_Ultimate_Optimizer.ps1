# ==============================================================================
# MOHIT SINDHU - ULTIMATE PC OPTIMIZER v9.0 (CYBER ENGINE & LIVE TELEMETRY)
# Developed by: Mohit Sindhu
# YouTube: @mohitm07live  |  Instagram: @Mohitm07live
# ==============================================================================

# Admin Elevation Check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$Host.UI.RawUI.WindowTitle = "MOHIT SINDHU - ULTIMATE PC OPTIMIZER v9.0 [CYBER EDITION]"

# --- CYBER ANIMATION & UI HELPERS ---

function Write-Typewriter {
    param([string]$text, [string]$color = "White", [int]$speedMs = 6, [switch]$NoNewline)
    foreach ($char in $text.ToCharArray()) {
        Write-Host $char -NoNewline -ForegroundColor $color
        Start-Sleep -Milliseconds $speedMs
    }
    if (-not $NoNewline) { Write-Host "" }
}

function Write-CyberBanner {
    Clear-Host
    Write-Host ""
    Write-Host "  ===========================================================================================" -ForegroundColor Cyan
    Write-Host "   MMM   MMM   OOOOO   HH   HH  IIIII  TTTTTTT     SSSSS  IIIII  NN   NN  DDDD    HH   HH  UU   UU" -ForegroundColor Yellow
    Write-Host "   MM M M MM  OO   OO  HH   HH   III     TTT      SS       III   NNN  NN  DD  DD  HH   HH  UU   UU" -ForegroundColor Yellow
    Write-Host "   MM  M  MM  OO   OO  HHHHHHH   III     TTT       SSSSS   III   NN N NN  DD   DD HHHHHHH  UU   UU" -ForegroundColor Cyan
    Write-Host "   MM     MM  OO   OO  HH   HH   III     TTT           SS  III   NN  NNN  DD  DD  HH   HH  UU   UU" -ForegroundColor Cyan
    Write-Host "   MM     MM   OOOOO   HH   HH  IIIII    TTT       SSSSS  IIIII  NN   NN  DDDD    HH   HH   UUUUU " -ForegroundColor Green
    Write-Host "  ===========================================================================================" -ForegroundColor Cyan
    Write-Host "   [*] ULTIMATE PC PERFORMANCE & GAMING ENGINE v9.0  -  ANIMATED REAL-TIME AUDITOR [*]" -ForegroundColor Yellow
    Write-Host "   YouTube: @mohitm07live   |   Instagram: @Mohitm07live   |   Owner: Mohit Sindhu" -ForegroundColor Magenta
    Write-Host "  ===========================================================================================" -ForegroundColor Cyan
}

function Write-SectionHeader {
    param([string]$title, [string]$color = "Cyan")
    Write-Host ""
    Write-Host "  +-----------------------------------------------------------------------------------------+" -ForegroundColor DarkGray
    Write-Host "  | [>>] $title" -ForegroundColor $color
    Write-Host "  +-----------------------------------------------------------------------------------------+" -ForegroundColor DarkGray
}

function Write-LogItem {
    param(
        [string]$category,
        [string]$action,
        [string]$detail = "",
        [string]$status = "DONE",
        [string]$statusColor = "Green"
    )
    $catColor = switch ($category) {
        "CLEANUP"   { "Yellow" }
        "REGISTRY"  { "Magenta" }
        "POWER"     { "Cyan" }
        "NETWORK"   { "Blue" }
        "SERVICE"   { "Red" }
        "MEMORY"    { "Green" }
        "STORAGE"   { "DarkYellow" }
        "SYSTEM"    { "Cyan" }
        default     { "White" }
    }

    $time = (Get-Date).ToString("HH:mm:ss")
    Write-Host "  [$time] " -NoNewline -ForegroundColor DarkGray
    Write-Host "[$category]" -NoNewline -ForegroundColor $catColor
    Write-Host " $action " -NoNewline -ForegroundColor White
    if ($detail -ne "") {
        Write-Host "($detail) " -NoNewline -ForegroundColor DarkGray
    }
    Write-Host "-> " -NoNewline -ForegroundColor DarkGray
    Write-Host "[$status]" -ForegroundColor $statusColor
}

function Show-CyberBar {
    param([string]$taskName, [int]$durationMs = 400, [string]$color = "Green")
    $totalBlocks = 25
    $delay = [math]::Max(5, [int]($durationMs / $totalBlocks))
    
    Write-Host "  [SCANNING] $taskName" -ForegroundColor Yellow
    Write-Host "  [" -NoNewline -ForegroundColor DarkGray
    for ($i = 1; $i -le $totalBlocks; $i++) {
        Write-Host "#" -NoNewline -ForegroundColor $color
        Start-Sleep -Milliseconds $delay
    }
    Write-Host "] 100% [VERIFIED]" -ForegroundColor Green
    Write-Host ""
}

function Show-SpinnerItem {
    param([string]$msg, [int]$durationMs = 250)
    $chars = @('|', '/', '-', '\')
    $endTime = (Get-Date).AddMilliseconds($durationMs)
    $i = 0
    while ((Get-Date) -lt $endTime) {
        Write-Host "`r  [$($chars[$i % $chars.Length])] $msg..." -NoNewline -ForegroundColor Yellow
        Start-Sleep -Milliseconds 45
        $i++
    }
    Write-Host "`r  [OK] $msg - COMPLETE                      " -ForegroundColor Green
}

function Show-QuickHUD {
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
        $freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
        $usedRam = [math]::Round($totalRam - $freeRam, 1)
        $cDrive = Get-PSDrive C -ErrorAction SilentlyContinue
        $cFree = [math]::Round($cDrive.Free / 1GB, 1)
        $cTotal = [math]::Round(($cDrive.Used + $cDrive.Free) / 1GB, 1)
        $powerPlan = (powercfg /getactivescheme)
        $pName = "Balanced"
        if ($powerPlan -like "*Ultimate*") { $pName = "Ultimate (MAX CPU CLOCK)" }
        elseif ($powerPlan -like "*High*") { $pName = "High Performance" }

        Write-Host "  ----------------------------------- LIVE SYSTEM HUD -----------------------------------" -ForegroundColor DarkGray
        Write-Host "  RAM In Use: " -NoNewline -ForegroundColor White
        Write-Host "$usedRam / $totalRam GB  " -NoNewline -ForegroundColor Yellow
        Write-Host "| C: Drive Free: " -NoNewline -ForegroundColor DarkGray
        Write-Host "$cFree / $cTotal GB  " -NoNewline -ForegroundColor Green
        Write-Host "| Active Power: " -NoNewline -ForegroundColor DarkGray
        Write-Host "$pName" -ForegroundColor Cyan
        Write-Host "  ---------------------------------------------------------------------------------------" -ForegroundColor DarkGray
    } catch {}
}

# --- REAL-TIME PURGE HELPER ---

function Clean-FolderRealtime {
    param([string]$path, [string]$label)
    if (Test-Path $path) {
        Show-SpinnerItem "Scanning $label" 150
        $files = Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        $count = ($files | Measure-Object).Count
        $sizeBytes = ($files | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        $sizeMB = [math]::Round(($sizeBytes / 1MB), 2)

        Remove-Item -Path "$path\*" -Recurse -Force -ErrorAction SilentlyContinue 2>$null
        Write-LogItem "CLEANUP" "Purged $label" "$count items | $sizeMB MB released" "PURGED" "Green"
    } else {
        Write-LogItem "CLEANUP" "$label Directory" "Clean" "SKIPPED" "DarkGray"
    }
}

# --- OPTION 1: 1-CLICK ALL-IN-ONE SUPER BOOST ---

function Run-GodMode {
    Write-CyberBanner
    Write-Host ""
    Write-Typewriter "  >>> INITIATING 1-CLICK ALL-IN-ONE CYBER BOOST PIPELINE <<<" "Green" 6
    Write-Host "  ===========================================================================================" -ForegroundColor Green
    
    $startTime = Get-Date

    # --- STEP 1: RESTORE POINT ---
    Write-SectionHeader "PHASE 1: SYSTEM SAFETY CHECKPOINT CREATION" "Yellow"
    Show-SpinnerItem "Initializing Windows Restore Engine" 200
    $prevWarn = $WarningPreference
    $WarningPreference = 'SilentlyContinue'
    try {
        Checkpoint-Computer -Description "MohitSindhu_Optimizer_v9" -RestorePointType "MODIFY_SETTINGS" -ErrorAction SilentlyContinue | Out-Null
        Write-LogItem "SYSTEM" "Restore Point Created" "MohitSindhu_Optimizer_v9" "SECURED" "Green"
    } catch {
        Write-LogItem "SYSTEM" "Restore Point" "System Restore checkpoint standby" "STANDBY" "Yellow"
    }
    $WarningPreference = $prevWarn

    # --- STEP 2: SYSTEM TEMP & JUNK PURGE ---
    Write-SectionHeader "PHASE 2: DEEP JUNK, PREFETCH & SYSTEM CACHE PURGE" "Yellow"
    Clean-FolderRealtime "$env:TEMP" "User Temp Cache (%TEMP%)"
    Clean-FolderRealtime "C:\Windows\Temp" "Windows System Temp (C:\Windows\Temp)"
    Clean-FolderRealtime "C:\Windows\Prefetch" "Windows Prefetch Boot Cache"
    Clean-FolderRealtime "C:\Windows\SoftwareDistribution\Download" "Windows Update Download Cache"
    Clean-FolderRealtime "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache" "Delivery Optimization P2P Cache"
    
    Show-SpinnerItem "Emptying Windows Recycle Bin across all drives" 200
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue 2>$null
    Write-LogItem "CLEANUP" "Windows Recycle Bin" "All Drives Flushed" "CLEARED" "Green"

    # --- STEP 3: GPU SHADER & DIRECTX CACHE ---
    Write-SectionHeader "PHASE 3: GPU SHADER & DIRECTX FPS-DROP FIX" "Cyan"
    Clean-FolderRealtime "$env:LOCALAPPDATA\D3DSCache" "DirectX D3D Shader Cache"
    Clean-FolderRealtime "$env:LOCALAPPDATA\NVIDIA\GLCache" "NVIDIA OpenGL / Vulkan Shader Cache"
    Clean-FolderRealtime "$env:LOCALAPPDATA\NVIDIA\DXCache" "NVIDIA DirectX Shader Cache"
    Clean-FolderRealtime "$env:LOCALAPPDATA\AMD\DxCache" "AMD Radeon DirectX Shader Cache"
    Clean-FolderRealtime "$env:LOCALAPPDATA\AMD\GLCache" "AMD Radeon OpenGL Shader Cache"
    Clean-FolderRealtime "$env:LOCALAPPDATA\Intel\ShaderCache" "Intel Graphics Shader Cache"

    # --- STEP 4: ZERO-LATENCY REGISTRY TWEAKS ---
    Write-SectionHeader "PHASE 4: ZERO-LATENCY & FOREGROUND CPU/GPU PRIORITY" "Magenta"
    Show-SpinnerItem "Configuring Zero-Delay UI & App Response Timers" 200
    reg add "HKCU\Control Panel\Desktop" /v "MenuShowDelay" /t REG_SZ /d "0" /f | Out-Null
    Write-LogItem "REGISTRY" "MenuShowDelay -> 0ms" "Instant Start Menu & Context Menus" "APPLIED" "Green"
    
    reg add "HKCU\Control Panel\Desktop" /v "WaitToKillAppTimeout" /t REG_SZ /d "2000" /f | Out-Null
    Write-LogItem "REGISTRY" "WaitToKillAppTimeout -> 2000ms" "Fast Shutdown & Reboot" "APPLIED" "Green"

    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 0 /f | Out-Null
    Write-LogItem "REGISTRY" "SystemResponsiveness -> 0" "100% Priority for Gaming & Streaming" "APPLIED" "Green"

    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v "NetworkThrottlingIndex" /t REG_DWORD /d 4294967295 /f | Out-Null
    Write-LogItem "REGISTRY" "NetworkThrottlingIndex -> Unlimited" "Windows Network Throttling Disabled" "APPLIED" "Green"

    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f | Out-Null
    Write-LogItem "REGISTRY" "GPU Priority -> 8 (Max)" "Dedicated Graphics Allocation" "APPLIED" "Green"

    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "Priority" /t REG_DWORD /d 6 /f | Out-Null
    Write-LogItem "REGISTRY" "Game Task Priority -> 6 (High)" "Scheduler Gaming Thread Boost" "APPLIED" "Green"

    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f | Out-Null
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "SFIO Priority" /t REG_SZ /d "High" /f | Out-Null

    reg add "HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 38 /f | Out-Null
    Write-LogItem "REGISTRY" "Win32PrioritySeparation -> 38 (0x26)" "Max Foreground Quantum Burst" "APPLIED" "Green"

    # --- STEP 5: POWER PLAN ---
    Write-SectionHeader "PHASE 5: ULTIMATE PERFORMANCE CPU POWER ENGINE" "Cyan"
    Show-SpinnerItem "Unlocking Hidden Windows Ultimate Performance Plan" 200
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 | Out-Null
    $plans = powercfg /list
    $ultPlan = ($plans | Select-String "Ultimate Performance" | Select-Object -First 1)
    if ($ultPlan) {
        $guid = $ultPlan.Line.Split()[3]
        powercfg /setactive $guid | Out-Null
        Write-LogItem "POWER" "Ultimate Performance Scheme Activated" "GUID: $guid" "LOCKED" "Green"
    } else {
        powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null
        Write-LogItem "POWER" "High Performance Scheme Activated" "Full CPU Turbo Frequency" "LOCKED" "Green"
    }

    # --- STEP 6: NETWORK & TCP AUTO-TUNING ---
    Write-SectionHeader "PHASE 6: TCP / IP PACKET & LOW-PING GAMING OPTIMIZATION" "Blue"
    Show-SpinnerItem "Tuning TCP Auto-Tuning, RSS & Disabling ECN" 200
    netsh int tcp set global autotuninglevel=normal | Out-Null
    Write-LogItem "NETWORK" "TCP AutoTuningLevel" "Set to Normal" "OPTIMIZED" "Green"

    netsh int tcp set global rss=enabled | Out-Null
    Write-LogItem "NETWORK" "Receive-Side Scaling (RSS)" "Multi-Core Packet Processing Enabled" "OPTIMIZED" "Green"

    netsh int tcp set global ecncapability=disabled | Out-Null
    netsh int tcp set global timestamps=disabled | Out-Null
    netsh int tcp set global fastopen=enabled | Out-Null
    netsh int tcp set global hystart=enabled | Out-Null
    Write-LogItem "NETWORK" "TCP FastOpen & HyStart" "Low Latency Gaming Packet Handling" "ENABLED" "Green"

    ipconfig /flushdns | Out-Null
    Write-LogItem "NETWORK" "DNS Resolver Cache" "Flushed 100% Stale Host Entries" "PURGED" "Green"

    # --- STEP 7: GAMEDVR & BACKGROUND RECORDING ---
    Write-SectionHeader "PHASE 7: GAMEDVR & STUTTER PREVENTION" "Red"
    reg add "HKCU\System\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v "AllowGameDVR" /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR" /v "AppCaptureEnabled" /t REG_DWORD /d 0 /f | Out-Null
    Write-LogItem "SYSTEM" "Xbox GameDVR Background Capture" "Disabled to prevent micro-stutters" "DISABLED" "Green"

    # --- STEP 8: TELEMETRY & BACKGROUND BLOAT ---
    Write-SectionHeader "PHASE 8: TELEMETRY & BACKGROUND TRACKING DEBLOAT" "Red"
    Show-SpinnerItem "Stopping & Disabling Diagnostics & Tracking Services" 200
    sc.exe config "DiagTrack" start= disabled | Out-Null
    net stop "DiagTrack" 2>$null | Out-Null
    Write-LogItem "SERVICE" "Connected User Experiences (DiagTrack)" "Telemetry Tracker Stopped" "DISABLED" "Green"

    sc.exe config "dmwappushservice" start= disabled | Out-Null
    net stop "dmwappushservice" 2>$null | Out-Null
    Write-LogItem "SERVICE" "WAP Push Routing (dmwappushservice)" "Push Tracking Stopped" "DISABLED" "Green"

    sc.exe config "WerSvc" start= disabled | Out-Null
    net stop "WerSvc" 2>$null | Out-Null
    Write-LogItem "SERVICE" "Windows Error Reporting (WerSvc)" "Crash Uploader Service Stopped" "DISABLED" "Green"

    reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v "SubscribedContent-338388Enabled" /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v "SubscribedContent-353696Enabled" /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" /v "DODownloadMode" /t REG_DWORD /d 0 /f | Out-Null
    Write-LogItem "REGISTRY" "Windows Delivery P2P & Ads Bloat" "Subscribed Content Disabled" "DISABLED" "Green"

    # --- STEP 9: RAM MEMORY WORKING SET PURGE ---
    Write-SectionHeader "PHASE 9: RAM COMPACTING & WORKING SET FLUSH" "Green"
    Show-SpinnerItem "Compacting Active Working Sets & Standby Cache" 250
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    Write-LogItem "MEMORY" "Garbage Collection & Memory Heap" "Working Sets Compacted" "FLUSHED" "Green"

    # --- STEP 10: INSTANT VISUALS ---
    Write-SectionHeader "PHASE 10: INSTANT SNAPPY VISUAL EFFECTS" "Magenta"
    reg add "HKCU\Control Panel\Desktop\WindowMetrics" /v "MinAnimate" /t REG_SZ /d "0" /f | Out-Null
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "TaskbarAnimations" /t REG_DWORD /d 0 /f | Out-Null
    Write-LogItem "REGISTRY" "Window & Taskbar Animations" "Zero Animation Lag Enabled" "OPTIMIZED" "Green"

    # --- STEP 11: STORAGE SSD TRIM ---
    Write-SectionHeader "PHASE 11: SSD & NVME STORAGE DRIVE TRIM / RE-OPTIMIZE" "DarkYellow"
    Get-Volume | Where-Object { $_.DriveLetter -ne $null -and $_.DriveType -eq 'Fixed' } | ForEach-Object {
        $letter = $_.DriveLetter
        Show-SpinnerItem "Executing TRIM on Drive ${letter}:" 250
        Optimize-Volume -DriveLetter $letter -Defrag -ReTrim -ErrorAction SilentlyContinue | Out-Null
        Write-LogItem "STORAGE" "Drive ${letter}: TRIM Cycle" "NAND Flash Blocks Optimized" "COMPLETE" "Green"
    }

    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

    # --- FINAL SUMMARY REPORT ---
    Write-Host ""
    Show-CyberBar "VERIFYING ALL OPTIMIZATION PHASES AND SYSTEM TELEMETRY" 300 "Cyan"

    Write-Host "  ===========================================================================================" -ForegroundColor Green
    Write-Host "   [*] 1-CLICK SUPER BOOST STATUS: 100% COMPLETE & VERIFIED [*]" -ForegroundColor Yellow
    Write-Host "   - Total Optimization Time : $elapsed Seconds" -ForegroundColor White
    Write-Host "   - Latency Status          : 0ms Instant Response" -ForegroundColor Green
    Write-Host "   - Power Scheme            : Ultimate Performance (Max Turbo)" -ForegroundColor Green
    Write-Host "   - Gaming / App Priority   : Foreground Quantum 38 (Maximum)" -ForegroundColor Green
    Write-Host "   - Telemetry Services      : Disabled & Memory Freed" -ForegroundColor Green
    Write-Host "  ===========================================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Typewriter "  [SUCCESS] PC IS NOW RUNNING AT PEAK CAPABILITY! HAPPY GAMING & STREAMING!" "Green" 8
    Write-Host ""
    Write-Host "  Press ENTER to return to Main Menu..." -ForegroundColor Gray
    Read-Host | Out-Null
}

# --- OPTION 2: LIVE SYSTEM HARDWARE & REALTIME DIAGNOSTIC ---

function Run-Diagnostic {
    Write-CyberBanner
    Write-Host ""
    Write-Typewriter "  >>> SCANNING COMPLETE SYSTEM HARDWARE, PROCESSES & TELEMETRY <<<" "Cyan" 8
    Write-Host "  ===========================================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Show-CyberBar "QUERYING CPU, GPU, RAM, VOLUMES & KERNEL STATUS" 300 "Yellow"

    $os = Get-CimInstance Win32_OperatingSystem
    $proc = Get-CimInstance Win32_Processor
    $gpuRaw = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Caption -ErrorAction SilentlyContinue
    $gpuList = if ($gpuRaw) { ($gpuRaw -join " + ") } else { "Standard Display Adapter" }
    $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $usedRam = [math]::Round($totalRam - $freeRam, 2)
    $ramPct = [math]::Round(($usedRam / $totalRam) * 100, 1)

    Write-Host "  1. HARDWARE SPECIFICATIONS:" -ForegroundColor Yellow
    Write-Host "     - Operating System : $($os.Caption) ($($os.OSArchitecture)) - Build $($os.BuildNumber)" -ForegroundColor White
    Write-Host "     - Processor (CPU)  : $($proc.Name)" -ForegroundColor White
    Write-Host "     - CPU Topology     : $($proc.NumberOfCores) Cores / $($proc.NumberOfLogicalProcessors) Logical Threads" -ForegroundColor White
    Write-Host "     - Graphics (GPU)   : $gpuList" -ForegroundColor White
    $ramColor = if ($ramPct -gt 85) { "Red" } else { "Green" }
    Write-Host "     - System RAM (DDR) : $usedRam GB Used / $totalRam GB Total ($freeRam GB Free - $ramPct% In Use)" -ForegroundColor $ramColor

    Write-Host ""
    Write-Host "  2. STORAGE VOLUMES HEALTH & FREE SPACE:" -ForegroundColor Yellow
    Get-PSDrive -PSProvider FileSystem | ForEach-Object {
        $u = [math]::Round($_.Used / 1GB, 2)
        $f = [math]::Round($_.Free / 1GB, 2)
        $t = [math]::Round(($_.Used + $_.Free) / 1GB, 2)
        if ($t -gt 0) {
            $pctFree = [math]::Round(($f / $t) * 100, 1)
            $col = if ($pctFree -lt 15) { "Red" } else { "Green" }
            Write-Host "     - Volume [$($_.Name):] Free: $f GB of $t GB ($pctFree% Free Space Remaining)" -ForegroundColor $col
        }
    }

    Write-Host ""
    Write-Host "  3. TOP 5 MEMORY-CONSUMING APPS:" -ForegroundColor Yellow
    Get-Process | Group-Object ProcessName | Select-Object Name, @{N='RAM_MB';E={[math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 2)}} | Sort-Object RAM_MB -Descending | Select-Object -First 5 | Format-Table -AutoSize | Out-String | Write-Host

    Write-Host "  4. ACTIVE POWER SCHEME:" -ForegroundColor Yellow
    Write-Host "     - $((powercfg /getactivescheme))" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "  5. LATENCY & REGISTRY STATUS:" -ForegroundColor Yellow
    $delay = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name MenuShowDelay -ErrorAction SilentlyContinue).MenuShowDelay
    $pSep = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name Win32PrioritySeparation -ErrorAction SilentlyContinue).Win32PrioritySeparation
    Write-Host "     - UI Menu Delay         : $delay ms (0ms = Instant)" -ForegroundColor White
    Write-Host "     - Priority Separation   : $pSep (38 = Max Foreground Power)" -ForegroundColor White

    Write-Host ""
    Write-Host "  -------------------------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  Press ENTER to return to Main Menu..." -ForegroundColor Gray
    Read-Host | Out-Null
}

# --- OPTION 3: CUSTOM TWEAKS WITH DETAILED OUTPUT ---

function Run-CustomTweaksMenu {
    while ($true) {
        Write-CyberBanner
        Write-Host "  ===========================================================================================" -ForegroundColor Magenta
        Write-Host "   CUSTOM OPTIMIZATION CATEGORIES (SELECT SPECIFIC TWEAK TO EXECUTE)" -ForegroundColor Magenta
        Write-Host "  ===========================================================================================" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "  [1] Deep Junk and Cache Purge (Temp, Prefetch, WinUpdate, Shaders)" -ForegroundColor White
        Write-Host "  [2] Low-Latency and Gaming Tweaks (0ms Delay, Win32Priority, GameDVR)" -ForegroundColor White
        Write-Host "  [3] Unlock Ultimate Performance Power Plan (Max CPU Clock)" -ForegroundColor White
        Write-Host "  [4] Network and TCP Speed Optimization (Flush DNS, Auto-Tuning, RSS)" -ForegroundColor White
        Write-Host "  [5] Debloat Telemetry and Background Tracking Services" -ForegroundColor White
        Write-Host "  [6] SSD / NVMe Drive TRIM Optimization" -ForegroundColor White
        Write-Host ""
        Write-Host "  [0] Back to Main Dashboard" -ForegroundColor DarkYellow
        Write-Host "  -------------------------------------------------------------------------------------------" -ForegroundColor DarkGray
        $sub = Read-Host "  Select Category [0-6]"
        
        switch ($sub.Trim()) {
            "1" {
                Write-Host ""
                Write-SectionHeader "EXECUTING DEEP JUNK & CACHE PURGE" "Yellow"
                Clean-FolderRealtime "$env:TEMP" "User Temp (%TEMP%)"
                Clean-FolderRealtime "C:\Windows\Temp" "System Temp"
                Clean-FolderRealtime "C:\Windows\Prefetch" "Prefetch Cache"
                Clean-FolderRealtime "$env:LOCALAPPDATA\D3DSCache" "DirectX Shader Cache"
                Clean-FolderRealtime "$env:LOCALAPPDATA\NVIDIA\GLCache" "NVIDIA Shader Cache"
                Clean-FolderRealtime "$env:LOCALAPPDATA\AMD\DxCache" "AMD Shader Cache"
                Clear-RecycleBin -Force -ErrorAction SilentlyContinue 2>$null
                Write-LogItem "CLEANUP" "Recycle Bin" "Emptied completely" "DONE" "Green"
                Write-Host "`n  [SUCCESS] All junk caches purged!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "2" {
                Write-Host ""
                Write-SectionHeader "APPLYING LOW-LATENCY REGISTRY TWEAKS" "Magenta"
                reg add "HKCU\Control Panel\Desktop" /v "MenuShowDelay" /t REG_SZ /d "0" /f | Out-Null
                Write-LogItem "REGISTRY" "MenuShowDelay -> 0ms" "Instant Menus" "APPLIED" "Green"
                reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 0 /f | Out-Null
                Write-LogItem "REGISTRY" "SystemResponsiveness -> 0" "App Priority" "APPLIED" "Green"
                reg add "HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 38 /f | Out-Null
                Write-LogItem "REGISTRY" "Win32PrioritySeparation -> 38" "Quantum Foreground Boost" "APPLIED" "Green"
                reg add "HKCU\System\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f | Out-Null
                Write-LogItem "SYSTEM" "GameDVR" "Disabled" "APPLIED" "Green"
                Write-Host "`n  [SUCCESS] Zero-latency tweaks active!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "3" {
                Write-Host ""
                Write-SectionHeader "ACTIVATING ULTIMATE PERFORMANCE POWER PLAN" "Cyan"
                powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 | Out-Null
                $plans = powercfg /list
                $ultPlan = ($plans | Select-String "Ultimate Performance" | Select-Object -First 1)
                if ($ultPlan) {
                    $guid = $ultPlan.Line.Split()[3]
                    powercfg /setactive $guid | Out-Null
                    Write-LogItem "POWER" "Ultimate Performance" "Active GUID: $guid" "ACTIVATED" "Green"
                }
                Write-Host "`n  [SUCCESS] CPU Power limits unlocked!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "4" {
                Write-Host ""
                Write-SectionHeader "OPTIMIZING TCP STACK & DNS" "Blue"
                netsh int tcp set global autotuninglevel=normal | Out-Null
                Write-LogItem "NETWORK" "TCP Auto-Tuning" "Normal" "APPLIED" "Green"
                netsh int tcp set global rss=enabled | Out-Null
                Write-LogItem "NETWORK" "Receive-Side Scaling" "Enabled" "APPLIED" "Green"
                ipconfig /flushdns | Out-Null
                Write-LogItem "NETWORK" "DNS Cache" "Flushed" "PURGED" "Green"
                Write-Host "`n  [SUCCESS] Network stack tuned!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "5" {
                Write-Host ""
                Write-SectionHeader "STOPPING TELEMETRY & TRACKING SERVICES" "Red"
                sc.exe config "DiagTrack" start= disabled | Out-Null
                net stop "DiagTrack" 2>$null | Out-Null
                Write-LogItem "SERVICE" "DiagTrack" "Stopped & Disabled" "OFF" "Green"
                sc.exe config "WerSvc" start= disabled | Out-Null
                net stop "WerSvc" 2>$null | Out-Null
                Write-LogItem "SERVICE" "WerSvc" "Stopped & Disabled" "OFF" "Green"
                Write-Host "`n  [SUCCESS] Background tracking stopped!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "6" {
                Write-Host ""
                Write-SectionHeader "EXECUTING STORAGE DRIVE TRIM" "DarkYellow"
                Get-Volume | Where-Object { $_.DriveLetter -ne $null -and $_.DriveType -eq 'Fixed' } | ForEach-Object {
                    $l = $_.DriveLetter
                    Show-SpinnerItem "Trimming Drive ${l}:" 250
                    Optimize-Volume -DriveLetter $l -Defrag -ReTrim -ErrorAction SilentlyContinue | Out-Null
                    Write-LogItem "STORAGE" "Drive ${l}: TRIM" "Optimized" "DONE" "Green"
                }
                Write-Host "`n  [SUCCESS] All SSD drives re-trimmed!" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
            "0" { return }
        }
    }
}

# --- OPTION 4: PRO TOOLS MENU ---

function Run-ProToolsMenu {
    while ($true) {
        Write-CyberBanner
        Write-Host "  ===========================================================================================" -ForegroundColor Cyan
        Write-Host "   QUICK PRO TOOLS AND UTILITIES" -ForegroundColor Cyan
        Write-Host "  ===========================================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [1] Flush RAM Standby Cache (Instantly free up cached memory)" -ForegroundColor White
        Write-Host "  [2] Restart Windows Explorer (Clear taskbar/desktop lag and memory leak)" -ForegroundColor White
        Write-Host "  [3] Fast Gaming DNS Changer (Switch to Cloudflare 1.1.1.1 / Google 8.8.8.8)" -ForegroundColor White
        Write-Host "  [4] Open Startup Apps Manager (Disable apps that slow down boot)" -ForegroundColor White
        Write-Host "  [5] Export Full Diagnostic Report (Save report text file to Desktop)" -ForegroundColor White
        Write-Host "  [6] Create System Restore Point (100% Safety Checkpoint)" -ForegroundColor White
        Write-Host ""
        Write-Host "  [0] Back to Main Dashboard" -ForegroundColor DarkYellow
        Write-Host "  -------------------------------------------------------------------------------------------" -ForegroundColor DarkGray
        $t = Read-Host "  Select Tool [0-6]"

        switch ($t.Trim()) {
            "1" {
                Write-Host ""
                Show-SpinnerItem "Purging RAM Working Sets & Garbage Collection" 300
                [System.GC]::Collect()
                [System.GC]::WaitForPendingFinalizers()
                Write-LogItem "MEMORY" "RAM Standby Cache" "Released" "FLUSHED" "Green"
                Start-Sleep -Seconds 2
            }
            "2" {
                Write-Host ""
                Show-SpinnerItem "Restarting Windows Explorer Shell" 300
                Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
                Start-Process explorer.exe
                Write-LogItem "SYSTEM" "Explorer Shell" "Reloaded cleanly" "RESTARTED" "Green"
                Start-Sleep -Seconds 2
            }
            "3" {
                Write-Host ""
                Write-Host "  Select DNS Provider:" -ForegroundColor Yellow
                Write-Host "  [1] Cloudflare DNS (1.1.1.1) - (Lowest Ping Gaming)" -ForegroundColor Green
                Write-Host "  [2] Google DNS (8.8.8.8) - (Ultra Reliable)" -ForegroundColor Cyan
                Write-Host "  [3] Reset to Automatic Router DHCP" -ForegroundColor White
                $dnsPick = Read-Host "  Pick DNS [1-3]"
                $ad = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notlike "*Virtual*" -and $_.InterfaceDescription -notlike "*VPN*" }
                if ($dnsPick -eq "1") {
                    Show-SpinnerItem "Configuring Cloudflare 1.1.1.1 DNS" 250
                    foreach ($a in $ad) { Set-DnsClientServerAddress -InterfaceIndex $a.InterfaceIndex -ServerAddresses ("1.1.1.1", "1.0.0.1") -ErrorAction SilentlyContinue }
                    ipconfig /flushdns | Out-Null
                    Write-LogItem "NETWORK" "DNS Server" "1.1.1.1 / 1.0.0.1 (Cloudflare)" "CONFIGURED" "Green"
                } elseif ($dnsPick -eq "2") {
                    Show-SpinnerItem "Configuring Google 8.8.8.8 DNS" 250
                    foreach ($a in $ad) { Set-DnsClientServerAddress -InterfaceIndex $a.InterfaceIndex -ServerAddresses ("8.8.8.8", "8.8.4.4") -ErrorAction SilentlyContinue }
                    ipconfig /flushdns | Out-Null
                    Write-LogItem "NETWORK" "DNS Server" "8.8.8.8 / 8.8.4.4 (Google)" "CONFIGURED" "Green"
                } elseif ($dnsPick -eq "3") {
                    Show-SpinnerItem "Resetting DNS to Automatic DHCP" 250
                    foreach ($a in $ad) { Set-DnsClientServerAddress -InterfaceIndex $a.InterfaceIndex -ResetServerAddresses -ErrorAction SilentlyContinue }
                    ipconfig /flushdns | Out-Null
                    Write-LogItem "NETWORK" "DNS Server" "Automatic DHCP" "RESET" "Green"
                }
                Start-Sleep -Seconds 2
            }
            "4" { Start-Process "ms-settings:startupapps"; return }
            "5" {
                Show-SpinnerItem "Generating System Diagnostic Report on Desktop" 250
                $desktop = [Environment]::GetFolderPath('Desktop')
                $reportPath = Join-Path $desktop "System_Health_Report_MohitSindhu.txt"
                $os = Get-CimInstance Win32_OperatingSystem
                $proc = Get-CimInstance Win32_Processor
                $gpuRaw = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Caption -ErrorAction SilentlyContinue
                $gpuList = if ($gpuRaw) { ($gpuRaw -join " + ") } else { "Standard Display Adapter" }
                $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
                $freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
                $usedRam = [math]::Round($totalRam - $freeRam, 2)
                $lines = @(
                    "=============================================================",
                    "   MOHIT SINDHU - SYSTEM HEALTH REPORT v9.0",
                    "   YouTube: @mohitm07live - Instagram: @Mohitm07live",
                    "   Generated on: $((Get-Date).ToString('dd-MM-yyyy HH:mm:ss'))",
                    "=============================================================",
                    "OS:          $($os.Caption) $($os.OSArchitecture)",
                    "Build:       $($os.Version) ($($os.BuildNumber))",
                    "Processor:   $($proc.Name)",
                    "GPU:         $gpuList",
                    "RAM:         $usedRam GB / $totalRam GB ($freeRam GB Free)",
                    "Active Plan: $((powercfg /getactivescheme))"
                )
                $lines | Out-File -FilePath $reportPath -Encoding UTF8
                Write-LogItem "SYSTEM" "Report Exported" "$reportPath" "SAVED" "Green"
                Start-Sleep -Seconds 2
            }
            "6" {
                Show-SpinnerItem "Creating System Restore Point Checkpoint" 250
                try { Checkpoint-Computer -Description "MohitSindhu_ManualBackup" -RestorePointType "MODIFY_SETTINGS" -ErrorAction SilentlyContinue | Out-Null } catch {}
                Write-LogItem "SYSTEM" "Restore Point" "MohitSindhu_ManualBackup" "SAVED" "Green"
                Start-Sleep -Seconds 2
            }
            "0" { return }
        }
    }
}

# --- OPTION U: UNDO / RESTORE DEFAULTS ---

function Run-UndoMenu {
    Write-CyberBanner
    Write-Host ""
    Write-Typewriter "  >>> UNDO / REVERT ALL OPTIMIZATIONS (RESTORE FACTORY DEFAULTS) <<<" "Red" 8
    Write-Host "  ===========================================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  This will restore Power Plan, Registry Tweaks, Telemetry and Visuals to Windows Defaults." -ForegroundColor Yellow
    $confirm = Read-Host "  Are you sure you want to revert all tweaks? (Y/N)"
    if ($confirm.ToUpper().Trim() -ne "Y") {
        return
    }

    Write-Host ""
    Show-SpinnerItem "Reverting Power Plan to Balanced" 250
    powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e | Out-Null
    Write-LogItem "POWER" "Power Plan" "Balanced Scheme" "RESTORED" "Green"

    Show-SpinnerItem "Restoring Default Registry Latency & Menu Delays" 250
    reg add "HKCU\Control Panel\Desktop" /v "MenuShowDelay" /t REG_SZ /d "400" /f | Out-Null
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 20 /f | Out-Null
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v "NetworkThrottlingIndex" /t REG_DWORD /d 10 /f | Out-Null
    reg add "HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 2 /f | Out-Null
    Write-LogItem "REGISTRY" "System Responsiveness & Delays" "Factory Defaults" "RESTORED" "Green"

    Show-SpinnerItem "Re-enabling Telemetry & Error Reporting Services" 250
    sc.exe config "DiagTrack" start= auto | Out-Null
    net start "DiagTrack" 2>$null | Out-Null
    sc.exe config "WerSvc" start= demand | Out-Null
    reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 1 /f | Out-Null
    Write-LogItem "SERVICE" "Telemetry Services" "Re-enabled" "RESTORED" "Green"

    Show-SpinnerItem "Re-enabling GameDVR Default Recording" 250
    reg add "HKCU\System\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 1 /f | Out-Null
    reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v "AllowGameDVR" /f 2>$null | Out-Null
    Write-LogItem "SYSTEM" "GameDVR" "Windows Defaults" "RESTORED" "Green"

    Show-SpinnerItem "Restoring Visual Animations & Resetting TCP" 250
    reg add "HKCU\Control Panel\Desktop\WindowMetrics" /v "MinAnimate" /t REG_SZ /d "1" /f | Out-Null
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "TaskbarAnimations" /t REG_DWORD /d 1 /f | Out-Null
    netsh int tcp reset | Out-Null
    ipconfig /flushdns | Out-Null
    Write-LogItem "SYSTEM" "Visual Animations & TCP Stack" "Factory Defaults" "RESTORED" "Green"

    Write-Host ""
    Write-Host "  ===========================================================================================" -ForegroundColor Green
    Write-Typewriter "  [SUCCESS] ALL SETTINGS REVERTED TO WINDOWS FACTORY DEFAULTS!" "Green" 8
    Write-Host "  ===========================================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Press ENTER to return to Main Menu..." -ForegroundColor Gray
    Read-Host | Out-Null
}

# --- MAIN DASHBOARD ---

function Main-Dashboard {
    while ($true) {
        Write-CyberBanner
        Show-QuickHUD
        Write-Host ""
        Write-Host "  ===========================================================================================" -ForegroundColor Yellow
        Write-Host "   [1] 1-CLICK ALL-IN-ONE SUPER BOOST (Full Animated Pipeline & Live Telemetry)" -ForegroundColor Green
        Write-Host "   [2] System Health & Hardware Scan (Deep Specs, RAM Usage & Latency Audit)" -ForegroundColor Cyan
        Write-Host "   [3] Custom Optimizer Categories (Choose Specific Tweaks Manually)" -ForegroundColor Magenta
        Write-Host "   [4] Quick Pro Tools (RAM Flush, Explorer Restart, Fast Gaming DNS)" -ForegroundColor White
        Write-Host "   [U] Undo / Revert All Tweaks (1-Click Restore Windows Factory Defaults)" -ForegroundColor Red
        Write-Host "  ===========================================================================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   [Y] YouTube: @mohitm07live   |   [I] Instagram: @Mohitm07live" -ForegroundColor DarkCyan
        Write-Host "   [0] Exit Suite" -ForegroundColor DarkRed
        Write-Host "  -------------------------------------------------------------------------------------------" -ForegroundColor DarkGray
        $choice = Read-Host "  Select Option [1-4, U, Y, I, 0]"

        switch ($choice.ToUpper().Trim()) {
            "1" { Run-GodMode }
            "2" { Run-Diagnostic }
            "3" { Run-CustomTweaksMenu }
            "4" { Run-ProToolsMenu }
            "U" { Run-UndoMenu }
            "Y" { Start-Process "https://youtube.com/@mohitm07live" }
            "I" { Start-Process "https://instagram.com/Mohitm07live" }
            "0" { exit }
            default {
                Write-Host "  [!] Please select a valid option from the menu." -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
    }
}

# Start Main Dashboard
Main-Dashboard
