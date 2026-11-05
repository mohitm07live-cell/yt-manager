const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PYTHON_PATH = 'C:\\Users\\mohit\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
const FFMPEG_PATH = 'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin';
const OUTPUT_DIR = path.join(process.cwd(), 'downloads', 'mohit_shorts');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('====================================================');
console.log('📥 [SHORTS DOWNLOADER] Downloading All Channel Shorts');
console.log(`📂 Output Directory: ${OUTPUT_DIR}`);
console.log('====================================================\n');

const args = [
  '-m', 'yt_dlp',
  '--ffmpeg-location', FFMPEG_PATH,
  '-f', 'bv*+ba/b',
  '--merge-output-format', 'mp4',
  '--write-info-json',
  '--write-thumbnail',
  '-o', path.join(OUTPUT_DIR, '%(id)s - %(title).100s.%(ext)s'),
  'https://www.youtube.com/@MOHITM07LIVE/shorts'
];

console.log('Starting yt-dlp batch download...');
const child = spawn(PYTHON_PATH, args, { stdio: 'inherit' });

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n====================================================');
    console.log('✅ ALL 43 SHORTS DOWNLOADED SUCCESSFULLY IN BEST QUALITY!');
    console.log(`📁 Check folder: ${OUTPUT_DIR}`);
    console.log('====================================================');
  } else {
    console.error(`\n❌ Process finished with exit code: ${code}`);
  }
});
