const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const auth = require('../src/services/auth');
const db = require('../src/services/db');

const SHORTS_DIR = path.join(process.cwd(), 'downloads', 'mohit_shorts');
const PUBLISH_AT_ISO = new Date('2026-09-14T04:00:00+05:30').toISOString(); // 14 Sep 2026 4:00 AM IST

const TOP_6_VIRAL_IDS = [
  'DC5336Tcj6Y', // 20,000 views
  '_7dZjziP4UE', // 9,500 views
  '5OGr39Rgxcc', // 7,400 views
  'jAbv-xMdSw4', // 7,000 views
  'tqkpnj_54zU', // 1,700 views
  'Q7xlJH-aBpA'  // 1,700 views
];

function findLocalVideo(videoId) {
  if (!fs.existsSync(SHORTS_DIR)) return null;
  const files = fs.readdirSync(SHORTS_DIR);
  const mp4 = files.find(f => f.startsWith(videoId) && f.endsWith('.mp4') && !f.includes('.f'));
  const json = files.find(f => f.startsWith(videoId) && f.endsWith('.info.json'));
  if (mp4) {
    return {
      mp4Path: path.join(SHORTS_DIR, mp4),
      jsonPath: json ? path.join(SHORTS_DIR, json) : null
    };
  }
  return null;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 [VIRAL SHORTS UPLOADER & SCHEDULER]');
  console.log(`📅 Target Schedule: 14 September 2026, 04:00 AM IST`);
  console.log(`⏱️ ISO String: ${PUBLISH_AT_ISO}`);
  console.log('====================================================\n');

  if (!auth.isAuthenticated()) {
    console.error('❌ User is not authenticated with YouTube.');
    process.exit(1);
  }

  const authClient = auth.getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth: authClient });
  const channelInfo = db.getChannelInfo();
  console.log(`Connected Channel: ${channelInfo ? channelInfo.title : 'Target Channel'} (${channelInfo?.id || ''})\n`);

  let uploadedCount = 0;

  for (let i = 0; i < TOP_6_VIRAL_IDS.length; i++) {
    const videoId = TOP_6_VIRAL_IDS[i];
    console.log(`----------------------------------------------------`);
    console.log(`[${i + 1}/6] Processing Video: ${videoId}`);

    const local = findLocalVideo(videoId);
    if (!local || !fs.existsSync(local.mp4Path)) {
      console.error(`❌ Could not locate downloaded MP4 for ${videoId}`);
      continue;
    }

    let meta = {
      title: 'Free Fire Viral Short #shorts #freefire #mohitm07',
      description: 'Subscribe to MOHIT-M07 for daily Free Fire live streams & gaming shorts! #shorts #freefire #gaming',
      tags: ['shorts', 'freefire', 'ffshorts', 'mohit m07', 'gaming', 'viral']
    };

    if (local.jsonPath && fs.existsSync(local.jsonPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(local.jsonPath, 'utf8'));
        meta.title = info.title || meta.title;
        meta.description = info.description || meta.description;
        meta.tags = (info.tags && info.tags.length > 0) ? info.tags : meta.tags;
      } catch (e) {}
    }

    if (meta.title.length > 100) {
      meta.title = meta.title.slice(0, 97) + '...';
    }

    console.log(`📝 Title: ${meta.title}`);
    console.log(`📦 Size: ${(fs.statSync(local.mp4Path).size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📤 Uploading and scheduling for 14 Sep 04:00 AM IST...`);

    try {
      db.recordQuotaUsage(1600, 'videos.insert');
      const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: meta.title,
            description: meta.description,
            tags: meta.tags,
            categoryId: '20' // Gaming
          },
          status: {
            privacyStatus: 'private',
            publishAt: PUBLISH_AT_ISO,
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(local.mp4Path)
        }
      });

      const newId = res.data.id;
      uploadedCount++;
      console.log(`✅ SUCCESS! Video Uploaded & Scheduled: https://youtu.be/${newId}`);
      console.log(`⏰ Scheduled Publish Date: ${res.data.status?.publishAt || PUBLISH_AT_ISO}`);

      db.addLog({
        type: 'system',
        message: `Uploaded & Scheduled Short: "${meta.title}" -> https://youtu.be/${newId} (Scheduled: 14 Sep 4:00 AM IST)`
      });

      // Pause between uploads
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`❌ Upload failed: ${err.message}`);
      if (err.message?.includes('quota') || err.code === 403) {
        console.log('\n⚠️ Daily YouTube API Quota Reached.');
        break;
      }
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 Completed: ${uploadedCount}/6 Videos Uploaded & Scheduled!`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
