const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function unmask(hex) {
  const buf = Buffer.from(hex, 'hex');
  const res = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    res[i] = buf[i] ^ 0x5A;
  }
  return res.toString('utf8');
}

const DEFAULT_DATA = {
  tokens: {
    access_token: unmask("233b6863743b6a1b3e171e6c1f32130f1b6b1133382e13202f3e39020d6f6c121618003d0a6d3418281f282377171529032022280d0a3e191f0f3b29020a6e28683b6222300d7734236d112239171f373e6b000f15632d343e3c3c0c10360a3f6977173409693012682a366e29132e28171d05032c373522003c0f282839110c3e6c1d003038153c0b1b6c292d2d0d3e770c3f2d0329383b093923636f090a380237296e0e1c1f382a6e0920161c3c05156b0a3b230f6e19200263362e6c1c39286d3d332b05681e31390e0d6c3e143b193d03111b391f091b0817091c0b121d026817331b130a18621f0029191133202d0c0f38172e2b28301b6a686a6d"),
    refresh_token: unmask("6b75756a3d2e0835132d2a2908222f0f193d03131b081b1b1d181b09142d1c7716631328162e302a362c681f081e05090f143e10151e0f2d003b621e6e032f006a123131340f386b1f22101b11363b1823362968620a226a1c000a6a302c6803370f63176c1103"),
    scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/youtube.force-ssl openid",
    token_type: "Bearer"
  },
  userProfile: {
    id: "106627652236199029883",
    name: "Mohit Sindhu",
    email: "mohitsindhu121@gmail.com",
    picture: "https://lh3.googleusercontent.com/a/ACg8ocJDgTF6ouvYfk-nMr9OvjdoVD5Xo9Y6cB7kQImb31apQLKs4XoY=s96-c"
  },
  channelInfo: {
    id: "UCx5BBHhn-OXQsjBWOnLvZug",
    title: "MOHIT-M07",
    customUrl: "@mohitm07livee",
    avatar: "https://yt3.ggpht.com/UiGHF1BF9d2-cEC14aRSo-r-9jMXVx55TH8JZSmtn347JL9_duo-yKUaT6N80_dYcHhgMeO7=s88-c-k-c0x00ffffff-no-rj",
    subscriberCount: "3290",
    videoCount: "139"
  },
  ttsHistory: [],
  botSettings: {
    enabled: false,
    manualVideoId: '',
    prefix: '!',
    pollingIntervalSeconds: 4,
    cooldownSeconds: 5,
    autoWelcomeSubscribers: true,
  },
  commands: [
    {
      id: 'cmd-1',
      name: 'discord',
      response: '🎮 Join Mohit M07\'s official Discord server: https://discord.gg/mkHSm7mrdT $(user)!',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 5,
      usageCount: 0
    },
    {
      id: 'cmd-2',
      name: 'instagram',
      response: '📸 Follow Mohit M07 on Instagram for stream updates & clips: https://www.instagram.com/mohitm07live/ $(user)!',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 5,
      usageCount: 0
    },
    {
      id: 'cmd-3',
      name: 'socials',
      response: '📱 Follow Mohit M07 on Socials: Instagram: https://www.instagram.com/mohitm07live/ | Discord: https://discord.gg/mkHSm7mrdT',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 5,
      usageCount: 0
    },
    {
      id: 'cmd-4',
      name: 'rules',
      response: '📜 Chat Rules: 1. Be respectful 2. No spam or abuse 3. No unauthorized self-promos 4. Have fun!',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 10,
      usageCount: 0
    },
    {
      id: 'cmd-5',
      name: 'uptime',
      response: '⏱️ Stream has been live for $(uptime)! Thanks for watching, $(user)!',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 5,
      usageCount: 0
    },
    {
      id: 'cmd-6',
      name: 'commands',
      response: '🤖 Available commands: !discord, !instagram, !socials, !uptime, !points, !leaderboard, !gamble, !spin, !trivia, !clip',
      enabled: true,
      userLevel: 'everyone',
      cooldown: 10,
      usageCount: 0
    }
  ],
  timers: [
    {
      id: 'timer-1',
      name: 'Subscribe & Like Reminder',
      message: '🔔 Enjoying the stream? Don\'t forget to Like, Subscribe & hit the Bell icon for alerts!',
      intervalMinutes: 10,
      minChatLines: 2,
      enabled: true,
      lastTriggered: 0
    },
    {
      id: 'timer-2',
      name: 'Discord Community',
      message: '💬 Join our official Discord community for daily stream schedules, voice chats & giveaways: https://discord.gg/mkHSm7mrdT',
      intervalMinutes: 12,
      minChatLines: 3,
      enabled: true,
      lastTriggered: 0
    },
    {
      id: 'timer-3',
      name: 'Instagram Follow',
      message: '📸 Follow Mohit M07 on Instagram for behind-the-scenes & stream clips: https://www.instagram.com/mohitm07live/',
      intervalMinutes: 15,
      minChatLines: 3,
      enabled: true,
      lastTriggered: 0
    }
  ],
  moderation: {
    profanity: {
      enabled: true,
      blacklist: [
        'bitch', 'asshole', 'fuck', 'shit', 'scam', 'free robux', 'free nitro',
        'madarchod', 'behenchod', 'chutiya', 'gandu', 'bhosdike', 'harami'
      ],
      action: 'delete', // 'delete' or 'timeout'
      timeoutSeconds: 300,
      customWarning: '⚠️ @$(user), please keep the chat clean and respectful.'
    },
    links: {
      enabled: true,
      allowlist: [
        'youtube.com', 'youtu.be', 'discord.gg', 'discord.com',
        'twitch.tv', 'twitter.com', 'x.com', 'instagram.com', 'github.com'
      ],
      action: 'delete',
      timeoutSeconds: 60,
      customWarning: '⚠️ @$(user), posting unauthorized links is not allowed.'
    },
    caps: {
      enabled: true,
      minCharLength: 8,
      maxCapsPercentage: 70,
      action: 'delete',
      timeoutSeconds: 30,
      customWarning: '⚠️ @$(user), please disable Caps Lock.'
    },
    repetitive: {
      enabled: true,
      maxRepeatedChars: 6,
      action: 'delete',
      timeoutSeconds: 30,
      customWarning: '⚠️ @$(user), please avoid excessive character repetition.'
    }
  },
  logs: [],
  alertsConfig: {
    subscriberAlert: {
      enabled: true,
      chatMessage: '🎉 Welcome to the stream @$(user)! Thank you for subscribing to MOHIT-M07! 🔥',
      obsBanner: true,
      voiceEnabled: true,
      mediaUrl: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
      mediaLayout: 'side'
    },
    unsubscriberAlert: {
      enabled: false,
      chatMessage: '👋 @$(user) has unsubscribed.',
      obsBanner: false,
      voiceEnabled: true,
      mediaUrl: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif',
      mediaLayout: 'side'
    },
    superChatAlert: {
      enabled: true,
      chatMessage: '💎 Huge thanks to @$(user) for the $(amount) Super Chat! $(message) ❤️',
      obsBanner: true,
      voiceEnabled: true,
      mediaUrl: 'https://media.giphy.com/media/67ThD16oZBrkE27cu6/giphy.gif',
      mediaLayout: 'side'
    },
    membershipAlert: {
      enabled: true,
      chatMessage: '👑 Welcome @$(user) to Channel Membership! Enjoy exclusive perks & badges! ✨',
      obsBanner: true,
      voiceEnabled: true,
      mediaUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
      mediaLayout: 'side'
    },
    voiceSettings: {
      enabled: true,
      voiceURI: '',
      voiceName: '',
      volume: 1.0,
      rate: 1.0,
      pitch: 1.0
    },
    appearanceSettings: {
      backgroundStyle: 'frosted',
      cardOpacity: 60,
      borderGlow: true,
      scanlines: false
    }
  },
  stats: {
    totalMessagesProcessed: 0,
    totalCommandsExecuted: 0,
    totalModerationActions: 0,
    totalTimersTriggered: 0,
    sessionStartTime: null
  },
  quotaTracker: {
    date: new Date().toISOString().split('T')[0],
    unitsUsed: 10000,
    dailyLimit: 10000,
    isExceeded: true,
    lastExceededTime: new Date().toISOString(),
    apiCalls: {
      chatList: 0,
      chatSend: 0,
      broadcastList: 0,
      subscribersSync: 0
    }
  },
  multiStreamConfig: {
    streams: [
      {
        id: 'stream-primary',
        name: 'Primary Stream (Mohit M07)',
        input: '',
        videoId: '',
        channelId: '',
        color: '#3B82F6',
        enabled: true,
        isPrimary: true
      }
    ],
    settings: {
      opacity: 0,
      fontSize: 14,
      showAvatars: true,
      showBadges: true,
      textShadow: true,
      soundAlert: false,
      lockOverlay: false,
      maxMessages: 100
    }
  }
};


class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_DATA, ...parsed };
      }
    } catch (err) {
      console.error('Error loading database, initializing defaults:', err);
    }
    this.save(DEFAULT_DATA);
    return DEFAULT_DATA;
  }

  reload() {
    this.data = this.load();
    return this.data;
  }

  save(dataToSave) {
    try {
      const data = dataToSave || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  // Tokens & Auth
  getTokens() {
    return this.data.tokens;
  }

  setTokens(tokens) {
    this.data.tokens = tokens;
    this.save();
  }

  getUserProfile() {
    return this.data.userProfile;
  }

  setUserProfile(profile) {
    this.data.userProfile = profile;
    this.save();
  }

  getChannelInfo() {
    return this.data.channelInfo;
  }

  setChannelInfo(info) {
    this.data.channelInfo = info;
    this.save();
  }

  // Multi-Stream Overlay Config & Channel Methods
  getMultiStreamConfig() {
    if (!this.data.multiStreamConfig) {
      this.data.multiStreamConfig = {
        streams: [
          {
            id: 'stream-primary',
            name: 'Primary Stream (Mohit M07)',
            input: '',
            videoId: '',
            channelId: '',
            color: '#3B82F6',
            enabled: true,
            isPrimary: true
          }
        ],
        settings: {
          opacity: 0,
          fontSize: 14,
          showAvatars: true,
          showBadges: true,
          textShadow: true,
          soundAlert: false,
          lockOverlay: false,
          maxMessages: 100
        }
      };
      this.save();
    }
    return this.data.multiStreamConfig;
  }

  updateMultiStreamSettings(settings) {
    const config = this.getMultiStreamConfig();
    config.settings = { ...config.settings, ...settings };
    this.save();
    return config;
  }

  addMultiStreamChannel(channelData) {
    const youtube = require('./youtube');
    const config = this.getMultiStreamConfig();
    const colors = ['#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const randomColor = colors[config.streams.length % colors.length];
    const extractedVid = youtube.extractVideoId(channelData.input || channelData.videoId || '');

    const newStream = {
      id: 'stream-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: channelData.name && channelData.name !== 'YouTube Live Stream' ? channelData.name : (extractedVid ? 'Live ' + extractedVid : 'YouTube Live Stream'),
      input: channelData.input || '',
      videoId: extractedVid || channelData.videoId || '',
      channelId: channelData.channelId || '',
      color: channelData.color || randomColor,
      enabled: channelData.enabled !== false,
      isPrimary: false,
      addedAt: Date.now()
    };
    config.streams.push(newStream);
    this.save();
    return newStream;
  }

  removeMultiStreamChannel(id) {
    const config = this.getMultiStreamConfig();
    config.streams = config.streams.filter(s => s.id !== id);
    this.save();
    return true;
  }

  updateMultiStreamChannel(id, updates) {
    const config = this.getMultiStreamConfig();
    const index = config.streams.findIndex(s => s.id === id);
    if (index !== -1) {
      config.streams[index] = { ...config.streams[index], ...updates };
      this.save();
      return config.streams[index];
    }
    return null;
  }


  // Commands
  getCommands() {
    return this.data.commands || [];
  }

  addCommand(command) {
    const newCmd = {
      id: 'cmd-' + Date.now(),
      name: command.name.toLowerCase().trim().replace(/^!/, ''),
      response: command.response,
      enabled: command.enabled !== false,
      userLevel: command.userLevel || 'everyone',
      cooldown: parseInt(command.cooldown, 10) || 5,
      usageCount: 0
    };
    this.data.commands.push(newCmd);
    this.save();
    return newCmd;
  }

  updateCommand(id, updates) {
    const index = this.data.commands.findIndex(c => c.id === id);
    if (index !== -1) {
      if (updates.name) {
        updates.name = updates.name.toLowerCase().trim().replace(/^!/, '');
      }
      this.data.commands[index] = { ...this.data.commands[index], ...updates };
      this.save();
      return this.data.commands[index];
    }
    return null;
  }

  deleteCommand(id) {
    this.data.commands = this.data.commands.filter(c => c.id !== id);
    this.save();
    return true;
  }

  incrementCommandUsage(name) {
    const cmd = this.data.commands.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (cmd) {
      cmd.usageCount = (cmd.usageCount || 0) + 1;
      this.data.stats.totalCommandsExecuted = (this.data.stats.totalCommandsExecuted || 0) + 1;
      this.save();
    }
  }

  // Timers
  getTimers() {
    return this.data.timers || [];
  }

  addTimer(timer) {
    const newTimer = {
      id: 'timer-' + Date.now(),
      name: timer.name || 'Scheduled Message',
      message: timer.message,
      intervalMinutes: Math.max(1, parseInt(timer.intervalMinutes, 10) || 10),
      minChatLines: Math.max(0, parseInt(timer.minChatLines, 10) || 3),
      enabled: timer.enabled !== false,
      lastTriggered: 0
    };
    this.data.timers.push(newTimer);
    this.save();
    return newTimer;
  }

  updateTimer(id, updates) {
    const index = this.data.timers.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.timers[index] = { ...this.data.timers[index], ...updates };
      this.save();
      return this.data.timers[index];
    }
    return null;
  }

  deleteTimer(id) {
    this.data.timers = this.data.timers.filter(t => t.id !== id);
    this.save();
    return true;
  }

  // Moderation
  getModeration() {
    return this.data.moderation;
  }

  updateModeration(settings) {
    this.data.moderation = { ...this.data.moderation, ...settings };
    this.save();
    return this.data.moderation;
  }

  // Bot Settings
  getBotSettings() {
    return this.data.botSettings;
  }

  updateBotSettings(settings) {
    this.data.botSettings = { ...this.data.botSettings, ...settings };
    this.save();
    return this.data.botSettings;
  }

  // Alerts Configuration
  getAlertsConfig() {
    const alerts = this.data.alertsConfig || DEFAULT_DATA.alertsConfig;
    if (!alerts.voiceSettings) {
      alerts.voiceSettings = { ...DEFAULT_DATA.alertsConfig.voiceSettings };
    }
    return alerts;
  }

  updateAlertsConfig(config) {
    this.data.alertsConfig = { ...this.data.alertsConfig, ...config };
    this.save();
    return this.data.alertsConfig;
  }

  // Stats
  getStats() {
    return this.data.stats;
  }

  incrementStat(key, amount = 1) {
    if (this.data.stats[key] !== undefined) {
      this.data.stats[key] += amount;
      this.save();
    }
  }

  // -------------------------------------------------------------
  // YouTube API Quota Tracker & Smart Daily Budget Management
  // -------------------------------------------------------------
  setQuotaChangeListener(callback) {
    this.quotaChangeListener = callback;
  }

  notifyQuotaChange() {
    if (typeof this.quotaChangeListener === 'function') {
      try {
        this.quotaChangeListener(this.getQuotaInfo());
      } catch (e) {}
    }
  }

  resetQuotaTracker() {
    const today = new Date().toISOString().split('T')[0];
    this.data.quotaTracker = {
      date: today,
      unitsUsed: 0,
      dailyLimit: 10000,
      isExceeded: false,
      lastExceededTime: null,
      lastResetTime: new Date().toISOString(),
      apiCalls: {
        chatList: 0,
        chatSend: 0,
        broadcastList: 0,
        subscribersSync: 0
      }
    };
    this.save();
    this.notifyQuotaChange();
    return this.getQuotaInfo();
  }

  getQuotaInfo() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Check if daily quota tracker needs reset (either new calendar date or passed 12:30 PM IST / 07:00 UTC reset time)
    const needsNewDay = !this.data.quotaTracker || this.data.quotaTracker.date !== today;

    // Check if lastExceededTime was before the most recent Google Cloud reset (07:00 UTC / 12:30 PM IST)
    let passedDailyResetSinceExceeded = false;
    if (this.data.quotaTracker && this.data.quotaTracker.isExceeded && this.data.quotaTracker.lastExceededTime) {
      const lastExceeded = new Date(this.data.quotaTracker.lastExceededTime);
      const todayResetTime = new Date();
      todayResetTime.setUTCHours(7, 0, 0, 0); // Midnight PDT (07:00 UTC)
      if (now >= todayResetTime && lastExceeded < todayResetTime) {
        passedDailyResetSinceExceeded = true;
      }
    }
    
    if (needsNewDay || passedDailyResetSinceExceeded) {
      this.data.quotaTracker = {
        date: today,
        unitsUsed: 0,
        dailyLimit: 10000,
        isExceeded: false,
        lastExceededTime: null,
        lastResetTime: new Date().toISOString(),
        apiCalls: {
          chatList: 0,
          chatSend: 0,
          broadcastList: 0,
          subscribersSync: 0
        }
      };
      this.save();
    }

    const q = this.data.quotaTracker;
    const pct = Math.min(100, Math.round((q.unitsUsed / q.dailyLimit) * 100));

    // Calculate next daily quota reset (12:00 AM PST / 12:30 PM IST / 07:00 UTC)
    const nextReset = new Date();
    nextReset.setUTCHours(7, 0, 0, 0);
    if (now >= nextReset) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }
    const msToReset = Math.max(0, nextReset.getTime() - now.getTime());
    const resetHours = Math.floor(msToReset / 3600000);
    const resetMins = Math.floor((msToReset % 3600000) / 60000);

    return {
      ...q,
      percentage: q.isExceeded ? 100 : pct,
      remaining: q.isExceeded ? 0 : Math.max(0, q.dailyLimit - q.unitsUsed),
      resetIn: `${resetHours}h ${resetMins}m`,
      nextResetISO: nextReset.toISOString()
    };
  }

  recordQuotaUsage(units = 1, apiType = 'chatList') {
    const info = this.getQuotaInfo();
    this.data.quotaTracker.unitsUsed = (this.data.quotaTracker.unitsUsed || 0) + units;
    if (this.data.quotaTracker.unitsUsed >= (this.data.quotaTracker.dailyLimit || 10000)) {
      this.data.quotaTracker.isExceeded = true;
      this.data.quotaTracker.lastExceededTime = new Date().toISOString();
    }
    if (this.data.quotaTracker.apiCalls && this.data.quotaTracker.apiCalls[apiType] !== undefined) {
      this.data.quotaTracker.apiCalls[apiType] += 1;
    }
    this.save();
    this.notifyQuotaChange();
  }

  setQuotaExceeded(exceeded = true) {
    this.getQuotaInfo();
    this.data.quotaTracker.isExceeded = exceeded;
    if (exceeded) {
      this.data.quotaTracker.unitsUsed = this.data.quotaTracker.dailyLimit || 10000;
      this.data.quotaTracker.lastExceededTime = new Date().toISOString();
    }
    this.save();
    this.notifyQuotaChange();
  }

  // Logs
  getLogs(limit = 100) {
    return (this.data.logs || []).slice(-limit).reverse();
  }

  addLog(entry) {
    const logItem = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type: entry.type || 'info', // 'command', 'moderation', 'timer', 'system', 'error'
      message: entry.message,
      author: entry.author || 'System',
      action: entry.action || null,
      details: entry.details || null
    };
    
    if (!this.data.logs) this.data.logs = [];
    this.data.logs.push(logItem);
    
    // Keep max 500 logs in memory
    if (this.data.logs.length > 500) {
      this.data.logs = this.data.logs.slice(-500);
    }
    this.save();
    return logItem;
  }

  // -------------------------------------------------------------
  // Subscribers Tracker & History
  // -------------------------------------------------------------
  getSubscribers() {
    return this.data.subscribers || [];
  }

  getSubscriberEvents(limit = 100) {
    return (this.data.subscriberEvents || []).slice(-limit).reverse();
  }

  getSubscriberStats() {
    const subs = this.data.subscribers || [];
    const active = subs.filter(s => s.status === 'active').length;
    const unsubscribed = subs.filter(s => s.status === 'unsubscribed').length;
    return {
      totalTracked: subs.length,
      activeCount: active,
      unsubscribedCount: unsubscribed,
      lastSync: this.data.subscriberStats?.lastSync || null
    };
  }

  syncSubscribers(fetchedList = []) {
    if (!this.data.subscribers) this.data.subscribers = [];
    if (!this.data.subscriberEvents) this.data.subscriberEvents = [];

    const existingMap = new Map();
    this.data.subscribers.forEach(sub => {
      existingMap.set(sub.channelId, sub);
    });

    const now = new Date().toISOString();
    const fetchedChannelIds = new Set();
    const newSubscribers = [];
    const lostSubscribers = [];

    // 1. Process all fetched subscribers
    for (const item of fetchedList) {
      if (!item.channelId) continue;
      fetchedChannelIds.add(item.channelId);

      const existing = existingMap.get(item.channelId);
      if (!existing) {
        // Brand New Subscriber
        const newSub = {
          id: item.id || 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          channelId: item.channelId,
          name: item.name,
          avatar: item.avatar,
          description: item.description,
          subscribedAt: item.subscribedAt || now,
          status: 'active',
          firstDetected: now,
          unsubscribedAt: null
        };
        this.data.subscribers.unshift(newSub);
        newSubscribers.push(newSub);

        // Record event
        this.data.subscriberEvents.push({
          id: 'subev-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          type: 'subscribed',
          name: item.name,
          channelId: item.channelId,
          avatar: item.avatar,
          timestamp: now
        });
      } else {
        // Update details
        existing.name = item.name || existing.name;
        existing.avatar = item.avatar || existing.avatar;
        existing.subscribedAt = item.subscribedAt || existing.subscribedAt;

        // If previously marked as unsubscribed and now returned:
        if (existing.status === 'unsubscribed') {
          existing.status = 'active';
          existing.reSubscribedAt = now;
          newSubscribers.push(existing);

          this.data.subscriberEvents.push({
            id: 'subev-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            type: 'resubscribed',
            name: item.name,
            channelId: item.channelId,
            avatar: item.avatar,
            timestamp: now
          });
        }
      }
    }

    // 2. Detect Unsubscribers (Previously active, but missing from new fetched list)
    // Only detect if fetchedList has items to prevent false positives during empty queries
    if (fetchedList.length > 0) {
      for (const sub of this.data.subscribers) {
        if (sub.status === 'active' && !fetchedChannelIds.has(sub.channelId)) {
          sub.status = 'unsubscribed';
          sub.unsubscribedAt = now;
          lostSubscribers.push(sub);

          this.data.subscriberEvents.push({
            id: 'subev-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            type: 'unsubscribed',
            name: sub.name,
            channelId: sub.channelId,
            avatar: sub.avatar,
            timestamp: now
          });
        }
      }
    }

    // Update stats metadata
    if (!this.data.subscriberStats) this.data.subscriberStats = {};
    this.data.subscriberStats.lastSync = now;

    // Keep max 500 events
    if (this.data.subscriberEvents.length > 500) {
      this.data.subscriberEvents = this.data.subscriberEvents.slice(-500);
    }

    this.save();
    return {
      newCount: newSubscribers.length,
      lostCount: lostSubscribers.length,
      newSubscribers,
      lostSubscribers,
      totalTracked: this.data.subscribers.length
    };
  }

  getTtsHistory() {
    if (!Array.isArray(this.data.ttsHistory)) {
      this.data.ttsHistory = [];
    }
    return this.data.ttsHistory;
  }

  addTtsHistoryItem(item) {
    if (!Array.isArray(this.data.ttsHistory)) {
      this.data.ttsHistory = [];
    }
    this.data.ttsHistory.unshift(item);
    // Keep max 100 entries in history
    if (this.data.ttsHistory.length > 100) {
      this.data.ttsHistory = this.data.ttsHistory.slice(0, 100);
    }
    this.save();
    return item;
  }

  deleteTtsHistoryItem(id) {
    if (!Array.isArray(this.data.ttsHistory)) return false;
    const initialLen = this.data.ttsHistory.length;
    this.data.ttsHistory = this.data.ttsHistory.filter(h => h.id !== id && h.filename !== id);
    if (this.data.ttsHistory.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // AI VIDEO COMMENTS AUTO-RESPONDER METHODS
  // ==========================================
  getCommentResponderSettings() {
    if (!this.data.commentAutoResponder) {
      this.data.commentAutoResponder = {
        enabled: false,
        checkIntervalSeconds: 60,
        persona: 'friendly_gamer',
        customPrompt: '',
        maxDailyReplies: 100,
        repliesToday: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        minCommentLength: 2,
        filterSpam: true,
        ignoreOwnComments: true,
        specificVideoOnly: false,
        specificVideoId: '',
        totalRepliedCount: 0,
        lastCheckTime: null
      };
      this.save();
    }

    // Daily reset check
    const today = new Date().toISOString().split('T')[0];
    if (this.data.commentAutoResponder.lastResetDate !== today) {
      this.data.commentAutoResponder.repliesToday = 0;
      this.data.commentAutoResponder.lastResetDate = today;
      this.save();
    }

    return this.data.commentAutoResponder;
  }

  updateCommentResponderSettings(newSettings) {
    const current = this.getCommentResponderSettings();
    this.data.commentAutoResponder = { ...current, ...newSettings };
    this.save();
    return this.data.commentAutoResponder;
  }

  getRepliedCommentIds() {
    if (!Array.isArray(this.data.repliedCommentIds)) {
      this.data.repliedCommentIds = [];
    }
    return this.data.repliedCommentIds;
  }

  isCommentReplied(commentId) {
    if (!commentId) return true;
    const ids = this.getRepliedCommentIds();
    return ids.includes(commentId);
  }

  markCommentReplied(commentId, metadata = {}) {
    if (!commentId) return;
    if (!Array.isArray(this.data.repliedCommentIds)) {
      this.data.repliedCommentIds = [];
    }
    if (!this.data.repliedCommentIds.includes(commentId)) {
      this.data.repliedCommentIds.push(commentId);
      // Keep up to 2000 remembered IDs
      if (this.data.repliedCommentIds.length > 2000) {
        this.data.repliedCommentIds = this.data.repliedCommentIds.slice(-2000);
      }
    }

    // Increment today and total counts
    const settings = this.getCommentResponderSettings();
    settings.repliesToday = (settings.repliesToday || 0) + 1;
    settings.totalRepliedCount = (settings.totalRepliedCount || 0) + 1;

    // Add to logs
    this.addCommentReplyLog({
      id: 'cr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      commentId,
      videoId: metadata.videoId || '',
      videoTitle: metadata.videoTitle || '',
      authorName: metadata.authorName || 'Viewer',
      authorAvatar: metadata.authorAvatar || '',
      commentText: metadata.commentText || '',
      replyText: metadata.replyText || '',
      publishedAt: metadata.publishedAt || new Date().toISOString(),
      repliedAt: new Date().toISOString(),
      status: metadata.status || 'success'
    });

    this.save();
  }

  getCommentReplyLogs() {
    if (!Array.isArray(this.data.commentReplyLogs)) {
      this.data.commentReplyLogs = [];
    }
    return this.data.commentReplyLogs;
  }

  addCommentReplyLog(logItem) {
    if (!Array.isArray(this.data.commentReplyLogs)) {
      this.data.commentReplyLogs = [];
    }
    this.data.commentReplyLogs.unshift(logItem);
    if (this.data.commentReplyLogs.length > 200) {
      this.data.commentReplyLogs = this.data.commentReplyLogs.slice(0, 200);
    }
    this.save();
  }

  clearCommentReplyLogs() {
    this.data.commentReplyLogs = [];
    this.save();
    return true;
  }
}

module.exports = new Database();

