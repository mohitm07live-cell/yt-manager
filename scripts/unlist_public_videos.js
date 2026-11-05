const { google } = require('googleapis');
const auth = require('../src/services/auth');
const db = require('../src/services/db');

async function main() {
  if (!auth.isAuthenticated()) {
    console.error('User is not authenticated with YouTube.');
    process.exit(1);
  }

  const authClient = auth.getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth: authClient });

  console.log('Fetching channel uploads playlist...');
  const chRes = await youtube.channels.list({
    part: ['contentDetails', 'snippet', 'statistics'],
    mine: true
  });

  if (!chRes.data.items || chRes.data.items.length === 0) {
    console.error('No channel found for authenticated account.');
    process.exit(1);
  }

  const channel = chRes.data.items[0];
  const channelTitle = channel.snippet.title;
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
  console.log(`Connected Channel: "${channelTitle}" (${channel.id})`);
  console.log(`Uploads Playlist ID: ${uploadsPlaylistId}`);

  // Fetch all videos in uploads playlist
  let pageToken = '';
  const allVideos = [];

  console.log('\nFetching video list from uploads playlist...');
  do {
    const res = await youtube.playlistItems.list({
      part: ['snippet', 'status', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: pageToken || undefined
    });

    if (res.data.items) {
      for (const item of res.data.items) {
        allVideos.push({
          id: item.contentDetails.videoId,
          title: item.snippet.title,
          privacyStatus: item.status?.privacyStatus || 'unknown',
          publishedAt: item.snippet.publishedAt
        });
      }
    }
    pageToken = res.data.nextPageToken;
    console.log(`Fetched ${allVideos.length} videos so far...`);
  } while (pageToken);

  console.log(`\nTotal videos found in channel: ${allVideos.length}`);

  const publicVideos = allVideos.filter(v => v.privacyStatus === 'public');
  const unlistedVideos = allVideos.filter(v => v.privacyStatus === 'unlisted');
  const privateVideos = allVideos.filter(v => v.privacyStatus === 'private');

  console.log(`- Public: ${publicVideos.length}`);
  console.log(`- Unlisted: ${unlistedVideos.length}`);
  console.log(`- Private: ${privateVideos.length}`);

  if (publicVideos.length === 0) {
    console.log('\n✅ No public videos found. All videos are already unlisted or private.');
    return;
  }

  console.log(`\nStarting unlisting process for ${publicVideos.length} public videos...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < publicVideos.length; i++) {
    const video = publicVideos[i];
    process.stdout.write(`[${i + 1}/${publicVideos.length}] Unlisting "${video.title.slice(0, 40)}..." (${video.id})... `);
    try {
      await youtube.videos.update({
        part: ['status'],
        requestBody: {
          id: video.id,
          status: {
            privacyStatus: 'unlisted'
          }
        }
      });
      successCount++;
      console.log('✅ DONE');
      db.addLog({
        type: 'system',
        message: `Video unlisted: "${video.title}" (${video.id})`
      });
    } catch (err) {
      failCount++;
      console.log(`❌ ERROR: ${err.message}`);
      db.addLog({
        type: 'error',
        message: `Failed to unlist video "${video.title}" (${video.id}): ${err.message}`
      });
    }

    // Small delay to prevent hitting rapid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n====================================================');
  console.log(`🎉 Completed!`);
  console.log(`Successfully unlisted: ${successCount} videos`);
  if (failCount > 0) {
    console.log(`Failed: ${failCount} videos`);
  }
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
