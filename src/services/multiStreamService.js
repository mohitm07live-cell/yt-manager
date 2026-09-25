const EventEmitter = require('events');
const db = require('./db');
const auth = require('./auth');
const youtube = require('./youtube');
const botEngine = require('./botEngine');

class MultiStreamService extends EventEmitter {
  constructor() {
    super();
    this.io = null;
    this.streamState = new Map(); // streamId -> { liveChatId, nextPageToken, isPolling, pollTimer, status, channelName, videoId }
    this.processedMsgIds = new Set();
    this.pollingIntervalMs = 4000;
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

  init() {
    // Listen to primary stream messages from botEngine
    botEngine.on('chatMessage', (msg) => {
      this.handlePrimaryChatMessage(msg);
    });

    // Listen to stream status changes
    botEngine.on('botStatus', (status) => {
      this.updatePrimaryStreamStatus(status);
    });

    // Start polling all enabled secondary streams
    this.startAllStreams();
  }

  handlePrimaryChatMessage(msg) {
    const config = db.getMultiStreamConfig();
    const primaryConfig = config.streams.find(s => s.isPrimary) || {
      id: 'stream-primary',
      name: 'Primary Stream',
      color: '#3B82F6'
    };

    if (!primaryConfig.enabled) return;

    const formattedMessage = {
      id: msg.id || 'msg-p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      streamId: primaryConfig.id,
      channelName: primaryConfig.name || msg.channelTitle || 'Primary Stream',
      channelColor: primaryConfig.color || '#3B82F6',
      authorName: msg.author || msg.displayName || 'User',
      authorAvatar: msg.avatar || msg.profileImageUrl || '',
      authorChannelId: msg.authorChannelId || '',
      message: msg.message || msg.text || '',
      timestamp: msg.timestamp || new Date().toISOString(),
      badges: {
        isOwner: msg.isOwner || false,
        isModerator: msg.isModerator || msg.isMod || false,
        isMember: msg.isMember || false,
        isVerified: msg.isVerified || false
      },
      superChat: msg.superChat || null
    };

    // Store in processed to avoid duplicates
    this.processedMsgIds.add(formattedMessage.id);
    if (this.processedMsgIds.size > 2000) {
      const arr = Array.from(this.processedMsgIds);
      this.processedMsgIds = new Set(arr.slice(1000));
    }

    this.broadcast('multiChat:message', formattedMessage);
  }

  updatePrimaryStreamStatus(status) {
    const config = db.getMultiStreamConfig();
    const primary = config.streams.find(s => s.isPrimary);
    if (primary) {
      const state = this.streamState.get(primary.id) || {};
      state.status = status.running ? (status.stream ? 'live' : 'searching') : 'stopped';
      state.title = status.stream ? status.stream.title : 'Primary Stream';
      this.streamState.set(primary.id, state);
      this.broadcastStreamStatuses();
    }
  }

  async startAllStreams() {
    const config = db.getMultiStreamConfig();
    for (const stream of config.streams) {
      if (stream.enabled && !stream.isPrimary) {
        this.startStreamPolling(stream);
      }
    }
    this.broadcastStreamStatuses();
  }

  stopAllStreams() {
    for (const [streamId, state] of this.streamState.entries()) {
      if (state.pollTimer) {
        clearTimeout(state.pollTimer);
      }
    }
    this.streamState.clear();
  }

  async startStreamPolling(stream) {
    if (!stream || !stream.id || stream.isPrimary) return;

    // Clear any existing timer for this stream
    const existing = this.streamState.get(stream.id);
    if (existing && existing.pollTimer) {
      clearTimeout(existing.pollTimer);
    }

    const state = {
      streamId: stream.id,
      videoId: youtube.extractVideoId(stream.input || stream.videoId),
      liveChatId: null,
      nextPageToken: null,
      status: 'connecting',
      channelName: stream.name || 'Stream ' + stream.id,
      pollTimer: null,
      errorCount: 0
    };

    this.streamState.set(stream.id, state);
    this.pollStreamChat(stream.id);
  }

  stopStreamPolling(streamId) {
    const state = this.streamState.get(streamId);
    if (state) {
      if (state.pollTimer) clearTimeout(state.pollTimer);
      this.streamState.delete(streamId);
      this.broadcastStreamStatuses();
    }
  }

  async pollStreamChat(streamId) {
    const state = this.streamState.get(streamId);
    if (!state) return;

    const config = db.getMultiStreamConfig();
    const streamConfig = config.streams.find(s => s.id === streamId);
    if (!streamConfig || !streamConfig.enabled) {
      this.stopStreamPolling(streamId);
      return;
    }

    try {
      if (auth.isAuthenticated()) {
        // 1. OAuth Mode
        if (!state.liveChatId) {
          const authClient = auth.getOAuthClient();
          const yt = youtube.getYoutubeClient(authClient);
          const vRes = await yt.videos.list({
            part: ['snippet', 'liveStreamingDetails'],
            id: [state.videoId]
          });

          if (vRes.data.items && vRes.data.items.length > 0) {
            const item = vRes.data.items[0];
            state.channelName = streamConfig.name !== 'YouTube Live Stream' ? streamConfig.name : item.snippet.channelTitle;
            const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
            if (liveChatId) {
              state.liveChatId = liveChatId;
              state.status = 'live';
            } else {
              state.status = 'offline';
            }
          } else {
            state.status = 'video_not_found';
          }
        }

        if (state.liveChatId) {
          const authClient = auth.getOAuthClient();
          const yt = youtube.getYoutubeClient(authClient);
          const params = {
            liveChatId: state.liveChatId,
            part: ['snippet', 'authorDetails'],
            maxResults: 200
          };
          if (state.nextPageToken) {
            params.pageToken = state.nextPageToken;
          }

          const cRes = await yt.liveChatMessages.list(params);
          state.nextPageToken = cRes.data.nextPageToken;
          state.status = 'live';
          state.errorCount = 0;

          if (cRes.data.items && cRes.data.items.length > 0) {
            for (const item of cRes.data.items) {
              if (this.processedMsgIds.has(item.id)) continue;
              this.processedMsgIds.add(item.id);

              const formattedMessage = {
                id: item.id,
                streamId: streamId,
                channelName: streamConfig.name || state.channelName || 'Live Stream',
                channelColor: streamConfig.color || '#10B981',
                authorName: item.authorDetails.displayName,
                authorAvatar: item.authorDetails.profileImageUrl,
                authorChannelId: item.authorDetails.channelId,
                message: item.snippet.displayMessage || item.snippet.textMessageDetails?.messageText || '',
                timestamp: item.snippet.publishedAt || new Date().toISOString(),
                badges: {
                  isOwner: item.authorDetails.isChatOwner || false,
                  isModerator: item.authorDetails.isChatModerator || false,
                  isMember: item.authorDetails.isChatSponsor || false,
                  isVerified: item.authorDetails.isVerified || false
                },
                superChat: item.snippet.superChatDetails ? {
                  amount: item.snippet.superChatDetails.amountDisplayString,
                  userComment: item.snippet.superChatDetails.userComment
                } : null
              };

              this.broadcast('multiChat:message', formattedMessage);
            }
          }
        }
      } else {
        // 2. Public Live Chat Mode (No OAuth Required)
        const pubRes = await youtube.fetchPublicLiveChat(state.videoId, state.nextPageToken);
        if (pubRes.nextContinuation) {
          state.nextPageToken = pubRes.nextContinuation;
        }
        state.status = 'live';
        state.errorCount = 0;

        if (pubRes.items && pubRes.items.length > 0) {
          for (const item of pubRes.items) {
            if (this.processedMsgIds.has(item.id)) continue;
            this.processedMsgIds.add(item.id);

            const formattedMessage = {
              id: item.id,
              streamId: streamId,
              channelName: streamConfig.name || state.channelName || 'Live Stream',
              channelColor: streamConfig.color || '#10B981',
              authorName: item.authorName,
              authorAvatar: item.authorAvatar,
              authorChannelId: '',
              message: item.message,
              timestamp: item.timestamp,
              badges: item.badges || { isOwner: false, isModerator: false, isMember: false, isVerified: false },
              superChat: item.superChat || null
            };

            this.broadcast('multiChat:message', formattedMessage);
          }
        }
      }
    } catch (err) {
      console.error(`[MultiStreamService] Error polling stream ${streamId}:`, err.message);
      state.errorCount = (state.errorCount || 0) + 1;
      state.status = err.message?.includes('liveChatEnded') ? 'ended' : 'error';
      if (state.errorCount > 10) {
        state.liveChatId = null; // reset live chat ID to re-query next time
      }
    }

    // Schedule next poll interval (4s default or fallback)
    state.pollTimer = setTimeout(() => {
      this.pollStreamChat(streamId);
    }, this.pollingIntervalMs);

    this.broadcastStreamStatuses();
  }

  broadcastStreamStatuses() {
    const config = db.getMultiStreamConfig();
    const result = config.streams.map(s => {
      const st = this.streamState.get(s.id) || {};
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        enabled: s.enabled,
        isPrimary: s.isPrimary,
        status: s.isPrimary ? (botEngine.isRunning ? 'live' : 'stopped') : (st.status || 'idle'),
        videoId: s.videoId || st.videoId || ''
      };
    });
    this.broadcast('multiChat:streamsList', result);
  }
}

module.exports = new MultiStreamService();
