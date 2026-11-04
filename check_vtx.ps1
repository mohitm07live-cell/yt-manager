$info = [ordered]@{}

# Check VT-x via systeminfo / PowerShell
$sysInfo = systeminfo.exe
$vtLine = $sysInfo | Select-String "Virtualization Enabled In Firmware"
$info["SystemInfo_VT"] = if ($vtLine) { $vtLine.Line.Trim() } else { "Not Found" }
$hyperVLines = $sysInfo | Select-String "Hyper-V Requirements" -Context 0,4
$info["HyperV_Requirements"] = ($hyperVLines | Out-String).Trim()

# Check NVIDIA settings via registry if present
$nvReg = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0001" -ErrorAction SilentlyContinue
$info["Nvidia_DriverDate"] = if ($nvReg) { $nvReg.DriverDate } else { "Unknown" }

# Check BlueStacks running instance
$hdPlayer = Get-Process -Name "HD-Player" -ErrorAction SilentlyContinue
if ($hdPlayer) {
    $info["HD_Player_PID"] = $hdPlayer.Id
    $info["HD_Player_Priority"] = $hdPlayer.PriorityClass
    $info["HD_Player_Threads"] = $hdPlayer.Threads.Count
}

$info | ConvertTo-Json
