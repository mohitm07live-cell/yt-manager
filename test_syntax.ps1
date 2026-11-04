$content = Get-Content -Path "c:\Users\mohit\.gemini\antigravity-ide\scratch\yt-management-bot\PC_Ultimate_Optimizer.ps1" -Raw
$errors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)

if ($errors.Count -eq 0) {
    Write-Host ">>> PERFECT! SYNTAX CHECK PASSED (0 ERRORS) <<<" -ForegroundColor Green
} else {
    Write-Host ">>> FOUND SYNTAX ERRORS: <<<" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "Line $($err.Extent.StartLineNumber): $($err.Message)" -ForegroundColor Yellow
    }
}
