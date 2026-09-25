const fs = require('fs');
const path = require('path');
const geminiService = require('./geminiService');
const db = require('./db');

const DATA_FILE = path.join(__dirname, '../../data/ai_settings.json');
const WELCOMED_FILE = path.join(__dirname, '../../data/welcomed_users.json');

const DEFAULT_AI_SETTINGS = {
  enabled: true,
  persona: 'gamer',
  triggerPrefix: '?',
  respondToMentions: true,
  smartModeration: true,
  maxDailyAiReplies: 200,
  repliesToday: 0
};

// ===================================================
// NATURAL & VARIED GREETING TEMPLATES
// Mix of English, Hinglish, Gaming Slang - rotates randomly
// $(user) = viewer's @handle
// ===================================================
const GREETING_TEMPLATES = [
  "👋 Aye $(user)! Welcome to the stream bhai! Drop a LIKE aur enjoy karo! 🔥",
  "🎮 $(user) aa gaya! Welcome to $(streamer)'s stream! Like karna mat bhulna! 💥",
  "🔴 $(user)! Haaji aaye ho! Welcome bro! Baith jao aur gameplay enjoy karo! 🎯",
  "🎉 $(user) welcome! Aaj ka stream fire hoga bhai! Like daalo aur chatting karte raho! 🔥",
  "👑 Aye $(user) bhai! Khush amdeed! Drop a LIKE aur stream enjoy karo! 🎮",
  "💥 $(user) you're here! Bahut badhiya! Welcome to the live - don't forget to LIKE! 🔔",
  "🚀 $(user) welcome bhai! Sahi time pe aaye! Like daalo aur baat karte raho! 🎯",
  "🔥 Aye $(user)! Glad you made it! Welcome bro - smash that LIKE button! 👊",
  "🎯 $(user) welcome to the chat! Stream enjoy karo aur LIKE daalna mat bhulna! 💪",
  "⚡ $(user) aa gaye! Welcome yaar! Baith ke enjoy karo - aur ek LIKE toh banta hai! 😎"
];

// Pick a random greeting template
function pickGreeting(userTag) {
  const ch = db.getChannelInfo() || {};
  const channelName = ch.title || 'MOHIT-M07';
  const idx = Math.floor(Math.random() * GREETING_TEMPLATES.length);
  return GREETING_TEMPLATES[idx]
    .replace(/\$\(user\)/g, userTag)
    .replace(/\$\(streamer\)/g, channelName);
}

// ===================================================
// INTENT RESPONSES (non-greeting)
// ===================================================
const INTENT_RESPONSES = [
  {
    type: 'specs',
    regex: /\b(pc\s*specs?|computer\s*specs?|graphic\s*card|gpu|ram|processor|cpu|specs)\b/i,
    reply: "🖥️ Streamer Specs: Intel i7/Ryzen 7, RTX 4070, 32GB DDR5 RAM, 1TB NVMe SSD! Playing on Ultra settings!"
  },
  {
    type: 'discord',
    regex: /\b(discord|dc\s*link|discord\s*server)\b/i,
    reply: "🎮 Join Mohit M07's official Discord server: https://discord.gg/mkHSm7mrdT $(user)!"
  },
  {
    type: 'instagram',
    regex: /\b(instagram|insta|ig\s*handle)\b/i,
    reply: "📸 Follow Mohit M07 on Instagram for stream updates & clips: https://www.instagram.com/mohitm07live/ $(user)!"
  },
  {
    type: 'schedule',
    regex: /\b(stream\s*time|kab\s*live|live\s*timing|stream\s*schedule|daily\s*live)\b/i,
    reply: "⏰ Live Stream Schedule: Daily 7:00 PM to 11:00 PM IST! Turn on all notifications (🔔) so you never miss a stream!"
  },
  {
    type: 'device',
    regex: /\b(kaun\s*sa\s*device|emulator|which\s*device|phone\s*or\s*pc)\b/i,
    reply: "📱 Playing on PC + High Refresh Rate Gaming Monitor with Pro Controller / Keyboard Setup!"
  },
  {
    type: 'rules',
    regex: /\b(stream\s*rules|chat\s*rules|nirdesh)\b/i,
    reply: "📜 Stream Rules: 1. Be respectful to everyone. 2. No hate speech or toxic abuse. 3. No unauthorized self-promo links. 4. Have fun!"
  },
  {
    type: 'uid',
    regex: /\b(uid|ff\s*id|game\s*id|free\s*fire\s*id|player\s*id|id\s*bhejo)\b/i,
    reply: "🎮 Mohit Bhai's In-Game UID: MOHIT-M07 (Guild: MOHIT ARMY 🏆) Add request bhej do @$(user)!"
  },
  {
    type: 'custom',
    regex: /\b(room\s*id|custom\s*room|custom\s*match|pass\s*kya\s*hai|password\s*batao|room\s*kab\s*banega)\b/i,
    reply: "🔥 Next Custom Room ID & Pass stream ke target likes (100 Likes) complete hone par milega! Stream like aur share karo @$(user)! 🎁"
  },
  {
    type: 'sensi',
    regex: /\b(sensitivity|sensi|dpi|setting|control|hud|fire\s*button)\b/i,
    reply: "🎯 Headshot Sensitivity: General: 98 | Red Dot: 95 | 2X: 90 | 4X: 85 | Sniper: 70 | Free Look: 60 ⚡"
  },
  {
    type: 'giveaway',
    regex: /\b(giveaway|redeem\s*code|airdrop|topup|diamond|diamonds)\b/i,
    reply: "🎁 Ongoing Stream Giveaway: Redeem codes & Custom Room cash prizes! Stream like karo aur active raho chat me @$(user)!"
  },
  {
    type: 'greeting',
    // Strict word-boundary: must start with a greeting word, NOT buried inside other words
    regex: /^[\s!@#]*\b(hi|hello|hey|namaste|wassup|kaise ho|hii|helo|heyy)\b/i
  }
];

// Phrases that indicate a message IS from the bot (loop prevention)
const BOT_RESPONSE_SIGNATURES = [
  'welcome to the stream', 'welcome to mohit', 'welcome bhai', 'welcome bro',
  'welcome yaar', 'aa gaye!', 'aa gaya!', 'khush amdeed',
  'join mohit m07', 'streamer specs:', '🖥️ streamer', '🎮 join mohit',
  '📸 follow mohit', '⏰ live stream schedule', 'thanks for asking about',
  'streamer will answer live'
];

class AiResponderService {
  constructor() {
    this.settings = this.loadSettings();

    // ========================================================
    // PER-STREAM welcomed tracking:
    // Key: "streamId_YYYY-MM-DD" (stream video ID + date)
    // Value: Set of welcomed user names (lowercase)
    //
    // - Same stream + same day: user NOT welcomed again
    // - New stream (new video ID or new date): fresh start, user welcomed again
    // ========================================================
    this.currentStreamKey = null;      // "videoId_2026-09-05"
    this.welcomedUsers = new Set();    // Users welcomed in CURRENT stream
    this.userCooldowns = new Map();    // Per-user cooldown (45s)
    this.lastGlobalReplyTime = 0;      // Global cooldown (8s)

    // Load any persisted welcomed users from disk (survives server restart mid-stream)
    this._loadWelcomedFromDisk();
  }

  // -------------------------------------------------------
  // Called by botEngine when a new/current stream is detected
  // broadcastId = YouTube video ID of the live stream
  // -------------------------------------------------------
  resetForNewStream(broadcastId) {
    if (!broadcastId) return;

    // Build a unique key for this stream session (video ID + date in IST)
    const dateStr = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '-'); // DD-MM-YYYY

    const newKey = `${broadcastId}_${dateStr}`;

    // If same stream as before, keep existing welcomed set
    if (this.currentStreamKey === newKey) return;

    console.log(`[AIResponder] New stream session detected: ${newKey} (was: ${this.currentStreamKey})`);
    console.log(`[AIResponder] Clearing ${this.welcomedUsers.size} welcomed users from previous session.`);

    // NEW STREAM → Reset welcomed users so everyone gets fresh welcome
    this.currentStreamKey = newKey;
    this.welcomedUsers.clear();
    this.userCooldowns.clear();
    this.lastGlobalReplyTime = 0;

    // Persist to disk: clear old session data
    this._saveWelcomedToDisk();
  }

  // Legacy resetSession() - kept for compatibility
  resetSession() {
    this.welcomedUsers.clear();
    this.userCooldowns.clear();
    this.lastGlobalReplyTime = 0;
    this.currentStreamKey = null;
    this._saveWelcomedToDisk();
  }

  // -------------------------------------------------------
  // Persist welcomed users to disk (survives server restart)
  // -------------------------------------------------------
  _saveWelcomedToDisk() {
    try {
      const dir = path.dirname(WELCOMED_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        streamKey: this.currentStreamKey,
        welcomedUsers: Array.from(this.welcomedUsers),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(WELCOMED_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      // Non-critical - just log
      console.error('[AIResponder] Could not save welcomed users:', e.message);
    }
  }

  _loadWelcomedFromDisk() {
    try {
      if (!fs.existsSync(WELCOMED_FILE)) return;
      const raw = fs.readFileSync(WELCOMED_FILE, 'utf8');
      const data = JSON.parse(raw);

      // Only restore if it's from the same stream session (same day + same stream key)
      if (data.streamKey && data.welcomedUsers) {
        const savedDate = data.streamKey.split('_').slice(-1)[0]; // DD-MM-YYYY
        const todayDate = new Date().toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\//g, '-');

        if (savedDate === todayDate) {
          // Same day - restore the session
          this.currentStreamKey = data.streamKey;
          this.welcomedUsers = new Set(data.welcomedUsers);
          console.log(`[AIResponder] Restored ${this.welcomedUsers.size} welcomed users from disk (stream: ${data.streamKey})`);
        } else {
          console.log(`[AIResponder] Previous session was from ${savedDate}, today is ${todayDate} - starting fresh.`);
        }
      }
    } catch (e) {
      // Non-critical
    }
  }

  // -------------------------------------------------------
  // Settings management
  // -------------------------------------------------------
  loadSettings() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Error loading ai_settings.json:', e);
    }
    return { ...DEFAULT_AI_SETTINGS };
  }

  saveSettings(settings) {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(settings || this.settings, null, 2));
    } catch (e) {
      console.error('Error saving ai_settings.json:', e);
    }
  }

  getSettings() { return this.settings; }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings(this.settings);
    return this.settings;
  }

  // -------------------------------------------------------
  // Main: Generate a reply for a chat message
  // Returns: reply string, or null if no reply needed
  // -------------------------------------------------------
  async generateReply(text, authorName = 'Viewer') {
    if (!this.settings.enabled) return null;

    const rawAuthor = String(authorName || 'Viewer').trim();
    const cleanAuthor = rawAuthor.replace(/^@+/, '').trim();
    const lowerAuthor = cleanAuthor.toLowerCase();
    const lowerAuthorNoSpace = lowerAuthor.replace(/[\s\-_]/g, '');

    // ── Guard 1: NEVER reply to streamer / bot itself ──────────────
    const ch = db.getChannelInfo() || {};
    const myCustomUrl = (ch.customUrl || '').replace(/^@+/, '').toLowerCase();
    const myCustomUrlNoSpace = myCustomUrl.replace(/[\s\-_]/g, '');
    const myTitle = (ch.title || '').toLowerCase();
    const myTitleNoSpace = myTitle.replace(/[\s\-_]/g, '');

    if (
      (myCustomUrl && lowerAuthor === myCustomUrl) ||
      (myCustomUrlNoSpace && lowerAuthorNoSpace === myCustomUrlNoSpace) ||
      (myTitle && lowerAuthor === myTitle) ||
      (myTitleNoSpace && lowerAuthorNoSpace === myTitleNoSpace) ||
      lowerAuthorNoSpace.includes('mohitm07') ||
      lowerAuthor === 'streamer'
    ) {
      return null;
    }

    // ── Guard 2: NEVER reply to bot's own response messages ─────────
    const trimmedLower = text.trim().toLowerCase();
    const looksLikeBot = BOT_RESPONSE_SIGNATURES.some(sig => trimmedLower.includes(sig));
    if (looksLikeBot) return null;

    // Also block by emoji prefixes used in bot responses
    const botEmojiPrefixes = ['🎮 join', '📸 follow', '⏰ live stream', '🖥️ streamer', '📜 stream rules'];
    if (botEmojiPrefixes.some(p => trimmedLower.startsWith(p))) return null;

    const now = Date.now();

    // ── Guard 3: Global rate limit (8 seconds between any AI replies) ──
    if (now - this.lastGlobalReplyTime < 8000) return null;

    // ── Guard 4: Per-user cooldown (45 seconds) ─────────────────────
    const userLastReply = this.userCooldowns.get(lowerAuthor) || 0;
    if (now - userLastReply < 45000) return null;

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const userTag = `@${cleanAuthor}`;

    // ── Check Intent Responses ───────────────────────────────────────
    for (const item of INTENT_RESPONSES) {
      if (item.regex.test(trimmed)) {

        // ── GREETING: Strict per-stream one-time welcome ─────────────
        if (item.type === 'greeting') {
          // Skip if this is a long message that just starts with "hi/hey" (likely a question)
          if (trimmed.length > 35) return null;

          // !! KEY LOGIC: One welcome per user per STREAM SESSION !!
          if (this.welcomedUsers.has(lowerAuthor)) {
            // Already welcomed in this stream - silently skip
            return null;
          }

          // Mark as welcomed in this stream and persist to disk
          this.welcomedUsers.add(lowerAuthor);
          this._saveWelcomedToDisk();

          // Pick a random natural greeting
          this.userCooldowns.set(lowerAuthor, now);
          this.lastGlobalReplyTime = now;
          return pickGreeting(userTag);
        }

        // Non-greeting intents
        this.userCooldowns.set(lowerAuthor, now);
        this.lastGlobalReplyTime = now;
        return item.reply.replace(/\$\(user\)/g, userTag);
      }
    }

    // ── Explicit trigger prefix or Question with Gemini AI ───
    const isQuestion = trimmed.includes('?') || 
                       lower.startsWith(this.settings.triggerPrefix) || 
                       /^(kaise|kya|kab|kaha|bhai|mohit|bro|how|why|what|when|where|which)\b/i.test(trimmed);

    if (isQuestion && trimmed.length >= 4) {
      const query = lower.startsWith(this.settings.triggerPrefix) 
        ? trimmed.slice(this.settings.triggerPrefix.length).trim() 
        : trimmed;

      if (geminiService.getApiKey()) {
        try {
          const aiReply = await geminiService.generateChatReply(cleanAuthor, query);
          if (aiReply) {
            this.userCooldowns.set(lowerAuthor, now);
            this.lastGlobalReplyTime = now;
            return `🤖 ${aiReply}`;
          }
        } catch (e) {}
      }

      // Fallback response if no Gemini API key
      if (lower.startsWith(this.settings.triggerPrefix)) {
        this.userCooldowns.set(lowerAuthor, now);
        this.lastGlobalReplyTime = now;
        return `🤖 ${userTag}, thanks for asking about "${query}"! Streamer will answer live shortly! 🔥`;
      }
    }

    return null;
  }
}

module.exports = new AiResponderService();
