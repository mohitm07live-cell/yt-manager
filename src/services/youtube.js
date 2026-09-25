const { google } = require('googleapis');
const db = require('./db');

class YouTubeService {
  constructor() {
    this.broadcastCache = null;
    this.broadcastCacheTime = 0;
    this.videoMetricsCache = new Map(); // videoId -> { data, timestamp }
    this.channelMetricsCache = { data: null, timestamp: 0 };
  }

  getYoutubeClient(authClient) {
    return google.youtube({
      version: 'v3',
      auth: authClient
    });
  }

  extractVideoId(input) {
    if (!input) return '';
    const str = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    const studioMatch = str.match(/studio\.youtube\.com\/video\/([a-zA-Z0-9_-]{11})/);
    if (studioMatch) return studioMatch[1];
    const watchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:live|shorts)\/)([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    return str.split('&')[0].split('?')[0].split('/').pop();
  }

  async fetchPublicLiveChat(videoId, continuationToken = '') {
    const https = require('https');
    if (!this.liveApiKeyCache) this.liveApiKeyCache = new Map();
    
    const makeRequest = (url, options = {}, postData = null) => {
      return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
      });
    };

    try {
      let token = continuationToken;
      let apiKey = this.liveApiKeyCache.get(videoId) || '';

      if (!token || !apiKey) {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const html = await makeRequest(watchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
        if (keyMatch) {
          apiKey = keyMatch[1];
          this.liveApiKeyCache.set(videoId, apiKey);
        }

        if (!token) {
          const tokenMatch = html.match(/"continuation":"([^"]+)"/);
          if (tokenMatch) token = tokenMatch[1];
        }
      }

      if (!token) return { items: [], nextContinuation: null };

      const apiUrl = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${apiKey || 'AIzaSyAO_FJz07b8b_91_Xz3'}`;
      const payload = JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240901.00.00'
          }
        },
        continuation: token
      });

      const jsonStr = await makeRequest(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Origin': 'https://www.youtube.com',
          'Referer': `https://www.youtube.com/watch?v=${videoId}`
        }
      }, payload);

      const data = JSON.parse(jsonStr);
      const continuationContents = data?.continuationContents?.liveChatContinuation;
      const actions = continuationContents?.actions || [];
      const nextContinuation = continuationContents?.continuations?.[0]?.invalidationContinuationData?.continuation ||
                               continuationContents?.continuations?.[0]?.timedContinuationData?.continuation ||
                               continuationContents?.continuations?.[0]?.liveChatReplayContinuationData?.continuation || null;

      const items = [];
      for (const action of actions) {
        const item = action?.addChatItemAction?.item || action?.addLiveChatItemAction?.item;
        if (item) {
          const rendererKey = Object.keys(item)[0];
          const renderer = item[rendererKey];
          if (renderer) {
            const msgText = renderer.message?.runs?.map(r => r.text).join('') || renderer.headerSubtext?.runs?.map(r => r.text).join('') || '';
            const authorName = renderer.authorName?.simpleText || 'User';
            const avatar = renderer.authorPhoto?.thumbnails?.[0]?.url || '';
            const id = renderer.id || item.id || 'pub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

            let superChat = null;
            if (rendererKey === 'liveChatPaidMessageRenderer') {
              superChat = {
                amount: renderer.purchaseAmountText?.simpleText || 'SuperChat',
                userComment: msgText
              };
            }

            const isOwner = renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.tooltip?.toLowerCase().includes('owner')) || false;
            const isModerator = renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.tooltip?.toLowerCase().includes('moderator')) || false;
            const isMember = renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.tooltip?.toLowerCase().includes('member')) || false;

            if (msgText || superChat) {
              items.push({
                id,
                authorName,
                authorAvatar: avatar,
                message: msgText,
                timestamp: new Date().toISOString(),
                badges: { isOwner, isModerator, isMember, isVerified: false },
                superChat
              });
            }
          }
        }
      }

      return { items, nextContinuation };
    } catch (e) {
      console.error('Error fetching public live chat:', e.message);
      return { items: [], nextContinuation: null };
    }
  }

  handleApiError(err, context = 'API Call') {
    const isQuota = err.message?.includes('quota') || err.code === 403;
    if (isQuota) {
      db.setQuotaExceeded(true);
      // Debounced single error log to avoid filling memory/logs
      const lastLogs = db.getLogs(5);
      const alreadyLogged = lastLogs.some(l => l.message?.includes('quota') && (Date.now() - new Date(l.timestamp).getTime() < 300000));
      if (!alreadyLogged) {
        db.addLog({
          type: 'error',
          message: `YouTube API Daily Quota Exceeded (10,000 units reached). Bot pausing external calls until daily reset at 1:00 PM IST.`
        });
      }
    } else {
      console.error(`Error in ${context}:`, err.message);
    }
  }

  /**
   * Find an active or upcoming live broadcast with intelligent 30s caching
   */
  async findActiveBroadcast(authClient, manualVideoId = '') {
    // Check in-memory cache (30 seconds)
    const now = Date.now();
    if (this.broadcastCache && (now - this.broadcastCacheTime < 30000)) {
      return this.broadcastCache;
    }

    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) {
      return null;
    }

    const youtube = this.getYoutubeClient(authClient);

    // If manual video ID supplied
    if (manualVideoId && manualVideoId.trim()) {
      const cleanId = this.extractVideoId(manualVideoId);
      if (cleanId && cleanId.length === 11) {
        try {
          db.recordQuotaUsage(1, 'broadcastList');
          const res = await youtube.videos.list({
            part: ['snippet', 'statistics', 'liveStreamingDetails'],
            id: [cleanId]
          });

          if (res.data.items && res.data.items.length > 0) {
            const item = res.data.items[0];
            const liveContent = item.snippet?.liveBroadcastContent;
            // Only use if currently live or has active live chat
            if (liveContent === 'live' || item.liveStreamingDetails?.activeLiveChatId) {
              const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
              const result = {
                id: item.id,
                title: item.snippet.title,
                liveChatId: liveChatId || null,
                status: liveContent || 'live',
                publishedAt: item.snippet.publishedAt,
                concurrentViewers: parseInt(item.liveStreamingDetails?.concurrentViewers || 0, 10),
                likeCount: parseInt(item.statistics?.likeCount || 0, 10),
                viewCount: parseInt(item.statistics?.viewCount || 0, 10),
                isManual: true
              };
              this.broadcastCache = result;
              this.broadcastCacheTime = now;
              return result;
            } else {
              console.log(`[YouTube] Manual video ${cleanId} is not live (${liveContent}). Auto-detecting active channel stream...`);
            }
          }
        } catch (err) {
          this.handleApiError(err, 'Manual Video Broadcast Query');
        }
      }
    }

    // Auto-detect broadcast (1 unit cost)
    try {
      db.recordQuotaUsage(1, 'broadcastList');
      const res = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'active',
        maxResults: 1
      });

      if (res.data.items && res.data.items.length > 0) {
        const broadcast = res.data.items[0];
        
        let likeCount = 0;
        let concurrentViewers = 0;
        try {
          db.recordQuotaUsage(1, 'broadcastList');
          const vRes = await youtube.videos.list({
            part: ['statistics', 'liveStreamingDetails'],
            id: [broadcast.id]
          });
          if (vRes.data.items && vRes.data.items.length > 0) {
            const vItem = vRes.data.items[0];
            likeCount = parseInt(vItem.statistics?.likeCount || 0, 10);
            concurrentViewers = parseInt(vItem.liveStreamingDetails?.concurrentViewers || 0, 10);
          }
        } catch (e) {}

        const result = {
          id: broadcast.id,
          title: broadcast.snippet.title,
          liveChatId: broadcast.snippet.liveChatId,
          status: 'live',
          publishedAt: broadcast.snippet.actualStartTime || broadcast.snippet.publishedAt,
          likeCount,
          concurrentViewers,
          isManual: false
        };
        this.broadcastCache = result;
        this.broadcastCacheTime = now;
        return result;
      }
    } catch (err) {
      this.handleApiError(err, 'Auto-detect Broadcast Query');
    }

    return null;
  }

  /**
   * Fetch live metrics (likes, viewers) with 45s smart cache
   */
  async fetchVideoLiveMetrics(authClient, videoId) {
    if (!videoId) return null;
    const now = Date.now();
    const cached = this.videoMetricsCache.get(videoId);
    if (cached && (now - cached.timestamp < 45000)) {
      return cached.data;
    }

    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) return cached ? cached.data : null;

    const youtube = this.getYoutubeClient(authClient);
    try {
      db.recordQuotaUsage(1, 'broadcastList');
      const res = await youtube.videos.list({
        part: ['statistics', 'liveStreamingDetails'],
        id: [videoId]
      });
      if (res.data.items && res.data.items.length > 0) {
        const item = res.data.items[0];
        const data = {
          likeCount: parseInt(item.statistics?.likeCount || 0, 10),
          viewCount: parseInt(item.statistics?.viewCount || 0, 10),
          concurrentViewers: parseInt(item.liveStreamingDetails?.concurrentViewers || 0, 10)
        };
        this.videoMetricsCache.set(videoId, { data, timestamp: now });
        return data;
      }
    } catch (err) {
      this.handleApiError(err, 'Video Live Metrics Query');
    }
    return cached ? cached.data : null;
  }

  /**
   * Fetch updated channel stats with 25s cache
   */
  async fetchChannelMetrics(authClient, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.channelMetricsCache.data && (now - this.channelMetricsCache.timestamp < 25000)) {
      return this.channelMetricsCache.data;
    }

    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) return this.channelMetricsCache.data;

    const youtube = this.getYoutubeClient(authClient);
    try {
      db.recordQuotaUsage(1, 'broadcastList');
      const res = await youtube.channels.list({
        part: ['statistics'],
        mine: true
      });
      if (res.data.items && res.data.items.length > 0) {
        const stats = res.data.items[0].statistics;
        const data = {
          subscriberCount: parseInt(stats.subscriberCount || 0, 10),
          videoCount: parseInt(stats.videoCount || 0, 10),
          viewCount: parseInt(stats.viewCount || 0, 10)
        };
        this.channelMetricsCache = { data, timestamp: now };
        return data;
      }
    } catch (err) {
      this.handleApiError(err, 'Channel Metrics Query');
    }
    return this.channelMetricsCache.data;
  }

  /**
   * Fetch chat messages with quota tracking & adaptive interval
   */
  async getLiveChatMessages(authClient, liveChatId, pageToken = '') {
    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) {
      throw new Error('quotaExceeded: YouTube API quota limit reached.');
    }

    const youtube = this.getYoutubeClient(authClient);
    const params = {
      liveChatId: liveChatId,
      part: ['snippet', 'authorDetails'],
      maxResults: 200
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    try {
      db.recordQuotaUsage(1, 'chatList');
      const res = await youtube.liveChatMessages.list(params);
      return {
        items: res.data.items || [],
        nextPageToken: res.data.nextPageToken,
        pollingIntervalMillis: res.data.pollingIntervalMillis || 4000,
        offlineAt: res.data.offlineAt || null
      };
    } catch (err) {
      this.handleApiError(err, 'Live Chat Messages Query');
      throw err;
    }
  }

  /**
   * Post message to live chat
   */
  async sendChatMessage(authClient, liveChatId, messageText) {
    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) {
      console.warn('Cannot send message: API quota exceeded.');
      return null;
    }

    const youtube = this.getYoutubeClient(authClient);
    try {
      db.recordQuotaUsage(1, 'chatSend');
      const res = await youtube.liveChatMessages.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            liveChatId: liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: messageText
            }
          }
        }
      });
      return res.data;
    } catch (err) {
      this.handleApiError(err, 'Send Chat Message');
      throw err;
    }
  }

  /**
   * Delete a chat message
   */
  async deleteChatMessage(authClient, messageId) {
    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) return false;

    const youtube = this.getYoutubeClient(authClient);
    try {
      db.recordQuotaUsage(1, 'chatSend');
      await youtube.liveChatMessages.delete({
        id: messageId
      });
      return true;
    } catch (err) {
      this.handleApiError(err, 'Delete Chat Message');
      throw err;
    }
  }

  /**
   * Ban or timeout user in chat
   */
  async banUser(authClient, liveChatId, channelId, durationSeconds = null) {
    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) return null;

    const youtube = this.getYoutubeClient(authClient);
    try {
      db.recordQuotaUsage(1, 'chatSend');
      const requestBody = {
        snippet: {
          liveChatId: liveChatId,
          type: durationSeconds ? 'temporary' : 'permanent',
          bannedUserDetails: {
            channelId: channelId
          }
        }
      };

      if (durationSeconds) {
        requestBody.snippet.banDurationSeconds = durationSeconds;
      }

      const res = await youtube.liveChatBans.insert({
        part: ['snippet'],
        requestBody: requestBody
      });
      return res.data;
    } catch (err) {
      this.handleApiError(err, 'Ban User Action');
      throw err;
    }
  }

  /**
   * Fetch subscribers with quota tracking and batching
   */
  async fetchSubscribers(authClient) {
    const quotaInfo = db.getQuotaInfo();
    if (quotaInfo.isExceeded) {
      throw new Error('YouTube API Quota exceeded. Cannot sync subscribers right now.');
    }

    const youtube = this.getYoutubeClient(authClient);
    const subscribers = [];
    let pageToken = '';

    try {
      do {
        db.recordQuotaUsage(1, 'subscribersSync');
        const params = {
          part: ['snippet', 'subscriberSnippet'],
          mySubscribers: true,
          maxResults: 50
        };
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const res = await youtube.subscriptions.list(params);
        if (res.data.items && res.data.items.length > 0) {
          for (const item of res.data.items) {
            const subSnippet = item.subscriberSnippet;
            subscribers.push({
              id: item.id,
              channelId: subSnippet?.channelId || item.snippet?.resourceId?.channelId,
              name: subSnippet?.title || item.snippet?.title || 'Subscriber',
              description: subSnippet?.description || '',
              avatar: subSnippet?.thumbnails?.default?.url || '',
              subscribedAt: item.snippet?.publishedAt || new Date().toISOString()
            });
          }
        }
        pageToken = res.data.nextPageToken;
      } while (pageToken && subscribers.length < 500);
    } catch (err) {
      this.handleApiError(err, 'Subscriber Sync Query');
      throw err;
    }

    return subscribers;
  }

  /**
   * Update video metadata (title, description, tags) on YouTube
   */
  async updateVideoMetadata(authClient, videoId, updates = {}) {
    const youtube = this.getYoutubeClient(authClient);

    try {
      // 1. Fetch current snippet (categoryId is required by YouTube API for videos.update)
      db.recordQuotaUsage(1, 'videos.list');
      const listRes = await youtube.videos.list({
        part: ['snippet'],
        id: [videoId]
      });

      if (!listRes.data.items || listRes.data.items.length === 0) {
        throw new Error(`Video "${videoId}" not found on YouTube`);
      }

      const currentSnippet = listRes.data.items[0].snippet;

      // 2. Build updated snippet preserving existing properties
      const newSnippet = {
        title: updates.title !== undefined && updates.title !== null ? String(updates.title).trim() : currentSnippet.title,
        description: updates.description !== undefined && updates.description !== null ? String(updates.description) : currentSnippet.description,
        tags: Array.isArray(updates.tags) ? updates.tags : (currentSnippet.tags || []),
        categoryId: currentSnippet.categoryId || '20', // 20 is Gaming
        defaultLanguage: currentSnippet.defaultLanguage,
        defaultAudioLanguage: currentSnippet.defaultAudioLanguage
      };

      // 3. Update video on YouTube (costs 50 quota units)
      db.recordQuotaUsage(50, 'videos.update');
      const updateRes = await youtube.videos.update({
        part: ['snippet'],
        requestBody: {
          id: videoId,
          snippet: newSnippet
        }
      });

      db.addLog({
        type: 'system',
        message: `Successfully updated YouTube video "${videoId}": Title = "${newSnippet.title}"`
      });

      return {
        success: true,
        videoId,
        title: updateRes.data.snippet.title,
        description: updateRes.data.snippet.description,
        tags: updateRes.data.snippet.tags,
        snippet: updateRes.data.snippet
      };
    } catch (err) {
      this.handleApiError(err, `Update Video Metadata for ${videoId}`);
      throw err;
    }
  }
}

module.exports = new YouTubeService();

