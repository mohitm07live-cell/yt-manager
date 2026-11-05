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
    let ledger = null;
    try {
      if (fs.existsSync(this.ledgerFile)) {
        const raw = fs.readFileSync(this.ledgerFile, 'utf8');
        ledger = JSON.parse(raw);
      }
    } catch (e) {
      console.error('[ShortsSync] Error reading ledger file:', e.message);
    }

    if (!ledger) {
      ledger = {
        activeChannel: 'channel_1',
        channels: {},
        history: []
      };
    }

    if (!ledger.channels) {
      ledger.channels = {};
    }

    // Channel 1 (Morning e.g. 06:00 AM) - migrate existing single settings if present
    if (!ledger.channels.channel_1) {
      ledger.channels.channel_1 = {
        id: 'channel_1',
        name: 'Channel 1 (Morning)',
        settings: ledger.settings || {
          targetChannelUrl: '',
          autoSyncEnabled: false,
          syncHour: 6, // 6:00 AM default
          privacyStatus: 'public',
          categoryId: '20',
          appendShortsTag: true,
          lastSyncDate: null
        },
        destinationAccount: ledger.destinationAccount || null
      };
    }

    // Channel 2 (Evening e.g. 06:00 PM)
    if (!ledger.channels.channel_2) {
      ledger.channels.channel_2 = {
        id: 'channel_2',
        name: 'Channel 2 (Evening)',
        settings: {
          targetChannelUrl: '',
          autoSyncEnabled: false,
          syncHour: 18, // 6:00 PM default
          privacyStatus: 'public',
          categoryId: '20',
          appendShortsTag: true,
          lastSyncDate: null
        },
        destinationAccount: null
      };
    }

    if (!ledger.activeChannel) {
      ledger.activeChannel = 'channel_1';
    }

    if (!ledger.history) {
      ledger.history = [];
    }

    return ledger;
  }

  saveLedger() {
    try {
      fs.writeFileSync(this.ledgerFile, JSON.stringify(this.ledger, null, 2), 'utf8');
    } catch (e) {
      console.error('[ShortsSync] Error saving ledger file:', e.message);
    }
  }

  getChannel(channelId = null) {
    const id = channelId || this.ledger.activeChannel || 'channel_1';
    if (!this.ledger.channels[id]) {
      this.ledger.channels[id] = {
        id,
        name: id === 'channel_1' ? 'Channel 1 (Morning)' : 'Channel 2 (Evening)',
        settings: {
          targetChannelUrl: '',
          autoSyncEnabled: false,
          syncHour: id === 'channel_1' ? 6 : 18,
          privacyStatus: 'public',
          categoryId: '20',
          appendShortsTag: true,
          lastSyncDate: null
        },
        destinationAccount: null
      };
      this.saveLedger();
    }
    return this.ledger.channels[id];
  }

  getActiveChannelId() {
    return this.ledger.activeChannel || 'channel_1';
  }

  setActiveChannelId(channelId) {
    if (this.ledger.channels[channelId]) {
      this.ledger.activeChannel = channelId;
      this.saveLedger();
      if (this.io) {
        this.io.emit('shortsSyncActiveChannelChanged', {
          activeChannel: channelId,
          channel: this.getChannel(channelId)
        });
      }
    }
    return this.ledger.activeChannel;
  }

  getChannelsSummary() {
    const res = {};
    for (const [id, ch] of Object.entries(this.ledger.channels || {})) {
      res[id] = {
        id,
        name: ch.name || id,
        settings: ch.settings,
        destinationAccount: this.getDestinationAccount(id)
      };
    }
    return {
      activeChannel: this.getActiveChannelId(),
      channels: res
    };
  }

  getSettings(channelId = null) {
    return this.getChannel(channelId).settings;
  }

  updateSettings(newSettings, channelId = null) {
    const ch = this.getChannel(channelId);
    ch.settings = { ...ch.settings, ...newSettings };
    this.saveLedger();
    if (this.io) {
      this.io.emit('shortsSyncSettingsUpdated', {
        channelId: ch.id,
        settings: ch.settings
      });
    }
    return ch.settings;
  }

  getClientCredentials(channelId = null) {
    const ch = this.getChannel(channelId);
    const custom = ch.settings?.customOAuth || this.ledger.settings?.customOAuth;
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
   * Dedicated Destination Channel OAuth & Token Management per Channel
   */
  getDestinationAuthUrl(req = null, channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const redirectUri = auth.resolveRedirectUri(req);
    const creds = this.getClientCredentials(targetChannelId);
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
          'https://www.googleapis.com/auth/userinfo.email',
          'openid'
        ]
      : [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid'
        ];

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent',
      state: `shorts_destination:${targetChannelId}`,
      scope: scopes
    });
  }

  async handleDestinationOAuthCallback(code, req = null, channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    const redirectUri = auth.resolveRedirectUri(req);
    const creds = this.getClientCredentials(targetChannelId);
    const client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      redirectUri
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch channel info for THIS specific connected account
    const youtube = google.youtube({ version: 'v3', auth: client });
    let channelInfo = null;
    try {
      const chRes = await youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true
      });
      if (chRes.data?.items && chRes.data.items.length > 0) {
        const item = chRes.data.items[0];
        channelInfo = {
          id: item.id,
          title: item.snippet.title,
          customUrl: item.snippet.customUrl || '',
          avatar: item.snippet.thumbnails?.default?.url || item.snippet.thumbnails?.medium?.url || '',
          subscriberCount: item.statistics.subscriberCount || '0',
          videoCount: item.statistics.videoCount || '0'
        };
      }
    } catch (e) {
      console.warn('[ShortsSync] Warning fetching channel info for destination:', e.message);
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

    ch.destinationAccount = {
      tokens,
      channelInfo,
      userProfile,
      connectedAt: new Date().toISOString()
    };
    this.saveLedger();

    db.addLog({
      type: 'system',
      message: `[ShortsSync] Destination channel connected for ${ch.name || targetChannelId}: ${channelInfo ? channelInfo.title : 'Custom Account'}`
    });

    if (this.io) {
      this.io.emit('shortsDestinationAccountUpdated', {
        channelId: targetChannelId,
        destinationAccount: this.getDestinationAccount(targetChannelId)
      });
    }

    return ch.destinationAccount;
  }

  disconnectDestinationAccount(channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    ch.destinationAccount = null;
    this.saveLedger();
    db.addLog({
      type: 'system',
      message: `[ShortsSync] Destination upload channel disconnected for ${ch.name || targetChannelId}.`
    });
    if (this.io) {
      this.io.emit('shortsDestinationAccountUpdated', {
        channelId: targetChannelId,
        destinationAccount: this.getDestinationAccount(targetChannelId)
      });
    }
  }

  getDestinationAccount(channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    if (ch.destinationAccount?.channelInfo) {
      return {
        isConnected: true,
        isDedicated: true,
        channel: ch.destinationAccount.channelInfo,
        user: ch.destinationAccount.userProfile,
        connectedAt: ch.destinationAccount.connectedAt
      };
    }

    // Fallback to primary bot auth if channel_1 and no dedicated destination
    if (targetChannelId === 'channel_1' && auth.isAuthenticated()) {
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

  getDestinationAuthClient(channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    if (ch.destinationAccount?.tokens) {
      const redirectUri = auth.resolveRedirectUri();
      const creds = this.getClientCredentials(targetChannelId);
      const client = new google.auth.OAuth2(
        creds.clientId,
        creds.clientSecret,
        redirectUri
      );
      client.setCredentials(ch.destinationAccount.tokens);

      client.on('tokens', (refreshedTokens) => {
        const existing = ch.destinationAccount.tokens || {};
        ch.destinationAccount.tokens = {
          ...existing,
          ...refreshedTokens,
          refresh_token: refreshedTokens.refresh_token || existing.refresh_token
        };
        this.saveLedger();
      });

      return client;
    }

    // Fallback to primary bot auth if channel_1 and no dedicated destination
    if (targetChannelId === 'channel_1' && auth.isAuthenticated()) {
      return auth.getOAuthClient();
    }

    return null;
  }

  getHistory(channelId = null) {
    const hist = this.ledger.history || [];
    if (!channelId) return hist;
    return hist.filter(h => !h.channelId || h.channelId === channelId);
  }

  isAlreadyProcessed(videoId, channelId = null) {
    return (this.ledger.history || []).some(item => {
      if (item.sourceVideoId !== videoId || item.status !== 'success') return false;
      if (channelId) {
        return item.channelId === channelId || !item.channelId;
      }
      return true;
    });
  }

  /**
   * Scan top performing shorts from target channel sorted by views
   */
  async scanChannelShorts(channelUrl, limit = 20, channelId = null) {
    if (!channelUrl) {
      throw new Error('Target channel URL is required.');
    }

    const targetChannelId = channelId || this.getActiveChannelId();

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
            const isProcessed = this.isAlreadyProcessed(videoId, targetChannelId);

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
  async uploadToYouTube(filePath, metadata, privacyStatus = 'public', categoryId = '20', channelId = null) {
    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    const authClient = this.getDestinationAuthClient(targetChannelId);
    if (!authClient) {
      throw new Error(`Destination YouTube channel for ${ch.name || targetChannelId} is not connected. Please connect your YouTube account.`);
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: authClient
    });

    // Ensure title is <= 100 characters
    let title = metadata.title.trim();
    if (ch.settings?.appendShortsTag && !/#shorts/i.test(title)) {
      if (title.length <= 91) {
        title = `${title} #Shorts`;
      }
    }
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    // Prepare description
    let description = metadata.description || '';
    if (ch.settings?.appendShortsTag && !/#shorts/i.test(description)) {
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

    const targetChannelName = ch.destinationAccount?.channelInfo?.title || ch.name || 'Connected Channel';
    this.emitProgress({
      stage: 'uploading',
      progress: 65,
      channelId: targetChannelId,
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
            categoryId: String(categoryId || ch.settings?.categoryId || '20')
          },
          status: {
            privacyStatus: privacyStatus || ch.settings?.privacyStatus || 'public',
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
              channelId: targetChannelId,
              uploadPercent: uploadPct,
              bytesUploaded: bytesRead,
              totalBytes: fileSize,
              message: `Uploading to YouTube (${targetChannelName}): ${uploadPct}% (${(bytesRead / (1024 * 1024)).toFixed(1)} MB / ${(fileSize / (1024 * 1024)).toFixed(1)} MB)...`,
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
  async runSyncPipeline(channelId = null, overrideChannelUrl = null) {
    if (this.isSyncing) {
      throw new Error('A sync process is already running. Please wait.');
    }

    const targetChannelId = channelId || this.getActiveChannelId();
    const ch = this.getChannel(targetChannelId);
    const targetUrl = overrideChannelUrl || ch.settings?.targetChannelUrl;
    if (!targetUrl) {
      throw new Error(`Please configure a target channel URL for ${ch.name || targetChannelId} first.`);
    }

    this.isSyncing = true;
    let downloadedFilePath = null;

    try {
      this.emitProgress({
        stage: 'scanning',
        progress: 5,
        channelId: targetChannelId,
        message: `[${ch.name || targetChannelId}] Scanning top performing shorts from ${targetUrl}...`
      });

      // 1. Scan channel shorts
      const shorts = await this.scanChannelShorts(targetUrl, 30, targetChannelId);
      if (!shorts || shorts.length === 0) {
        throw new Error('No shorts found on the specified channel URL.');
      }

      this.emitProgress({
        stage: 'scanning',
        progress: 10,
        channelId: targetChannelId,
        message: `Scanned ${shorts.length} shorts. Analyzing view counts to find #1 top short...`
      });

      // 2. Find top performing short not yet uploaded
      const candidate = shorts.find(s => !s.isProcessed);
      if (!candidate) {
        throw new Error(`All top performing shorts from this channel have already been synced for ${ch.name || targetChannelId}!`);
      }

      this.emitProgress({
        stage: 'downloading',
        progress: 15,
        channelId: targetChannelId,
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
        channelId: targetChannelId,
        message: `Video downloaded (${(fs.statSync(downloadedFilePath).size / (1024 * 1024)).toFixed(1)} MB). Preparing YouTube metadata and tags...`,
        candidate
      });

      // 4. Upload to destination YouTube channel
      const uploadResult = await this.uploadToYouTube(
        downloadedFilePath,
        downloadResult.metadata,
        ch.settings?.privacyStatus || 'public',
        ch.settings?.categoryId || '20',
        targetChannelId
      );

      // 5. Update ledger history
      const historyEntry = {
        id: `sync-${Date.now()}`,
        channelId: targetChannelId,
        channelName: ch.name || (targetChannelId === 'channel_1' ? 'Channel 1' : 'Channel 2'),
        destinationChannelTitle: ch.destinationAccount?.channelInfo?.title || 'Connected Channel',
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
      ch.settings.lastSyncDate = this.getIndianTime().todayStr;
      this.saveLedger();

      // Log to system DB
      db.addLog({
        type: 'system',
        message: `[Auto Shorts] [${ch.name || targetChannelId}] Cloned & Uploaded: "${candidate.title}" -> ${uploadResult.uploadedUrl}`
      });

      this.emitProgress({
        stage: 'completed',
        progress: 100,
        channelId: targetChannelId,
        message: `🎉 Successfully uploaded to ${ch.name || targetChannelId}! Live at ${uploadResult.uploadedUrl}`,
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
        channelId: targetChannelId,
        message: `Sync failed: ${err.message}`,
        error: err.message
      });
      if (this.io) {
        this.io.emit('shortsSyncError', { error: err.message, channelId: targetChannelId });
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
   * Helper to get IST (Asia/Kolkata) Date & Hour regardless of server host timezone (e.g. Render UTC)
   */
  getIndianTime(date = new Date()) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        hourCycle: 'h23'
      });
      const parts = formatter.formatToParts(date);
      const m = {};
      for (const p of parts) m[p.type] = p.value;
      return {
        todayStr: `${m.year}-${m.month}-${m.day}`,
        currentHour: parseInt(m.hour, 10)
      };
    } catch (e) {
      return {
        todayStr: date.toISOString().split('T')[0],
        currentHour: date.getHours()
      };
    }
  }

  /**
   * Hourly check for daily automated sync across all configured channels
   */
  initScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);

    // Check every 5 minutes
    this.schedulerTimer = setInterval(async () => {
      try {
        const { todayStr, currentHour } = this.getIndianTime();

        const channelIds = Object.keys(this.ledger.channels || {});
        for (const chId of channelIds) {
          const ch = this.ledger.channels[chId];
          if (!ch || !ch.settings) continue;

          const { autoSyncEnabled, syncHour, lastSyncDate, targetChannelUrl } = ch.settings;
          if (!autoSyncEnabled || !targetChannelUrl) continue;

          const targetHour = syncHour !== undefined ? Number(syncHour) : (chId === 'channel_1' ? 6 : 18);

          if (currentHour >= targetHour && lastSyncDate !== todayStr && !this.isSyncing) {
            console.log(`[ShortsSync] Scheduled auto-pilot triggered for ${ch.name || chId} (IST scheduled: ${targetHour}:00, IST current: ${currentHour}:00)`);
            try {
              await this.runSyncPipeline(chId);
            } catch (err) {
              console.error(`[ShortsSync] Scheduled sync failed for ${chId}:`, err.message);
            }
          }
        }
      } catch (e) {
        console.error('[ShortsSync] Scheduler error:', e.message);
      }
    }, 5 * 60 * 1000);

    if (this.schedulerTimer.unref) {
      this.schedulerTimer.unref();
    }
  }
}

module.exports = new ShortsAutoSyncService();
