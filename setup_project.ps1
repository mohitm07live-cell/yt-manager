$dest = "D:\backup\PC_Optimizer_ImGui"
if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
Copy-Item -Path "D:\backup\UID BYPASS\third_party" -Destination $dest -Recurse -Force
Copy-Item -Path "D:\backup\UID BYPASS\UIPart" -Destination $dest -Recurse -Force
Copy-Item -Path "D:\backup\UID BYPASS\Src" -Destination $dest -Recurse -Force
Copy-Item -Path "D:\backup\UID BYPASS\imgui_settings.h" -Destination $dest -Force
Copy-Item -Path "D:\backup\UID BYPASS\imgui_settings.cpp" -Destination $dest -Force
Copy-Item -Path "D:\backup\UID BYPASS\app.manifest" -Destination $dest -Force
Write-Host "COPIED SUCCESSFULLY TO $dest"
