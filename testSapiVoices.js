const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function testVoiceGen(text, voiceName, rate = 0, outputFile) {
  return new Promise((resolve) => {
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '`"');
    const escapedOutput = outputFile.replace(/'/g, "''");
    const escapedVoice = voiceName.replace(/'/g, "''");

    const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $s.SelectVoice('${escapedVoice}')
} catch {}
$s.Rate = ${rate}
$s.Volume = 100
$s.SetOutputToWaveFile('${escapedOutput}')
$s.Speak("${escapedText}")
$s.Dispose()
`;

    const base64Script = Buffer.from(ps, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err) => {
      if (err || !fs.existsSync(outputFile)) {
        console.error(`Error with ${voiceName}:`, err);
        return resolve(false);
      }
      const size = fs.statSync(outputFile).size;
      console.log(`Success with ${voiceName}: size = ${size} bytes`);
      resolve(true);
    });
  });
}

(async () => {
  await testVoiceGen('Thank you Rohit Sharma for subscribing to Mohit M07!', 'Microsoft Zira Desktop', 1, path.join(__dirname, 'test_zira.wav'));
  await testVoiceGen('Thank you Rohit Sharma for subscribing to Mohit M07!', 'Microsoft David Desktop', 0, path.join(__dirname, 'test_david.wav'));
})();
