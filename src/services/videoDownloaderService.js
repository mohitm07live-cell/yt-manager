const fs = require('fs');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');

class VideoDownloaderService {
  constructor() {
    this.pythonPath = this.resolvePythonPath();
    this.downloadsDir = process.env.DOWNLOADS_DIR || path.join(process.cwd(), 'downloads');
    this.activeDownloads = new Map();
    this.io = null;

    if (!fs.existsSync(this.downloadsDir)) {
      try {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      } catch (e) {}
    }
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

    // 2. Candidate paths
    const candidateDirs = [
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin',
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-essentials_build\\bin',
      'C:\\Users\\mohit\\AppData\\Local\\Microsoft\\WinGet\\Links',
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
    if (process.env.FFMPEG_PATH) {
      return process.env.FFMPEG_PATH;
    }
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
   * Fetch video info and available quality formats
   */
  async getVideoInfo(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'yt_dlp',
        '--dump-single-json',
        '--no-playlist',
        url
      ];

      const child = spawn(this.pythonPath, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(stderr || 'Failed to fetch video information'));
        }

        try {
          const info = JSON.parse(stdout);
          
          // Determine available resolutions
          const formats = info.formats || [];
          const videoHeights = new Set();
          formats.forEach(f => {
            if (f.vcodec && f.vcodec !== 'none' && f.height) {
              videoHeights.add(f.height);
            }
          });

          const sortedHeights = Array.from(videoHeights).sort((a, b) => b - a);

          const result = {
            id: info.id,
            title: info.title,
            channel: info.uploader || info.channel || 'Unknown Channel',
            channelUrl: info.uploader_url || '',
            duration: info.duration,
            durationString: this.formatDuration(info.duration),
            thumbnail: info.thumbnail,
            viewCount: info.view_count,
            availableResolutions: sortedHeights,
            maxResolution: sortedHeights.length > 0 ? `${sortedHeights[0]}p` : 'Best Available',
            webpageUrl: info.webpage_url || url
          };

          resolve(result);
        } catch (err) {
          reject(new Error('Failed to parse video metadata: ' + err.message));
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
   */
  startDownload(url, quality = 'highest', customFilename = null) {
    const downloadId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const outputTemplate = path.join(this.downloadsDir, '%(title).100s [%(id)s].%(ext)s');
    const ffmpegLocation = this.getFFmpegLocation();

    // Extract video ID if possible
    const videoIdMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/|embed\/|v\/)([a-zA-Z0-9_-]{11})/);
    const vid = videoIdMatch ? videoIdMatch[1] : null;

    let formatSelection = 'bv*+ba/b';
    const isAudioOnly = quality === 'audio_only' || quality === 'mp3';

    if (isAudioOnly) {
      formatSelection = 'ba/b';
    } else if (quality === '1080p') {
      formatSelection = 'bv*[height<=1080]+ba/b[height<=1080]/b';
    } else if (quality === '720p') {
      formatSelection = 'bv*[height<=720]+ba/b[height<=720]/b';
    } else if (quality === '480p') {
      formatSelection = 'bv*[height<=480]+ba/b[height<=480]/b';
    } else {
      // Highest possible (4K/8K 60fps) + best audio
      formatSelection = 'bv*+ba/b';
    }

    const args = [
      '-m', 'yt_dlp',
      '--newline',
      '--no-playlist',
      '--progress',
      '--windows-filenames',
      '--ffmpeg-location', ffmpegLocation,
      '-f', formatSelection,
      '-o', outputTemplate
    ];

    if (isAudioOnly) {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    const child = spawn(this.pythonPath, args);

    const downloadState = {
      id: downloadId,
      videoId: vid,
      url,
      quality,
      status: 'starting',
      progress: 0,
      speed: '0 KiB/s',
      eta: '--',
      size: '--',
      title: 'Downloading video...',
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
        if (!potential.match(/\.f\d+\./)) {
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
        downloadState.error = errText;
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

    // 1. Look for finished merged file for this video ID
    let finalMatch = null;
    if (vid) {
      finalMatch = files.find(f => f.includes(`[${vid}]`) && !f.match(/\.f\d+\./) && (f.endsWith('.mp4') || f.endsWith('.mp3') || f.endsWith('.mkv') || f.endsWith('.webm')));
    }

    // 2. Self-healing fallback: If no finished file, but video and audio fragments exist, merge them now!
    if (!finalMatch && vid) {
      const vidFiles = files.filter(f => f.includes(`[${vid}]`) && (f.includes('.f') || f.includes('.temp') || f.includes('.part')));
      const audioFrag = vidFiles.find(f => f.endsWith('.m4a') || f.endsWith('.opus') || f.endsWith('.mp3') || f.includes('.f251.') || f.includes('.f140.') || f.includes('.f250.') || f.includes('.f249.'));
      const videoFrag = vidFiles.find(f => f !== audioFrag && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv')));

      if (videoFrag && audioFrag) {
        const ffmpegExe = this.getFFmpegExe();
        const baseTitle = videoFrag.replace(/\.f\d+\.(mp4|webm|m4a|mkv)$/i, '').replace(/\[.*\]/, '').trim() || 'Downloaded_Video';
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

      // Clean up any lingering .f fragments, .part, .ytdl for this video ID
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
          if (f.match(/\.f\d+\./) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp')) {
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
      const vidMatch = query.match(/\[([a-zA-Z0-9_-]{11})\]/) || decoded.match(/\[([a-zA-Z0-9_-]{11})\]/) || query.match(/([a-zA-Z0-9_-]{11})/);
      if (vidMatch) {
        const vid = vidMatch[1];
        const mediaMatch = files.find(f => f.includes(`[${vid}]`) && !f.match(/\.f\d+\./) && /\.(mp4|mkv|webm|mp3|m4a)$/i.test(f));
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
        if (f.match(/\.f\d+\./) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp')) continue;
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
        if (f.match(/\.f\d+\./) || f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp') || f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.json')) {
          continue;
        }
        if (!/\.(mp4|mkv|webm|mp3|m4a|wav)$/i.test(f)) continue;

        const fullPath = path.join(this.downloadsDir, f);
        try {
          const st = fs.statSync(fullPath);
          if (st.isFile()) {
            results.push({
              filename: f,
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
    const explorerCmd = `explorer "${this.downloadsDir}"`;
    exec(explorerCmd);
    return true;
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
