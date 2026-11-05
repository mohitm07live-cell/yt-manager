require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const shortsAutoSyncService = require('../src/services/shortsAutoSyncService');
const db = require('../src/services/db');
const auth = require('../src/services/auth');

async function main() {
  console.log('================================================================');
  console.log('       YOUTUBE AUTO SHORTS CLONER & UPLOADER (STANDALONE)');
  console.log('================================================================');

  if (!auth.isAuthenticated()) {
    console.error('[-] Error: YouTube account is not authenticated.');
    console.error('    Please start the dashboard (npm start) and authenticate your channel.');
    process.exit(1);
  }

  const channelInfo = db.getChannelInfo();
  console.log(`[+] Connected Destination Channel: ${channelInfo?.title || 'Unknown'} (${channelInfo?.customUrl || ''})`);

  let targetUrl = process.argv[2] || shortsAutoSyncService.getSettings().targetChannelUrl;

  if (!targetUrl) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    targetUrl = await new Promise(resolve => {
      readline.question('Paste Target YouTube Channel URL (e.g. https://www.youtube.com/@Channel): ', ans => {
        readline.close();
        resolve(ans.trim());
      });
    });
  }

  if (!targetUrl) {
    console.error('[-] Error: No target channel provided.');
    process.exit(1);
  }

  // Save as default target
  shortsAutoSyncService.updateSettings({ targetChannelUrl: targetUrl });
  console.log(`[*] Target Channel: ${targetUrl}`);
  console.log('[*] Scanning for top-performing un-synced shorts...');

  try {
    const result = await shortsAutoSyncService.runSyncPipeline(targetUrl);
    console.log('\n================================================================');
    console.log('[+] SYNC & UPLOAD COMPLETED SUCCESSFULLY!');
    console.log(`[+] Original Short: ${result.sourceTitle} (${result.sourceViews.toLocaleString()} views)`);
    console.log(`[+] Source URL:     ${result.sourceUrl}`);
    console.log(`[+] Uploaded Video: ${result.uploadedTitle}`);
    console.log(`[+] Uploaded URL:   ${result.uploadedUrl}`);
    console.log(`[+] Privacy:        ${result.privacyStatus}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[-] Sync Failed:', err.message);
    process.exit(1);
  }
}

main();

