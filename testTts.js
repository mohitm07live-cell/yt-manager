const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function generateSpeechWav(text, outputFile) {
  return new Promise((resolve, reject) => {
    // Escape single quotes for PowerShell
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '`"');
    const escapedOutput = outputFile.replace(/'/g, "''");
    
    const psScript = `
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.Rate = 0
$speaker.Volume = 100
$speaker.SetOutputToWaveFile('${escapedOutput}')
$speaker.Speak("${escapedText}")
$speaker.Dispose()
`;

    const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      resolve(outputFile);
    });
  });
}

(async () => {
  const outPath = path.join(__dirname, 'test_speech.wav');
  console.log('Generating speech WAV...');
  await generateSpeechWav('Welcome to the stream Mohit Sharma! Thank you for subscribing to Mohit M07!', outPath);
  console.log('Done! File size:', fs.statSync(outPath).size);
})();
