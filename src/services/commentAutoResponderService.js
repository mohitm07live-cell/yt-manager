const db = require('./db');
const auth = require('./auth');
const youtubeService = require('./youtube');
const geminiService = require('./geminiService');

class CommentAutoResponderService {
  constructor() {
    this.timer = null;
    this.isProcessing = false;
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  init() {
    const settings = db.getCommentResponderSettings();
    if (settings.enabled) {
      this.start();
    }
  }

  start() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    const settings = db.getCommentResponderSettings();
    const intervalMs = Math.max(15, (settings.checkIntervalSeconds || 60)) * 1000;

    console.log(`[CommentAutoResponder] Started background service (polling every ${settings.checkIntervalSeconds || 60}s)`);
    this.timer = setInterval(() => {
      this.processNewComments().catch(err => {
        console.error('[CommentAutoResponder] Background loop error:', err.message);
      });
    }, intervalMs);

    // Initial check right after starting
    setTimeout(() => {
      this.processNewComments().catch(err => {
        console.error('[CommentAutoResponder] Initial run error:', err.message);
      });
    }, 2000);

    this.broadcastStatus();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[CommentAutoResponder] Stopped background service');
    this.broadcastStatus();
  }

  getStatus() {
    const settings = db.getCommentResponderSettings();
    return {
      running: Boolean(this.timer),
      enabled: Boolean(settings.enabled),
      isProcessing: this.isProcessing,
      repliesToday: settings.repliesToday || 0,
      maxDailyReplies: settings.maxDailyReplies || 100,
      totalRepliedCount: settings.totalRepliedCount || 0,
      lastCheckTime: settings.lastCheckTime || null,
      persona: settings.persona || 'friendly_gamer'
    };
  }

  broadcastStatus() {
    if (this.io) {
      this.io.emit('commentResponderStatus', this.getStatus());
    }
  }

  async toggle(enable) {
    const settings = db.updateCommentResponderSettings({ enabled: Boolean(enable) });
    if (settings.enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.getStatus();
  }

  /**
   * Main processing loop: scans latest comments and replies with Gemini AI
   */
  async processNewComments() {
    if (this.isProcessing) return { skipped: true, reason: 'Already processing' };
    if (!auth.isAuthenticated()) {
      return { skipped: true, reason: 'YouTube authentication required' };
    }

    const geminiKey = geminiService.getApiKey();
    if (!geminiKey) {
      return { skipped: true, reason: 'Gemini API key not configured' };
    }

    const settings = db.getCommentResponderSettings();
    if (settings.repliesToday >= settings.maxDailyReplies) {
      console.log('[CommentAutoResponder] Daily reply limit reached:', settings.repliesToday);
      return { skipped: true, reason: 'Daily reply limit reached' };
    }

    this.isProcessing = true;
    db.updateCommentResponderSettings({ lastCheckTime: new Date().toISOString() });
    this.broadcastStatus();

    const authClient = auth.getOAuthClient();
    const myChannel = db.getChannelInfo() || {};
    const myChannelId = myChannel.id;
    const moderationSettings = db.data?.moderation || {};
    const blacklist = moderationSettings?.profanity?.blacklist || [];

    let processedCount = 0;
    let repliedCount = 0;
    const results = [];

    try {
      const threads = await youtubeService.fetchCommentThreads(authClient, {
        maxResults: 15,
        videoId: (settings.specificVideoOnly && settings.specificVideoId) ? settings.specificVideoId : undefined,
        channelId: myChannelId
      });

      for (const thread of threads) {
        // Daily quota limit check in-loop
        const currentSettings = db.getCommentResponderSettings();
        if (currentSettings.repliesToday >= currentSettings.maxDailyReplies) {
          break;
        }

        const topComment = thread.snippet?.topLevelComment;
        if (!topComment) continue;

        const commentId = topComment.id;
        const snippet = topComment.snippet || {};
        const authorName = snippet.authorDisplayName || 'Viewer';
        const authorChannelId = snippet.authorChannelId?.value;
        const authorAvatar = snippet.authorProfileImageUrl || '';
        const commentText = (snippet.textDisplay || snippet.textOriginal || '').trim();
        const videoId = snippet.videoId || thread.snippet?.videoId || '';
        const publishedAt = snippet.publishedAt || new Date().toISOString();

        processedCount++;

        // 1. Check if already replied
        if (db.isCommentReplied(commentId)) {
          continue;
        }

        // 2. Ignore creator's own comments
        if (settings.ignoreOwnComments && (authorChannelId === myChannelId || authorName === myChannel.title)) {
          db.markCommentReplied(commentId, {
            videoId,
            authorName,
            commentText,
            replyText: '[Skipped: Own Comment]',
            status: 'ignored'
          });
          continue;
        }

        // 3. Ignore short comments if below min length
        if (commentText.length < (settings.minCommentLength || 2)) {
          db.markCommentReplied(commentId, {
            videoId,
            authorName,
            commentText,
            replyText: '[Skipped: Too Short]',
            status: 'ignored'
          });
          continue;
        }

        // 4. Spam / Blacklist filter
        if (settings.filterSpam && blacklist.length > 0) {
          const lowerText = commentText.toLowerCase();
          const hasProfanity = blacklist.some(badWord => badWord && lowerText.includes(badWord.toLowerCase()));
          if (hasProfanity) {
            console.log(`[CommentAutoResponder] Ignored profanity comment by ${authorName}: ${commentText}`);
            db.markCommentReplied(commentId, {
              videoId,
              authorName,
              commentText,
              replyText: '[Skipped: Filtered by Profanity Filter]',
              status: 'filtered'
            });
            continue;
          }
        }

        // 5. Check if thread already has a reply from channel owner in YouTube
        const totalReplyCount = thread.snippet?.totalReplyCount || 0;
        if (totalReplyCount > 0 && thread.replies?.comments) {
          const existingReplies = thread.replies.comments;
          const ownerAlreadyReplied = existingReplies.some(r => 
            r.snippet?.authorChannelId?.value === myChannelId || r.snippet?.authorDisplayName === myChannel.title
          );
          if (ownerAlreadyReplied) {
            db.markCommentReplied(commentId, {
              videoId,
              authorName,
              commentText,
              replyText: '[Skipped: Already Replied on YouTube]',
              status: 'ignored'
            });
            continue;
          }
        }

        // 6. Generate AI Reply using Gemini
        console.log(`[CommentAutoResponder] Generating AI reply for @${authorName}: "${commentText}"`);
        let replyText = await geminiService.generateVideoCommentReply({
          authorName,
          commentText,
          videoTitle: '',
          persona: settings.persona || 'friendly_gamer',
          customInstructions: settings.customPrompt || ''
        });

        if (!replyText) {
          replyText = `Thanks for watching and supporting @${authorName}! ❤️🔥`;
        }

        // 7. Post Reply to YouTube
        try {
          await youtubeService.postCommentReply(authClient, commentId, replyText);
          
          db.markCommentReplied(commentId, {
            videoId,
            videoTitle: '',
            authorName,
            authorAvatar,
            commentText,
            replyText,
            publishedAt,
            status: 'success'
          });

          repliedCount++;
          const replyRecord = {
            commentId,
            authorName,
            authorAvatar,
            commentText,
            replyText,
            videoId,
            time: new Date().toISOString()
          };

          results.push(replyRecord);

          // Emit real-time update
          if (this.io) {
            this.io.emit('commentReplied', replyRecord);
          }

          console.log(`[CommentAutoResponder] ✅ Replied to @${authorName}: "${replyText}"`);

          // Small throttle delay between replies (1.5 seconds)
          await new Promise(r => setTimeout(r, 1500));
        } catch (postErr) {
          console.error(`[CommentAutoResponder] Failed to post reply to ${commentId}:`, postErr.message);
          db.markCommentReplied(commentId, {
            videoId,
            authorName,
            commentText,
            replyText: `[Error: ${postErr.message}]`,
            status: 'error'
          });
        }
      }
    } catch (err) {
      console.error('[CommentAutoResponder] Error querying comments:', err.message);
      throw err;
    } finally {
      this.isProcessing = false;
      this.broadcastStatus();
    }

    return {
      success: true,
      processedCount,
      repliedCount,
      results
    };
  }
}

module.exports = new CommentAutoResponderService();
