@echo off
title MOHIT SINDHU - ULTIMATE PC OPTIMIZER [IMGUI CYBER SUITE]

:: ==============================================================================
:: MOHIT SINDHU - ULTIMATE PC PERFORMANCE & GAMING OPTIMIZER v10.0
:: YouTube: @mohitm07live  |  Instagram: @Mohitm07live
:: ==============================================================================

:: Admin Check and Auto-Elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: Resolve Script Directory
set "SCRIPT_DIR=%~dp0"
set "GUI_TARGET=%SCRIPT_DIR%optimizer_imgui.py"
set "PS_TARGET=%SCRIPT_DIR%PC_Ultimate_Optimizer.ps1"

if not exist "%GUI_TARGET%" (
    set "GUI_TARGET=%USERPROFILE%\Desktop\optimizer_imgui.py"
)
if not exist "%PS_TARGET%" (
    set "PS_TARGET=%USERPROFILE%\Desktop\PC_Ultimate_Optimizer.ps1"
)

:: Launch ImGui GUI Suite if Python is available
python --version >nul 2>&1
if %errorlevel% equ 0 (
    if exist "%GUI_TARGET%" (
        start "" pythonw "%GUI_TARGET%"
        exit /b
    )
)

:: Fallback to Cyberpunk Animated PowerShell Suite
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_TARGET%"
exit /b
