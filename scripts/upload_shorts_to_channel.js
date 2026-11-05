const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const auth = require('../src/services/auth');
const db = require('../src/services/db');

const SHORTS_DIR = path.join(process.cwd(), 'downloads', 'mohit_shorts');
const UPLOAD_PROGRESS_FILE = path.join(process.cwd(), 'downloads', 'upload_progress.json');

function loadUploadedMap() {
  if (fs.existsSync(UPLOAD_PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(UPLOAD_PROGRESS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveUploadedMap(map) {
  fs.writeFileSync(UPLOAD_PROGRESS_FILE, JSON.stringify(map, null, 2), 'utf8');
}

async function uploadShorts() {
  console.log('====================================================');
  console.log('🚀 [SHORTS UPLOADER] Uploading Shorts to Connected Channel');
  console.log('====================================================\n');

  if (!auth.isAuthenticated()) {
    console.error('❌ User is not authenticated with YouTube. Please login in the dashboard first.');
    process.exit(1);
  }

  const authClient = auth.getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth: authClient });

  const channelInfo = db.getChannelInfo();
  console.log(`Target Channel: ${channelInfo ? channelInfo.title : 'Connected Channel'} (${channelInfo?.id || ''})`);

  if (!fs.existsSync(SHORTS_DIR)) {
    console.error(`❌ Shorts folder not found at ${SHORTS_DIR}`);
    process.exit(1);
  }

  // Find all mp4 files with their corresponding .info.json
  const files = fs.readdirSync(SHORTS_DIR);
  const mp4Files = files.filter(f => f.endsWith('.mp4'));
  const uploadedMap = loadUploadedMap();

  console.log(`Found ${mp4Files.length} downloaded Shorts in ${SHORTS_DIR}`);
  console.log(`Already uploaded in previous runs: ${Object.keys(uploadedMap).length}\n`);

  let successCount = 0;
  let quotaReached = false;

  for (let i = 0; i < mp4Files.length; i++) {
    const mp4Name = mp4Files[i];
    const baseName = mp4Name.slice(0, -4);
    const jsonName = baseName + '.info.json';
    const mp4Path = path.join(SHORTS_DIR, mp4Name);
    const jsonPath = path.join(SHORTS_DIR, jsonName);

    if (uploadedMap[mp4Name]) {
      console.log(`[${i + 1}/${mp4Files.length}] ⏭️ Already uploaded: "${mp4Name}" -> Video ID: ${uploadedMap[mp4Name]}`);
      continue;
    }

    let meta = {
      title: baseName.replace(/^[a-zA-Z0-9_-]{11}\s*-\s*/, ''),
      description: 'Gaming Short by MOHIT-M07 #shorts #freefire #gaming',
      tags: ['shorts', 'freefire', 'gaming', 'mohit m07', 'ffshorts']
    };

    if (fs.existsSync(jsonPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        meta.title = info.title || meta.title;
        meta.description = info.description || meta.description;
        meta.tags = info.tags && info.tags.length > 0 ? info.tags : meta.tags;
      } catch (e) {
        console.warn(`Warning reading info.json for ${mp4Name}:`, e.message);
      }
    }

    // Ensure title is within 100 characters for YouTube Shorts
    if (meta.title.length > 100) {
      meta.title = meta.title.slice(0, 97) + '...';
    }

    console.log(`[${i + 1}/${mp4Files.length}] 📤 Uploading "${meta.title.slice(0, 50)}..." (${(fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2)} MB)...`);

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
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(mp4Path)
        }
      });

      const newVideoId = res.data.id;
      uploadedMap[mp4Name] = newVideoId;
      saveUploadedMap(uploadedMap);
      successCount++;
      console.log(`✅ Uploaded successfully! Video ID: ${newVideoId} (https://youtu.be/${newVideoId})`);

      db.addLog({
        type: 'system',
        message: `Uploaded Short "${meta.title}" -> https://youtu.be/${newVideoId}`
      });

      // Pause 3 seconds between uploads
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`❌ Upload failed for "${meta.title}":`, err.message);
      if (err.message?.includes('quota') || err.code === 403) {
        console.log('\n⚠️ YouTube API Daily Quota Limit (10,000 units) reached for today.');
        console.log('YouTube limits third-party API uploads to ~6 videos per day per project.');
        console.log('All remaining videos remain safely saved in the "downloads/mohit_shorts" folder.');
        quotaReached = true;
        break;
      }
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 Batch upload summary:`);
  console.log(`Successfully uploaded: ${successCount} videos`);
  console.log(`Total completed so far: ${Object.keys(uploadedMap).length}/${mp4Files.length}`);
  if (quotaReached) {
    console.log(`⏰ Daily quota reached. You can run this again tomorrow or upload directly from downloads/mohit_shorts!`);
  }
  console.log('====================================================');
}

uploadShorts().catch(err => {
  console.error('Fatal error in uploader:', err);
  process.exit(1);
});
