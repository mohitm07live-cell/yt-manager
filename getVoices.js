const { exec } = require('child_process');

const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $s.GetInstalledVoices()
foreach ($v in $voices) {
    Write-Output "$($v.VoiceInfo.Name)|$($v.VoiceInfo.Gender)|$($v.VoiceInfo.Culture.Name)|$($v.VoiceInfo.Description)"
}
$s.Dispose()
`;

const base64Script = Buffer.from(ps, 'utf16le').toString('base64');
exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err, stdout, stderr) => {
  console.log('INSTALLED VOICES:');
  console.log(stdout);
});
