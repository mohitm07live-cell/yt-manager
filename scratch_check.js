const { google } = require('googleapis');
const db = require('./src/services/db');
const config = require('./src/config');

async function checkAccount() {
  const tokens = db.getTokens();
  console.log('--- DATABASE SAVED DATA ---');
  console.log('Saved UserProfile:', db.getUserProfile());
  console.log('Saved ChannelInfo:', db.getChannelInfo());

  if (!tokens || !tokens.refresh_token) {
    console.log('No tokens found');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    config.CLIENT_ID,
    config.CLIENT_SECRET,
    'http://localhost:3000/auth/callback'
  );

  oauth2Client.setCredentials(tokens);

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    console.log('--- GOOGLE API LIVE USERINFO ---');
    console.log('Email:', userInfo.data.email);
    console.log('Name:', userInfo.data.name);
    console.log('ID:', userInfo.data.id);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      mine: true,
      part: ['snippet', 'contentDetails', 'statistics']
    });
    if (channelRes.data.items && channelRes.data.items.length > 0) {
      const ch = channelRes.data.items[0];
      console.log('--- LIVE YOUTUBE CHANNEL INFO ---');
      console.log('Channel ID:', ch.id);
      console.log('Title:', ch.snippet.title);
      console.log('CustomURL:', ch.snippet.customUrl);
      console.log('Subscribers:', ch.statistics.subscriberCount);
    }
  } catch (err) {
    console.error('API Error:', err.message);
  }
}

checkAccount().catch(console.error);
