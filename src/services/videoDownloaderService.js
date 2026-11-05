const fs = require('fs');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');

class VideoDownloaderService {
  constructor() {
    this.downloadsDir = process.env.DOWNLOADS_DIR || path.join(process.cwd(), 'downloads');
    this.activeDownloads = new Map();
    this.io = null;

    if (!fs.existsSync(this.downloadsDir)) {
      try {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      } catch (e) {}
    }

    // Auto-bootstrap environment dependencies on Linux/Render
    if (process.platform !== 'win32') {
      setTimeout(() => this.bootstrapLinuxEnvironment(), 100);
    }
  }

  bootstrapLinuxEnvironment() {
    if (process.platform === 'win32') return;

    try {
      const existing = this.resolveYtDlpBinary(true);
      if (existing) {
        return;
      }
    } catch (e) {}

    console.log('[VideoDownloader] Auto-installing yt-dlp for Linux / Render...');
    const binDir = path.join(process.cwd(), 'bin');
    const targetBin = path.join(binDir, 'yt-dlp');

    if (!fs.existsSync(binDir)) {
      try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) {}
    }

    // 1. Run setup_render_env script via Node
    try {
      const setupScript = path.join(__dirname, '..', '..', 'scripts', 'setup_render_env.js');
      if (fs.existsSync(setupScript)) {
        execSync(`node "${setupScript}"`, { stdio: 'inherit', timeout: 65000 });
        if (fs.existsSync(targetBin)) {
          fs.chmodSync(targetBin, 0o755);
          console.log('[VideoDownloader] Verified standalone yt-dlp binary at', targetBin);
          return;
        }
      }
    } catch (e) {
      console.warn('[VideoDownloader] Note: setup_render_env run error:', e.message);
    }

    // 2. Try curl standalone executable as fallback
    try {
      execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${targetBin}" && chmod a+rx "${targetBin}"`, { stdio: 'ignore', timeout: 45000 });
      if (fs.existsSync(targetBin)) {
        fs.chmodSync(targetBin, 0o755);
        console.log('[VideoDownloader] Downloaded standalone yt-dlp binary via curl to', targetBin);
        return;
      }
    } catch (e) {}

    // 3. Try pip3 install
    try {
      execSync('python3 -m pip install --no-cache-dir --break-system-packages yt-dlp || pip3 install --no-cache-dir yt-dlp || pip install --no-cache-dir yt-dlp', { stdio: 'ignore', timeout: 35000 });
      console.log('[VideoDownloader] yt-dlp installed via pip.');
      return;
    } catch (e) {}
  }

  /**
   * Resolve best working yt-dlp binary (WinGet standalone executable, workspace bin, or system PATH)
   */
  resolveYtDlpBinary(fastCheckOnly = false) {
    // 1. Explicit env variable
    if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
      return { cmd: process.env.YTDLP_PATH, isPythonModule: false };
    }

    if (process.platform === 'win32') {
      const candidates = [
        'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Links\\yt-dlp.exe',
        path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
        path.join(process.cwd(), 'bin', 'yt-dlp', 'yt-dlp.exe'),
        'C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe'
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return { cmd: p, isPythonModule: false };
        }
      }

      // 2. Query where.exe in system PATH
      try {
        const out = execSync('where.exe yt-dlp', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        const firstLine = out.trim().split(/\r?\n/)[0];
        if (firstLine && fs.existsSync(firstLine)) {
          return { cmd: firstLine, isPythonModule: false };
        }
      } catch (e) {}
    } else {
      // Linux / Docker / Render paths
      const linuxCandidates = [
        path.join(process.cwd(), 'bin', 'yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp'
      ];
      for (const p of linuxCandidates) {
        if (fs.existsSync(p)) {
          return { cmd: p, isPythonModule: false };
        }
      }
      try {
        const out = execSync('which yt-dlp', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (out && fs.existsSync(out)) {
          return { cmd: out, isPythonModule: false };
        }
      } catch (e) {}
    }

    // Verify if python -m yt_dlp actually works
    const py = this.resolvePythonPath();
    try {
      execSync(`${py} -m yt_dlp --version`, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 4000 });
      return { cmd: py, isPythonModule: true };
    } catch (e) {}

    // If fast check only, exit without attempting installation
    if (fastCheckOnly) return null;

    // If not found and on Linux, run bootstrap installation synchronously
    if (process.platform !== 'win32') {
      this.bootstrapLinuxEnvironment();
      const localBin = path.join(process.cwd(), 'bin', 'yt-dlp');
      if (fs.existsSync(localBin)) {
        return { cmd: localBin, isPythonModule: false };
      }
      try {
        execSync(`${py} -m yt_dlp --version`, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 4000 });
        return { cmd: py, isPythonModule: true };
      } catch (e) {}

      throw new Error('yt-dlp binary is missing on this server. Please ensure scripts/setup_render_env.js ran during build.');
    }

    return { cmd: py, isPythonModule: true };
  }

  resolvePythonPath() {
    if (process.env.PYTHON_PATH) {
      return process.env.PYTHON_PATH;
    }
    if (process.platform === 'win32') {
      const candidates = [
        'C:\\Users\\mohit\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
        'C:\\Users\\mohit\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
      return 'python';
    }
    return 'python3';
  }

  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Dynamically locate working FFmpeg directory or binary
   */
  getFFmpegLocation() {
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        return path.dirname(ffmpegStatic);
      }
    } catch (e) {}

    if (process.platform !== 'win32') {
      return 'ffmpeg';
    }

    // 1. Workspace local bin directory (highest priority)
    const workspaceBin = path.join(process.cwd(), 'bin', 'ffmpeg');
    if (fs.existsSync(path.join(workspaceBin, 'ffmpeg.exe'))) {
      return workspaceBin;
    }
    const directBin = path.join(process.cwd(), 'bin');
    if (fs.existsSync(path.join(directBin, 'ffmpeg.exe'))) {
      return directBin;
    }

    // 2. Candidate paths (standard Program Files and WinGet)
    const candidateDirs = [
      'C:\\Program Files\\FFmpeg\\bin',
      'C:\\Program Files\\FFmpeg',
      'C:\\Program Files\\FFmpeg 8\\bin',
      'C:\\Program Files\\FFmpeg 8',
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Links',
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin',
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-essentials_build\\bin',
      path.join(__dirname, '../../bin/ffmpeg'),
      path.join(__dirname, '../../bin')
    ];

    for (const dir of candidateDirs) {
      if (fs.existsSync(path.join(dir, 'ffmpeg.exe'))) {
        return dir;
      }
    }

    // 3. Dynamic scan in WinGet Packages
    const wingetPackages = 'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages';
    if (fs.existsSync(wingetPackages)) {
      try {
        const pkgs = fs.readdirSync(wingetPackages);
        for (const pkg of pkgs) {
          if (pkg.toLowerCase().includes('ffmpeg')) {
            const pkgPath = path.join(wingetPackages, pkg);
            const subdirs = fs.readdirSync(pkgPath);
            for (const sub of subdirs) {
              const binPath = path.join(pkgPath, sub, 'bin');
              if (fs.existsSync(path.join(binPath, 'ffmpeg.exe'))) {
                return binPath;
              }
              if (fs.existsSync(path.join(pkgPath, sub, 'ffmpeg.exe'))) {
                return path.join(pkgPath, sub);
              }
            }
          }
        }
      } catch (e) {}
    }

    return 'ffmpeg';
  }

  getFFmpegExe() {
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      return process.env.FFMPEG_PATH;
    }
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        return ffmpegStatic;
      }
    } catch (e) {}
    if (process.platform !== 'win32') {
      return 'ffmpeg';
    }
    const loc = this.getFFmpegLocation();
    if (loc && loc !== 'ffmpeg') {
      const p = path.join(loc, 'ffmpeg.exe');
      if (fs.existsSync(p)) return p;
    }
    return 'ffmpeg';
  }

  /**
   * Identify platform from URL
   */
  detectPlatform(url) {
    if (!url) return 'generic';
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    return 'generic';
  }

  /**
   * Extract video or reel ID / shortcode
   */
  extractMediaId(url) {
    if (!url) return null;
    // Instagram Reel / Post / TV / Share: e.g. /reel/DfQCqMnhpsG/ or /p/DfPQchkG1tg/
    const igMatch = url.match(/(?:instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_-]+))/i);
    if (igMatch) return igMatch[1];

    // YouTube 11-char ID
    const ytMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/|embed\/|v\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) return ytMatch[1];

    return null;
  }

  /**
   * Look for optional cookies file for Instagram/YouTube authentication if provided
   */
  getCookiesArgument() {
    const candidateFiles = [
      path.join(process.cwd(), 'cookies.txt'),
      path.join(process.cwd(), 'instagram_cookies.txt'),
      path.join(this.downloadsDir, 'cookies.txt')
    ];
    for (const f of candidateFiles) {
      if (fs.existsSync(f)) {
        return ['--cookies', f];
      }
    }
    return [];
  }

  /**
   * Fetch video/reel info and available quality formats
   */
  async getVideoInfo(url) {
    return new Promise((resolve, reject) => {
      const { cmd, isPythonModule } = this.resolveYtDlpBinary();
      const platform = this.detectPlatform(url);
      const args = isPythonModule ? ['-m', 'yt_dlp'] : [];

      args.push(
        '--dump-single-json',
        '--no-playlist',
        '--no-warnings'
      );

      // Add platform specific headers
      if (platform === 'instagram') {
        args.push('--add-header', 'Referer:https://www.instagram.com/');
        args.push('--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');
      }

      // Add cookies if available
      const cookieArgs = this.getCookiesArgument();
      if (cookieArgs.length > 0) {
        args.push(...cookieArgs);
      }

      args.push(url);

      const child = spawn(cmd, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) {
          const errClean = stderr.replace(/WARNING:.*\n?/g, '').trim() || 'Failed to inspect media URL';
          return reject(new Error(errClean));
        }

        try {
          const info = JSON.parse(stdout);
          let target = info;

          // For carousels or multi-entries, pick the main video entry
          if (info._type === 'playlist' && Array.isArray(info.entries)) {
            target = info.entries.find(e => e && e.formats && e.formats.length > 0) || info.entries[0] || info;
          }

          // Determine available resolutions (accounting for vertical video resolutions 1080x1920 etc.)
          const formats = target.formats || [];
          const resolutionsSet = new Set();

          formats.forEach(f => {
            const h = f.height || 0;
            const w = f.width || 0;
            if (f.vcodec && f.vcodec !== 'none') {
              if (h >= 2160 || w >= 3840) resolutionsSet.add('4K');
              else if (h >= 1440 || w >= 2560) resolutionsSet.add('1440p');
              else if (h >= 1080 || w >= 1080) resolutionsSet.add('1080p');
              else if (h >= 720 || w >= 720) resolutionsSet.add('720p');
              else if (h >= 480 || w >= 480) resolutionsSet.add('480p');
              else if (h >= 360 || w >= 360) resolutionsSet.add('360p');
            }
          });

          // Order resolutions highest to lowest
          const order = ['4K', '1440p', '1080p', '720p', '480p', '360p'];
          const availableResolutions = order.filter(r => resolutionsSet.has(r));
          if (availableResolutions.length === 0) {
            availableResolutions.push('1080p', '720p');
          }

          const maxResolution = availableResolutions[0] || '1080p Full HD';
          const mediaId = target.id || this.extractMediaId(url) || 'media';

          let creator = target.uploader || target.channel || target.uploader_id;
          if (!creator) {
            creator = platform === 'instagram' ? 'Instagram Creator' : 'YouTube Channel';
          }
          if (platform === 'instagram' && !creator.startsWith('@') && !creator.includes(' ')) {
            creator = '@' + creator;
          }

          const result = {
            id: mediaId,
            title: target.title || (platform === 'instagram' ? `Instagram Reel [${mediaId}]` : 'Downloaded Video'),
            channel: creator,
            channelUrl: target.uploader_url || '',
            duration: target.duration,
            durationString: this.formatDuration(target.duration),
            thumbnail: target.thumbnail || (Array.isArray(target.thumbnails) && target.thumbnails[target.thumbnails.length - 1]?.url) || '',
            viewCount: target.view_count || target.like_count || 0,
            likeCount: target.like_count || 0,
            availableResolutions,
            maxResolution,
            platform,
            webpageUrl: target.webpage_url || url
          };

          resolve(result);
        } catch (err) {
          reject(new Error('Failed to parse media metadata: ' + err.message));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  /**
   * Start high quality download with guaranteed sound and MP4 merging
   * Supports both YouTube videos and Instagram reels/posts
   */
  startDownload(url, quality = 'highest', customFilename = null) {
    const downloadId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const outputTemplate = path.join(this.downloadsDir, '%(title).100s [%(id)s].%(ext)s');
    const ffmpegLocation = this.getFFmpegLocation();
    const platform = this.detectPlatform(url);
    const vid = this.extractMediaId(url);

    let formatSelection = 'bv*+ba/b';
    const isAudioOnly = quality === 'audio_only' || quality === 'mp3';

    if (isAudioOnly) {
      formatSelection = 'ba/b';
    } else if (quality === '1080p') {
      if (platform === 'instagram') {
        formatSelection = 'bv*[height<=1920][width<=1080]+ba/bv*[height<=1080]+ba/bv*+ba/b';
      } else {
        formatSelection = 'bv*[height<=1080]+ba/b[height<=1080]/b';
      }
    } else if (quality === '720p') {
      if (platform === 'instagram') {
        formatSelection = 'bv*[height<=1280][width<=720]+ba/bv*[height<=720]+ba/b[height<=720]/b';
      } else {
        formatSelection = 'bv*[height<=720]+ba/b[height<=720]/b';
      }
    } else if (quality === '480p') {
      formatSelection = 'bv*[height<=480]+ba/b[height<=480]/b';
    } else {
      // Highest possible (4K/8K 60fps for YouTube, 1080p 60fps DASH for Instagram) + best audio
      formatSelection = 'bv*+ba/b';
    }

    const { cmd, isPythonModule } = this.resolveYtDlpBinary();
    const args = isPythonModule ? ['-m', 'yt_dlp'] : [];

    args.push(
      '--newline',
      '--no-playlist',
      '--progress',
      '--windows-filenames',
      '-f', formatSelection,
      '-o', outputTemplate
    );

    if (ffmpegLocation && ffmpegLocation !== 'ffmpeg') {
      args.push('--ffmpeg-location', ffmpegLocation);
    }

    // Platform specific headers
    if (platform === 'instagram') {
      args.push('--add-header', 'Referer:https://www.instagram.com/');
      args.push('--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');
    }

    // Optional cookies
    const cookieArgs = this.getCookiesArgument();
    if (cookieArgs.length > 0) {
      args.push(...cookieArgs);
    }

    if (isAudioOnly) {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    const child = spawn(cmd, args);

    const downloadState = {
      id: downloadId,
      videoId: vid,
      url,
      quality,
      platform,
      status: 'starting',
      progress: 0,
      speed: '0 KiB/s',
      eta: '--',
      size: '--',
      title: platform === 'instagram' ? 'Downloading Instagram Reel...' : 'Downloading video...',
      filename: null,
      fullPath: null,
      downloadUrl: null,
      error: null,
      startTime: Date.now()
    };

    this.activeDownloads.set(downloadId, downloadState);
    this.emitProgress(downloadState);

    let destinationPath = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();

      // Check for merger into final file (highest priority)
      const mergerMatch = text.match(/\[Merger\] Merging formats into "(.+)"/i);
      if (mergerMatch) {
        destinationPath = mergerMatch[1].trim();
        downloadState.filename = path.basename(destinationPath);
        downloadState.fullPath = destinationPath;
        downloadState.downloadUrl = `/api/downloader/file/${encodeURIComponent(downloadState.filename)}`;
        downloadState.status = 'processing';
        downloadState.progress = 98;
        this.emitProgress(downloadState);
      }

      // Check for audio extraction destination
      const audioDestMatch = text.match(/\[ExtractAudio\] Destination: (.+)/i);
      if (audioDestMatch) {
        destinationPath = audioDestMatch[1].trim();
        downloadState.filename = path.basename(destinationPath);
        downloadState.fullPath = destinationPath;
        downloadState.downloadUrl = `/api/downloader/file/${encodeURIComponent(downloadState.filename)}`;
      }

      // Detect already downloaded file
      const alreadyMatch = text.match(/\[download\] (.+) has already been downloaded/i);
      if (alreadyMatch) {
        destinationPath = alreadyMatch[1].trim();
        downloadState.filename = path.basename(destinationPath);
        downloadState.fullPath = destinationPath;
        downloadState.downloadUrl = `/api/downloader/file/${encodeURIComponent(downloadState.filename)}`;
        downloadState.progress = 100;
        downloadState.status = 'completed';
      }

      // Destination line for single stream
      const destMatch = text.match(/\[download\] Destination: (.+)/i);
      if (destMatch && !destinationPath) {
        const potential = destMatch[1].trim();
        if (!potential.match(/\.f\d+\./) && !potential.match(/\.fdash-/)) {
          destinationPath = potential;
          downloadState.filename = path.basename(destinationPath);
          downloadState.fullPath = destinationPath;
          downloadState.downloadUrl = `/api/downloader/file/${encodeURIComponent(downloadState.filename)}`;
        }
      }

      // Parse progress robustly across all yt-dlp output formats
      const pctMatch = text.match(/\[download\]\s+([\d\.]+)%/i);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        if (!isNaN(pct)) {
          downloadState.status = 'downloading';
          downloadState.progress = pct;
        }

        const sizeMatch = text.match(/of\s+~?([\d\.]+\s*[kMGTP]?i?B)/i);
        if (sizeMatch) downloadState.size = sizeMatch[1].trim();

        const speedMatch = text.match(/(?:at|in)\s+([\d\.]+\s*[kMGTP]?i?B\/s)/i);
        if (speedMatch) downloadState.speed = speedMatch[1].trim();

        const etaMatch = text.match(/ETA\s+([\d\:]+)/i);
        if (etaMatch) downloadState.eta = etaMatch[1].trim();

        this.emitProgress(downloadState);
      }
    });

    child.stderr.on('data', (data) => {
      const errText = data.toString();
      if (errText.includes('ERROR:')) {
        downloadState.error = errText.replace(/WARNING:.*\n?/g, '').trim();
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        this.resolveFinalDownloadFile(downloadState, vid);
      } else {
        // Even if non-zero, check if files exist and try fallback merge
        const resolved = this.resolveFinalDownloadFile(downloadState, vid);
        if (!resolved) {
          downloadState.status = 'error';
          downloadState.error = downloadState.error || `Download failed with exit code ${code}`;
          this.emitProgress(downloadState);
        }
      }
    });

    return downloadState;
  }

  /**
   * Finalize download file path, auto-merge fragmented streams if needed, and clean temp files
   */
  resolveFinalDownloadFile(downloadState, vid) {
    if (!fs.existsSync(this.downloadsDir)) return false;

    const files = fs.readdirSync(this.downloadsDir);

    // 1. Look for finished merged file for this video/reel ID
    let finalMatch = null;
    if (vid) {
      finalMatch = files.find(f => f.includes(`[${vid}]`) && !f.match(/\.f\d+\./) && !f.match(/\.fdash-/) && (f.endsWith('.mp4') || f.endsWith('.mp3') || f.endsWith('.mkv') || f.endsWith('.webm')));
    }

    // 2. Self-healing fallback: If no finished file, but video and audio fragments exist, merge them now!
    if (!finalMatch && vid) {
      const vidFiles = files.filter(f => f.includes(`[${vid}]`) && (f.includes('.f') || f.includes('.temp') || f.includes('.part')));
      const audioFrag = vidFiles.find(f => f.endsWith('.m4a') || f.endsWith('.opus') || f.endsWith('.mp3') || f.includes('.f251.') || f.includes('.f140.') || f.includes('.f250.') || f.includes('.f249.') || f.includes('dash-') && f.endsWith('.m4a'));
      const videoFrag = vidFiles.find(f => f !== audioFrag && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));

      if (videoFrag && audioFrag) {
        const ffmpegExe = this.getFFmpegExe();
        const baseTitle = videoFrag.replace(/\.f[a-zA-Z0-9_-]+\.(mp4|webm|m4a|mkv)$/i, '').replace(/\[.*\]/, '').trim() || 'Downloaded_Media';
        const mergedName = `${baseTitle} [${vid}].mp4`;
        const mergedPath = path.join(this.downloadsDir, mergedName);

        try {
          const cmd = `"${ffmpegExe}" -i "${path.join(this.downloadsDir, videoFrag)}" -i "${path.join(this.downloadsDir, audioFrag)}" -c:v copy -c:a aac "${mergedPath}" -y`;
          execSync(cmd, { stdio: 'ignore' });
          if (fs.existsSync(mergedPath)) {
            finalMatch = mergedName;
            // Clean up fragments
            try { fs.unlinkSync(path.join(this.downloadsDir, videoFrag)); } catch (e) {}
            try { fs.unlinkSync(path.join(this.downloadsDir, audioFrag)); } catch (e) {}
          }
        } catch (mergeErr) {
          console.error('Manual fallback FFmpeg merge error:', mergeErr);
        }
      } else if (videoFrag && !audioFrag) {
        finalMatch = videoFrag;
      }
    }

    // 3. Fallback to newest media file if still not identified
    if (!finalMatch) {
      const newest = this.getNewestMediaFile();
      if (newest) {
        finalMatch = newest.filename;
      }
    }

    if (finalMatch) {
      downloadState.status = 'completed';
      downloadState.progress = 100;
      downloadState.speed = 'Done';
      downloadState.eta = '0s';
      downloadState.filename = finalMatch;
      downloadState.fullPath = path.join(this.downloadsDir, finalMatch);
      downloadState.downloadUrl = `/api/downloader/file/${encodeURIComponent(finalMatch)}`;

      try {
        const st = fs.statSync(downloadState.fullPath);
        downloadState.size = this.formatBytes(st.size);
      } catch (e) {}

      // Clean up any lingering fragments, .part, .ytdl for this video ID
      if (vid) {
        this.cleanFragmentsForVideo(vid, finalMatch);
      }

      this.emitProgress(downloadState);
      return true;
    }

    return false;
  }

  cleanFragmentsForVideo(vid, keepFilename) {
    try {
      const files = fs.readdirSync(this.downloadsDir);
      for (const f of files) {
        if (f !== keepFilename && f.includes(`[${vid}]`)) {
          if (f.match(/\.f\d+\./) || f.match(/\.fdash-/) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp')) {
            try {
              fs.unlinkSync(path.join(this.downloadsDir, f));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  emitProgress(downloadState) {
    if (this.io) {
      this.io.emit('downloader_progress', downloadState);
    }
  }

  getDownloadStatus(id) {
    return this.activeDownloads.get(id) || null;
  }

  /**
   * Locate a file by exact name, decoded name, NFC normalized, or video ID
   */
  findFile(query) {
    if (!query) return null;
    try {
      if (!fs.existsSync(this.downloadsDir)) return null;

      const directPath = path.join(this.downloadsDir, path.basename(query));
      if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return {
          filename: path.basename(query),
          fullPath: directPath
        };
      }

      const decoded = decodeURIComponent(query);
      const decodedPath = path.join(this.downloadsDir, path.basename(decoded));
      if (fs.existsSync(decodedPath) && fs.statSync(decodedPath).isFile()) {
        return {
          filename: path.basename(decoded),
          fullPath: decodedPath
        };
      }

      const files = fs.readdirSync(this.downloadsDir);

      // Match by Unicode normalized name
      const normQuery = query.normalize('NFC').toLowerCase();
      const normDecoded = decoded.normalize('NFC').toLowerCase();

      for (const f of files) {
        const normF = f.normalize('NFC').toLowerCase();
        if (normF === normQuery || normF === normDecoded) {
          const p = path.join(this.downloadsDir, f);
          if (fs.statSync(p).isFile()) return { filename: f, fullPath: p };
        }
      }

      // Match by Video ID [xxxxxxxxxxx]
      const vidMatch = query.match(/\[([a-zA-Z0-9_-]{5,30})\]/) || decoded.match(/\[([a-zA-Z0-9_-]{5,30})\]/) || query.match(/([a-zA-Z0-9_-]{5,30})/);
      if (vidMatch) {
        const vid = vidMatch[1];
        const mediaMatch = files.find(f => f.includes(`[${vid}]`) && !f.match(/\.f\d+\./) && !f.match(/\.fdash-/) && /\.(mp4|mkv|webm|mp3|m4a)$/i.test(f));
        if (mediaMatch) {
          const p = path.join(this.downloadsDir, mediaMatch);
          if (fs.statSync(p).isFile()) return { filename: mediaMatch, fullPath: p };
        }
      }

      return null;
    } catch (e) {
      console.error('Error finding download file:', e);
      return null;
    }
  }

  getNewestMediaFile() {
    try {
      if (!fs.existsSync(this.downloadsDir)) return null;
      const files = fs.readdirSync(this.downloadsDir);
      let latestFile = null;
      let latestMtime = 0;

      for (const f of files) {
        if (f.match(/\.f\d+\./) || f.match(/\.fdash-/) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp')) continue;
        if (!/\.(mp4|mkv|webm|mp3|m4a|wav)$/i.test(f)) continue;

        const p = path.join(this.downloadsDir, f);
        try {
          const st = fs.statSync(p);
          if (st.isFile() && st.mtimeMs > latestMtime) {
            latestMtime = st.mtimeMs;
            latestFile = {
              filename: f,
              fullPath: p,
              size: st.size,
              sizeFormatted: this.formatBytes(st.size),
              mtime: st.mtime
            };
          }
        } catch (e) {}
      }
      return latestFile;
    } catch (e) {
      return null;
    }
  }

  listCompletedDownloads() {
    try {
      if (!fs.existsSync(this.downloadsDir)) return [];
      const files = fs.readdirSync(this.downloadsDir);
      const results = [];

      for (const f of files) {
        // Exclude intermediate stream fragments and image/thumbnails
        if (f.match(/\.f\d+\./) || f.match(/\.fdash-/) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp') || f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.json')) {
          continue;
        }
        if (!/\.(mp4|mkv|webm|mp3|m4a|wav)$/i.test(f)) continue;

        const fullPath = path.join(this.downloadsDir, f);
        try {
          const st = fs.statSync(fullPath);
          if (st.isFile()) {
            const isInstagram = f.toLowerCase().includes('instagram') || f.toLowerCase().includes('reel');
            results.push({
              filename: f,
              platform: isInstagram ? 'instagram' : 'youtube',
              sizeBytes: st.size,
              sizeFormatted: this.formatBytes(st.size),
              createdAt: st.birthtime || st.mtime,
              downloadUrl: `/api/downloader/file/${encodeURIComponent(f)}`
            });
          }
        } catch (e) {}
      }

      return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      console.error('Error listing downloads:', e);
      return [];
    }
  }

  deleteDownload(filename) {
    const fileObj = this.findFile(filename);
    if (fileObj && fs.existsSync(fileObj.fullPath)) {
      fs.unlinkSync(fileObj.fullPath);
      return true;
    }
    return false;
  }

  openDownloadsFolder() {
    if (process.platform === 'win32') {
      exec(`explorer "${this.downloadsDir}"`);
      return true;
    }
    return false;
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

module.exports = new VideoDownloaderService();
