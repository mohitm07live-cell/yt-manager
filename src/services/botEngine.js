const EventEmitter = require('events');
const db = require('./db');
const auth = require('./auth');
const youtube = require('./youtube');
const ttsService = require('./ttsService');
const goalsService = require('./goalsService');
const soundboardService = require('./soundboardService');
const pollsService = require('./pollsService');
const loyaltyService = require('./loyaltyService');
const highlightsService = require('./highlightsService');
const aiResponderService = require('./aiResponderService');
const geminiService = require('./geminiService');

class BotEngine extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.isPolling = false;
    this.pollTimeout = null;
    this.timerInterval = null;
    this.currentBroadcast = null;
    this.nextPageToken = null;
    this.processedMessageIds = new Set();
    this.commandCooldowns = new Map(); // commandName -> timestamp
    this.userCooldowns = new Map(); // userId+cmd -> timestamp
    this.chatLinesSinceLastTimer = 0;
    this.streamStartTime = null;
    this.io = null; // Socket.io instance

    // === ANTI-SPAM SELF-LOOP PROTECTION ===
    // Track every message ID the bot itself sends (from YouTube API response)
    this.botSentMessageIds = new Set();
    // Track every message text the bot sends (as fallback if ID not captured)
    // Map: text -> timestamp (expire after 60s)
    this.botSentTexts = new Map();
  }

  setSocketIO(io) {
    this.io = io;
  }

  broadcast(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
    this.emit(event, data);
  }

  async start() {
    if (this.isRunning) return;
    if (!auth.isAuthenticated()) {
      throw new Error('Bot cannot start: Not authenticated with Google/YouTube.');
    }

    this.isRunning = true;
    const settings = db.getBotSettings();
    settings.enabled = true;
    db.updateBotSettings(settings);

    db.addLog({
      type: 'system',
      message: 'Bot Engine started. Searching for active live stream...'
    });
    this.broadcast('botStatus', { running: true });

    // Start background stream checker and polling loop
    this.pollLoop();
    this.startTimers();
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const settings = db.getBotSettings();
    settings.enabled = false;
    db.updateBotSettings(settings);

    this.currentBroadcast = null;
    this.nextPageToken = null;
    this.processedMessageIds.clear();

    db.addLog({
      type: 'system',
      message: 'Bot Engine stopped.'
    });
    this.broadcast('botStatus', { running: false, stream: null });
  }

  async pollLoop() {
    if (!this.isRunning) return;

    try {
      const quotaInfo = db.getQuotaInfo();
      if (quotaInfo.isExceeded) {
        this.broadcast('quotaStandby', {
          message: 'YouTube API Quota limit reached (10,000 units). Bot in standby mode.',
          quota: quotaInfo
        });
        // Sleep for 5 minutes during quota exhaustion before checking reset
        this.pollTimeout = setTimeout(() => this.pollLoop(), 300000);
        return;
      }

      const authClient = auth.getOAuthClient();
      const settings = db.getBotSettings();

      // If no broadcast or liveChatId, try to find active broadcast
      if (!this.currentBroadcast || !this.currentBroadcast.liveChatId) {
        this.currentBroadcast = await youtube.findActiveBroadcast(authClient, settings.manualVideoId);
        
        if (this.currentBroadcast && this.currentBroadcast.liveChatId) {
          if (this.currentBroadcast.publishedAt) {
            this.streamStartTime = new Date(this.currentBroadcast.publishedAt);
          } else {
            this.streamStartTime = new Date();
          }

          // ✅ Tell AI responder which stream we're connected to
          // This ensures per-stream welcomed tracking:
          //   - Same stream: user NOT welcomed again (even after server restart)
          //   - New stream (new video ID): fresh welcome for everyone
          aiResponderService.resetForNewStream(this.currentBroadcast.id);

          // Sync initial live likes & subscriber goals with real YouTube numbers
          if (this.currentBroadcast.likeCount !== undefined) {
            goalsService.setGoalValue('likeGoal', this.currentBroadcast.likeCount);
          }
          const channelSubs = parseInt(db.getChannelInfo()?.subscriberCount || 2270, 10);
          goalsService.setGoalValue('subscriberGoal', channelSubs);

          db.addLog({
            type: 'system',
            message: `Connected to Live Stream: "${this.currentBroadcast.title}" (Chat ID: ${this.currentBroadcast.liveChatId}, Likes: ${this.currentBroadcast.likeCount || 0})`
          });
          this.broadcast('streamStatus', {
            live: true,
            broadcast: this.currentBroadcast
          });
        } else {
          this.broadcast('streamStatus', {
            live: false,
            message: 'No active live stream detected on your channel.'
          });
          // Wait 60 seconds before checking for live broadcast again to conserve quota
          this.pollTimeout = setTimeout(() => this.pollLoop(), 60000);
          return;
        }
      }

      // Periodically refresh Live Likes and Concurrent Viewers (every ~20s, every 5 polls)
      this.pollCount = (this.pollCount || 0) + 1;
      if (this.pollCount % 5 === 0 && this.currentBroadcast?.id) {
        youtube.fetchVideoLiveMetrics(authClient, this.currentBroadcast.id).then(vMetrics => {
          if (vMetrics) {
            this.currentBroadcast.likeCount = vMetrics.likeCount;
            this.currentBroadcast.concurrentViewers = vMetrics.concurrentViewers;
            goalsService.setGoalValue('likeGoal', vMetrics.likeCount);
            this.broadcast('streamStatus', {
              live: true,
              broadcast: this.currentBroadcast
            });
          }
        }).catch(() => {});
      }

      // Periodically sync real subscriber count directly from YouTube Channel API (every ~25-30s, every 8 polls)
      if (this.pollCount % 8 === 0) {
        youtube.fetchChannelMetrics(authClient).then(chMetrics => {
          if (chMetrics && chMetrics.subscriberCount) {
            const apiSubCount = parseInt(chMetrics.subscriberCount, 10);
            const currentGoal = goalsService.getGoals()?.subscriberGoal?.current || 2349;
            // YouTube public API abbreviates/rounds down to nearest 10 (e.g. 2340 for 2340-2349).
            const apiFloor = Math.floor(apiSubCount / 10) * 10;
            const apiCeil = apiFloor + 9;

            let updatedSubCount = currentGoal;
            // If YouTube API jumped higher (e.g. 2350), currentGoal must be at least apiFloor
            if (currentGoal < apiFloor) {
              updatedSubCount = apiFloor;
            } else if (currentGoal > apiCeil) {
              // Current goal had drifted higher than YouTube API bucket ceiling! Clamp it to apiCeil.
              updatedSubCount = apiCeil;
            }

            if (updatedSubCount !== currentGoal) {
              const ch = db.getChannelInfo() || {};
              ch.subscriberCount = String(updatedSubCount);
              db.setChannelInfo(ch);
              goalsService.setGoalValue('subscriberGoal', updatedSubCount);
              this.broadcast('channelUpdated', ch);
              this.broadcast('goalUpdated', { type: 'subscriberGoal', value: updatedSubCount });
              console.log(`[BotEngine] 🎯 Clamped/Synced Subscriber Goal to valid bucket: ${updatedSubCount}`);
            }
          }
        }).catch(() => {});
      }

      // UNIFIED SUBSCRIBER NOTIFICATION (every ~45-60s, every 15 polls)
      // Checks new public subscribers and triggers live OBS alert popups
      if (this.pollCount % 15 === 0) {
        youtube.fetchSubscribers(authClient).then(fetchedList => {
          if (Array.isArray(fetchedList) && fetchedList.length > 0) {
            const syncResult = db.syncSubscribers(fetchedList);

            // 2. Fire Live Alert for NEW Subscribers
            if (syncResult && syncResult.newSubscribers && syncResult.newSubscribers.length > 0) {
              console.log(`[BotEngine] 🔔 Detected ${syncResult.newSubscribers.length} new subscriber(s)! Triggering alerts...`);
              let delay = 0;
              for (const newSub of syncResult.newSubscribers) {
                setTimeout(async () => {
                  try {
                    await this.triggerLiveAlert('subscriber', {
                      user: newSub.name || 'New Subscriber',
                      channelId: newSub.channelId,
                      avatar: newSub.avatar
                    }, authClient, false);
                  } catch (e) {
                    console.error('[BotEngine] Error firing live sub alert:', e.message);
                  }
                }, delay);
                delay += 2500;
              }
            }

            // 3. Fire Live Alert for Unsubscribed (if enabled)
            const alertsConfig = db.getAlertsConfig();
            if (alertsConfig?.unsubscriberAlert?.enabled && syncResult?.lostSubscribers?.length > 0) {
              let delay = (syncResult.newSubscribers?.length || 0) * 2500 + 1000;
              for (const lostSub of syncResult.lostSubscribers) {
                setTimeout(async () => {
                  try {
                    await this.triggerLiveAlert('unsubscriber', {
                      user: lostSub.name || 'Viewer',
                      channelId: lostSub.channelId
                    }, authClient, false);
                  } catch (e) {}
                }, delay);
                delay += 2000;
              }
            }

            // 4. Broadcast updated subscriber list
            this.broadcast('subscribersSynced', {
              stats: db.getSubscriberStats(),
              syncResult
            });
          }
        }).catch(() => {});
      }

      // Fetch messages
      const chatData = await youtube.getLiveChatMessages(
        authClient,
        this.currentBroadcast.liveChatId,
        this.nextPageToken
      );

      this.nextPageToken = chatData.nextPageToken;
      
      // Dynamic Adaptive Polling: Scale interval based on live chat activity to save 50-70% quota
      let pollingInterval = Math.max(chatData.pollingIntervalMillis || 3500, 3000);

      // Process new messages
      if (chatData.items && chatData.items.length > 0) {
        this.emptyPollCount = 0;
        for (const item of chatData.items) {
          if (!this.processedMessageIds.has(item.id)) {
            this.processedMessageIds.add(item.id);
            // Cap memory of processed IDs
            if (this.processedMessageIds.size > 2000) {
              const first = this.processedMessageIds.values().next().value;
              this.processedMessageIds.delete(first);
            }
            await this.processIncomingMessage(item, authClient);
          }
        }
      } else {
        // Chat is quiet, smoothly increase interval up to 8s to conserve quota
        this.emptyPollCount = (this.emptyPollCount || 0) + 1;
        if (this.emptyPollCount >= 8) {
          pollingInterval = 8000;
        } else if (this.emptyPollCount >= 4) {
          pollingInterval = 6000;
        } else if (this.emptyPollCount >= 2) {
          pollingInterval = 4500;
        }
      }

      // Schedule next poll
      if (this.isRunning) {
        this.pollTimeout = setTimeout(() => this.pollLoop(), pollingInterval);
      }
    } catch (err) {
      const isQuota = err.message?.includes('quota') || err.code === 403;
      if (isQuota) {
        db.setQuotaExceeded(true);
        // Sleep for 5 minutes during quota exhaustion before retrying
        if (this.isRunning) {
          this.pollTimeout = setTimeout(() => this.pollLoop(), 300000);
        }
        return;
      }

      console.error('Error in bot pollLoop:', err.message);
      
      // If live chat is offline or error occurred
      if (err.code === 404) {
        this.currentBroadcast = null;
        this.nextPageToken = null;
      }

      // Retry after backoff
      if (this.isRunning) {
        this.pollTimeout = setTimeout(() => this.pollLoop(), 15000);
      }
    }
  }

  async processIncomingMessage(item, authClient, isSimulated = false) {
    const messageId = item.id;
    const text = item.snippet?.displayMessage || item.snippet?.textMessageDetails?.messageText || '';

    // === ANTI-SPAM SELF-LOOP PROTECTION (First Line of Defense) ===
    // 1. If we already know this exact message ID was sent by the bot, SKIP entirely
    if (this.botSentMessageIds.has(messageId)) {
      return;
    }

    // 2. Clean up expired botSentTexts entries (older than 90 seconds)
    const nowClean = Date.now();
    for (const [t, ts] of this.botSentTexts.entries()) {
      if (nowClean - ts > 90000) this.botSentTexts.delete(t);
    }

    // 3. If message text matches something the bot JUST sent, SKIP it
    if (this.botSentTexts.has(text)) {
      // Add ID so we never process it again
      this.botSentMessageIds.add(messageId);
      return;
    }

    db.incrementStat('totalMessagesProcessed');
    this.chatLinesSinceLastTimer++;

    const author = item.authorDetails?.displayName || 'Unknown';
    const authorChannelId = item.authorDetails?.channelId || '';
    const isOwner = Boolean(item.authorDetails?.isChatOwner);
    const isModerator = Boolean(item.authorDetails?.isChatModerator);
    const isSponsor = Boolean(item.authorDetails?.isChatSponsor); // Member
    const msgType = item.snippet?.type || 'textMessageEvent';

    const chatEvent = {
      id: messageId,
      author,
      authorChannelId,
      text,
      type: msgType,
      isOwner,
      isModerator,
      isSponsor,
      timestamp: item.snippet?.publishedAt || new Date().toISOString(),
      avatar: item.authorDetails?.profileImageUrl || '',
      isSimulated
    };

    this.broadcast('chatMessage', chatEvent);

    // Check Special YouTube Live Events: SuperChat, SuperSticker, Member Sponsor
    if (msgType === 'superChatEvent') {
      const amountStr = item.snippet?.superChatDetails?.amountDisplayString || 'Super Chat';
      const comment = item.snippet?.superChatDetails?.userComment || '';
      const numAmount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      if (numAmount > 0) {
        goalsService.incrementGoal('superChatGoal', numAmount);
      }
      await this.triggerLiveAlert('superChat', { user: author, amount: amountStr, message: comment }, authClient, isSimulated);
      return;
    }

    if (msgType === 'superStickerEvent') {
      const amountStr = item.snippet?.superStickerDetails?.amountDisplayString || 'Super Sticker';
      const numAmount = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 0;
      if (numAmount > 0) {
        goalsService.incrementGoal('superChatGoal', numAmount);
      }
      await this.triggerLiveAlert('superChat', { user: author, amount: amountStr, message: 'Super Sticker' }, authClient, isSimulated);
      return;
    }


    if (msgType === 'newSponsorEvent') {
      const tier = item.snippet?.newSponsorDetails?.memberLevelName || 'Member';
      await this.triggerLiveAlert('membership', { user: author, tier }, authClient, isSimulated);
      return;
    }

    // Determine if the message was sent by the streamer / channel owner / bot account itself
    const ch = db.getChannelInfo() || {};
    const myChannelId = ch.id || '';
    const cleanAuthor = author.replace(/^@+/, '').trim().toLowerCase();
    // Strip spaces & special chars for robust substring matching (handles "MOHIT M07" -> "mohitm07")
    const cleanAuthorNoSpace = cleanAuthor.replace(/[\s\-_]/g, '');
    const myCustomUrl = (ch.customUrl || '').replace(/^@+/, '').trim().toLowerCase();
    const myCustomUrlNoSpace = myCustomUrl.replace(/[\s\-_]/g, '');
    const isSelf = isOwner || 
                   (authorChannelId && myChannelId && authorChannelId === myChannelId) || 
                   (myCustomUrl && cleanAuthor === myCustomUrl) ||
                   (myCustomUrlNoSpace && cleanAuthorNoSpace === myCustomUrlNoSpace) ||
                   cleanAuthorNoSpace.includes('mohitm07') ||
                   cleanAuthor === 'mohit-m07' ||
                   cleanAuthor === 'mohit m07';

    // Skip auto-moderation on channel owner, moderators, or self
    let moderationResult = { violated: false };
    if (!isOwner && !isModerator && !isSelf) {
      moderationResult = await this.checkAutoModeration(text, author, authorChannelId, messageId, authClient, isSimulated);
      if (moderationResult.violated) {
        return { success: true, moderated: true, moderation: moderationResult };
      }
    }

    // Award Loyalty Points for active chat participation (skip self)
    if (!isSelf) {
      loyaltyService.addPoints(authorChannelId || author, author, 5, 'chat');
    }

    // Check Live Chat Trivia if active
    if (!isSelf) {
      const triviaSolved = loyaltyService.checkTriviaAnswer(authorChannelId || author, author, text);
      if (triviaSolved) {
        this.broadcast('botResponse', {
          command: 'trivia',
          author: 'Mohit M07 Bot',
          response: triviaSolved.message,
          isSimulated
        });
        if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
          this.botSentTexts.set(triviaSolved.message, Date.now());
          youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, triviaSolved.message)
            .then(sentMsg => { if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id); })
            .catch(() => { this.botSentTexts.delete(triviaSolved.message); });
        }
        return;
      }
    }

    // Check Live Poll Vote if active
    if (!isSelf) {
      pollsService.recordVote(authorChannelId || author, author, text);
    }

    // Process Commands (Streamer or viewers)
    const prefix = db.getBotSettings().prefix || '!';
    if (text.startsWith(prefix)) {
      const parts = text.slice(prefix.length).trim().split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);

      await this.handleCommand(cmdName, args, chatEvent, authClient, isSimulated);
      return;
    }

    // Check AI Smart Auto-Responder for general questions (STRICTLY SKIP SELF / STREAMER)
    if (!isSelf) {
      const aiAnswer = await aiResponderService.generateReply(text, author);
      if (aiAnswer) {
        this.broadcast('botResponse', {
          command: 'ai_reply',
          author: 'Mohit M07 AI',
          response: aiAnswer,
          isSimulated
        });
        if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
          // Register text BEFORE sending so if polling returns it fast, it gets skipped
          this.botSentTexts.set(aiAnswer, Date.now());
          youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, aiAnswer)
            .then(sentMsg => { if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id); })
            .catch(() => { this.botSentTexts.delete(aiAnswer); });
        }
      }
    }
  }

  async triggerLiveAlert(alertType, data, authClient = null, isSimulated = false) {
    const config = db.getAlertsConfig();
    let template = '';
    let alertTitle = '';
    let obsSound = 'chime';

    if (alertType === 'subscriber') {
      if (!isSimulated && !config.subscriberAlert?.enabled) return;
      template = config.subscriberAlert?.chatMessage || '🎉 Welcome @$(user) to the channel! Thanks for subscribing! 🔥';
      alertTitle = 'NEW SUBSCRIBER!';
      obsSound = 'fanfare';
    } else if (alertType === 'unsubscriber') {
      if (!isSimulated && !config.unsubscriberAlert?.enabled) return;
      template = config.unsubscriberAlert?.chatMessage || '👋 @$(user) has unsubscribed.';
      alertTitle = 'UNSUBSCRIBED';
      obsSound = 'pop';
    } else if (alertType === 'superChat') {
      if (!isSimulated && !config.superChatAlert?.enabled) return;
      template = config.superChatAlert?.chatMessage || '💎 Huge thanks to @$(user) for the $(amount) Super Chat! ❤️';
      alertTitle = `SUPER CHAT: ${data.amount || ''}`;
      obsSound = 'coin';
    } else if (alertType === 'membership') {
      if (!isSimulated && !config.membershipAlert?.enabled) return;
      template = config.membershipAlert?.chatMessage || '👑 Welcome @$(user) to Channel Membership! Enjoy exclusive perks! ✨';
      alertTitle = 'NEW CHANNEL MEMBER!';
      obsSound = 'cheer';
    }

    // Expand chat template
    let chatMsg = template.replace(/\$\(user\)/gi, data.user || 'Viewer');
    chatMsg = chatMsg.replace(/\$\(amount\)/gi, data.amount || '');
    chatMsg = chatMsg.replace(/\$\(message\)/gi, data.message || '');
    chatMsg = chatMsg.replace(/\$\(tier\)/gi, data.tier || 'Member');

    // Check alert-specific voice toggle
    let alertVoiceEnabled = true;
    if (alertType === 'subscriber') {
      alertVoiceEnabled = config.subscriberAlert?.voiceEnabled !== false;
    } else if (alertType === 'superChat') {
      alertVoiceEnabled = config.superChatAlert?.voiceEnabled !== false;
    } else if (alertType === 'membership') {
      alertVoiceEnabled = config.membershipAlert?.voiceEnabled !== false;
    } else if (alertType === 'unsubscriber') {
      alertVoiceEnabled = config.unsubscriberAlert?.voiceEnabled !== false;
    }

    // Expand voice announcement text directly from the notification text (clean of emojis/@ for natural audio)
    const voiceSettings = config.voiceSettings || { enabled: true };
    let voiceText = '';
    if (voiceSettings.enabled !== false && alertVoiceEnabled) {
      // Clean emojis, @ symbols, extra punctuation for natural TTS pronunciation
      voiceText = chatMsg
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/@+/g, '')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/[!*#~_]{2,}/g, '!')
        .replace(/\s+/g, ' ')
        .trim();

      // Pre-generate speech audio in background for 0ms instant delivery to OBS CEF
      if (voiceText) {
        ttsService.generateSpeechAudio(voiceText, { voice: voiceSettings.voiceURI, rate: voiceSettings.rate }).catch(() => {});
      }
    }

    // Media Animation (GIF, WebM, MP4, Image)
    let mediaUrl = '';
    let mediaLayout = 'side';
    if (alertType === 'subscriber') {
      mediaUrl = config.subscriberAlert?.mediaUrl || '';
      mediaLayout = config.subscriberAlert?.mediaLayout || 'side';
    } else if (alertType === 'superChat') {
      mediaUrl = config.superChatAlert?.mediaUrl || '';
      mediaLayout = config.superChatAlert?.mediaLayout || 'side';
    } else if (alertType === 'membership') {
      mediaUrl = config.membershipAlert?.mediaUrl || '';
      mediaLayout = config.membershipAlert?.mediaLayout || 'side';
    } else if (alertType === 'unsubscriber') {
      mediaUrl = config.unsubscriberAlert?.mediaUrl || '';
      mediaLayout = config.unsubscriberAlert?.mediaLayout || 'side';
    }

    const appearanceSettings = config.appearanceSettings || {
      backgroundStyle: 'frosted',
      cardOpacity: 60,
      borderGlow: true,
      scanlines: false
    };

    // Broadcast to OBS Overlay Widget & Dashboard
    this.broadcast('obsAlert', {
      type: alertType,
      title: alertTitle,
      user: data.user || 'Viewer',
      amount: alertType === 'superChat' ? (data.amount || '₹500.00') : '',
      message: data.message || '',
      chatMsg: chatMsg,
      sound: obsSound,
      voiceText: voiceText,
      voiceSettings: voiceSettings,
      appearanceSettings: appearanceSettings,
      mediaUrl: mediaUrl,
      mediaLayout: mediaLayout,
      isSimulated
    });

    db.addLog({
      type: 'system',
      message: `[Live Alert - ${alertTitle}]: ${chatMsg}`
    });

    // Send celebratory message to YouTube Live Chat
    if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
      try {
        this.botSentTexts.set(chatMsg, Date.now());
        const sentMsg = await youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, chatMsg);
        if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id);
      } catch (err) {
        this.botSentTexts.delete(chatMsg);
        console.error(`Failed to send alert chat message:`, err.message);
      }
    }
  }

  async checkAutoModeration(text, author, authorChannelId, messageId, authClient, isSimulated = false) {
    const modConfig = db.getModeration();
    const result = { violated: false, rule: '', action: '' };

    // 1. Profanity Filter
    if (modConfig.profanity?.enabled) {
      const words = modConfig.profanity.blacklist || [];
      const lower = text.toLowerCase();
      const matched = words.find(w => w && lower.includes(w.toLowerCase()));
      if (matched) {
        result.violated = true;
        result.rule = 'Profanity Filter';
        result.action = modConfig.profanity.action || 'delete';
        result.details = `Word matched: "${matched}"`;
        result.warning = modConfig.profanity.customWarning;
        result.timeoutSeconds = modConfig.profanity.timeoutSeconds || 300;
      }
    }

    // 2. Links Filter
    if (!result.violated && modConfig.links?.enabled) {
      const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|org|net|io|gg|tv|xyz|info|app|co|in|tk|ml|ga|cf|gq)[\/\w-]*)/gi;
      const urls = text.match(urlRegex);
      if (urls && urls.length > 0) {
        const allowlist = modConfig.links.allowlist || [];
        const isAllowed = urls.every(u => {
          return allowlist.some(allowed => u.toLowerCase().includes(allowed.toLowerCase()));
        });

        if (!isAllowed) {
          result.violated = true;
          result.rule = 'Unauthorized Links Filter';
          result.action = modConfig.links.action || 'delete';
          result.details = `Detected unauthorized link: ${urls.join(', ')}`;
          result.warning = modConfig.links.customWarning;
          result.timeoutSeconds = modConfig.links.timeoutSeconds || 60;
        }
      }
    }

    // 3. Excessive Caps Lock Filter
    if (!result.violated && modConfig.caps?.enabled) {
      const minLength = modConfig.caps.minCharLength || 8;
      if (text.length >= minLength) {
        const letters = text.replace(/[^a-zA-Z]/g, '');
        if (letters.length >= minLength) {
          const uppercase = letters.replace(/[^A-Z]/g, '');
          const capsPercentage = (uppercase.length / letters.length) * 100;
          if (capsPercentage >= (modConfig.caps.maxCapsPercentage || 70)) {
            result.violated = true;
            result.rule = 'Excessive Caps Lock Filter';
            result.action = modConfig.caps.action || 'delete';
            result.details = `Caps ratio: ${Math.round(capsPercentage)}%`;
            result.warning = modConfig.caps.customWarning;
            result.timeoutSeconds = modConfig.caps.timeoutSeconds || 30;
          }
        }
      }
    }

    // 4. Excessive Character Repetition Filter
    if (!result.violated && modConfig.repetitive?.enabled) {
      const maxRepeated = modConfig.repetitive.maxRepeatedChars || 6;
      const repeatRegex = new RegExp(`(.)\\1{${maxRepeated},}`, 'i');
      if (repeatRegex.test(text)) {
        result.violated = true;
        result.rule = 'Repetitive Characters Filter';
        result.action = modConfig.repetitive.action || 'delete';
        result.details = `Excessive character repetition detected.`;
        result.warning = modConfig.repetitive.customWarning;
        result.timeoutSeconds = modConfig.repetitive.timeoutSeconds || 30;
      }
    }

    if (result.violated) {
      db.incrementStat('totalModerationActions');
      const log = db.addLog({
        type: 'moderation',
        message: `Moderated message from @${author} [${result.rule}]: "${text}" -> Action: ${result.action.toUpperCase()}`,
        author,
        action: result.action,
        details: result.details
      });

      this.broadcast('moderationAction', {
        author,
        text,
        rule: result.rule,
        action: result.action,
        details: result.details,
        isSimulated
      });

      // Execute moderation action in YouTube Live Chat
      if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
        try {
          if (result.action === 'delete') {
            await youtube.deleteChatMessage(authClient, messageId);
          } else if (result.action === 'timeout' && authorChannelId) {
            await youtube.banUser(authClient, this.currentBroadcast.liveChatId, authorChannelId, result.timeoutSeconds);
          }

          // Optionally post warning in chat
          if (result.warning) {
            const warningMsg = this.expandVariables(result.warning, { user: author });
            await youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, warningMsg);
          }
        } catch (err) {
          console.error('Error executing moderation action on YouTube:', err.message);
        }
      }
    }

    return result;
  }

  async handleCommand(cmdName, args, chatEvent, authClient, isSimulated = false) {
    const author = chatEvent.author;
    const authorId = chatEvent.authorChannelId || author;

    // 1. Built-in: Loyalty Points (!points, !coins, !balance)
    if (['points', 'coins', 'balance'].includes(cmdName)) {
      const pts = loyaltyService.getPoints(authorId, author);
      const responseText = `💰 @${author}, you currently have ${pts} Loyalty Points! Use !gamble or !spin to play! 💎`;
      this.sendBotChatResponse('points', author, responseText, authClient, isSimulated);
      return;
    }

    // 2. Built-in: Leaderboard (!leaderboard, !top)
    if (['leaderboard', 'top'].includes(cmdName)) {
      const topList = loyaltyService.getLeaderboard(5);
      const lines = topList.map((u, i) => `#${i + 1} ${u.name} (${u.points} pts)`).join(' | ');
      const responseText = `🏆 TOP STREAM VIEWERS: ${lines || 'No active players yet! Keep chatting to earn points!'}`;
      this.sendBotChatResponse('leaderboard', author, responseText, authClient, isSimulated);
      return;
    }

    // 3. Built-in: Gamble mini-game (!gamble <amount>)
    if (cmdName === 'gamble') {
      const gResult = loyaltyService.gamble(authorId, author, args[0] || '10');
      this.sendBotChatResponse('gamble', author, gResult.message, authClient, isSimulated);
      return;
    }

    // 4. Built-in: Slot Machine Spin (!spin)
    if (cmdName === 'spin') {
      const sResult = loyaltyService.spin(authorId, author);
      this.sendBotChatResponse('spin', author, sResult.message, authClient, isSimulated);
      return;
    }

    // 5. Built-in: Chat Trivia Quiz (!trivia)
    if (cmdName === 'trivia') {
      const category = args.join(' ') || 'Free Fire and Gaming';
      const tr = await loyaltyService.startTrivia(category);
      const responseText = `🎯 [TRIVIA TIME]: ${tr.question} (Chat me answer likho! First correct answer wins +${tr.reward} Points 💎)`;
      this.sendBotChatResponse('trivia', author, responseText, authClient, isSimulated);
      return;
    }

    // 6. Built-in: AI Question Answering (!ask, !ai, !gemini)
    if (['ask', 'ai', 'gemini'].includes(cmdName)) {
      const query = args.join(' ').trim();
      if (!query) {
        this.sendBotChatResponse('ask', author, `@${author}, poochne ke liye sawaal likho: !ask <question>`, authClient, isSimulated);
        return;
      }
      try {
        const aiAnswer = await geminiService.generateChatReply(author, query);
        if (aiAnswer) {
          this.sendBotChatResponse('ask', author, `🤖 @${author}: ${aiAnswer}`, authClient, isSimulated);
          return;
        }
      } catch (e) {}
      this.sendBotChatResponse('ask', author, `@${author}, stream enjoy karte raho bhai! 🔥`, authClient, isSimulated);
      return;
    }

    // 6. Built-in: Clip Marker (!clip <description>)
    if (['clip', 'highlight'].includes(cmdName)) {
      const desc = args.join(' ') || 'Epic Stream Moment';
      const hl = highlightsService.addHighlight(desc, author);
      const responseText = `⏱️ CLIPPED! [${hl.timestampFormatted}] "${hl.description}" by @${author}! 🎬`;
      this.sendBotChatResponse('clip', author, responseText, authClient, isSimulated);
      return;
    }

    // 7. Built-in: Soundboard trigger (!sound <id>)
    if (cmdName === 'sound' && args[0]) {
      const played = soundboardService.playSound(args[0].toLowerCase(), author);
      if (played) {
        const responseText = `🔊 SFX: Played "${played.name}" sound!`;
        this.sendBotChatResponse('sound', author, responseText, authClient, isSimulated);
        return;
      }
    }

    // Custom Commands
    const commands = db.getCommands();
    const cmd = commands.find(c => c.name.toLowerCase() === cmdName && c.enabled);

    if (!cmd) return;

    // Check user level
    if (cmd.userLevel === 'owner' && !chatEvent.isOwner) return;
    if (cmd.userLevel === 'moderator' && !chatEvent.isOwner && !chatEvent.isModerator) return;
    if (cmd.userLevel === 'member' && !chatEvent.isOwner && !chatEvent.isModerator && !chatEvent.isSponsor) return;

    // Check cooldown
    const now = Date.now();
    const lastUsed = this.commandCooldowns.get(cmdName) || 0;
    const cooldownMs = (cmd.cooldown || 5) * 1000;
    if (now - lastUsed < cooldownMs && !chatEvent.isOwner) {
      return; // Under cooldown
    }
    this.commandCooldowns.set(cmdName, now);

    // Expand response variables
    const responseText = this.expandVariables(cmd.response, {
      user: chatEvent.author,
      query: args.join(' '),
      count: (cmd.usageCount || 0) + 1
    });

    db.incrementCommandUsage(cmd.name);

    db.addLog({
      type: 'command',
      message: `@${chatEvent.author} triggered !${cmd.name} -> "${responseText}"`,
      author: chatEvent.author,
      action: 'command_response'
    });

    this.broadcast('botResponse', {
      command: cmd.name,
      author: chatEvent.author,
      response: responseText,
      isSimulated
    });

    // Send to Live Chat
    if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
      try {
        this.botSentTexts.set(responseText, Date.now());
        const sentMsg = await youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, responseText);
        if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id);
      } catch (err) {
        this.botSentTexts.delete(responseText);
        console.error(`Error sending command response for !${cmd.name}:`, err.message);
      }
    }
  }

  sendBotChatResponse(command, author, responseText, authClient, isSimulated = false) {
    db.addLog({
      type: 'command',
      message: `@${author} triggered !${command} -> "${responseText}"`,
      author,
      action: 'command_response'
    });

    this.broadcast('botResponse', {
      command,
      author,
      response: responseText,
      isSimulated
    });

    if (!isSimulated && authClient && this.currentBroadcast?.liveChatId) {
      this.botSentTexts.set(responseText, Date.now());
      youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, responseText)
        .then(sentMsg => { if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id); })
        .catch(err => {
          this.botSentTexts.delete(responseText);
          console.error(`Error sending chat response for !${command}:`, err.message);
        });
    }
  }

  expandVariables(template, context = {}) {
    let result = template;
    const user = context.user || 'Viewer';
    const query = context.query || '';
    const count = context.count || 1;

    // $(user)
    result = result.replace(/\$\(user\)/gi, user);

    // $(query)
    result = result.replace(/\$\(query\)/gi, query || user);

    // $(count)
    result = result.replace(/\$\(count\)/gi, count);

    // $(time)
    result = result.replace(/\$\(time\)/gi, new Date().toLocaleTimeString());

    // $(uptime)
    result = result.replace(/\$\(uptime\)/gi, this.getFormattedUptime());

    // $(random min max)
    result = result.replace(/\$\(random\s+(\d+)\s+(\d+)\)/gi, (match, min, max) => {
      const minNum = parseInt(min, 10);
      const maxNum = parseInt(max, 10);
      return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    });

    return result;
  }

  getFormattedUptime() {
    if (!this.streamStartTime || !this.currentBroadcast || this.currentBroadcast.status !== 'live') {
      return 'Stream is currently offline';
    }
    const diffMs = Date.now() - this.streamStartTime.getTime();
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  startTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Check timers every 30 seconds
    this.timerInterval = setInterval(() => {
      this.checkTimers();
    }, 30000);
  }

  async checkTimers() {
    if (!this.isRunning) return;
    const timers = db.getTimers().filter(t => t.enabled);
    if (timers.length === 0) return;

    const now = Date.now();
    const authClient = auth.getOAuthClient();

    for (const timer of timers) {
      const intervalMs = (timer.intervalMinutes || 10) * 60 * 1000;
      const last = timer.lastTriggered || 0;

      if (now - last >= intervalMs && this.chatLinesSinceLastTimer >= (timer.minChatLines || 3)) {
        timer.lastTriggered = now;
        db.updateTimer(timer.id, { lastTriggered: now });
        this.chatLinesSinceLastTimer = 0;
        db.incrementStat('totalTimersTriggered');

        const messageText = this.expandVariables(timer.message);

        db.addLog({
          type: 'timer',
          message: `Timer [${timer.name}] triggered: "${messageText}"`
        });

        this.broadcast('timerTriggered', {
          name: timer.name,
          message: messageText
        });

        if (authClient && this.currentBroadcast?.liveChatId) {
          try {
            this.botSentTexts.set(messageText, Date.now());
            const sentMsg = await youtube.sendChatMessage(authClient, this.currentBroadcast.liveChatId, messageText);
            if (sentMsg?.id) this.botSentMessageIds.add(sentMsg.id);
          } catch (err) {
            this.botSentTexts.delete(messageText);
            console.error(`Error sending timer message for ${timer.name}:`, err.message);
          }
        }
      }
    }
  }

  /**
   * Test message simulator (test commands and auto-moderation without going live)
   */
  async simulateMessage(user, text, isOwner = false, isMod = false) {
    const fakeItem = {
      id: 'sim-' + Date.now(),
      snippet: {
        displayMessage: text,
        publishedAt: new Date().toISOString(),
        textMessageDetails: {
          messageText: text
        }
      },
      authorDetails: {
        displayName: user || 'TestUser',
        channelId: 'channel-' + (user || 'TestUser'),
        isChatOwner: isOwner,
        isChatModerator: isMod,
        isChatSponsor: false,
        profileImageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(user || 'TestUser')
      }
    };

    const res = await this.processIncomingMessage(fakeItem, null, true);
    return res || { success: true, message: 'Message simulated' };
  }
}

module.exports = new BotEngine();
