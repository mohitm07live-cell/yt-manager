require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { google } = require('googleapis');

const db = require('./services/db');
const auth = require('./services/auth');
const botEngine = require('./services/botEngine');
const ttsService = require('./services/ttsService');
const goalsService = require('./services/goalsService');
const soundboardService = require('./services/soundboardService');
const pollsService = require('./services/pollsService');
const loyaltyService = require('./services/loyaltyService');
const highlightsService = require('./services/highlightsService');
const aiResponderService = require('./services/aiResponderService');
const analyticsService = require('./services/analyticsService');
const geminiService = require('./services/geminiService');
const videoDownloaderService = require('./services/videoDownloaderService');
const youtubeService = require('./services/youtube');
const multiStreamService = require('./services/multiStreamService');
const config = require('./config');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = config.PORT;

// Connect Socket.IO to Services
botEngine.setSocketIO(io);
goalsService.setSocketIO(io);
soundboardService.setSocketIO(io);
pollsService.setSocketIO(io);
loyaltyService.setSocketIO(io);
multiStreamService.setSocketIO(io);
multiStreamService.init();

loyaltyService.setOnTimeoutCallback((timeoutMsg) => {
  if (botEngine.isRunning && auth.isAuthenticated() && botEngine.currentBroadcast?.liveChatId) {
    const authClient = auth.getOAuthClient();
    botEngine.sendBotChatResponse('trivia_timeout', 'System', timeoutMsg, authClient, false);
  }
});
highlightsService.setSocketIO(io);
videoDownloaderService.setSocketIO(io);
db.setQuotaChangeListener((quota) => {
  io.emit('quotaUpdated', quota);
});

// Sync Official Discord and Instagram Links
try {
  const allCmds = db.getCommands();
  const dCmd = allCmds.find(c => c.name === 'discord');
  if (dCmd) {
    db.updateCommand(dCmd.id, {
      response: "🎮 Join Mohit M07's official Discord server: https://discord.gg/mkHSm7mrdT $(user)!"
    });
  }
  const iCmd = allCmds.find(c => c.name === 'instagram');
  if (iCmd) {
    db.updateCommand(iCmd.id, {
      response: "📸 Follow Mohit M07 on Instagram: https://www.instagram.com/mohitm07live/ $(user)!"
    });
  } else {
    db.addCommand({
      name: 'instagram',
      response: "📸 Follow Mohit M07 on Instagram: https://www.instagram.com/mohitm07live/ $(user)!",
      enabled: true,
      userLevel: 'everyone',
      cooldown: 5
    });
  }

  // Update Timers
  const allTimers = db.getTimers();
  const dTimer = allTimers.find(t => t.id === 'timer-2' || t.name.toLowerCase().includes('discord'));
  if (dTimer) {
    db.updateTimer(dTimer.id, {
      message: "💬 Join our official Discord community for daily stream schedules, voice chats & giveaways: https://discord.gg/mkHSm7mrdT",
      intervalMinutes: 12
    });
  }
  const iTimer = allTimers.find(t => t.name.toLowerCase().includes('instagram'));
  if (iTimer) {
    db.updateTimer(iTimer.id, {
      message: "📸 Follow Mohit M07 on Instagram for behind-the-scenes & stream clips: https://www.instagram.com/mohitm07live/",
      intervalMinutes: 15
    });
  } else {
    db.addTimer({
      name: 'Instagram Follow',
      message: "📸 Follow Mohit M07 on Instagram for behind-the-scenes & stream clips: https://www.instagram.com/mohitm07live/",
      intervalMinutes: 15,
      minChatLines: 3,
      enabled: true
    });
  }

  // Commands Discovery Timer
  const cTimer = allTimers.find(t => t.name.toLowerCase().includes('command'));
  if (cTimer) {
    db.updateTimer(cTimer.id, {
      message: "🤖 Try out our live chat commands & mini-games! Type: !discord, !instagram, !points, !spin, !gamble, !trivia, !clip, !rules",
      intervalMinutes: 18
    });
  } else {
    db.addTimer({
      name: 'Commands & Mini-Games Discovery',
      message: "🤖 Try out our live chat commands & mini-games! Type: !discord, !instagram, !points, !spin, !gamble, !trivia, !clip, !rules",
      intervalMinutes: 18,
      minChatLines: 2,
      enabled: true
    });
  }
} catch (e) {
  console.warn('Error syncing official links:', e);
}

// Middlewares
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Health Check Endpoint (Render Health Checks & Uptime Keep-Alive)
// -------------------------------------------------------------
const healthHandler = (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    service: 'yt-management-bot',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    }
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

// Redirect user to Google OAuth consent screen
app.get('/auth/google', (req, res) => {
  try {
    const url = auth.getAuthUrl(req);
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

// OAuth Callback handler
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?error=No+code+provided');
  }

  try {
    await auth.handleCallback(code, req);
    res.redirect('/?auth=success');
  } catch (err) {
    console.error('OAuth Callback error:', err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// Get current auth status & profile
app.get('/api/auth/status', (req, res) => {
  const isAuth = auth.isAuthenticated();
  const user = db.getUserProfile();
  const channel = db.getChannelInfo();
  res.json({
    authenticated: isAuth,
    user,
    channel
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  botEngine.stop();
  auth.logout();
  res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// Bot Controls & Status Endpoints
// -------------------------------------------------------------

// Toggle bot active state
app.post('/api/bot/toggle', async (req, res) => {
  try {
    if (botEngine.isRunning) {
      botEngine.stop();
      res.json({ running: false, message: 'Bot stopped.' });
    } else {
      if (!auth.isAuthenticated()) {
        return res.status(401).json({ error: 'Please login with Google/YouTube first.' });
      }
      await botEngine.start();
      res.json({ running: true, message: 'Bot started successfully.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get complete bot state & stats
app.get('/api/bot/status', (req, res) => {
  const settings = db.getBotSettings();
  const stats = db.getStats();
  res.json({
    running: botEngine.isRunning,
    currentBroadcast: botEngine.currentBroadcast,
    settings,
    stats
  });
});

// Update bot settings (manual stream ID, prefix, etc.)
app.put('/api/bot/settings', (req, res) => {
  const updated = db.updateBotSettings(req.body);
  res.json({ success: true, settings: updated });
});

// Logs Endpoints
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getLogs(limit));
});

app.delete('/api/logs', (req, res) => {
  db.clearLogs();
  res.json({ success: true, message: 'Logs cleared' });
});

// -------------------------------------------------------------
// Commands Endpoints (CRUD)
// -------------------------------------------------------------

app.get('/api/commands', (req, res) => {
  res.json(db.getCommands());
});

app.post('/api/commands', (req, res) => {
  const { name, response, userLevel, cooldown, enabled } = req.body;
  if (!name || !response) {
    return res.status(400).json({ error: 'Command name and response are required.' });
  }
  const cmd = db.addCommand({ name, response, userLevel, cooldown, enabled });
  res.json(cmd);
});

app.put('/api/commands/:id', (req, res) => {
  const cmd = db.updateCommand(req.params.id, req.body);
  if (!cmd) return res.status(404).json({ error: 'Command not found.' });
  res.json(cmd);
});

app.delete('/api/commands/:id', (req, res) => {
  db.deleteCommand(req.params.id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Timers Endpoints (CRUD)
// -------------------------------------------------------------

app.get('/api/timers', (req, res) => {
  res.json(db.getTimers());
});

app.post('/api/timers', (req, res) => {
  const { name, message, intervalMinutes, minChatLines, enabled } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Timer message is required.' });
  }
  const timer = db.addTimer({ name, message, intervalMinutes, minChatLines, enabled });
  res.json(timer);
});

app.put('/api/timers/:id', (req, res) => {
  const timer = db.updateTimer(req.params.id, req.body);
  if (!timer) return res.status(404).json({ error: 'Timer not found.' });
  res.json(timer);
});

app.delete('/api/timers/:id', (req, res) => {
  db.deleteTimer(req.params.id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Auto-Moderation Endpoints
// -------------------------------------------------------------

app.get('/api/moderation', (req, res) => {
  res.json(db.getModeration());
});

app.put('/api/moderation', (req, res) => {
  const updated = db.updateModeration(req.body);
  res.json(updated);
});

// -------------------------------------------------------------
// Subscribers Tracking Endpoints
// -------------------------------------------------------------

const youtube = require('./services/youtube');

app.get('/api/subscribers', (req, res) => {
  const subscribers = db.getSubscribers();
  const events = db.getSubscriberEvents(50);
  const stats = db.getSubscriberStats();
  res.json({
    subscribers,
    events,
    stats
  });
});

app.post('/api/subscribers/sync', async (req, res) => {
  if (!auth.isAuthenticated()) {
    return res.status(401).json({ error: 'Please login with YouTube to sync subscribers.' });
  }

  try {
    const authClient = auth.getOAuthClient();
    const fetchedList = await youtube.fetchSubscribers(authClient);
    const syncResult = db.syncSubscribers(fetchedList);

    // Refresh official channel subscriber count + net changes
    const updatedChannel = await auth.fetchChannelInfo();
    const newCount = syncResult?.newCount || 0;
    const lostCount = syncResult?.lostCount || 0;
    const netChange = newCount - lostCount;

    let targetSubs = parseInt(updatedChannel?.subscriberCount || '2300', 10);
    if (netChange !== 0) {
      targetSubs = Math.max(0, targetSubs + netChange);
      if (updatedChannel) updatedChannel.subscriberCount = String(targetSubs);
      db.setChannelInfo(updatedChannel);
    }

    goalsService.setGoalValue('subscriberGoal', targetSubs);
    io.emit('channelUpdated', updatedChannel);
    io.emit('goalUpdated', { type: 'subscriberGoal', value: targetSubs });

    db.addLog({
      type: 'system',
      message: `Synced ${fetchedList.length} public subscribers. Channel Total: ${targetSubs} (New: +${syncResult.newCount}, Unsubscribed: -${syncResult.lostCount})`
    });

    // 🔔 FIRE LIVE ALERT for each NEW subscriber detected
    if (syncResult.newSubscribers && syncResult.newSubscribers.length > 0) {
      // Fire alerts with a small delay between each to avoid spam
      let delay = 0;
      for (const newSub of syncResult.newSubscribers) {
        setTimeout(async () => {
          try {
            await botEngine.triggerLiveAlert('subscriber', {
              user: newSub.name || 'New Subscriber',
              channelId: newSub.channelId,
              avatar: newSub.avatar
            }, authClient, false);
          } catch (e) {
            console.error('[SubAlert] Error firing subscriber alert:', e.message);
          }
        }, delay);
        delay += 2500; // 2.5 second gap between each alert if multiple new subs
      }
    }

    // 🔔 FIRE LIVE ALERT for each UNSUBSCRIBED user detected
    const alertsConfig = db.getAlertsConfig();
    if (alertsConfig?.unsubscriberAlert?.enabled && syncResult.lostSubscribers && syncResult.lostSubscribers.length > 0) {
      let delay = syncResult.newSubscribers.length * 2500 + 1000;
      for (const lostSub of syncResult.lostSubscribers) {
        setTimeout(async () => {
          try {
            await botEngine.triggerLiveAlert('unsubscriber', {
              user: lostSub.name || 'Viewer',
              channelId: lostSub.channelId
            }, authClient, false);
          } catch (e) {}
        }, delay);
        delay += 2000;
      }
    }

    io.emit('subscribersSynced', {
      stats: db.getSubscriberStats(),
      channel: updatedChannel,
      syncResult
    });

    res.json({
      success: true,
      syncResult,
      channel: updatedChannel,
      stats: db.getSubscriberStats(),
      subscribers: db.getSubscribers()
    });
  } catch (err) {
    console.error('Error syncing subscribers:', err.message);
    res.status(500).json({ error: `Failed to sync subscribers: ${err.message}` });
  }
});

// GET current channel info (subscriber count, etc.) - used by frontend polling
app.get('/api/channel', (req, res) => {
  const channel = db.getChannelInfo() || {};
  res.json({ success: true, channel });
});

// Refresh channel stats from YouTube API on demand
app.post('/api/channel/sync', async (req, res) => {
  if (!auth.isAuthenticated()) {
    return res.status(401).json({ error: 'Please login with YouTube first.' });
  }
  try {
    const channel = await auth.fetchChannelInfo();
    if (channel?.subscriberCount) {
      goalsService.setGoalValue('subscriberGoal', parseInt(channel.subscriberCount, 10));
      io.emit('goalUpdated', { type: 'subscriberGoal', value: parseInt(channel.subscriberCount, 10) });
    }
    io.emit('channelUpdated', channel);
    res.json({ success: true, channel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Live Stream Alerts & OBS Overlay Endpoints
// -------------------------------------------------------------

app.get('/api/alerts', (req, res) => {
  res.json(db.getAlertsConfig());
});

app.put('/api/alerts', (req, res) => {
  const updated = db.updateAlertsConfig(req.body);
  res.json({ success: true, alertsConfig: updated });
});

// Direct Media File Upload (GIF, MP4, WebM, PNG, WebP)
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.post('/api/upload-media', (req, res) => {
  const { fileName, fileData } = req.body;
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  try {
    let buffer;
    let ext = '.gif';
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
      const mime = matches[1].toLowerCase();
      if (mime.includes('mp4')) ext = '.mp4';
      else if (mime.includes('webm')) ext = '.webm';
      else if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('gif')) ext = '.gif';
    } else {
      buffer = Buffer.from(fileData, 'base64');
    }

    const cleanBaseName = (fileName || 'media')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueName = `alert_${Date.now()}_${cleanBaseName}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(targetPath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;
    res.json({
      success: true,
      fileUrl: fileUrl,
      fileName: uniqueName
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

app.post('/api/alerts/test', async (req, res) => {
  const { type, user, amount, message } = req.body;
  const alertType = type || 'subscriber';
  try {
    await botEngine.triggerLiveAlert(alertType, {
      user: user || 'Rohit Sharma',
      amount: amount !== undefined ? amount : (alertType === 'superChat' ? '₹500.00' : ''),
      message: message !== undefined ? message : (alertType === 'superChat' ? 'Keep up the amazing stream!' : '')
    }, null, true);
    res.json({ success: true, message: 'Test alert triggered!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getLogs(limit));
});

app.delete('/api/logs', (req, res) => {
  db.clearLogs();
  res.json({ success: true, message: 'Logs cleared' });
});

app.post('/api/test-message', async (req, res) => {
  const { user, text, isOwner, isMod } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Message text is required.' });
  }
  try {
    const result = await botEngine.simulateMessage(user, text, isOwner, isMod);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// High-Fidelity Text-to-Speech (TTS) Voice Endpoint for OBS CEF & Web
// -------------------------------------------------------------
app.get('/api/tts', async (req, res) => {
  const text = (req.query.text || '').trim();
  const alertsConfig = db.getAlertsConfig();
  const voice = req.query.voice || alertsConfig.voiceSettings?.voiceURI || 'hi';
  const rate = req.query.rate || alertsConfig.voiceSettings?.rate || 1.0;

  if (!text) {
    return res.status(400).send('Text parameter is required.');
  }

  try {
    const audioData = await ttsService.generateSpeechAudio(text, { voice, rate });
    if (!audioData || !audioData.buffer) {
      return res.status(500).send('TTS speech synthesis failed');
    }

    res.set({
      'Content-Type': audioData.contentType || 'audio/wav',
      'Content-Length': audioData.buffer.length,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    });

    res.send(audioData.buffer);
  } catch (err) {
    console.error('TTS audio error:', err.message);
    res.status(500).send('TTS Generation Failed');
  }
});

// -------------------------------------------------------------
// Live Goals Endpoints
// -------------------------------------------------------------
app.get('/api/goals', (req, res) => {
  res.json(goalsService.getGoals());
});

app.post('/api/goals', (req, res) => {
  const updated = goalsService.updateGoals(req.body);
  if (req.body?.subscriberGoal?.current !== undefined) {
    const ch = db.getChannelInfo() || {};
    ch.subscriberCount = String(req.body.subscriberGoal.current);
    db.setChannelInfo(ch);
    io.emit('channelUpdated', ch);
  }
  res.json({ success: true, goals: updated });
});

app.post('/api/goals/increment', (req, res) => {
  const { goalKey, amount } = req.body;
  goalsService.incrementGoal(goalKey, amount || 1);
  const currentGoals = goalsService.getGoals();
  if (goalKey === 'subscriberGoal' && currentGoals?.subscriberGoal?.current) {
    const ch = db.getChannelInfo() || {};
    ch.subscriberCount = String(currentGoals.subscriberGoal.current);
    db.setChannelInfo(ch);
    io.emit('channelUpdated', ch);
  }
  res.json({ success: true, goals: currentGoals });
});

// Force-sync goals from YouTube API (subscriber count, live likes)
app.post('/api/goals/sync', async (req, res) => {
  try {
    const goals = goalsService.getGoals();

    // Sync subscriber count from stored channel info (always available)
    const ch = db.getChannelInfo() || {};
    const storedSubs = parseInt(ch.subscriberCount || 0, 10);
    if (storedSubs > 0) {
      goalsService.setGoalValue('subscriberGoal', storedSubs);
    }

    // If bot is active and authenticated, also fetch fresh from YouTube API
    if (auth.isAuthenticated()) {
      try {
        const authClient = auth.getOAuthClient();
        const youtube = require('./services/youtube');
        // 1. Sync fresh subscriber count
        const chMetrics = await youtube.fetchChannelMetrics(authClient);
        if (chMetrics && chMetrics.subscriberCount) {
          const apiSub = parseInt(chMetrics.subscriberCount, 10);
          const currentGoal = goalsService.getGoals()?.subscriberGoal?.current || 2349;
          const apiFloor = Math.floor(apiSub / 10) * 10;
          const apiCeil = apiFloor + 9;
          let effectiveSubs = currentGoal;
          if (currentGoal < apiFloor) {
            effectiveSubs = apiFloor;
          } else if (currentGoal > apiCeil) {
            effectiveSubs = apiCeil;
          }

          const ch = db.getChannelInfo() || {};
          ch.subscriberCount = String(effectiveSubs);
          db.setChannelInfo(ch);
          goalsService.setGoalValue('subscriberGoal', effectiveSubs);
          io.emit('channelUpdated', ch);
        }

        // 2. Sync fresh live stream likes from active broadcast
        const broadcast = await youtube.findActiveBroadcast(authClient, db.getBotSettings()?.manualVideoId);
        if (broadcast && broadcast.likeCount !== undefined) {
          goalsService.setGoalValue('likeGoal', broadcast.likeCount);
        }
      } catch (e) { /* Use stored value if API fails */ }
    }

    // Broadcast updated goals to all connected widgets
    const updatedGoals = goalsService.getGoals();
    io.emit('goalsUpdate', updatedGoals);
    io.emit('goalUpdated', { synced: true });
    res.json({ success: true, goals: updatedGoals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Soundboard Endpoints
// -------------------------------------------------------------
app.get('/api/soundboard', (req, res) => {
  res.json(soundboardService.getSoundsList());
});

app.post('/api/soundboard/play', (req, res) => {
  const { soundId } = req.body;
  const result = soundboardService.playSound(soundId, 'Dashboard Streamer');
  if (result) {
    res.json({ success: true, sound: result });
  } else {
    res.status(404).json({ error: 'Sound not found' });
  }
});

// -------------------------------------------------------------
// Live Polls Endpoints
// -------------------------------------------------------------
app.get('/api/polls/active', (req, res) => {
  res.json({ poll: pollsService.getActivePoll() });
});

app.get('/api/polls/history', (req, res) => {
  res.json({ history: pollsService.getPollHistory() });
});

app.post('/api/polls/start', (req, res) => {
  try {
    const poll = pollsService.startPoll(req.body);
    res.json({ success: true, poll });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/polls/end', (req, res) => {
  const ended = pollsService.endPoll();
  res.json({ success: true, poll: ended });
});

app.post('/api/polls/vote', (req, res) => {
  const { authorId, authorName, vote } = req.body;
  const matched = pollsService.recordVote(authorId || 'sim_user', authorName || 'Viewer', vote);
  if (matched) {
    res.json({ success: true, option: matched, poll: pollsService.getActivePoll() });
  } else {
    res.status(400).json({ error: 'Invalid vote or poll ended/already voted.' });
  }
});

app.delete('/api/polls/active', (req, res) => {
  pollsService.clearPoll();
  res.json({ success: true });
});

// -------------------------------------------------------------
// Loyalty & Leaderboard Endpoints
// -------------------------------------------------------------
app.get('/api/loyalty/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json({ leaderboard: loyaltyService.getLeaderboard(limit) });
});

app.post('/api/loyalty/points', (req, res) => {
  const { authorId, authorName, amount, reason } = req.body;
  const newBalance = loyaltyService.addPoints(authorId, authorName, amount, reason || 'manual');
  res.json({ success: true, balance: newBalance });
});

app.post('/api/loyalty/trivia/start', async (req, res) => {
  try {
    const category = req.body?.category || 'Free Fire and Gaming';
    const tr = await loyaltyService.startTrivia(category);
    io.emit('triviaStarted', tr);

    const questionMsg = `🎯 [LIVE TRIVIA]: ${tr.question} (Chat me direct answer likho! First correct answer wins +${tr.reward} Points 💎)`;
    
    // Broadcast question to YouTube Live Chat if bot is active!
    if (botEngine.isRunning && auth.isAuthenticated() && botEngine.currentBroadcast?.liveChatId) {
      const authClient = auth.getOAuthClient();
      botEngine.sendBotChatResponse('trivia', 'All Viewers', questionMsg, authClient, false);
    } else {
      io.emit('botResponse', {
        command: 'trivia',
        author: 'Mohit M07 AI',
        response: questionMsg
      });
    }

    res.json({ success: true, trivia: tr, message: questionMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loyalty/gamble', (req, res) => {
  const { authorId, authorName, amount } = req.body;
  const result = loyaltyService.gamble(authorId || 'sim_user', authorName || 'Viewer', String(amount));
  res.json(result);
});

app.post('/api/loyalty/spin', (req, res) => {
  const { authorId, authorName } = req.body;
  const result = loyaltyService.spin(authorId || 'sim_user', authorName || 'Viewer');
  res.json(result);
});

// -------------------------------------------------------------
// Highlights & Stream Clips Endpoints
// -------------------------------------------------------------
app.get('/api/highlights', (req, res) => {
  res.json({ highlights: highlightsService.getHighlights() });
});

app.post('/api/highlights', (req, res) => {
  const { description, createdBy } = req.body;
  const hl = highlightsService.addHighlight(description, createdBy);
  res.json({ success: true, highlight: hl });
});

app.delete('/api/highlights/:id', (req, res) => {
  highlightsService.deleteHighlight(req.params.id);
  res.json({ success: true });
});

app.delete('/api/highlights', (req, res) => {
  highlightsService.clearHighlights();
  res.json({ success: true });
});

// -------------------------------------------------------------
// AI Responder & Google Gemini AI Endpoints
// -------------------------------------------------------------
app.get('/api/ai/settings', (req, res) => {
  res.json(aiResponderService.getSettings());
});

app.post('/api/ai/settings', (req, res) => {
  const updated = aiResponderService.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// Gemini AI Config & Key Management
app.get('/api/ai/gemini', (req, res) => {
  res.json(geminiService.getConfig());
});

app.post('/api/ai/gemini', (req, res) => {
  const { apiKey, model, customPrompt, enabled } = req.body;
  if (apiKey !== undefined && apiKey.trim() !== '') {
    geminiService.setApiKey(apiKey);
  }
  const updated = geminiService.saveConfig({
    ...(model ? { model } : {}),
    ...(customPrompt ? { customPrompt } : {}),
    ...(enabled !== undefined ? { enabled } : {})
  });
  res.json({ success: true, config: geminiService.getConfig() });
});

// Test Gemini AI Key
app.post('/api/ai/gemini/test', async (req, res) => {
  try {
    const { prompt } = req.body;
    const testPrompt = prompt || 'Say a 1-sentence friendly greeting in natural Hinglish for Mohit-M07 live stream viewers!';
    const result = await geminiService.generateText(testPrompt);
    res.json({ success: true, reply: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// YouTube API Quota Tracker Endpoint
// -------------------------------------------------------------
app.get('/api/quota', (req, res) => {
  res.json(db.getQuotaInfo());
});

app.post('/api/quota/reset', (req, res) => {
  const fresh = db.resetQuotaTracker();
  io.emit('quotaUpdated', fresh);
  res.json({ success: true, quota: fresh });
});

app.post('/api/quota/check', async (req, res) => {
  try {
    const yt = google.youtube({ version: 'v3', auth: auth.getOAuthClient() });
    const checkRes = await yt.channels.list({ part: ['snippet'], mine: true });
    // Live call succeeded! Quota is active!
    const fresh = db.resetQuotaTracker();
    io.emit('quotaUpdated', fresh);
    res.json({ success: true, liveOk: true, channel: checkRes.data.items[0]?.snippet?.title, quota: fresh });
  } catch (err) {
    if (err.errors?.[0]?.reason === 'quotaExceeded') {
      db.setQuotaExceeded(true);
      res.json({ success: false, quotaExceeded: true, quota: db.getQuotaInfo() });
    } else {
      res.status(400).json({ error: err.message, details: err.errors });
    }
  }
});

// -------------------------------------------------------------
// Deep Channel Analytics Endpoints
// -------------------------------------------------------------
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const data = await analyticsService.getChannelAnalytics(force);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch analytics: ${err.message}` });
  }
});

app.post('/api/analytics/refresh', async (req, res) => {
  try {
    const data = await analyticsService.getChannelAnalytics(true);
    res.json({ success: true, analytics: data });
  } catch (err) {
    res.status(500).json({ error: `Failed to refresh analytics: ${err.message}` });
  }
});

app.get('/api/analytics/videos', async (req, res) => {
  try {
    const data = await analyticsService.getChannelAnalytics(false);
    const allVideos = data.recentUploads || [];
    res.json({ success: true, videos: allVideos });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch channel videos: ${err.message}` });
  }
});

app.get('/api/analytics/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const data = await analyticsService.getVideoDeepAnalysis(videoId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Failed to inspect video: ${err.message}` });
  }
});

app.post('/api/analytics/video/:id/ai-train', async (req, res) => {
  try {
    const videoId = req.params.id;
    const result = await analyticsService.getVideoAiTrainingPackage(videoId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error generating AI training package:', err);
    res.status(500).json({ error: `Failed to generate AI package: ${err.message}` });
  }
});

// Update Video Metadata (Title, Description, Tags) directly on YouTube
app.post('/api/analytics/video/:id/update-meta', async (req, res) => {
  try {
    if (!auth.isAuthenticated()) {
      return res.status(401).json({ error: 'Please login with your YouTube account to update videos.' });
    }
    const videoId = analyticsService.extractVideoId(req.params.id);
    const { title, description, tags } = req.body;
    if (!title && !description && !tags) {
      return res.status(400).json({ error: 'At least one field (title, description, or tags) must be provided' });
    }
    const authClient = auth.getOAuthClient();
    const result = await youtubeService.updateVideoMetadata(authClient, videoId, { title, description, tags });
    res.json(result);
  } catch (err) {
    console.error('Error updating video metadata on YouTube:', err);
    res.status(500).json({ error: err.message || 'Failed to update video on YouTube' });
  }
});

// -------------------------------------------------------------
// YouTube Video Downloader Endpoints (Highest Possible Quality)
// -------------------------------------------------------------

app.post('/api/downloader/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube video URL is required' });
    }
    const info = await videoDownloaderService.getVideoInfo(url);
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to inspect YouTube video' });
  }
});

app.post('/api/downloader/start', (req, res) => {
  try {
    const { url, quality } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube video URL is required' });
    }
    const download = videoDownloaderService.startDownload(url, quality || 'highest');
    res.json({ success: true, download });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to start video download' });
  }
});

app.get('/api/downloader/status/:id', (req, res) => {
  const status = videoDownloaderService.getDownloadStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: 'Download not found' });
  }
  res.json({ success: true, status });
});

app.get('/api/downloader/files', (req, res) => {
  try {
    const files = videoDownloaderService.listCompletedDownloads();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/downloader/file/:filename', (req, res) => {
  try {
    const rawParam = req.params.filename;
    const fileObj = videoDownloaderService.findFile(rawParam);
    if (!fileObj || !fs.existsSync(fileObj.fullPath)) {
      return res.status(404).json({ error: 'Requested file does not exist or has been moved' });
    }

    const { filename, fullPath } = fileObj;
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`);
    if (filename.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filename.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filename.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'audio/mp4');
    }

    const stream = fs.createReadStream(fullPath);
    stream.on('error', (streamErr) => {
      if (!res.headersSent) {
        res.status(500).json({ error: streamErr.message });
      }
    });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get('/api/downloader/file-by-id/:id', (req, res) => {
  try {
    const videoId = req.params.id;
    const fileObj = videoDownloaderService.findFile(`[${videoId}]`);
    if (!fileObj || !fs.existsSync(fileObj.fullPath)) {
      return res.status(404).json({ error: `File for video ID ${videoId} not found` });
    }

    const { filename, fullPath } = fileObj;
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`);
    if (filename.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filename.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }

    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/downloader/file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const ok = videoDownloaderService.deleteDownload(filename);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/downloader/open-folder', (req, res) => {
  try {
    videoDownloaderService.openDownloadsFolder();
    res.json({ success: true, path: videoDownloaderService.downloadsDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AI Long Text-to-Speech (TTS) Studio Endpoints
// -------------------------------------------------------------

app.get('/api/tts/studio/voices', (req, res) => {
  try {
    const voices = ttsService.getAvailableVoices();
    res.json({ success: true, voices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tts/studio/generate', async (req, res) => {
  try {
    const { text, voice, rate, title } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text script is required for speech synthesis' });
    }

    // Generate asynchronously & broadcast progress via Socket.IO
    ttsService.generateLongSpeechAudio(
      { text, voice, rate: parseFloat(rate) || 1.0, title },
      (progressData) => {
        io.emit('ttsStudio_progress', progressData);
      }
    ).then((result) => {
      db.addTtsHistoryItem(result);
      io.emit('ttsStudio_completed', result);
    }).catch((err) => {
      io.emit('ttsStudio_error', { error: err.message });
    });

    res.json({ success: true, message: 'Text-to-Speech synthesis started in background!' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to start TTS synthesis' });
  }
});

app.get('/api/tts/studio/history', (req, res) => {
  try {
    const history = db.getTtsHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tts/studio/file/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const fullPath = path.join(ttsService.studioDir, filename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', 'audio/mpeg');

    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/tts/studio/file/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const fullPath = path.join(ttsService.studioDir, filename);

    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }

    db.deleteTtsHistoryItem(filename);
    res.json({ success: true, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Multi-Stream Live Chat Overlay Endpoints
// -------------------------------------------------------------

app.get('/api/multistream/config', (req, res) => {
  try {
    const config = db.getMultiStreamConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/multistream/channels', (req, res) => {
  try {
    const channelData = req.body;
    console.log('[MultiStream API] Received add channel request:', channelData);
    if (!channelData.input && !channelData.videoId && !channelData.channelId) {
      return res.status(400).json({ error: 'Stream URL, Video ID, or Channel handle is required' });
    }
    const newStream = db.addMultiStreamChannel(channelData);
    if (newStream.enabled && !newStream.isPrimary) {
      multiStreamService.startStreamPolling(newStream);
    }
    multiStreamService.broadcastStreamStatuses();
    io.emit('multiChat:configUpdated', db.getMultiStreamConfig());
    res.json({ success: true, stream: newStream, config: db.getMultiStreamConfig() });
  } catch (err) {
    console.error('[MultiStream API Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/multistream/channels/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = db.updateMultiStreamChannel(id, updates);
    if (updated) {
      if (updated.enabled && !updated.isPrimary) {
        multiStreamService.startStreamPolling(updated);
      } else if (!updated.enabled && !updated.isPrimary) {
        multiStreamService.stopStreamPolling(id);
      }
      multiStreamService.broadcastStreamStatuses();
      res.json({ success: true, stream: updated });
    } else {
      res.status(404).json({ error: 'Stream channel not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/multistream/channels/:id', (req, res) => {
  try {
    const { id } = req.params;
    const config = db.getMultiStreamConfig();
    const stream = config.streams.find(s => s.id === id);
    if (stream?.isPrimary) {
      return res.status(400).json({ error: 'Primary stream channel cannot be deleted.' });
    }
    db.removeMultiStreamChannel(id);
    multiStreamService.stopStreamPolling(id);
    res.json({ success: true, config: db.getMultiStreamConfig() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/multistream/settings', (req, res) => {
  try {
    const updatedConfig = db.updateMultiStreamSettings(req.body);
    io.emit('multiChat:configUpdated', updatedConfig);
    res.json({ success: true, config: updatedConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/multistream/launch-desktop', (req, res) => {
  try {
    const { exec } = require('child_process');
    const exePath = path.join(__dirname, '..', 'scripts', 'DesktopOverlay.exe');
    exec(`start "" "${exePath}"`, (err) => {
      if (err) console.error('Error launching DesktopOverlay.exe:', err);
    });
    res.json({ success: true, message: 'Transparent Desktop Overlay Launched!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/multistream/test-message', (req, res) => {
  try {
    const config = db.getMultiStreamConfig();
    const streams = config.streams;
    const randomStream = streams[Math.floor(Math.random() * streams.length)] || {
      id: 'stream-test',
      name: 'Test Gaming Stream',
      color: '#10B981'
    };

    const testUsers = ['GamerPro_99', 'NinjaLive', 'ProStreamer_IN', 'BeastGamer', 'ShadowRider'];
    const testComments = [
      '🔥 OPOPOP clutches in the game!',
      'What GPU are you using bro?',
      'Subscribe to the channel guys! ❤️',
      'GGWP! That sniper shot was crazy! 🎯',
      'Love the stream transparent overlay! Super clean!'
    ];

    const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
    const randomComment = testComments[Math.floor(Math.random() * testComments.length)];

    const mockMsg = {
      id: 'test-msg-' + Date.now(),
      streamId: randomStream.id,
      channelName: randomStream.name,
      channelColor: randomStream.color || '#F59E0B',
      authorName: randomUser,
      authorAvatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${randomUser}`,
      message: randomComment,
      timestamp: new Date().toISOString(),
      badges: {
        isOwner: Math.random() > 0.8,
        isModerator: Math.random() > 0.7,
        isMember: Math.random() > 0.6
      }
    };

    io.emit('multiChat:message', mockMsg);
    res.json({ success: true, message: mockMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// WebSocket Realtime Events
// -------------------------------------------------------------

io.on('connection', (socket) => {
  // Send current initial state
  socket.emit('initialState', {
    running: botEngine.isRunning,
    currentBroadcast: botEngine.currentBroadcast,
    stats: db.getStats(),
    logs: db.getLogs(30)
  });

  // Multi-Stream Overlay Socket Events
  socket.emit('multiChat:config', db.getMultiStreamConfig());
  multiStreamService.broadcastStreamStatuses();

  socket.on('multiChat:getStreams', () => {
    multiStreamService.broadcastStreamStatuses();
  });

  socket.on('multiChat:updateSettings', (settings) => {
    const updated = db.updateMultiStreamSettings(settings);
    io.emit('multiChat:configUpdated', updated);
  });

  socket.on('disconnect', () => {
    // Client disconnected
  });
});


// Start Server (Bind to 0.0.0.0 for Cloud / Docker / Render containers)
server.listen(PORT, '0.0.0.0', () => {
  const extUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`===================================================`);
  console.log(`🚀 YouTube Management Bot Server running on:`);
  console.log(`👉 Local:    http://localhost:${PORT}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🌐 External: ${process.env.RENDER_EXTERNAL_URL}`);
  }
  console.log(`🏥 Health:   ${extUrl}/health`);
  console.log(`===================================================`);

  // Auto-start bot if previously enabled and authenticated
  const settings = db.getBotSettings();
  if (settings.enabled && auth.isAuthenticated()) {
    botEngine.start().catch(err => {
      console.error('Failed to auto-start bot:', err.message);
    });
  }
});

// Graceful Shutdown for Cloud Deployments (Render / Docker / Kubernetes)
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  try {
    if (botEngine.isRunning) {
      console.log('Stopping Bot Engine...');
      botEngine.stop();
    }
  } catch (e) {
    console.error('Error stopping bot engine:', e.message);
  }

  server.close(() => {
    console.log('✅ HTTP and WebSocket server stopped.');
    process.exit(0);
  });

  // Force close after 10s if connections linger
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
