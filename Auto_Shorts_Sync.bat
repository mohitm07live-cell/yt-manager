@echo off
setlocal enabledelayedexpansion
title YouTube Auto Shorts Cloner & Uploader
color 0A

cd /d "%~dp0"

echo ================================================================
echo         YOUTUBE AUTO SHORTS CLONER & UPLOADER
echo   Auto-finds Top Performing Shorts, Downloads in 1080p/4K,
echo   and Uploads to your Connected Channel with same Title & Tags
echo ================================================================
echo.

node scripts\auto_shorts_sync.js %*

echo.
echo Press any key to exit...
pause >nul

