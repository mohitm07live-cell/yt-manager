require('dotenv').config();
const auth = require('../src/services/auth');
const db = require('../src/services/db');
const { google } = require('googleapis');

(async () => {
  try {
    console.log('=== STARTING REUSED CONTENT SHORTS DELETION PROCESS ===');
    const authClient = auth.getOAuthClient();
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    // 1. Fetch channel and uploads playlist
    const chRes = await youtube.channels.list({ part: ['contentDetails', 'snippet'], mine: true });
    const channel = chRes.data.items?.[0];
    if (!channel) {
      console.error('No channel found or token invalid.');
      return;
    }
    console.log(`Target Channel: ${channel.snippet?.title} (${channel.snippet?.customUrl})`);

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('Uploads playlist not found.');
      return;
    }

    // 2. Fetch all playlist items
    let playlistItems = [];
    let nextPageToken = null;
    do {
      const plRes = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails', 'status'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken
      });
      playlistItems.push(...(plRes.data.items || []));
      nextPageToken = plRes.data.nextPageToken;
    } while (nextPageToken);

    console.log(`Total Uploads Scanned: ${playlistItems.length}`);

    // 3. Batch fetch video details
    const videoIds = playlistItems.map(v => v.contentDetails?.videoId).filter(Boolean);
    let allVideos = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const vRes = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'status'],
        id: chunk
      });
      allVideos.push(...(vRes.data.items || []));
    }

    // 4. Separate videos: Keep gaming/public ones safe, queue old unlisted/private fact shorts for deletion
    const toDelete = [];
    const toKeep = [];

    allVideos.forEach(v => {
      const title = (v.snippet?.title || '').toLowerCase();
      const desc = (v.snippet?.description || '').toLowerCase();
      const privacy = v.status?.privacyStatus || 'unlisted';

      // Keep public Free Fire gaming streams & gaming shorts safe
      const isGaming = (title.includes('free fire') || title.includes('ff') || title.includes('mohit') || desc.includes('free fire') || desc.includes('gaming') || desc.includes('gameplay')) &&
                       (!title.includes('childhood') && !title.includes('school') && !title.includes('animals') && !title.includes('food') && !title.includes('things we') && !title.includes('facts') && !title.includes('kurkure') && !title.includes('milk is real'));

      if (isGaming && privacy === 'public') {
        toKeep.push(v);
      } else if (privacy === 'public' && (title.includes('mohit') || title.includes('freefire') || title.includes('custom room') || title.includes('diamonds'))) {
        toKeep.push(v);
      } else {
        toDelete.push(v);
      }
    });

    console.log(`\nSafe Gaming Videos to PRESERVE: ${toKeep.length}`);
    toKeep.forEach(v => console.log(`  [KEEP] ${v.id} - ${v.snippet?.title} (${v.status?.privacyStatus})`));

    console.log(`\nReused Fact Shorts Queued for PERMANENT DELETION: ${toDelete.length}`);
    console.log('------------------------------------------------------------');

    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toDelete.length; i++) {
      const v = toDelete[i];
      try {
        await youtube.videos.delete({ id: v.id });
        deletedCount++;
        console.log(`[${deletedCount}/${toDelete.length}] Deleted: ${v.id} - ${v.snippet?.title?.substring(0, 45)}...`);
        // Small delay to prevent API rate spikes
        await new Promise(r => setTimeout(r, 120));
      } catch (delErr) {
        failedCount++;
        console.error(`Failed to delete ${v.id}:`, delErr.message);
        if (delErr.message?.includes('quotaExceeded') || delErr.code === 403) {
          console.error('\n⚠️ YouTube API Daily Quota Exceeded. Stopped at video index:', i);
          break;
        }
      }
    }

    console.log('\n============================================================');
    console.log(`DELETION SUMMARY:`);
    console.log(`Successfully Deleted: ${deletedCount} videos`);
    console.log(`Remaining / Failed: ${failedCount} videos`);
    console.log(`Preserved Public Gaming Videos: ${toKeep.length} videos`);
    console.log('============================================================');

  } catch (err) {
    console.error('Fatal error during deletion script:', err.message);
  }
})();
