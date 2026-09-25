const { google } = require('googleapis');
const db = require('./db');
const config = require('../config');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

class AuthService {
  constructor() {
    this.clientId = config.CLIENT_ID;
    this.clientSecret = config.CLIENT_SECRET;
    this.redirectUri = this.resolveRedirectUri();

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    // Auto save refreshed tokens
    this.oauth2Client.on('tokens', (tokens) => {
      const existing = db.getTokens() || {};
      const updated = {
        ...existing,
        ...tokens,
        // Preserve refresh_token if not provided in refresh response
        refresh_token: tokens.refresh_token || existing.refresh_token
      };
      db.setTokens(updated);
      db.addLog({
        type: 'system',
        message: 'OAuth tokens refreshed successfully.'
      });
    });

    // Load stored tokens on startup if available
    const savedTokens = db.getTokens();
    if (savedTokens) {
      this.oauth2Client.setCredentials(savedTokens);
    }
  }

  resolveRedirectUri(req = null) {
    if (config.REDIRECT_URI) {
      return config.REDIRECT_URI;
    }
    if (process.env.RENDER_EXTERNAL_URL) {
      return `${process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '')}/auth/google/callback`;
    }
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get?.('host');
      if (host) {
        return `${protocol}://${host}/auth/google/callback`;
      }
    }
    return 'http://localhost:3000/auth/google/callback';
  }

  applyRedirectUri(req = null) {
    const uri = this.resolveRedirectUri(req);
    this.redirectUri = uri;
    if (this.oauth2Client) {
      this.oauth2Client._redirectUri = uri;
      this.oauth2Client.redirectUri = uri;
    }
    return uri;
  }

  getAuthUrl(req = null) {
    this.applyRedirectUri(req);
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES
    });
  }

  async handleCallback(code, req = null) {
    this.applyRedirectUri(req);
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    db.setTokens(tokens);

    // Fetch user profile and channel information
    const profile = await this.fetchUserProfile();
    const channel = await this.fetchChannelInfo();

    db.addLog({
      type: 'system',
      message: `User logged in as ${profile.name || 'Streamer'} (Channel: ${channel ? channel.title : 'N/A'})`
    });

    return { tokens, profile, channel };
  }

  async fetchUserProfile() {
    try {
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2'
      });
      const res = await oauth2.userinfo.get();
      const profile = {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        picture: res.data.picture
      };
      db.setUserProfile(profile);
      return profile;
    } catch (err) {
      console.error('Error fetching user profile:', err.message);
      return db.getUserProfile();
    }
  }

  async fetchChannelInfo() {
    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client
      });
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true
      });

      if (res.data.items && res.data.items.length > 0) {
        const item = res.data.items[0];
        const channelInfo = {
          id: item.id,
          title: item.snippet.title,
          customUrl: item.snippet.customUrl || '',
          avatar: item.snippet.thumbnails?.default?.url,
          subscriberCount: item.statistics.subscriberCount,
          videoCount: item.statistics.videoCount
        };
        db.setChannelInfo(channelInfo);
        return channelInfo;
      }
    } catch (err) {
      console.error('Error fetching channel info:', err.message);
    }
    return db.getChannelInfo();
  }

  isAuthenticated() {
    const tokens = db.getTokens();
    return Boolean(tokens && (tokens.access_token || tokens.refresh_token));
  }

  getOAuthClient() {
    return this.oauth2Client;
  }

  logout() {
    db.setTokens(null);
    db.setUserProfile(null);
    db.setChannelInfo(null);
    this.oauth2Client.setCredentials({});
    db.addLog({
      type: 'system',
      message: 'User logged out and tokens cleared.'
    });
  }
}

module.exports = new AuthService();
