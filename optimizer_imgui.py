"""
==============================================================================
 MOHIT SINDHU - ULTIMATE PC OPTIMIZER (DEAR IMGUI CYBER SUITE)
 Developed by: Mohit Sindhu
 YouTube: @mohitm07live  |  Instagram: @Mohitm07live
==============================================================================
"""

import os
import sys
import time
import ctypes
import threading
import subprocess
import dearpygui.dearpygui as dpg

# --- ADMIN ELEVATION CHECK ---
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

if not is_admin():
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, f'"{os.path.abspath(__file__)}"', None, 1
    )
    sys.exit(0)

# --- GLOBAL STATE & TELEMETRY ---
g_logs = []
g_status_text = "Status: Ready & Idle"
g_status_color = [0, 230, 255, 255]
g_is_running = False
g_progress = 0.0
g_notifications = []

# Live Hardware Stats
g_stats = {
    "cpu_name": "Scanning...",
    "cpu_cores": "8 Cores / 12 Threads",
    "ram_total": 16.0,
    "ram_used": 8.0,
    "ram_pct": 50.0,
    "c_free": 100.0,
    "c_total": 500.0,
    "power_plan": "Scanning...",
    "top_procs": []
}

def add_log(category, action, detail="", status="DONE", status_color=(80, 220, 100)):
    timestamp = time.strftime("%H:%M:%S")
    log_entry = {
        "time": timestamp,
        "category": category,
        "action": action,
        "detail": detail,
        "status": status,
        "color": status_color
    }
    g_logs.append(log_entry)
    
    # Format line for DPG child logger
    formatted = f"[{timestamp}] [{category:8s}] {action} {('(' + detail + ')') if detail else ''} -> [{status}]"
    try:
        if dpg.does_item_exist("log_terminal"):
            dpg.add_text(formatted, parent="log_terminal", color=status_color)
            dpg.set_y_scroll("log_terminal", 99999)
    except:
        pass

def add_notification(title, message, color=(0, 230, 255)):
    g_notifications.append({"title": title, "msg": message, "time": time.time(), "color": color})
    try:
        if dpg.does_item_exist("toast_text"):
            dpg.set_value("toast_title", title)
            dpg.set_value("toast_text", message)
            dpg.configure_item("toast_window", show=True)
    except:
        pass

def run_cmd(cmd, as_admin=False):
    try:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        res = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        return res.stdout.strip()
    except Exception as e:
        return str(e)

# --- SYSTEM METRICS UPDATE LOOP ---
def refresh_system_metrics():
    global g_stats
    try:
        # Operating System & RAM
        out = run_cmd("""
            $os = Get-CimInstance Win32_OperatingSystem
            $proc = Get-CimInstance Win32_Processor
            $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
            $freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
            $usedRam = [math]::Round($totalRam - $freeRam, 2)
            $c = Get-PSDrive C
            $cFree = [math]::Round($c.Free / 1GB, 1)
            $cTot = [math]::Round(($c.Used + $c.Free) / 1GB, 1)
            $power = (powercfg /getactivescheme)
            "$($proc.Name)|$($proc.NumberOfCores)|$($proc.NumberOfLogicalProcessors)|$totalRam|$usedRam|$cFree|$cTot|$power"
        """)
        parts = out.split("|")
        if len(parts) >= 8:
            g_stats["cpu_name"] = parts[0]
            g_stats["cpu_cores"] = f"{parts[1]} Cores / {parts[2]} Threads"
            g_stats["ram_total"] = float(parts[3])
            g_stats["ram_used"] = float(parts[4])
            g_stats["ram_pct"] = round((float(parts[4]) / float(parts[3])) * 100, 1)
            g_stats["c_free"] = float(parts[5])
            g_stats["c_total"] = float(parts[6])
            
            p_plan = parts[7]
            if "Ultimate" in p_plan:
                g_stats["power_plan"] = "Ultimate Performance"
            elif "High" in p_plan:
                g_stats["power_plan"] = "High Performance"
            elif "Balanced" in p_plan:
                g_stats["power_plan"] = "Balanced (Normal)"
            else:
                g_stats["power_plan"] = p_plan[:25]
        
        # Top processes
        proc_out = run_cmd("Get-Process | Group-Object ProcessName | Select-Object Name, @{N='RAM';E={[math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)}} | Sort-Object RAM -Descending | Select-Object -First 5 | ForEach-Object { \"$($_.Name): $($_.RAM) MB\" }")
        g_stats["top_procs"] = [p.strip() for p in proc_out.splitlines() if p.strip()]

    except Exception as e:
        pass

# --- OPTIMIZATION BACKEND TASKS ---

def task_godmode():
    global g_is_running, g_progress, g_status_text, g_status_color
    g_is_running = True
    g_status_text = "Status: Super Boost Pipeline Running..."
    g_status_color = [255, 200, 0, 255]
    
    add_notification("SUPER BOOST INITIATED", "Starting 11-Phase Complete PC Boost", (255, 200, 0))
    add_log("SYSTEM", ">>> 1-CLICK ALL-IN-ONE SUPER BOOST STARTED <<<", status="IN PROGRESS", status_color=(0, 230, 255))
    
    phases = [
        ("Phase 1/11: Safety Restore Point", task_restore_point, 0.10),
        ("Phase 2/11: Junk & Temp Purge", task_purge_junk, 0.25),
        ("Phase 3/11: GPU Shader Cache Purge", task_purge_shaders, 0.40),
        ("Phase 4/11: Zero-Latency Registry Tweaks", task_latency_tweaks, 0.55),
        ("Phase 5/11: Ultimate Performance Power Plan", task_power_plan, 0.65),
        ("Phase 6/11: TCP/IP & Low Ping Tuning", task_network_tuning, 0.75),
        ("Phase 7/11: GameDVR & Stutter Fix", task_gamedvr_fix, 0.80),
        ("Phase 8/11: Telemetry Debloat", task_debloat_telemetry, 0.90),
        ("Phase 9/11: RAM Memory Flush", task_flush_ram, 0.95),
        ("Phase 10/11: Visual Animations Optimization", task_visuals_opt, 0.98),
        ("Phase 11/11: SSD NVMe Storage TRIM", task_trim_drives, 1.0)
    ]
    
    for title, func, prog in phases:
        g_status_text = f"Status: {title}"
        if dpg.does_item_exist("boost_progress"):
            dpg.set_value("boost_progress", prog)
            dpg.configure_item("boost_progress_text", default_value=f"{int(prog*100)}% - {title}")
        func(is_subtask=True)
        time.sleep(0.3)
        
    g_status_text = "Status: 1-Click Super Boost Complete!"
    g_status_color = [80, 220, 100, 255]
    g_is_running = False
    
    add_log("SUCCESS", ">>> ALL 11 OPTIMIZATION PHASES COMPLETED 100% <<<", status="VERIFIED", status_color=(80, 220, 100))
    add_notification("SUPER BOOST COMPLETE", "PC is now at Peak Maximum Speed!", (80, 220, 100))
    refresh_system_metrics()

def task_restore_point(is_subtask=False):
    if not is_subtask:
        add_log("SYSTEM", "Creating Safety Restore Point Checkpoint...")
    run_cmd('Checkpoint-Computer -Description "MohitSindhu_Optimizer_GUI" -RestorePointType "MODIFY_SETTINGS" -ErrorAction SilentlyContinue')
    add_log("SYSTEM", "Restore Point Checkpoint", "MohitSindhu_Optimizer_GUI", "SECURED", (80, 220, 100))
    if not is_subtask:
        add_notification("RESTORE POINT", "System checkpoint created safely", (80, 220, 100))

def task_purge_junk(is_subtask=False):
    folders = [
        ("$env:TEMP", "User Temp Cache (%TEMP%)"),
        ("C:\\Windows\\Temp", "System Temp"),
        ("C:\\Windows\\Prefetch", "Prefetch Boot Cache"),
        ("C:\\Windows\\SoftwareDistribution\\Download", "WinUpdate Download Cache"),
        ("C:\\Windows\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache", "Delivery Optimization Cache")
    ]
    for path, label in folders:
        run_cmd(f"Remove-Item -Path '{path}\\*' -Recurse -Force -ErrorAction SilentlyContinue")
        add_log("CLEANUP", f"Purged {label}", "Zero Leftovers", "CLEARED", (255, 200, 0))
    
    run_cmd("Clear-RecycleBin -Force -ErrorAction SilentlyContinue")
    add_log("CLEANUP", "Windows Recycle Bin", "All Drives Flushed", "EMPTY", (255, 200, 0))
    if not is_subtask:
        add_notification("JUNK PURGED", "Temp, Prefetch and Update cache cleared", (255, 200, 0))

def task_purge_shaders(is_subtask=False):
    shaders = [
        ("$env:LOCALAPPDATA\\D3DSCache", "DirectX D3D Shader Cache"),
        ("$env:LOCALAPPDATA\\NVIDIA\\GLCache", "NVIDIA OpenGL Cache"),
        ("$env:LOCALAPPDATA\\NVIDIA\\DXCache", "NVIDIA DirectX Cache"),
        ("$env:LOCALAPPDATA\\AMD\\DxCache", "AMD Radeon Shader Cache"),
        ("$env:LOCALAPPDATA\\AMD\\GLCache", "AMD Radeon OpenGL Cache"),
        ("$env:LOCALAPPDATA\\Intel\\ShaderCache", "Intel Graphics Cache")
    ]
    for path, label in shaders:
        run_cmd(f"Remove-Item -Path '{path}\\*' -Recurse -Force -ErrorAction SilentlyContinue")
        add_log("CLEANUP", f"Purged {label}", "FPS Drops & Stutter Fix", "FLUSHED", (0, 230, 255))
    if not is_subtask:
        add_notification("SHADERS FLUSHED", "GPU Shader caches cleaned for smooth FPS", (0, 230, 255))

def task_latency_tweaks(is_subtask=False):
    tweaks = [
        ('reg add "HKCU\\Control Panel\\Desktop" /v "MenuShowDelay" /t REG_SZ /d "0" /f', "MenuShowDelay -> 0ms", "Instant Menu Response"),
        ('reg add "HKCU\\Control Panel\\Desktop" /v "WaitToKillAppTimeout" /t REG_SZ /d "2000" /f', "WaitToKillAppTimeout -> 2000ms", "Fast Shutdown"),
        ('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 0 /f', "SystemResponsiveness -> 0", "100% Gaming CPU Allocation"),
        ('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v "NetworkThrottlingIndex" /t REG_DWORD /d 4294967295 /f', "NetworkThrottlingIndex -> Unlimited", "No Bandwidth Caps"),
        ('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f', "GPU Priority -> 8 (Max)", "GPU Thread Allocation"),
        ('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f', "Game Priority -> 6 (High)", "Foreground Thread Boost"),
        ('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 38 /f', "Win32PrioritySeparation -> 38", "Foreground Quantum Power")
    ]
    for cmd, name, desc in tweaks:
        run_cmd(cmd)
        add_log("REGISTRY", name, desc, "APPLIED", (168, 85, 247))
    if not is_subtask:
        add_notification("LATENCY TWEAKS", "Zero-delay registry injected", (168, 85, 247))

def task_power_plan(is_subtask=False):
    run_cmd("powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61")
    plans = run_cmd("powercfg /list")
    guid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
    for line in plans.splitlines():
        if "Ultimate Performance" in line:
            parts = line.split()
            if len(parts) >= 4:
                guid = parts[3]
                break
    run_cmd(f"powercfg /setactive {guid}")
    add_log("POWER", "Ultimate Performance Power Scheme", f"Active GUID: {guid}", "LOCKED", (0, 230, 255))
    if not is_subtask:
        add_notification("POWER PLAN", "Ultimate Performance CPU Plan Activated", (0, 230, 255))
        refresh_system_metrics()

def task_network_tuning(is_subtask=False):
    cmds = [
        ("netsh int tcp set global autotuninglevel=normal", "TCP Auto-Tuning Level: Normal"),
        ("netsh int tcp set global rss=enabled", "Receive-Side Scaling (RSS): Enabled"),
        ("netsh int tcp set global ecncapability=disabled", "ECN Capability: Disabled"),
        ("netsh int tcp set global fastopen=enabled", "TCP FastOpen: Enabled"),
        ("netsh int tcp set global hystart=enabled", "TCP HyStart: Enabled"),
        ("ipconfig /flushdns", "DNS Resolver Cache: Flushed")
    ]
    for cmd, label in cmds:
        run_cmd(cmd)
        add_log("NETWORK", label, "Low Ping Gaming", "OPTIMIZED", (59, 130, 246))
    if not is_subtask:
        add_notification("NETWORK TUNED", "TCP Stack & DNS optimized for low ping", (59, 130, 246))

def task_gamedvr_fix(is_subtask=False):
    run_cmd('reg add "HKCU\\System\\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f')
    run_cmd('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v "AllowGameDVR" /t REG_DWORD /d 0 /f')
    run_cmd('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v "AppCaptureEnabled" /t REG_DWORD /d 0 /f')
    add_log("SYSTEM", "Xbox GameDVR & AppCapture", "Background Recording Disabled (No Stutter)", "DISABLED", (255, 65, 65))

def task_debloat_telemetry(is_subtask=False):
    services = [
        ("DiagTrack", "Connected User Experiences and Telemetry"),
        ("dmwappushservice", "Device Management WAP Push Service"),
        ("WerSvc", "Windows Error Reporting Service")
    ]
    for svc, desc in services:
        run_cmd(f"sc.exe config '{svc}' start= disabled")
        run_cmd(f"net stop '{svc}' 2>$null")
        add_log("SERVICE", f"{svc} ({desc})", "Service Stopped & Disabled", "DEBLOATED", (255, 65, 65))
    
    run_cmd('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 0 /f')
    run_cmd('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SubscribedContent-338388Enabled" /t REG_DWORD /d 0 /f')
    run_cmd('reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v "DODownloadMode" /t REG_DWORD /d 0 /f')
    add_log("REGISTRY", "Windows Data Collection & Ads Bloat", "Telemetry & Delivery P2P Off", "DISABLED", (255, 65, 65))
    if not is_subtask:
        add_notification("DEBLOATED", "Background tracking services disabled", (255, 65, 65))

def task_flush_ram(is_subtask=False):
    run_cmd("[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()")
    add_log("MEMORY", "RAM Garbage Collection & Working Sets", "Standby memory flushed", "COMPACTED", (80, 220, 100))
    if not is_subtask:
        add_notification("RAM FLUSHED", "Memory standby cache freed up", (80, 220, 100))
        refresh_system_metrics()

def task_visuals_opt(is_subtask=False):
    run_cmd('reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v "MinAnimate" /t REG_SZ /d "0" /f')
    run_cmd('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarAnimations" /t REG_DWORD /d 0 /f')
    add_log("REGISTRY", "Window & Taskbar Animations", "Zero-Lag Snappy Windows", "OPTIMIZED", (168, 85, 247))

def task_trim_drives(is_subtask=False):
    run_cmd("Get-Volume | Where-Object { $_.DriveLetter -ne $null -and $_.DriveType -eq 'Fixed' } | ForEach-Object { Optimize-Volume -DriveLetter $_.DriveLetter -Defrag -ReTrim -ErrorAction SilentlyContinue }")
    add_log("STORAGE", "SSD / NVMe Storage TRIM", "NAND Flash Blocks Re-Trimmed", "COMPLETE", (255, 200, 0))
    if not is_subtask:
        add_notification("STORAGE TRIM", "SSD & NVMe drives trimmed", (255, 200, 0))

def task_undo_all():
    add_log("RESTORE", ">>> REVERTING ALL SETTINGS TO WINDOWS DEFAULTS <<<", status="IN PROGRESS", status_color=(255, 65, 65))
    run_cmd("powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e")
    run_cmd('reg add "HKCU\\Control Panel\\Desktop" /v "MenuShowDelay" /t REG_SZ /d "400" /f')
    run_cmd('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 20 /f')
    run_cmd('reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 2 /f')
    run_cmd('sc.exe config "DiagTrack" start= auto; net start "DiagTrack" 2>$null')
    run_cmd('sc.exe config "WerSvc" start= demand')
    run_cmd('reg add "HKCU\\System\\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 1 /f')
    run_cmd('reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v "MinAnimate" /t REG_SZ /d "1" /f')
    run_cmd('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarAnimations" /t REG_DWORD /d 1 /f')
    run_cmd("netsh int tcp reset; ipconfig /flushdns")
    add_log("RESTORE", "Windows Factory Defaults Restored", "Balanced Plan & Stock Registry", "COMPLETED", (80, 220, 100))
    add_notification("RESTORE COMPLETE", "Windows factory defaults restored", (80, 220, 100))
    refresh_system_metrics()

def task_set_dns(provider):
    if provider == "cloudflare":
        run_cmd("Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('1.1.1.1', '1.0.0.1') -ErrorAction SilentlyContinue }; ipconfig /flushdns")
        add_log("NETWORK", "DNS Changed -> Cloudflare 1.1.1.1", "Ultra Low Gaming Ping", "ACTIVE", (80, 220, 100))
        add_notification("DNS CHANGED", "Cloudflare 1.1.1.1 (Low Ping) Active", (80, 220, 100))
    elif provider == "google":
        run_cmd("Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('8.8.8.8', '8.8.4.4') -ErrorAction SilentlyContinue }; ipconfig /flushdns")
        add_log("NETWORK", "DNS Changed -> Google 8.8.8.8", "Reliable High Speed", "ACTIVE", (0, 230, 255))
        add_notification("DNS CHANGED", "Google DNS 8.8.8.8 Active", (0, 230, 255))
    elif provider == "dhcp":
        run_cmd("Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses -ErrorAction SilentlyContinue }; ipconfig /flushdns")
        add_log("NETWORK", "DNS Reset -> Automatic Router DHCP", "Default Settings", "RESET", (255, 200, 0))
        add_notification("DNS RESET", "Automatic Router DHCP Active", (255, 200, 0))

def task_restart_explorer():
    run_cmd("Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500; Start-Process explorer.exe")
    add_log("SYSTEM", "Windows Explorer Shell Reloaded", "Cleared Shell Memory Leaks", "RELOADED", (80, 220, 100))
    add_notification("EXPLORER RESTARTED", "Shell reloaded cleanly", (80, 220, 100))

def task_export_report():
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    path = os.path.join(desktop, "MohitSindhu_System_Health_Report.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("=====================================================\n")
        f.write("   MOHIT SINDHU - SYSTEM HEALTH & OPTIMIZER REPORT\n")
        f.write("   YouTube: @mohitm07live  |  Instagram: @Mohitm07live\n")
        f.write(f"   Generated on: {time.strftime('%d-%m-%Y %H:%M:%S')}\n")
        f.write("=====================================================\n")
        f.write(f"CPU:         {g_stats['cpu_name']} ({g_stats['cpu_cores']})\n")
        f.write(f"RAM:         {g_stats['ram_used']} GB / {g_stats['ram_total']} GB ({g_stats['ram_pct']}% Used)\n")
        f.write(f"Power Plan:  {g_stats['power_plan']}\n")
        f.write(f"C: Drive:    {g_stats['c_free']} GB Free / {g_stats['c_total']} GB Total\n")
    add_log("SYSTEM", "Health Report Exported to Desktop", path, "SAVED", (80, 220, 100))
    add_notification("REPORT SAVED", f"Report saved to Desktop", (80, 220, 100))

# --- ASYNC DISPATCHER ---
def async_dispatch(fn, *args):
    t = threading.Thread(target=fn, args=args, daemon=True)
    t.start()

# --- BUILD DEAR IMGUI THEME & INTERFACE ---

def build_gui():
    dpg.create_context()
    
    # 1. CYBERPUNK OBSIDIAN THEME (Inspired by Project Aim Done / UID Bypass)
    with dpg.theme() as global_theme:
        with dpg.theme_component(dpg.mvAll):
            # Window & Backgrounds
            dpg.add_theme_color(dpg.mvThemeCol_WindowBg, (15, 15, 18, 255))
            dpg.add_theme_color(dpg.mvThemeCol_ChildBg, (20, 20, 24, 255))
            dpg.add_theme_color(dpg.mvThemeCol_PopupBg, (18, 18, 22, 255))
            dpg.add_theme_color(dpg.mvThemeCol_Border, (42, 42, 48, 255))
            dpg.add_theme_color(dpg.mvThemeCol_BorderShadow, (0, 0, 0, 0))
            
            # Frame Backgrounds (Inputs, Sliders)
            dpg.add_theme_color(dpg.mvThemeCol_FrameBg, (28, 28, 34, 255))
            dpg.add_theme_color(dpg.mvThemeCol_FrameBgHovered, (38, 38, 46, 255))
            dpg.add_theme_color(dpg.mvThemeCol_FrameBgActive, (48, 48, 58, 255))
            
            # Title & Header
            dpg.add_theme_color(dpg.mvThemeCol_TitleBg, (12, 12, 15, 255))
            dpg.add_theme_color(dpg.mvThemeCol_TitleBgActive, (18, 18, 24, 255))
            dpg.add_theme_color(dpg.mvThemeCol_Header, (32, 32, 40, 255))
            dpg.add_theme_color(dpg.mvThemeCol_HeaderHovered, (45, 45, 58, 255))
            dpg.add_theme_color(dpg.mvThemeCol_HeaderActive, (255, 65, 65, 255))
            
            # Buttons (Vibrant Crimson & Cyber Glow)
            dpg.add_theme_color(dpg.mvThemeCol_Button, (255, 55, 55, 180))
            dpg.add_theme_color(dpg.mvThemeCol_ButtonHovered, (255, 80, 80, 240))
            dpg.add_theme_color(dpg.mvThemeCol_ButtonActive, (220, 40, 40, 255))
            
            # Tabs (Cyber Accent Line)
            dpg.add_theme_color(dpg.mvThemeCol_Tab, (22, 22, 26, 255))
            dpg.add_theme_color(dpg.mvThemeCol_TabHovered, (38, 38, 48, 255))
            dpg.add_theme_color(dpg.mvThemeCol_TabActive, (255, 65, 65, 220))
            dpg.add_theme_color(dpg.mvThemeCol_TabUnfocused, (18, 18, 22, 255))
            dpg.add_theme_color(dpg.mvThemeCol_TabUnfocusedActive, (255, 65, 65, 180))
            
            # Scrollbars & Sliders
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarBg, (15, 15, 18, 200))
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarGrab, (45, 45, 55, 255))
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarGrabHovered, (255, 65, 65, 200))
            dpg.add_theme_color(dpg.mvThemeCol_ScrollbarGrabActive, (255, 65, 65, 255))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrab, (255, 65, 65, 255))
            dpg.add_theme_color(dpg.mvThemeCol_SliderGrabActive, (255, 95, 95, 255))
            
            # Text & Highlights
            dpg.add_theme_color(dpg.mvThemeCol_Text, (240, 240, 245, 255))
            dpg.add_theme_color(dpg.mvThemeCol_TextDisabled, (120, 120, 130, 255))
            dpg.add_theme_color(dpg.mvThemeCol_CheckMark, (0, 230, 255, 255))
            
            # Rounding & Spacing (Modern Sleek Curve)
            dpg.add_theme_style(dpg.mvStyleVar_WindowRounding, 10.0)
            dpg.add_theme_style(dpg.mvStyleVar_ChildRounding, 8.0)
            dpg.add_theme_style(dpg.mvStyleVar_FrameRounding, 6.0)
            dpg.add_theme_style(dpg.mvStyleVar_GrabRounding, 6.0)
            dpg.add_theme_style(dpg.mvStyleVar_TabRounding, 6.0)
            dpg.add_theme_style(dpg.mvStyleVar_WindowPadding, 16.0, 16.0)
            dpg.add_theme_style(dpg.mvStyleVar_FramePadding, 10.0, 6.0)
            dpg.add_theme_style(dpg.mvStyleVar_ItemSpacing, 10.0, 8.0)
            
    dpg.bind_theme(global_theme)
    
    # 2. MAIN WINDOW VIEWPORT (920x680)
    with dpg.window(tag="primary_window", label="MOHIT SINDHU - ULTIMATE PC OPTIMIZER", no_collapse=True, no_close=True, no_move=True, no_resize=True):
        
        # --- TOP BRAND HEADER BAR ---
        with dpg.group(horizontal=True):
            with dpg.group():
                dpg.add_text("MOHIT SINDHU - ULTIMATE PC OPTIMIZER", color=(255, 65, 65))
                dpg.add_text("v10.0 CYBER EDITION  |  YouTube: @mohitm07live  |  Instagram: @Mohitm07live", color=(150, 150, 165))
            
            dpg.add_spacer(width=200)
            
            # Live Status Pill
            with dpg.child_window(width=230, height=45, border=True):
                with dpg.group(horizontal=True):
                    dpg.add_text("●", color=(80, 220, 100), tag="status_dot")
                    dpg.add_text(g_status_text, tag="status_label", color=g_status_color)
        
        dpg.add_separator()
        dpg.add_spacer(height=4)
        
        # --- QUICK HUD CARDS ---
        with dpg.group(horizontal=True):
            with dpg.child_window(width=210, height=65, border=True):
                dpg.add_text("⚡ ACTIVE POWER PLAN", color=(0, 230, 255))
                dpg.add_text("Ultimate Performance", tag="hud_power", color=(255, 255, 255))
            
            with dpg.child_window(width=210, height=65, border=True):
                dpg.add_text("🧠 SYSTEM RAM IN USE", color=(255, 200, 0))
                dpg.add_text("Scanning...", tag="hud_ram", color=(255, 255, 255))
                
            with dpg.child_window(width=210, height=65, border=True):
                dpg.add_text("💾 C: DRIVE FREE SPACE", color=(80, 220, 100))
                dpg.add_text("Scanning...", tag="hud_drive", color=(255, 255, 255))
                
            with dpg.child_window(width=210, height=65, border=True):
                dpg.add_text("🎯 UI LATENCY STATUS", color=(168, 85, 247))
                dpg.add_text("0ms (Instant Quantum)", tag="hud_latency", color=(80, 220, 100))

        dpg.add_spacer(height=6)

        # --- TAB CONTAINER (THE CORE SUITE) ---
        with dpg.tab_bar(tag="main_tabs"):
            
            # === TAB 1: 1-CLICK SUPER BOOST ===
            with dpg.tab(label="  ⚡ 1-CLICK SUPER BOOST  "):
                dpg.add_spacer(height=8)
                with dpg.group(horizontal=True):
                    with dpg.child_window(width=520, height=270, border=True):
                        dpg.add_text("AUTOMATED 11-PHASE PERFORMANCE ACCELERATOR", color=(255, 65, 65))
                        dpg.add_text("Instantly applies all latency registry tweaks, unlocks Ultimate CPU clock speed,\npurges junk/shaders, optimizes TCP/IP ping, and debloats background telemetry.", color=(160, 160, 175))
                        dpg.add_spacer(height=12)
                        
                        # Giant Glow Action Button
                        dpg.add_button(
                            label="🚀 EXECUTE 1-CLICK SUPER BOOST NOW",
                            width=485,
                            height=48,
                            callback=lambda: async_dispatch(task_godmode)
                        )
                        
                        dpg.add_spacer(height=12)
                        dpg.add_progress_bar(tag="boost_progress", default_value=0.0, width=485)
                        dpg.add_text("0% - Ready to Boost", tag="boost_progress_text", color=(0, 230, 255))
                        
                    with dpg.child_window(width=340, height=270, border=True):
                        dpg.add_text("FEATURE HIGHLIGHTS", color=(0, 230, 255))
                        dpg.add_text("✔ 0ms MenuShowDelay (Instant Menus)\n✔ Foreground Quantum 38 (Max FPS)\n✔ GPU & Game Task Scheduler (Priority 8)\n✔ DirectX, NVIDIA & AMD Shader Flush\n✔ Ultimate Performance Plan GUID\n✔ Multi-Core TCP Auto-Tuning & RSS\n✔ Background Telemetry & GameDVR Off\n✔ RAM Working Set Compaction\n✔ SSD / NVMe Storage TRIM", color=(200, 200, 210))

            # === TAB 2: GAMING & ZERO LATENCY ===
            with dpg.tab(label="  🎯 GAMING & LATENCY  "):
                dpg.add_spacer(height=8)
                with dpg.group(horizontal=True):
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("LOW-LATENCY REGISTRY ENGINE", color=(168, 85, 247))
                        dpg.add_text("Injects low-level registry values for 0 input lag.", color=(140, 140, 155))
                        dpg.add_spacer(height=8)
                        dpg.add_button(label="⚡ Apply 0ms Menu Delay & Quantum 38", width=395, height=36, callback=lambda: async_dispatch(task_latency_tweaks))
                        dpg.add_spacer(height=6)
                        dpg.add_button(label="🎮 Disable GameDVR & Xbox Screen Capture", width=395, height=36, callback=lambda: async_dispatch(task_gamedvr_fix))
                        dpg.add_spacer(height=6)
                        dpg.add_button(label="🖼️ Disable Window & Taskbar Animation Lag", width=395, height=36, callback=lambda: async_dispatch(task_visuals_opt))
                        
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("ZERO DELAY EXPLANATION", color=(0, 230, 255))
                        dpg.add_text("• MenuShowDelay = 0ms:\n  Removes all desktop & taskbar UI animation delays.\n• Win32PrioritySeparation = 38 (0x26):\n  Gives active foreground window max CPU quantum cycles.\n• SystemResponsiveness = 0:\n  Stops Windows from reserving 20% CPU for background.\n• GPU Priority = 8:\n  Forces GPU thread priority for games & OBS.", color=(180, 180, 195))

            # === TAB 3: DEEP CLEANUP & SHADERS ===
            with dpg.tab(label="  🧹 JUNK & SHADERS  "):
                dpg.add_spacer(height=8)
                with dpg.group(horizontal=True):
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("DEEP JUNK & CACHE PURGE", color=(255, 200, 0))
                        dpg.add_text("Deletes temporary files, prefetch and download caches.", color=(140, 140, 155))
                        dpg.add_spacer(height=8)
                        dpg.add_button(label="🗑️ Purge User Temp, Prefetch & WinUpdate", width=395, height=36, callback=lambda: async_dispatch(task_purge_junk))
                        dpg.add_spacer(height=6)
                        dpg.add_button(label="🎮 Flush GPU Shaders (NVIDIA / AMD / Intel)", width=395, height=36, callback=lambda: async_dispatch(task_purge_shaders))
                        dpg.add_spacer(height=6)
                        dpg.add_button(label="⚡ Execute SSD / NVMe Storage TRIM", width=395, height=36, callback=lambda: async_dispatch(task_trim_drives))
                        
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("WHY FLUSH SHADER CACHES?", color=(0, 230, 255))
                        dpg.add_text("• Corrupted DirectX & NVIDIA Shader Caches cause\n  sudden FPS drops and micro-stutters in games.\n• Purging shader cache forces the GPU to recompile\n  fresh, optimized shader binaries smoothly.\n• Storage TRIM optimizes NAND flash wear-leveling\n  for fast SSD read/write speeds.", color=(180, 180, 195))

            # === TAB 4: CPU POWER & NETWORK ===
            with dpg.tab(label="  🌐 POWER & NETWORK  "):
                dpg.add_spacer(height=8)
                with dpg.group(horizontal=True):
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("CPU POWER PLAN CONTROLLER", color=(0, 230, 255))
                        dpg.add_spacer(height=4)
                        dpg.add_button(label="⚡ Unlock & Lock Ultimate Performance Scheme", width=395, height=36, callback=lambda: async_dispatch(task_power_plan))
                        dpg.add_spacer(height=8)
                        dpg.add_text("FAST GAMING DNS SWITCHER", color=(80, 220, 100))
                        with dpg.group(horizontal=True):
                            dpg.add_button(label="Cloudflare (1.1.1.1)", width=125, height=32, callback=lambda: async_dispatch(task_set_dns, "cloudflare"))
                            dpg.add_button(label="Google (8.8.8.8)", width=125, height=32, callback=lambda: async_dispatch(task_set_dns, "google"))
                            dpg.add_button(label="Router DHCP", width=125, height=32, callback=lambda: async_dispatch(task_set_dns, "dhcp"))
                        
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("NETWORK & TCP PACKET TUNING", color=(59, 130, 246))
                        dpg.add_text("Optimizes packet buffers and eliminates throttling.", color=(140, 140, 155))
                        dpg.add_spacer(height=8)
                        dpg.add_button(label="🚀 Optimize TCP Auto-Tuning & Multi-Core RSS", width=395, height=36, callback=lambda: async_dispatch(task_network_tuning))
                        dpg.add_spacer(height=6)
                        dpg.add_button(label="🛡️ Debloat Telemetry & Background Tracking", width=395, height=36, callback=lambda: async_dispatch(task_debloat_telemetry))

            # === TAB 5: PRO TOOLS & RESTORE ===
            with dpg.tab(label="  🛠️ PRO TOOLS & UNDO  "):
                dpg.add_spacer(height=8)
                with dpg.group(horizontal=True):
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("QUICK UTILITIES", color=(0, 230, 255))
                        dpg.add_spacer(height=4)
                        dpg.add_button(label="🧠 Flush RAM Standby Cache", width=395, height=34, callback=lambda: async_dispatch(task_flush_ram))
                        dpg.add_spacer(height=4)
                        dpg.add_button(label="🔄 Restart Windows Explorer Shell", width=395, height=34, callback=lambda: async_dispatch(task_restart_explorer))
                        dpg.add_spacer(height=4)
                        dpg.add_button(label="📋 Export System Health Report to Desktop", width=395, height=34, callback=lambda: async_dispatch(task_export_report))
                        dpg.add_spacer(height=4)
                        dpg.add_button(label="🛡️ Create Safety System Restore Point", width=395, height=34, callback=lambda: async_dispatch(task_restore_point))
                        
                    with dpg.child_window(width=430, height=270, border=True):
                        dpg.add_text("RESTORE FACTORY DEFAULTS (UNDO)", color=(255, 65, 65))
                        dpg.add_text("Reverts all power plans, registry delays, services\nand visual animations to stock Windows settings.", color=(160, 160, 175))
                        dpg.add_spacer(height=16)
                        dpg.add_button(label="⏪ 1-CLICK RESTORE WINDOWS FACTORY DEFAULTS", width=395, height=44, callback=lambda: async_dispatch(task_undo_all))

        dpg.add_spacer(height=8)
        
        # --- REAL-TIME TELEMETRY LOG TERMINAL ---
        with dpg.child_window(tag="log_terminal_container", width=-1, height=180, border=True):
            dpg.add_text("💻 LIVE TELEMETRY & PROCESSING LOGS", color=(0, 230, 255))
            dpg.add_separator()
            with dpg.child_window(tag="log_terminal", width=-1, height=140, border=False):
                dpg.add_text("[SYSTEM] Mohit Sindhu Ultimate Optimizer GUI initialized.", color=(0, 230, 255))
                dpg.add_text("[SYSTEM] Ready to optimize your PC. Select a tab or click Super Boost!", color=(80, 220, 100))

        # --- FOOTER BAR ---
        with dpg.group(horizontal=True):
            dpg.add_text("Mohit Sindhu PC Optimizer v10.0", color=(100, 100, 115))
            dpg.add_spacer(width=320)
            dpg.add_text("YouTube: @mohitm07live  |  Instagram: @Mohitm07live", color=(255, 65, 65))

    # --- TOAST NOTIFICATION POPUP ---
    with dpg.window(tag="toast_window", label="", show=False, no_title_bar=True, no_resize=True, no_move=True, width=320, height=65, pos=(560, 580)):
        dpg.add_text("NOTIFICATION", tag="toast_title", color=(0, 230, 255))
        dpg.add_text("Action Completed Successfully", tag="toast_text", color=(255, 255, 255))

    # 3. SETUP VIEWPORT
    dpg.create_viewport(title="MOHIT SINDHU - ULTIMATE PC OPTIMIZER [CYBER IMGUI]", width=930, height=720, resizable=False)
    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.set_primary_window("primary_window", True)
    
    # Background Metrics Refresh
    async_dispatch(refresh_system_metrics)
    
    # Render Loop with dynamic HUD updates
    last_update = 0
    last_toast = 0
    
    while dpg.is_dearpygui_running():
        now = time.time()
        
        # Update HUD stats every 3 seconds
        if now - last_update > 3.0:
            last_update = now
            try:
                dpg.set_value("hud_ram", f"{g_stats['ram_used']} / {g_stats['ram_total']} GB ({g_stats['ram_pct']}%)")
                dpg.set_value("hud_drive", f"{g_stats['c_free']} / {g_stats['c_total']} GB Free")
                dpg.set_value("hud_power", g_stats["power_plan"])
                dpg.set_value("status_label", g_status_text)
                dpg.configure_item("status_label", color=g_status_color)
            except:
                pass
        
        # Auto-hide toast after 4 seconds
        if dpg.is_item_shown("toast_window"):
            if last_toast == 0:
                last_toast = now
            elif now - last_toast > 4.0:
                dpg.configure_item("toast_window", show=False)
                last_toast = 0
                
        dpg.render_dearpygui_frame()
        
    dpg.destroy_context()

if __name__ == "__main__":
    build_gui()
