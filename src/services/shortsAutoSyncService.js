const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const db = require('./db');
const auth = require('./auth');
const config = require('../config');
const videoDownloaderService = require('./videoDownloaderService');

class ShortsAutoSyncService {
  constructor() {
    this.ledgerFile = path.join(__dirname, '../../data/shorts_sync_ledger.json');
    this.tempDownloadDir = path.join(__dirname, '../../downloads/shorts_sync');
    this.io = null;
    this.isSyncing = false;
    this.schedulerTimer = null;
    this.syncLogs = [];
    this.currentSyncState = {
      isSyncing: false,
      stage: 'idle',
      progress: 0,
      message: 'Ready to clone and upload shorts.',
      candidate: null,
      uploadedUrl: null,
      error: null
    };

    if (!fs.existsSync(this.tempDownloadDir)) {
      try {
        fs.mkdirSync(this.tempDownloadDir, { recursive: true });
      } catch (e) {}
    }

    this.ledger = this.loadLedger();
    this.initScheduler();
  }

  emitProgress(data) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.currentSyncState = {
      ...this.currentSyncState,
      ...data,
      isSyncing: data.stage !== 'completed' && data.stage !== 'error' && data.stage !== 'idle',
      timestamp: timeStr
    };

    if (data.message) {
      this.syncLogs.push({ time: timeStr, stage: data.stage || 'info', text: data.message });
      if (this.syncLogs.length > 80) {
        this.syncLogs.shift();
      }
      console.log(`[ShortsSync] [${timeStr}] ${data.message}`);
    }

    if (this.io) {
      this.io.emit('shortsSyncProgress', {
        ...this.currentSyncState,
        logs: this.syncLogs
      });
    }
  }

  getSyncState() {
    return {
      isSyncing: this.isSyncing,
      ...this.currentSyncState,
      logs: this.syncLogs
    };
  }

  setSocketIO(io) {
    this.io = io;
  }

  loadLedger() {
    try {
      if (fs.existsSync(this.ledgerFile)) {
        const raw = fs.readFileSync(this.ledgerFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[ShortsSync] Error reading ledger file:', e.message);
    }
    return {
      settings: {
        targetChannelUrl: '',
        autoSyncEnabled: false,
        syncHour: 18, // 6:00 PM default
        privacyStatus: 'public', // 'public' | 'unlisted' | 'private'
        categoryId: '20', // 20 = Gaming, 24 = Entertainment
        appendShortsTag: true,
        lastSyncDate: null
      },
      destinationAccount: null,
      history: []
    };
  }

  saveLedger() {
    try {
      fs.writeFileSync(this.ledgerFile, JSON.stringify(this.ledger, null, 2), 'utf8');
    } catch (e) {
      console.error('[ShortsSync] Error saving ledger file:', e.message);
    }
  }

  getSettings() {
    return this.ledger.settings;
  }

  updateSettings(newSettings) {
    this.ledger.settings = { ...this.ledger.settings, ...newSettings };
    this.saveLedger();
    if (this.io) {
      this.io.emit('shortsSyncSettingsUpdated', this.ledger.settings);
    }
    return this.ledger.settings;
  }

  getClientCredentials() {
    const custom = this.ledger.settings?.customOAuth;
    if (custom?.clientId && custom?.clientSecret) {
      return {
        clientId: custom.clientId.trim(),
        clientSecret: custom.clientSecret.trim(),
        isCustom: true
      };
    }
    return {
      clientId: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      isCustom: false
    };
  }

  /**
   * Dedicated Destination Channel OAuth & Token Management
   */
  getDestinationAuthUrl(req = null) {
    const redirectUri = auth.resolveRedirectUri(req);
    const creds = this.getClientCredentials();
    const client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      redirectUri
    );

    const scopes = creds.isCustom
      ? [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      : [
          'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ];

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent',
      state: 'shorts_destination',
      scope: scopes
    });
  }

  async handleDestinationOAuthCallback(code, req = null) {
    const redirectUri = auth.resolveRedirectUri(req);
    const creds = this.getClientCredentials();
    const client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      redirectUri
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch channel info for THIS specific connected account
    const youtube = google.youtube({ version: 'v3', auth: client });
    const chRes = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true
    });

    let channelInfo = null;
    if (chRes.data?.items && chRes.data.items.length > 0) {
      const ch = chRes.data.items[0];
      channelInfo = {
        id: ch.id,
        title: ch.snippet.title,
        customUrl: ch.snippet.customUrl || '',
        avatar: ch.snippet.thumbnails?.default?.url || ch.snippet.thumbnails?.medium?.url || '',
        subscriberCount: ch.statistics.subscriberCount || '0',
        videoCount: ch.statistics.videoCount || '0'
      };
    }

    // Fetch user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    let userProfile = null;
    try {
      const uRes = await oauth2.userinfo.get();
      userProfile = {
        id: uRes.data.id,
        name: uRes.data.name,
        email: uRes.data.email,
        picture: uRes.data.picture
      };
    } catch (e) {}

    this.ledger.destinationAccount = {
      tokens,
      channelInfo,
      userProfile,
      connectedAt: new Date().toISOString()
    };
    this.saveLedger();

    db.addLog({
      type: 'system',
      message: `[ShortsSync] Dedicated upload channel connected: ${channelInfo ? channelInfo.title : 'Custom Account'}`
    });

    if (this.io) {
      this.io.emit('shortsDestinationAccountUpdated', this.getDestinationAccount());
    }

    return this.ledger.destinationAccount;
  }

  disconnectDestinationAccount() {
    this.ledger.destinationAccount = null;
    this.saveLedger();
    db.addLog({
      type: 'system',
      message: '[ShortsSync] Dedicated upload channel disconnected. Reverting to default.'
    });
    if (this.io) {
      this.io.emit('shortsDestinationAccountUpdated', this.getDestinationAccount());
    }
  }

  getDestinationAccount() {
    if (this.ledger.destinationAccount?.channelInfo) {
      return {
        isConnected: true,
        isDedicated: true,
        channel: this.ledger.destinationAccount.channelInfo,
        user: this.ledger.destinationAccount.userProfile,
        connectedAt: this.ledger.destinationAccount.connectedAt
      };
    }

    // Fallback to bot's primary authenticated channel
    if (auth.isAuthenticated()) {
      return {
        isConnected: true,
        isDedicated: false,
        channel: db.getChannelInfo(),
        user: db.getUserProfile(),
        connectedAt: null
      };
    }

    return {
      isConnected: false,
      isDedicated: false,
      channel: null,
      user: null,
      connectedAt: null
    };
  }

  getDestinationAuthClient() {
    if (this.ledger.destinationAccount?.tokens) {
      const redirectUri = auth.resolveRedirectUri();
      const creds = this.getClientCredentials();
      const client = new google.auth.OAuth2(
        creds.clientId,
        creds.clientSecret,
        redirectUri
      );
      client.setCredentials(this.ledger.destinationAccount.tokens);

      client.on('tokens', (refreshedTokens) => {
        const existing = this.ledger.destinationAccount.tokens || {};
        this.ledger.destinationAccount.tokens = {
          ...existing,
          ...refreshedTokens,
          refresh_token: refreshedTokens.refresh_token || existing.refresh_token
        };
        this.saveLedger();
      });

      return client;
    }

    // Fallback to primary bot auth if no dedicated destination channel connected
    if (auth.isAuthenticated()) {
      return auth.getOAuthClient();
    }

    return null;
  }

  getHistory() {
    return this.ledger.history || [];
  }

  isAlreadyProcessed(videoId) {
    return this.ledger.history.some(item => item.sourceVideoId === videoId && item.status === 'success');
  }

  /**
   * Scan top performing shorts from target channel sorted by views
   */
  async scanChannelShorts(channelUrl, limit = 20) {
    if (!channelUrl) {
      throw new Error('Target channel URL is required.');
    }

    let cleanUrl = channelUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (!cleanUrl.startsWith('@') && !cleanUrl.startsWith('channel/')) {
        cleanUrl = '@' + cleanUrl;
      }
      cleanUrl = 'https://www.youtube.com/' + cleanUrl;
    }
    // Normalize if /videos or /featured was given
    cleanUrl = cleanUrl.replace(/\/(videos|featured|community|streams)\/?$/i, '');
    if (!cleanUrl.endsWith('/shorts')) {
      cleanUrl = cleanUrl.replace(/\/+$/, '') + '/shorts';
    }

    const ytDlp = videoDownloaderService.resolveYtDlpBinary();
    const bypassArgs = this.getYtDlpBypassArgs();
    const args = [
      ...bypassArgs,
      '--flat-playlist',
      '-j',
      '--playlist-end', String(limit),
      cleanUrl
    ];

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      let child;
      if (ytDlp.isPythonModule) {
        child = spawn(ytDlp.cmd, ['-m', 'yt_dlp', ...args]);
      } else {
        child = spawn(ytDlp.cmd, args);
      }

      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });

      child.on('close', code => {
        if (code !== 0 && !stdout.trim()) {
          if (/404/i.test(stderr)) {
            return reject(new Error('YouTube channel ya shorts page nahi mila (404 Not Found). Channel handle ya URL sahi se check karein.'));
          }
          return reject(new Error(`yt-dlp failed to scan channel: ${stderr || 'Unknown error'}`));
        }

        const items = [];
        const lines = stdout.split(/\r?\n/).filter(l => l.trim().length > 0);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const videoId = data.id || data.url?.split('/').pop();
            if (!videoId) continue;

            const views = data.view_count || 0;
            const title = data.title || 'Untitled Short';
            const url = `https://www.youtube.com/shorts/${videoId}`;
            const isProcessed = this.isAlreadyProcessed(videoId);

            items.push({
              id: videoId,
              title,
              views,
              url,
              thumbnail: data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              isProcessed
            });
          } catch (e) {}
        }

        // Sort descending by view count
        items.sort((a, b) => (b.views || 0) - (a.views || 0));
        resolve(items);
      });
    });
  }

  saveCookies(cookiesText) {
    const sanitized = videoDownloaderService.sanitizeNetscapeCookies(cookiesText);
    if (!sanitized) {
      return {
        success: false,
        error: 'Invalid cookie format! File ka naam ("cookies.txt") nahi, balki cookies.txt file ko Notepad me open karke uska pura content copy-paste karein (jo "# Netscape HTTP Cookie File" se shuru hota hai).'
      };
    }
    const cookiePath = path.join(process.cwd(), 'data', 'cookies.txt');
    fs.writeFileSync(cookiePath, sanitized, 'utf8');
    try {
      fs.writeFileSync(path.join(process.cwd(), 'cookies.txt'), sanitized, 'utf8');
    } catch (e) {}
    return { success: true, size: sanitized.length };
  }

  getCookiesStatus() {
    const candidateFiles = [
      path.join(process.cwd(), 'data', 'cookies.txt'),
      path.join(process.cwd(), 'cookies.txt')
    ];
    for (const f of candidateFiles) {
      if (fs.existsSync(f) && fs.statSync(f).size > 10) {
        return { hasCookies: true, size: fs.statSync(f).size, path: f };
      }
    }
    return { hasCookies: false, size: 0 };
  }

  deleteCookies() {
    const candidateFiles = [
      path.join(process.cwd(), 'data', 'cookies.txt'),
      path.join(process.cwd(), 'cookies.txt')
    ];
    for (const f of candidateFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
    return { success: true };
  }

  getYtDlpBypassArgs() {
    return videoDownloaderService.getYtDlpBypassArgs('youtube');
  }

  /**
   * Download a short and extract its rich metadata (tags, title, description)
   */
  async downloadShortWithMetadata(videoId, fallbackMetadata = {}) {
    const videoUrl = `https://www.youtube.com/shorts/${videoId}`;
    const ytDlp = videoDownloaderService.resolveYtDlpBinary();
    const ffmpegExe = videoDownloaderService.getFFmpegExe();
    const bypassArgs = this.getYtDlpBypassArgs();

    const outputTemplate = path.join(this.tempDownloadDir, `${videoId}_%(title).50s.%(ext)s`);

    // 1. Fetch full metadata JSON (with graceful fallback if YouTube warns or throttles metadata endpoint)
    const metadata = await new Promise((resolve) => {
      const args = [
        ...bypassArgs,
        '-j',
        '--skip-download',
        '--no-warnings',
        videoUrl
      ];
      let stdout = '';
      let stderr = '';

      const child = ytDlp.isPythonModule
        ? spawn(ytDlp.cmd, ['-m', 'yt_dlp', ...args])
        : spawn(ytDlp.cmd, args);

      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });

      child.on('close', code => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout);
            return resolve(parsed);
          } catch (e) {}
        }
        console.warn(`[ShortsSync] Metadata fetch warning, using candidate metadata: ${stderr.substring(0, 150)}...`);
        resolve({
          title: fallbackMetadata.title || 'Viral Gaming Short',
          description: fallbackMetadata.description || '',
          tags: fallbackMetadata.tags || ['Shorts', 'FreeFire', 'Gaming'],
          view_count: fallbackMetadata.views || 0,
          id: videoId
        });
      });
    });

    // 2. Download highest quality video + audio merged to mp4 using mobile player bypass
    const downloadArgs = [
      ...bypassArgs,
      '-f', 'bestvideo*+bestaudio/best/18',
      '--merge-output-format', 'mp4',
      '--windows-filenames',
      '--no-mtime',
      '--newline',
      '-o', outputTemplate
    ];

    if (ffmpegExe && ffmpegExe !== 'ffmpeg') {
      downloadArgs.push('--ffmpeg-location', ffmpegExe);
    }

    downloadArgs.push(videoUrl);

    await new Promise((resolve, reject) => {
      let stderr = '';
      const child = ytDlp.isPythonModule
        ? spawn(ytDlp.cmd, ['-m', 'yt_dlp', ...downloadArgs])
        : spawn(ytDlp.cmd, downloadArgs);

      child.stdout.on('data', chunk => {
        const text = chunk.toString();
        const pctMatch = text.match(/\[download\]\s+([\d\.]+)%/i);
        if (pctMatch) {
          const dlPct = Math.min(100, parseFloat(pctMatch[1]));
          const sizeMatch = text.match(/of\s+~?([\d\.]+\s*[kMGTP]?i?B)/i);
          const speedMatch = text.match(/(?:at|in)\s+([\d\.]+\s*[kMGTP]?i?B\/s)/i);
          const etaMatch = text.match(/ETA\s+([\d\:]+)/i);
          const sizeStr = sizeMatch ? sizeMatch[1].trim() : '';
          const speedStr = speedMatch ? speedMatch[1].trim() : '';
          const etaStr = etaMatch ? etaMatch[1].trim() : '';

          // Composite pipeline progress (download spans 10% to 60%)
          const pipelinePct = Math.round(10 + (dlPct * 0.5));
          this.emitProgress({
            stage: 'downloading',
            progress: pipelinePct,
            downloadPercent: dlPct,
            size: sizeStr,
            speed: speedStr,
            eta: etaStr,
            message: `Downloading short: ${dlPct.toFixed(0)}%${sizeStr ? ` of ${sizeStr}` : ''}${speedStr ? ` @ ${speedStr}` : ''}${etaStr ? ` (ETA: ${etaStr})` : ''}`
          });
        }

        if (text.includes('[Merger]') || text.includes('[ExtractAudio]')) {
          this.emitProgress({
            stage: 'processing',
            progress: 60,
            message: 'Merging video & audio streams with FFmpeg...'
          });
        }
      });

      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('close', code => {
        if (code !== 0) {
          let errorDetail = stderr || 'Unknown error';
          if (/Sign in to confirm you’re not a bot|HTTP Error 429/i.test(stderr)) {
            errorDetail = `YouTube Bot Verification Triggered on Cloud Server (Datacenter IP Block). Click "Anti-Bot Cookies" above and paste your browser YouTube cookies.txt to bypass. [Details: ${stderr.substring(0, 180)}]`;
          }
          return reject(new Error(`Video download failed: ${errorDetail}`));
        }
        resolve();
      });
    });

    // 3. Locate downloaded file
    const files = fs.readdirSync(this.tempDownloadDir);
    const targetFile = files.find(f => f.startsWith(videoId) && f.endsWith('.mp4'));
    if (!targetFile) {
      throw new Error(`Downloaded MP4 file for ${videoId} not found in temp directory.`);
    }

    const downloadedPath = path.join(this.tempDownloadDir, targetFile);

    return {
      filePath: downloadedPath,
      metadata: {
        id: videoId,
        title: metadata.title || 'Untitled Short',
        description: metadata.description || '',
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        categories: metadata.categories || [],
        views: metadata.view_count || 0,
        originalUrl: videoUrl,
        uploader: metadata.uploader || metadata.channel || 'Unknown'
      }
    };
  }

  /**
   * Upload video to authenticated YouTube channel via Data API v3
   */
  async uploadToYouTube(filePath, metadata, privacyStatus = 'public', categoryId = '20') {
    const authClient = this.getDestinationAuthClient();
    if (!authClient) {
      throw new Error('Destination YouTube channel is not connected. Please connect your YouTube account on the Auto Shorts page.');
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: authClient
    });

    // Ensure title is <= 100 characters
    let title = metadata.title.trim();
    if (this.ledger.settings.appendShortsTag && !/#shorts/i.test(title)) {
      if (title.length <= 91) {
        title = `${title} #Shorts`;
      }
    }
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    // Prepare description
    let description = metadata.description || '';
    if (this.ledger.settings.appendShortsTag && !/#shorts/i.test(description)) {
      description = `${description}\n\n#Shorts #Viral #Trending`;
    }

    // Tags list (up to 500 chars total for YouTube)
    let tags = Array.isArray(metadata.tags) ? [...metadata.tags] : [];
    if (!tags.some(t => /shorts/i.test(t))) {
      tags.push('Shorts');
      tags.push('YouTube Shorts');
    }

    const fileSize = fs.statSync(filePath).size;
    const mediaStream = fs.createReadStream(filePath);

    const targetChannelName = this.ledger.destinationAccount?.channelInfo?.title || 'Connected Channel';
    this.emitProgress({
      stage: 'uploading',
      progress: 65,
      bytesUploaded: 0,
      totalBytes: fileSize,
      message: `Connecting to YouTube Data API v3 for channel: ${targetChannelName} (${(fileSize / (1024 * 1024)).toFixed(1)} MB)...`,
      title
    });

    let lastUploadPct = -1;
    const res = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: String(categoryId || '20')
          },
          status: {
            privacyStatus: privacyStatus || 'public',
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: mediaStream
        }
      },
      {
        onUploadProgress: (evt) => {
          const bytesRead = evt.bytesRead || 0;
          const uploadPct = Math.min(100, Math.round((bytesRead / fileSize) * 100));
          if (uploadPct !== lastUploadPct) {
            lastUploadPct = uploadPct;
            // Pipeline progress: Upload spans 65% to 98%
            const pipelinePct = Math.round(65 + (uploadPct * 0.33));
            this.emitProgress({
              stage: 'uploading',
              progress: pipelinePct,
              uploadPercent: uploadPct,
              bytesUploaded: bytesRead,
              totalBytes: fileSize,
              message: `Uploading to YouTube: ${uploadPct}% (${(bytesRead / (1024 * 1024)).toFixed(1)} MB / ${(fileSize / (1024 * 1024)).toFixed(1)} MB)...`,
              title
            });
          }
        }
      }
    );

    const uploadedId = res.data?.id;
    if (!uploadedId) {
      throw new Error('YouTube API did not return an uploaded video ID.');
    }

    return {
      uploadedId,
      uploadedUrl: `https://www.youtube.com/shorts/${uploadedId}`,
      title,
      privacyStatus
    };
  }

  /**
   * Master execution pipeline: scans target channel, picks #1 un-uploaded short, downloads, and uploads.
   */
  async runSyncPipeline(overrideChannelUrl = null) {
    if (this.isSyncing) {
      throw new Error('A sync process is already running. Please wait.');
    }

    const targetUrl = overrideChannelUrl || this.ledger.settings.targetChannelUrl;
    if (!targetUrl) {
      throw new Error('Please configure a target channel URL first.');
    }

    this.isSyncing = true;
    let downloadedFilePath = null;

    try {
      this.emitProgress({
        stage: 'scanning',
        progress: 5,
        message: `Scanning top performing shorts from ${targetUrl}...`
      });

      // 1. Scan channel shorts
      const shorts = await this.scanChannelShorts(targetUrl, 30);
      if (!shorts || shorts.length === 0) {
        throw new Error('No shorts found on the specified channel URL.');
      }

      this.emitProgress({
        stage: 'scanning',
        progress: 10,
        message: `Scanned ${shorts.length} shorts. Analyzing view counts to find #1 top short...`
      });

      // 2. Find top performing short not yet uploaded
      const candidate = shorts.find(s => !s.isProcessed);
      if (!candidate) {
        throw new Error('All top performing shorts from this channel have already been synced!');
      }

      this.emitProgress({
        stage: 'downloading',
        progress: 15,
        message: `Selected #1 Top Short: "${candidate.title}" (${(candidate.views || 0).toLocaleString()} views). Preparing stream download...`,
        candidate
      });

      // 3. Download video in highest quality + metadata
      const downloadResult = await this.downloadShortWithMetadata(candidate.id, {
        title: candidate.title,
        views: candidate.views,
        id: candidate.id,
        url: candidate.url
      });
      downloadedFilePath = downloadResult.filePath;

      this.emitProgress({
        stage: 'processing',
        progress: 62,
        message: `Video downloaded (${(fs.statSync(downloadedFilePath).size / (1024 * 1024)).toFixed(1)} MB). Preparing YouTube metadata and tags...`,
        candidate
      });

      // 4. Upload to destination YouTube channel
      const uploadResult = await this.uploadToYouTube(
        downloadedFilePath,
        downloadResult.metadata,
        this.ledger.settings.privacyStatus,
        this.ledger.settings.categoryId
      );

      // 5. Update ledger history
      const historyEntry = {
        id: `sync-${Date.now()}`,
        sourceVideoId: candidate.id,
        sourceTitle: candidate.title,
        sourceViews: candidate.views,
        sourceUrl: candidate.url,
        uploadedVideoId: uploadResult.uploadedId,
        uploadedUrl: uploadResult.uploadedUrl,
        uploadedTitle: uploadResult.title,
        privacyStatus: uploadResult.privacyStatus,
        syncedAt: new Date().toISOString(),
        status: 'success'
      };

      this.ledger.history.unshift(historyEntry);
      this.ledger.settings.lastSyncDate = new Date().toISOString().split('T')[0];
      this.saveLedger();

      // Log to system DB
      db.addLog({
        type: 'system',
        message: `[Auto Shorts] Cloned & Uploaded: "${candidate.title}" -> ${uploadResult.uploadedUrl}`
      });

      this.emitProgress({
        stage: 'completed',
        progress: 100,
        message: `🎉 Successfully uploaded! Short is live at ${uploadResult.uploadedUrl}`,
        candidate,
        historyEntry
      });

      if (this.io) {
        this.io.emit('shortsSyncSuccess', historyEntry);
        this.io.emit('shortsSyncHistoryUpdated', this.ledger.history);
      }

      return historyEntry;
    } catch (err) {
      this.emitProgress({
        stage: 'error',
        progress: 0,
        message: `Sync failed: ${err.message}`,
        error: err.message
      });
      if (this.io) {
        this.io.emit('shortsSyncError', { error: err.message });
      }
      throw err;
    } finally {
      // Clean up local temp video file
      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        try {
          fs.unlinkSync(downloadedFilePath);
        } catch (e) {}
      }
      this.isSyncing = false;
    }
  }

  /**
   * Hourly check for daily automated sync
   */
  initScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);

    // Check every 15 minutes
    this.schedulerTimer = setInterval(() => {
      try {
        const { autoSyncEnabled, syncHour, lastSyncDate, targetChannelUrl } = this.ledger.settings;
        if (!autoSyncEnabled || !targetChannelUrl) return;

        const now = new Date();
        const currentHour = now.getHours();
        const todayStr = now.toISOString().split('T')[0];

        if (currentHour >= (syncHour || 18) && lastSyncDate !== todayStr && !this.isSyncing) {
          console.log(`[ShortsSync] Daily auto-pilot triggered for ${targetChannelUrl}`);
          this.runSyncPipeline().catch(e => {
            console.error('[ShortsSync] Scheduled sync failed:', e.message);
          });
        }
      } catch (e) {
        console.error('[ShortsSync] Scheduler error:', e.message);
      }
    }, 15 * 60 * 1000);

    if (this.schedulerTimer.unref) {
      this.schedulerTimer.unref();
    }
  }
}

module.exports = new ShortsAutoSyncService();
