@echo off
setlocal enabledelayedexpansion
title Ultra Video & Metadata Downloader (YouTube & Instagram)
color 0B

:: Ensure script operates in its own directory
cd /d "%~dp0"

echo ================================================================
echo         ULTRA HIGH QUALITY VIDEO & METADATA DOWNLOADER
echo   Extracts: Video (MP4) + Title + Tags + Caption/Description
echo   Supports: YouTube (4K/1080p/Shorts) & Instagram (Reels/Posts)
echo ================================================================
echo Output Directory: "%~dp0"
echo.

:LOOP
echo ----------------------------------------------------------------
set "URL="
set /p "URL=Paste YouTube or Instagram Link (or 'q' to exit): "

if not defined URL (
    echo [!] Please enter a valid URL.
    goto LOOP
)

if /i "%URL%"=="q" goto EXIT
if /i "%URL%"=="exit" goto EXIT
if /i "%URL%"=="quit" goto EXIT

:: Strip surrounding quotes if any
set "URL=%URL:"=%"

echo.
echo [*] Fetching Video & Extracting Metadata...
echo [*] Downloading best video + best audio stream...
echo.

yt-dlp -f "bestvideo*+bestaudio/best" --merge-output-format mp4 --windows-filenames --no-mtime ^
  --print-to-file "================================================================" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "TITLE: %%(title)s" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "CREATOR / CHANNEL: %%(uploader,channel|Unknown)s" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "UPLOAD DATE: %%(upload_date|Unknown)s" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "ORIGINAL LINK: %%(webpage_url)s" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "----------------------------------------------------------------" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "TAGS / KEYWORDS (Copy-Paste for YT Studio):" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "%%(tags|None)l" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "----------------------------------------------------------------" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "CAPTION / DESCRIPTION:" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "%%(description|No caption or description.)s" "%~dp0%%(title)s_info.txt" ^
  --print-to-file "================================================================" "%~dp0%%(title)s_info.txt" ^
  -o "%~dp0%%(title)s.%%(ext)s" "%URL%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo [+] SUCCESS! Download & Metadata Extraction Completed.
    echo [+] Video: Merged MP4 saved in current folder.
    echo [+] Metadata: Title, Tags, Description saved to *_info.txt
    echo ================================================================
) else (
    echo.
    echo [!] Primary download encountered an issue. Retrying with fallback stream...
    yt-dlp -f "best" --windows-filenames --no-mtime ^
      --print-to-file "================================================================" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "TITLE: %%(title)s" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "CREATOR / CHANNEL: %%(uploader,channel|Unknown)s" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "UPLOAD DATE: %%(upload_date|Unknown)s" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "ORIGINAL LINK: %%(webpage_url)s" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "----------------------------------------------------------------" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "TAGS / KEYWORDS (Copy-Paste for YT Studio):" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "%%(tags|None)l" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "----------------------------------------------------------------" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "CAPTION / DESCRIPTION:" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "%%(description|No caption or description.)s" "%~dp0%%(title)s_info.txt" ^
      --print-to-file "================================================================" "%~dp0%%(title)s_info.txt" ^
      -o "%~dp0%%(title)s.%%(ext)s" "%URL%"
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [+] Fallback download completed successfully!
    ) else (
        echo.
        echo [-] Download Failed. If Instagram/YouTube requires login, verify URL or check connection.
    )
)

echo.
goto LOOP

:EXIT
echo Exiting...
timeout /t 1 >nul
exit /b 0
