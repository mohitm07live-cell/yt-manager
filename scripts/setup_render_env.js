const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

/**
 * Download a binary file following all HTTP/HTTPS redirects in pure Node.js
 */
function downloadBinaryWithRedirects(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      // Follow 301, 302, 303, 307, 308 redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinaryWithRedirects(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status code ${res.statusCode} received from ${url}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          try {
            fs.chmodSync(destPath, 0o755);
          } catch (e) {}
          resolve();
        });
      });

      fileStream.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (e) {}
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Download request timed out after 60s'));
    });
  });
}

async function setup() {
  if (process.platform === 'win32') {
    console.log('[Setup] Running on Windows. System uses local WinGet / yt-dlp.exe.');
    return;
  }

  console.log('[Setup] Checking environment dependencies for Linux / Render...');
  const binDir = path.join(__dirname, '..', 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const linuxYtDlp = path.join(binDir, 'yt-dlp');

  // Check if system already has yt-dlp in PATH
  try {
    const out = execSync('which yt-dlp || echo ""', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (out && fs.existsSync(out)) {
      console.log('[Setup] System yt-dlp detected at:', out);
      return;
    }
  } catch (e) {}

  // Check if python module yt_dlp is installed
  try {
    execSync('python3 -m yt_dlp --version', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 4000 });
    console.log('[Setup] python3 -m yt_dlp module is already available.');
    return;
  } catch (e) {}

  // Try pip3 install if pip is available
  try {
    console.log('[Setup] Attempting pip3 install yt-dlp...');
    execSync('python3 -m pip install --no-cache-dir --break-system-packages yt-dlp || pip3 install --no-cache-dir yt-dlp', {
      stdio: 'ignore',
      timeout: 30000
    });
    console.log('[Setup] yt-dlp installed via pip3 successfully.');
    return;
  } catch (e) {
    console.log('[Setup] pip3 not present or restricted, downloading official standalone Linux binary...');
  }

  // Download official standalone Linux binary via pure Node.js HTTPS
  const downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  try {
    await downloadBinaryWithRedirects(downloadUrl, linuxYtDlp);
    if (fs.existsSync(linuxYtDlp)) {
      fs.chmodSync(linuxYtDlp, 0o755);
      console.log('[Setup] Standalone yt-dlp binary downloaded successfully to', linuxYtDlp);
      // Test execution
      try {
        const ver = execSync(`"${linuxYtDlp}" --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
        console.log(`[Setup] Verified yt-dlp version: ${ver}`);
      } catch (testErr) {
        console.warn('[Setup] Note: downloaded binary test returned:', testErr.message);
      }
    }
  } catch (dlErr) {
    console.warn('[Setup] Warning: could not download standalone yt-dlp binary:', dlErr.message);
  }
}

setup().then(() => {
  process.exit(0);
}).catch((err) => {
  console.warn('[Setup] Warning during setup_render_env:', err.message);
  process.exit(0); // Exit 0 so build never breaks
});
