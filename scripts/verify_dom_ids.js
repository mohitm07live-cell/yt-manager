const fs = require('fs');
const html = fs.readFileSync('src/public/index.html', 'utf8');

const actualIdsInAppJs = [
  'shortsTargetUrlInput',
  'btnScanTargetShorts',
  'btnRunSyncNow',
  'shortsAutoPilotToggle',
  'shortsSyncHourSelect',
  'shortsPrivacySelect',
  'shortsAppendTag',
  'shortsSyncProgressBox',
  'shortsSyncProgressTitle',
  'shortsSyncProgressMsg',
  'shortsSyncProgressPct',
  'shortsSyncProgressBar',
  'shortsSyncSpinner',
  'shortsSyncCandidateCard',
  'shortsSyncCandidateThumb',
  'shortsSyncCandidateTitle',
  'shortsSyncCandidateMeta',
  'shortsSyncLogConsole',
  'shortsSyncLogCount',
  'shortsScannedQueueBox',
  'shortsScannedTableBody',
  'shortsScanCountBadge',
  'shortsHistoryTableBody',
  'btnRefreshShortsHistory',
  'shortsSyncDestBadge',
  'shortsSyncDestName',
  'shortsDestAvatar',
  'shortsDestTitle',
  'shortsDestCustomUrl',
  'shortsDestSubCount',
  'shortsDestTypeBadge',
  'btnDisconnectShortsDest',
  'btnToggleCustomOAuth',
  'shortsCustomOAuthBox',
  'customOAuthClientId',
  'customOAuthClientSecret',
  'btnSaveCustomOAuth',
  'btnResetCustomOAuth',
  'btnConnectShortsDest',
  'btnToggleCookies',
  'shortsCookiesBox',
  'cookiesTextarea',
  'btnSaveCookies',
  'btnDeleteCookies',
  'cookieStatusLabel',
  'cookieBadgeStatus',
  'ch1TimingBadge',
  'ch2TimingBadge',
  'activeChannelSchedulePill'
];

let missing = [];
for (const id of actualIdsInAppJs) {
  if (!html.includes('id="' + id + '"')) {
    missing.push(id);
  }
}

if (missing.length === 0) {
  console.log(`✅ All ${actualIdsInAppJs.length} Shorts Sync DOM IDs verified in index.html!`);
} else {
  console.error('❌ Missing IDs in index.html:', missing);
  process.exit(1);
}
