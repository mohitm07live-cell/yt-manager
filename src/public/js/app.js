// Socket.io instance
const socket = io();

// State
let appState = {
  authenticated: false,
  user: null,
  channel: null,
  botRunning: false,
  commands: [],
  timers: [],
  moderation: {},
  subscribers: [],
  subscriberStats: {},
  subscriberFilter: 'all',
  alertsConfig: {},
  settings: {},
  stats: {}
};

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

// Tab Configuration Titles
const tabMeta = {
  overview: { title: 'Dashboard Overview', subtitle: 'Live metrics, stream status, and quick bot controls' },
  analytics: { title: 'Channel Analytics & Growth Suite', subtitle: 'Deep performance metrics, video engagement, milestone roadmap, and live insights' },
  commands: { title: 'Custom Commands', subtitle: 'Manage custom chat commands like !discord, !socials, !rules' },
  timers: { title: 'Scheduled Timers', subtitle: 'Automate recurring messages and announcements in chat' },
  moderation: { title: 'Auto-Moderation Rules', subtitle: 'Automated protection against profanity, spam, and links' },
  subscribers: { title: 'Subscribers & Unsubscribers Tracker', subtitle: 'Real-time monitoring of channel subscribers, subscribe dates, and unsubscriber detection' },
  alerts: { title: 'Live Stream Alerts & OBS Overlay', subtitle: 'Celebratory chat announcements & animated OBS popups for new subscribers, superchats, and members' },
  goals: { title: 'Live Stream Goals & OBS Widgets', subtitle: 'Interactive animated subscriber goals, like meters, and transparent OBS browser overlays' },
  soundboard: { title: 'Interactive Soundboard SFX', subtitle: 'Instant streamer audio triggers & chat-driven sound effects with zero latency' },
  polls: { title: 'Live Chat Polls & Viewer Predictions', subtitle: 'Create interactive chat-driven polls with instant voting and OBS overlay' },
  loyalty: { title: 'Viewer Loyalty Points & Mini-Games', subtitle: 'Reward active chatters with points, slot spins, coin flips, and live trivia' },
  highlights: { title: 'Stream Moments & Clip Markers', subtitle: 'Timestamp stream highlights, clutch plays, and bookmark memorable stream moments' },
  downloader: { title: 'YouTube Ultra-HD Video Downloader', subtitle: 'Download any YouTube Video, Short, or Stream in the Highest Possible Quality (Up to 4K / 8K) with FFmpeg audio merging' },
  multistream: { title: 'Multi-Stream Live Chat Overlay', subtitle: 'Aggregate & view real-time comments from multiple YouTube channels on a transparent floating overlay window while gaming' },
  'live-feed': { title: 'Live Chat Feed & Logs', subtitle: 'Real-time feed of live chat messages and bot responses' },

  simulator: { title: 'Test Simulator', subtitle: 'Sandbox environment to test commands and moderation offline' },
  settings: { title: 'Bot & API Settings', subtitle: 'Configure polling rate, credentials, and bot variables' }
};

// -------------------------------------------------------------
// Navigation & Tab Switching
// -------------------------------------------------------------
function switchTab(tabId) {
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const currentTabPanes = document.querySelectorAll('.tab-pane');
  currentTabPanes.forEach(pane => {
    if (pane.id === `tab-${tabId}` || pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  if (tabMeta[tabId]) {
    pageTitle.textContent = tabMeta[tabId].title;
    pageSubtitle.textContent = tabMeta[tabId].subtitle;
  }
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tabId = item.getAttribute('data-tab');
    switchTab(tabId);
  });
});

// -------------------------------------------------------------
// Advanced Multi-Toast Notification System
// -------------------------------------------------------------
function showToast(message, typeOrIsError = 'success', customTitle = null, duration = 4500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  let type = 'success';
  if (typeof typeOrIsError === 'boolean') {
    type = typeOrIsError ? 'error' : 'success';
  } else if (typeof typeOrIsError === 'string') {
    type = typeOrIsError;
  }

  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info',
    warning: 'fa-solid fa-bell',
    subscriber: 'fa-solid fa-heart',
    superChat: 'fa-solid fa-gem',
    membership: 'fa-solid fa-crown',
    unsubscriber: 'fa-solid fa-user-minus'
  };

  const titleMap = {
    success: 'Action Successful',
    error: 'System Alert',
    info: 'Information',
    warning: 'Warning',
    subscriber: 'New Subscriber!',
    superChat: 'Super Chat Received!',
    membership: 'New Channel Member!',
    unsubscriber: 'Unsubscribe Notice'
  };

  const title = customTitle || titleMap[type] || 'Notification';
  const icon = iconMap[type] || 'fa-solid fa-bell';

  const toastItem = document.createElement('div');
  toastItem.className = `toast-item ${type}`;
  toastItem.style.setProperty('--toast-duration', `${duration}ms`);

  toastItem.innerHTML = `
    <div class="toast-icon-wrap">
      <i class="${icon}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-body">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close-btn" aria-label="Close">&times;</button>
    <div class="toast-progress-bar"></div>
  `;

  container.appendChild(toastItem);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toastItem.classList.add('show');
  });

  let isClosed = false;
  const closeToast = () => {
    if (isClosed) return;
    isClosed = true;
    toastItem.classList.remove('show');
    toastItem.classList.add('hide');
    setTimeout(() => {
      toastItem.remove();
    }, 400);
  };

  toastItem.querySelector('.toast-close-btn').addEventListener('click', closeToast);
  setTimeout(closeToast, duration);
}

// -------------------------------------------------------------
// Data Fetching & Sync
// -------------------------------------------------------------
async function fetchAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    appState.authenticated = data.authenticated;
    appState.user = data.user;
    appState.channel = data.channel;
    renderAuthUI();
  } catch (err) {
    console.error('Error fetching auth status:', err);
  }
}

async function fetchBotStatus() {
  try {
    const res = await fetch('/api/bot/status');
    const data = await res.json();
    appState.botRunning = data.running;
    appState.settings = data.settings || {};
    appState.stats = data.stats || {};
    renderBotStatusUI(data.running);
    renderStats(data.stats);
    renderStreamStatus(data.currentBroadcast);
  } catch (err) {
    console.error('Error fetching bot status:', err);
  }
}

async function fetchCommands() {
  try {
    const res = await fetch('/api/commands');
    appState.commands = await res.json();
    renderCommandsTable();
  } catch (err) {
    console.error('Error fetching commands:', err);
  }
}

async function fetchTimers() {
  try {
    const res = await fetch('/api/timers');
    appState.timers = await res.json();
    renderTimersTable();
  } catch (err) {
    console.error('Error fetching timers:', err);
  }
}

async function fetchModeration() {
  try {
    const res = await fetch('/api/moderation');
    appState.moderation = await res.json();
    renderModerationForm();
  } catch (err) {
    console.error('Error fetching moderation:', err);
  }
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs?limit=50');
    const logs = await res.json();
    renderLogs(logs);
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

async function fetchSubscribers() {
  try {
    const res = await fetch('/api/subscribers');
    const data = await res.json();
    appState.subscribers = data.subscribers || [];
    appState.subscriberStats = data.stats || {};
    renderSubscribersTable();
    renderSubscriberStats(data.stats);
  } catch (err) {
    console.error('Error fetching subscribers:', err);
  }
}

// -------------------------------------------------------------
// UI Renderers
// -------------------------------------------------------------
function renderAuthUI() {
  const sidebarUserBox = document.getElementById('sidebarUserBox');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userStatus = document.getElementById('userStatus');
  const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');
  const authHeaderContainer = document.getElementById('authHeaderContainer');
  const channelCardBody = document.getElementById('channelCardBody');

  if (appState.authenticated && appState.user) {
    // User Logged In
    const userImg = appState.user.picture
      ? `<img src="${appState.user.picture}" referrerpolicy="no-referrer" alt="Avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="avatar-fallback" style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background:linear-gradient(135deg, var(--accent-cyan), var(--accent-purple)); color:#fff; font-weight:700; font-size:14px;">${escapeHtml((appState.user.name || 'M').charAt(0).toUpperCase())}</div>`
      : `<i class="fa-solid fa-user"></i>`;
    userAvatar.innerHTML = userImg;
    userName.textContent = appState.user.name || 'Connected User';
    userStatus.textContent = appState.channel ? appState.channel.title : 'Active Streamer';
    
    sidebarAuthBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
    sidebarAuthBtn.title = 'Logout';
    sidebarAuthBtn.onclick = logoutUser;

    authHeaderContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="headerLogoutBtn">
        <i class="fa-solid fa-right-from-bracket"></i> Disconnect
      </button>
    `;
    document.getElementById('headerLogoutBtn').onclick = logoutUser;

    // Render Channel Card
    if (appState.channel) {
      const channelImgUrl = appState.channel.avatar || appState.user.picture;
      channelCardBody.innerHTML = `
        <div class="channel-profile-view">
          <div style="position:relative; width:72px; height:72px; border-radius:50%; overflow:hidden; border: 2px solid var(--accent-cyan); box-shadow: 0 0 16px var(--accent-cyan-glow);">
            <img src="${channelImgUrl}" class="channel-avatar-lg" referrerpolicy="no-referrer" alt="Channel Avatar" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background:linear-gradient(135deg, var(--yt-red), #99001f); color:#fff; font-weight:700; font-size:24px;">${escapeHtml((appState.channel.title || 'M').charAt(0).toUpperCase())}</div>
          </div>
          <h4 style="font-family: var(--font-heading); font-size: 17px; margin-top: 6px;">${escapeHtml(appState.channel.title)}</h4>
          <span class="badge badge-purple">${escapeHtml(appState.channel.customUrl || '@live')}</span>
          
          <div class="channel-stats-row">
            <div class="ch-stat">
              <span class="ch-stat-num">${formatCount(appState.channel.subscriberCount || 0)}</span>
              <span class="ch-stat-label">Subscribers</span>
            </div>
            <div class="ch-stat">
              <span class="ch-stat-num">${appState.channel.videoCount || 0}</span>
              <span class="ch-stat-label">Videos</span>
            </div>
          </div>
        </div>
      `;

      // Dynamically brand entire dashboard with connected channel
      const sidebarBrandTitle = document.getElementById('sidebarBrandTitle');
      if (sidebarBrandTitle) {
        sidebarBrandTitle.innerHTML = `${escapeHtml(appState.channel.title)} <span>Manager</span>`;
      }
      const footerBrandName = document.getElementById('footerBrandName');
      if (footerBrandName) {
        footerBrandName.textContent = `${appState.channel.title} Official Manager`;
      }
      const selectChannelVidLabel = document.getElementById('selectChannelVidLabel');
      if (selectChannelVidLabel) {
        selectChannelVidLabel.innerHTML = `<i class="fa-brands fa-youtube" style="color: #ff0000;"></i> Select Any Video from Channel (${escapeHtml(appState.channel.customUrl || appState.channel.title)}):`;
      }
      const yppChannelDesc = document.getElementById('yppChannelDesc');
      if (yppChannelDesc) {
        yppChannelDesc.innerHTML = `Official monetization roadmap for <strong>${escapeHtml(appState.channel.title)}</strong> (${escapeHtml(appState.channel.customUrl || '')}). Calculated from actual channel uploads, 365-day public watch hours & YouTube Partner policies.`;
      }
      const analyticsOpenStudioBtn = document.getElementById('analyticsOpenStudioBtn');
      if (analyticsOpenStudioBtn) {
        analyticsOpenStudioBtn.href = appState.channel.customUrl 
          ? `https://www.youtube.com/${appState.channel.customUrl}` 
          : (appState.channel.id ? `https://www.youtube.com/channel/${appState.channel.id}` : 'https://studio.youtube.com');
      }
      document.title = `${appState.channel.title} Official Manager - YouTube Live Stream & Channel Manager`;
    }
  } else {
    // User Logged Out
    userAvatar.innerHTML = '<i class="fa-solid fa-user-xmark"></i>';
    userName.textContent = 'Not Connected';
    userStatus.textContent = 'Click to login';
    sidebarAuthBtn.innerHTML = '<i class="fa-brands fa-google"></i>';
    sidebarAuthBtn.title = 'Login with YouTube';
    sidebarAuthBtn.onclick = () => window.location.href = '/auth/google';

    authHeaderContainer.innerHTML = `
      <a href="/auth/google" class="btn btn-google" id="loginHeaderBtn">
        <i class="fa-brands fa-google"></i>
        <span>Connect YouTube</span>
      </a>
    `;

    channelCardBody.innerHTML = `
      <div class="channel-auth-prompt">
        <i class="fa-solid fa-user-lock"></i>
        <p>Connect your YouTube account to view channel statistics and enable live chat moderation.</p>
        <a href="/auth/google" class="btn btn-primary btn-sm">
          <i class="fa-brands fa-google"></i> Login with Google
        </a>
      </div>
    `;
  }
}

function renderBotStatusUI(isRunning) {
  const indicator = document.getElementById('botStatusIndicator');
  const statusText = document.getElementById('botStatusText');
  const toggleBtn = document.getElementById('toggleBotBtn');

  if (isRunning) {
    indicator.className = 'bot-status-indicator running';
    statusText.textContent = 'Bot is Active';
    toggleBtn.className = 'btn-toggle-bot active';
    toggleBtn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>Stop Bot</span>';
  } else {
    indicator.className = 'bot-status-indicator';
    statusText.textContent = 'Bot is Idle';
    toggleBtn.className = 'btn-toggle-bot';
    toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Start Bot</span>';
  }
}

function renderStats(stats = {}) {
  document.getElementById('statMessages').textContent = (stats.totalMessagesProcessed || 0).toLocaleString();
  document.getElementById('statCommands').textContent = (stats.totalCommandsExecuted || 0).toLocaleString();
  document.getElementById('statModeration').textContent = (stats.totalModerationActions || 0).toLocaleString();
  document.getElementById('statTimers').textContent = (stats.totalTimersTriggered || 0).toLocaleString();
}

function renderStreamStatus(broadcast) {
  const pill = document.getElementById('streamStatusPill');
  const label = document.getElementById('streamStatusLabel');
  const infoBox = document.getElementById('streamInfoBox');

  if (broadcast && broadcast.liveChatId) {
    pill.className = 'live-status-pill live';
    label.textContent = broadcast.status === 'live' ? 'LIVE NOW' : 'UPCOMING';

    // Build YouTube watch URL
    const ytWatchUrl = `https://www.youtube.com/watch?v=${broadcast.id}`;
    const viewerCount = broadcast.concurrentViewers > 0 ? `<span style="color:#ff4444; font-weight:700;"><i class="fa-solid fa-eye"></i> ${broadcast.concurrentViewers.toLocaleString()} watching</span>` : '';
    const likeCount = broadcast.likeCount > 0 ? `<span style="color:#00c897; font-weight:600;"><i class="fa-solid fa-thumbs-up"></i> ${broadcast.likeCount.toLocaleString()} likes</span>` : '';

    infoBox.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <h4 style="font-family: var(--font-heading); font-size: 15px; color: var(--text-main); flex: 1; line-height: 1.4;">${escapeHtml(broadcast.title)}</h4>
          <a href="${ytWatchUrl}" target="_blank" id="liveStreamWatchBtn"
            style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:linear-gradient(135deg,#ff0000,#cc0000); color:#fff; border-radius:8px; font-size:13px; font-weight:700; text-decoration:none; white-space:nowrap; box-shadow:0 2px 12px rgba(255,0,0,0.4); transition: all 0.2s;"
            onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 20px rgba(255,0,0,0.6)'"
            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 12px rgba(255,0,0,0.4)'">
            <i class="fa-brands fa-youtube"></i> Watch Live
          </a>
        </div>
        <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; align-items: center;">
          <span><i class="fa-solid fa-hashtag"></i> Video ID: <code>${broadcast.id}</code></span>
          <span><i class="fa-solid fa-comments"></i> Chat ID: <code>${broadcast.liveChatId.substring(0, 16)}...</code></span>
          ${viewerCount}
          ${likeCount}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="${ytWatchUrl}" target="_blank" style="font-size:11px; color:var(--text-muted); text-decoration:underline;">
            🔗 ${ytWatchUrl}
          </a>
        </div>
      </div>
    `;
  } else {
    pill.className = 'live-status-pill offline';
    label.textContent = 'Offline';
    infoBox.innerHTML = `
      <div class="stream-placeholder">
        <i class="fa-brands fa-youtube stream-big-icon"></i>
        <h4>No Live Stream Active</h4>
        <p>Start a live stream on your YouTube channel, or enter a direct Video ID below to connect manually.</p>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// Commands Table Renderer
// -------------------------------------------------------------
function renderCommandsTable() {
  const tbody = document.getElementById('commandsTableBody');
  const search = (document.getElementById('commandSearch').value || '').toLowerCase();
  const badge = document.getElementById('cmdCountBadge');

  const filtered = appState.commands.filter(c => 
    c.name.toLowerCase().includes(search) || c.response.toLowerCase().includes(search)
  );

  badge.textContent = appState.commands.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-subtle); padding: 30px;">No custom commands found. Click "Add New Command" to create one!</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(cmd => `
    <tr>
      <td>
        <span class="cmd-badge">!${escapeHtml(cmd.name)}</span>
      </td>
      <td style="max-width: 320px; font-size: 13px;" title="${escapeHtml(cmd.response)}">
        ${escapeHtml(cmd.response)}
      </td>
      <td>
        <span class="badge-role badge-${cmd.userLevel || 'everyone'}">${cmd.userLevel || 'everyone'}</span>
      </td>
      <td><code>${cmd.cooldown || 5}s</code></td>
      <td><span style="font-family: var(--font-mono); font-weight:600;">${cmd.usageCount || 0}</span></td>
      <td>
        <label class="switch" style="transform: scale(0.8);">
          <input type="checkbox" ${cmd.enabled ? 'checked' : ''} onchange="toggleCommandStatus('${cmd.id}', this.checked)">
          <span class="slider round"></span>
        </label>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon btn-sm" onclick="openEditCommandModal('${cmd.id}')" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-secondary btn-icon btn-sm btn-icon-danger" onclick="deleteCommand('${cmd.id}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// Timers Table Renderer
// -------------------------------------------------------------
function renderTimersTable() {
  const tbody = document.getElementById('timersTableBody');
  const search = (document.getElementById('timerSearch').value || '').toLowerCase();
  const badge = document.getElementById('timerCountBadge');

  const filtered = appState.timers.filter(t => 
    t.name.toLowerCase().includes(search) || t.message.toLowerCase().includes(search)
  );

  badge.textContent = appState.timers.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-subtle); padding: 30px;">No scheduled timers found. Click "Add New Timer" to create one!</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td style="max-width: 360px; font-size: 13px;">${escapeHtml(t.message)}</td>
      <td><code>Every ${t.intervalMinutes} min</code></td>
      <td><code>${t.minChatLines || 3} lines</code></td>
      <td>
        <label class="switch" style="transform: scale(0.8);">
          <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="toggleTimerStatus('${t.id}', this.checked)">
          <span class="slider round"></span>
        </label>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon btn-sm" onclick="openEditTimerModal('${t.id}')" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-secondary btn-icon btn-sm btn-icon-danger" onclick="deleteTimer('${t.id}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// Moderation Settings Renderer
// -------------------------------------------------------------
function renderModerationForm() {
  const mod = appState.moderation;
  if (!mod) return;

  // Profanity
  if (mod.profanity) {
    document.getElementById('modProfanityToggle').checked = mod.profanity.enabled !== false;
    document.getElementById('modProfanityBlacklist').value = (mod.profanity.blacklist || []).join(', ');
    document.getElementById('modProfanityAction').value = mod.profanity.action || 'delete';
    document.getElementById('modProfanityWarning').value = mod.profanity.customWarning || '';
  }

  // Links
  if (mod.links) {
    document.getElementById('modLinksToggle').checked = mod.links.enabled !== false;
    document.getElementById('modLinksAllowlist').value = (mod.links.allowlist || []).join(', ');
    document.getElementById('modLinksAction').value = mod.links.action || 'delete';
    document.getElementById('modLinksWarning').value = mod.links.customWarning || '';
  }

  // Caps
  if (mod.caps) {
    document.getElementById('modCapsToggle').checked = mod.caps.enabled !== false;
    document.getElementById('modCapsPercentage').value = mod.caps.maxCapsPercentage || 70;
    document.getElementById('modCapsMinLength').value = mod.caps.minCharLength || 8;
    document.getElementById('modCapsAction').value = mod.caps.action || 'delete';
    document.getElementById('modCapsWarning').value = mod.caps.customWarning || '';
  }

  // Repetitive
  if (mod.repetitive) {
    document.getElementById('modRepetitiveToggle').checked = mod.repetitive.enabled !== false;
    document.getElementById('modRepetitiveMax').value = mod.repetitive.maxRepeatedChars || 6;
    document.getElementById('modRepetitiveAction').value = mod.repetitive.action || 'delete';
  }
}

// -------------------------------------------------------------
// Subscribers Tracker Renderers & Actions
// -------------------------------------------------------------
function renderSubscriberStats(stats = {}) {
  const channelTotalEl = document.getElementById('statChannelSubsTotal');
  const trackedEl = document.getElementById('statTrackedSubs');
  const privateEl = document.getElementById('statPrivateSubs');
  const unsubEl = document.getElementById('statUnsubSubs');
  const subBadge = document.getElementById('subCountBadge');

  const channelTotal = parseInt(appState.channel?.subscriberCount || 2270, 10);
  const totalPublic = stats.totalTracked !== undefined ? stats.totalTracked : appState.subscribers.length;
  const activeCount = stats.activeCount !== undefined ? stats.activeCount : appState.subscribers.filter(s => s.status === 'active').length;
  const unsubCount = stats.unsubscribedCount !== undefined ? stats.unsubscribedCount : appState.subscribers.filter(s => s.status === 'unsubscribed').length;
  const privateCount = Math.max(0, channelTotal - totalPublic);

  if (channelTotalEl) channelTotalEl.textContent = channelTotal.toLocaleString();
  if (trackedEl) trackedEl.textContent = totalPublic.toLocaleString();
  if (privateEl) privateEl.textContent = `~${privateCount.toLocaleString()}`;
  if (unsubEl) unsubEl.textContent = unsubCount.toLocaleString();
  if (subBadge) subBadge.textContent = totalPublic.toLocaleString();
}

function renderSubscribersTable() {
  const tbody = document.getElementById('subscribersTableBody');
  if (!tbody) return;

  const search = (document.getElementById('subscriberSearch')?.value || '').toLowerCase();
  const filter = appState.subscriberFilter || 'all';

  let filtered = appState.subscribers.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(search) || (s.channelId || '').toLowerCase().includes(search);
    if (!matchesSearch) return false;
    if (filter === 'active') return s.status === 'active';
    if (filter === 'unsubscribed') return s.status === 'unsubscribed';
    return true;
  });

  renderSubscriberStats(appState.subscriberStats);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-subtle); padding: 30px;">
      No ${filter !== 'all' ? filter : ''} subscribers found in records. Click <strong>"Sync Subscribers Now"</strong> to fetch public subscribers from YouTube!
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(sub => {
    const isUnsub = sub.status === 'unsubscribed';
    const initial = (sub.name || 'S').charAt(0).toUpperCase();
    const avatarUrl = sub.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sub.name || 'Sub')}`;
    const subDate = sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleString() : 'Unknown';
    const unsubDate = sub.unsubscribedAt ? new Date(sub.unsubscribedAt).toLocaleString() : '—';
    const ytUrl = sub.channelId ? `https://www.youtube.com/channel/${sub.channelId}` : '#';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="position:relative; width:38px; height:38px; border-radius:50%; overflow:hidden; flex-shrink:0; border: 1px solid var(--border-color);">
              <img src="${avatarUrl}" referrerpolicy="no-referrer" alt="Avatar" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); color:#fff; font-size:13px; font-weight:700;">${escapeHtml(initial)}</div>
            </div>
            <div>
              <div style="font-weight: 600; color: var(--text-main); font-size: 14px;">${escapeHtml(sub.name)}</div>
              <div style="font-size: 11px; color: var(--text-subtle); font-family: var(--font-mono);">${escapeHtml(sub.channelId)}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size: 13px; color: var(--text-muted);"><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i> ${subDate}</span>
        </td>
        <td>
          ${!isUnsub 
            ? '<span class="badge-role badge-member" style="background:rgba(16,185,129,0.15); color:var(--accent-emerald); border: 1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> Active Subscriber</span>' 
            : '<span class="badge-role badge-owner" style="background:rgba(244,63,94,0.15); color:var(--accent-rose); border: 1px solid rgba(244,63,94,0.3);"><i class="fa-solid fa-user-xmark" style="margin-right:4px;"></i> Unsubscribed</span>'
          }
        </td>
        <td>
          <span style="font-size: 12px; color: ${isUnsub ? 'var(--accent-rose)' : 'var(--text-subtle)'}; font-family: var(--font-mono);">
            ${unsubDate}
          </span>
        </td>
        <td>
          <a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 12px;">
            <i class="fa-brands fa-youtube" style="color:var(--yt-red);"></i> View
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

async function syncSubscribers() {
  const btn = document.getElementById('syncSubscribersBtn');
  const icon = document.getElementById('syncSubsIcon');
  if (btn) btn.disabled = true;
  if (icon) icon.classList.add('fa-spin');

  try {
    const res = await fetch('/api/subscribers/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      appState.subscribers = data.subscribers || [];
      appState.subscriberStats = data.stats || {};
      renderSubscribersTable();
      renderSubscriberStats(data.stats);
      showToast(`Synced! Found ${data.syncResult.newCount} new & ${data.syncResult.lostCount} unsubscribed.`);
    } else {
      showToast(data.error || 'Failed to sync subscribers', true);
    }
  } catch (err) {
    showToast('Network error while syncing subscribers', true);
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.classList.remove('fa-spin');
  }
}

// -------------------------------------------------------------
// Live Stream Alerts, OBS & AI Voice TTS Configuration
// -------------------------------------------------------------
let availableVoices = [];

const studioVoices = [
  { id: 'hi', name: '🇮🇳 Hindi AI Voice (Natural Female - Best for Hindi/Hinglish)' },
  { id: 'en-IN', name: '🇮🇳 Indian English (Natural Female - Crisp & Clear)' },
  { id: 'Microsoft Zira Desktop', name: '🇺🇸 English US Female (Studio Streamer - Clear & Loud)' },
  { id: 'Microsoft David Desktop', name: '🇺🇸 English US Male (Deep Radio Host)' },
  { id: 'en-GB', name: '🇬🇧 British English (Studio Female - Royal Accent)' },
  { id: 'en-AU', name: '🇦🇺 Australian English (Studio Female)' },
  { id: 'en-US', name: '🇺🇸 American English (Natural AI)' }
];

function populateVoiceList() {
  const select = document.getElementById('voiceSelect');
  if (!select) return;

  const currentSelected = select.value || appState.alertsConfig?.voiceSettings?.voiceURI || 'hi';
  select.innerHTML = '';

  // 1. Studio Curated Voices
  const studioGroup = document.createElement('optgroup');
  studioGroup.label = '✨ Studio AI Voices (OBS & Stream Verified)';
  studioVoices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    studioGroup.appendChild(opt);
  });
  select.appendChild(studioGroup);

  // 2. Local Windows / Browser SAPI Voices
  if ('speechSynthesis' in window) {
    availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices && availableVoices.length > 0) {
      const localGroup = document.createElement('optgroup');
      localGroup.label = '💻 Device / Windows Voices';
      availableVoices.forEach(voice => {
        // Skip duplicate IDs
        if (studioVoices.some(sv => sv.id === voice.voiceURI || sv.id === voice.name)) return;
        const opt = document.createElement('option');
        opt.value = voice.voiceURI || voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        localGroup.appendChild(opt);
      });
      if (localGroup.children.length > 0) {
        select.appendChild(localGroup);
      }
    }
  }

  if (currentSelected) {
    select.value = currentSelected;
  }
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = populateVoiceList;
}

async function fetchAlertsConfig() {
  try {
    const res = await fetch('/api/alerts');
    appState.alertsConfig = await res.json();
    renderAlertsConfigForm();
  } catch (err) {
    console.error('Error fetching alerts config:', err);
  }
}

function renderAlertsConfigForm() {
  const cfg = appState.alertsConfig;
  if (!cfg) return;

  if (cfg.subscriberAlert) {
    const subToggle = document.getElementById('alertSubToggle');
    const subVoiceToggle = document.getElementById('alertSubVoiceToggle');
    const subTpl = document.getElementById('alertSubTemplate');
    if (subToggle) subToggle.checked = cfg.subscriberAlert.enabled !== false;
    if (subVoiceToggle) subVoiceToggle.checked = cfg.subscriberAlert.voiceEnabled !== false;
    if (subTpl && cfg.subscriberAlert.chatMessage) subTpl.value = cfg.subscriberAlert.chatMessage;
    const subMedia = document.getElementById('alertSubMediaUrl');
    const subLayout = document.getElementById('alertSubMediaLayout');
    if (subMedia && cfg.subscriberAlert.mediaUrl !== undefined) subMedia.value = cfg.subscriberAlert.mediaUrl;
    if (subLayout && cfg.subscriberAlert.mediaLayout) subLayout.value = cfg.subscriberAlert.mediaLayout;
  }

  if (cfg.superChatAlert) {
    const scToggle = document.getElementById('alertSuperChatToggle');
    const scVoiceToggle = document.getElementById('alertSuperChatVoiceToggle');
    const scTpl = document.getElementById('alertSuperChatTemplate');
    if (scToggle) scToggle.checked = cfg.superChatAlert.enabled !== false;
    if (scVoiceToggle) scVoiceToggle.checked = cfg.superChatAlert.voiceEnabled !== false;
    if (scTpl && cfg.superChatAlert.chatMessage) scTpl.value = cfg.superChatAlert.chatMessage;
    const scMedia = document.getElementById('alertSuperChatMediaUrl');
    const scLayout = document.getElementById('alertSuperChatMediaLayout');
    if (scMedia && cfg.superChatAlert.mediaUrl !== undefined) scMedia.value = cfg.superChatAlert.mediaUrl;
    if (scLayout && cfg.superChatAlert.mediaLayout) scLayout.value = cfg.superChatAlert.mediaLayout;
  }

  if (cfg.membershipAlert) {
    const memToggle = document.getElementById('alertMembershipToggle');
    const memVoiceToggle = document.getElementById('alertMemberVoiceToggle');
    const memTpl = document.getElementById('alertMembershipTemplate');
    if (memToggle) memToggle.checked = cfg.membershipAlert.enabled !== false;
    if (memVoiceToggle) memVoiceToggle.checked = cfg.membershipAlert.voiceEnabled !== false;
    if (memTpl && cfg.membershipAlert.chatMessage) memTpl.value = cfg.membershipAlert.chatMessage;
    const memMedia = document.getElementById('alertMemberMediaUrl');
    const memLayout = document.getElementById('alertMemberMediaLayout');
    if (memMedia && cfg.membershipAlert.mediaUrl !== undefined) memMedia.value = cfg.membershipAlert.mediaUrl;
    if (memLayout && cfg.membershipAlert.mediaLayout) memLayout.value = cfg.membershipAlert.mediaLayout;
  }

  if (cfg.unsubscriberAlert) {
    const unsubToggle = document.getElementById('alertUnsubToggle');
    const unsubVoiceToggle = document.getElementById('alertUnsubVoiceToggle');
    const unsubTpl = document.getElementById('alertUnsubTemplate');
    if (unsubToggle) unsubToggle.checked = Boolean(cfg.unsubscriberAlert.enabled);
    if (unsubVoiceToggle) unsubVoiceToggle.checked = cfg.unsubscriberAlert.voiceEnabled !== false;
    if (unsubTpl && cfg.unsubscriberAlert.chatMessage) unsubTpl.value = cfg.unsubscriberAlert.chatMessage;
    const unsubMedia = document.getElementById('alertUnsubMediaUrl');
    const unsubLayout = document.getElementById('alertUnsubMediaLayout');
    if (unsubMedia && cfg.unsubscriberAlert.mediaUrl !== undefined) unsubMedia.value = cfg.unsubscriberAlert.mediaUrl;
    if (unsubLayout && cfg.unsubscriberAlert.mediaLayout) unsubLayout.value = cfg.unsubscriberAlert.mediaLayout;
  }

  // Voice Preferences
  const voiceCfg = cfg.voiceSettings || {};
  const voiceToggle = document.getElementById('voiceAlertMasterToggle');
  const voiceSelect = document.getElementById('voiceSelect');
  const voiceVol = document.getElementById('voiceVolume');
  const voiceVolVal = document.getElementById('voiceVolumeVal');
  const voiceRate = document.getElementById('voiceRate');
  const voiceRateVal = document.getElementById('voiceRateVal');
  const voicePitch = document.getElementById('voicePitch');
  const voicePitchVal = document.getElementById('voicePitchVal');

  if (voiceToggle) voiceToggle.checked = voiceCfg.enabled !== false;
  if (voiceVol && voiceCfg.volume !== undefined) {
    voiceVol.value = voiceCfg.volume;
    if (voiceVolVal) voiceVolVal.textContent = `${Math.round(voiceCfg.volume * 100)}%`;
  }
  if (voiceRate && voiceCfg.rate !== undefined) {
    voiceRate.value = voiceCfg.rate;
    if (voiceRateVal) voiceRateVal.textContent = `${voiceCfg.rate}x`;
  }
  if (voicePitch && voiceCfg.pitch !== undefined) {
    voicePitch.value = voiceCfg.pitch;
    if (voicePitchVal) voicePitchVal.textContent = `${voiceCfg.pitch}`;
  }

  // Appearance & Transparency Preferences
  const appCfg = cfg.appearanceSettings || {};
  const obsBgStyle = document.getElementById('obsBackgroundStyle');
  const obsOpacity = document.getElementById('obsCardOpacity');
  const obsOpacityVal = document.getElementById('obsCardOpacityVal');

  if (obsBgStyle && appCfg.backgroundStyle) {
    obsBgStyle.value = appCfg.backgroundStyle;
  }
  if (obsOpacity && appCfg.cardOpacity !== undefined) {
    obsOpacity.value = appCfg.cardOpacity;
    if (obsOpacityVal) obsOpacityVal.textContent = `${appCfg.cardOpacity}%`;
  }

  populateVoiceList();
  if (voiceSelect && voiceCfg.voiceURI) {
    voiceSelect.value = voiceCfg.voiceURI;
  }
}

async function saveAlertsConfig() {
  const payload = {
    subscriberAlert: {
      enabled: document.getElementById('alertSubToggle')?.checked !== false,
      voiceEnabled: document.getElementById('alertSubVoiceToggle')?.checked !== false,
      chatMessage: document.getElementById('alertSubTemplate')?.value || '',
      mediaUrl: document.getElementById('alertSubMediaUrl')?.value || '',
      mediaLayout: document.getElementById('alertSubMediaLayout')?.value || 'side',
      obsBanner: true
    },
    superChatAlert: {
      enabled: document.getElementById('alertSuperChatToggle')?.checked !== false,
      voiceEnabled: document.getElementById('alertSuperChatVoiceToggle')?.checked !== false,
      chatMessage: document.getElementById('alertSuperChatTemplate')?.value || '',
      mediaUrl: document.getElementById('alertSuperChatMediaUrl')?.value || '',
      mediaLayout: document.getElementById('alertSuperChatMediaLayout')?.value || 'side',
      obsBanner: true
    },
    membershipAlert: {
      enabled: document.getElementById('alertMembershipToggle')?.checked !== false,
      voiceEnabled: document.getElementById('alertMemberVoiceToggle')?.checked !== false,
      chatMessage: document.getElementById('alertMembershipTemplate')?.value || '',
      mediaUrl: document.getElementById('alertMemberMediaUrl')?.value || '',
      mediaLayout: document.getElementById('alertMemberMediaLayout')?.value || 'side',
      obsBanner: true
    },
    unsubscriberAlert: {
      enabled: document.getElementById('alertUnsubToggle')?.checked === true,
      voiceEnabled: document.getElementById('alertUnsubVoiceToggle')?.checked !== false,
      chatMessage: document.getElementById('alertUnsubTemplate')?.value || '',
      mediaUrl: document.getElementById('alertUnsubMediaUrl')?.value || '',
      mediaLayout: document.getElementById('alertUnsubMediaLayout')?.value || 'side',
      obsBanner: false
    },
    voiceSettings: {
      enabled: document.getElementById('voiceAlertMasterToggle')?.checked !== false,
      voiceURI: document.getElementById('voiceSelect')?.value || '',
      volume: parseFloat(document.getElementById('voiceVolume')?.value || 1.0),
      rate: parseFloat(document.getElementById('voiceRate')?.value || 1.0),
      pitch: parseFloat(document.getElementById('voicePitch')?.value || 1.0)
    },
    appearanceSettings: {
      backgroundStyle: document.getElementById('obsBackgroundStyle')?.value || 'frosted',
      cardOpacity: parseInt(document.getElementById('obsCardOpacity')?.value || 60),
      borderGlow: true,
      scanlines: false
    }
  };

  try {
    const res = await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    appState.alertsConfig = (await res.json()).alertsConfig;
    showToast('Live Alerts & AI Voice Settings saved successfully!');
  } catch (err) {
    showToast('Failed to save alerts config', true);
  }
}

let currentTestVoiceAudio = null;

function testVoiceSpeech() {
  const isEnabled = document.getElementById('voiceAlertMasterToggle')?.checked !== false;
  if (!isEnabled) {
    showToast('Voice alerts are currently disabled. Please enable the switch first!', 'warning');
    return;
  }

  const volume = parseFloat(document.getElementById('voiceVolume')?.value || 1.0);
  const rate = parseFloat(document.getElementById('voiceRate')?.value || 1.0);
  const selectedVoice = document.getElementById('voiceSelect')?.value || 'hi';

  const rawTemplate = document.getElementById('alertSuperChatTemplate')?.value || "Thank you @$(user) for the $(amount) Super Chat! $(message)";
  const speechText = rawTemplate
    .replace(/\$\(user\)/gi, 'Rohit Sharma')
    .replace(/\$\(amount\)/gi, '500 Rupees')
    .replace(/\$\(message\)/gi, 'Keep up the awesome stream!')
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/@+/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[!*#~_]{2,}/g, '!')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    if (currentTestVoiceAudio) {
      currentTestVoiceAudio.pause();
      currentTestVoiceAudio = null;
    }

    const ttsUrl = `/api/tts?text=${encodeURIComponent(speechText)}&voice=${encodeURIComponent(selectedVoice)}&rate=${rate}&t=${Date.now()}`;
    const audio = new Audio(ttsUrl);
    audio.volume = volume;
    currentTestVoiceAudio = audio;

    audio.play().then(() => {
      showToast(`🔊 Previewing Voice: "${speechText}"`, 'info', 'AI Voice Preview');
    }).catch(err => {
      console.warn('Audio play fallback:', err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(speechText);
        utt.volume = volume;
        utt.rate = rate;
        window.speechSynthesis.speak(utt);
      }
    });
  } catch (err) {
    showToast(`Voice test error: ${err.message}`, true);
  }
}

async function testAlert(type) {
  try {
    const res = await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        user: 'Rohit Sharma',
        amount: type === 'superChat' ? '₹500.00' : '',
        message: type === 'superChat' ? 'Keep up the awesome streams!' : ''
      })
    });
    if (res.ok) {
      showToast(`Test ${type} alert sent to live chat & OBS overlay!`);
    }
  } catch (err) {
    showToast('Failed to trigger test alert', true);
  }
}

// -------------------------------------------------------------
// Logs & Activity Renderers
// -------------------------------------------------------------
function renderLogs(logs = []) {
  const overviewBox = document.getElementById('overviewLogsFeed');
  const auditBox = document.getElementById('liveAuditLogsBox');

  if (logs.length === 0) {
    overviewBox.innerHTML = '<div class="empty-state">No recent bot events. Start the bot or test in the simulator!</div>';
    auditBox.innerHTML = '<div class="empty-state">No audit logs available.</div>';
    return;
  }

  const html = logs.map(log => createLogElement(log)).join('');
  overviewBox.innerHTML = html;
  auditBox.innerHTML = html;
}

function appendLog(log) {
  const overviewBox = document.getElementById('overviewLogsFeed');
  const auditBox = document.getElementById('liveAuditLogsBox');

  const emptyOverview = overviewBox.querySelector('.empty-state');
  if (emptyOverview) emptyOverview.remove();

  const emptyAudit = auditBox.querySelector('.empty-state');
  if (emptyAudit) emptyAudit.remove();

  const logHtml = createLogElement(log);
  overviewBox.insertAdjacentHTML('afterbegin', logHtml);
  auditBox.insertAdjacentHTML('afterbegin', logHtml);
}

function createLogElement(log) {
  const time = new Date(log.timestamp).toLocaleTimeString();
  return `
    <div class="log-entry ${log.type}">
      <span class="log-time">${time}</span>
      <span class="log-msg">${escapeHtml(log.message)}</span>
    </div>
  `;
}

// -------------------------------------------------------------
// Command Modal Actions (Add / Edit)
// -------------------------------------------------------------
const commandModal = document.getElementById('commandModal');
const commandForm = document.getElementById('commandForm');

document.getElementById('openAddCommandModal').onclick = () => {
  document.getElementById('commandModalTitle').innerHTML = '<i class="fa-solid fa-plus"></i> Add New Command';
  document.getElementById('cmdEditId').value = '';
  document.getElementById('cmdName').value = '';
  document.getElementById('cmdResponse').value = '';
  document.getElementById('cmdUserLevel').value = 'everyone';
  document.getElementById('cmdCooldown').value = 5;
  document.getElementById('cmdEnabled').checked = true;
  commandModal.classList.add('show');
};

document.getElementById('closeCommandModal').onclick = () => commandModal.classList.remove('show');
document.getElementById('cancelCommandModal').onclick = () => commandModal.classList.remove('show');

function openEditCommandModal(id) {
  const cmd = appState.commands.find(c => c.id === id);
  if (!cmd) return;

  document.getElementById('commandModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Command';
  document.getElementById('cmdEditId').value = cmd.id;
  document.getElementById('cmdName').value = cmd.name;
  document.getElementById('cmdResponse').value = cmd.response;
  document.getElementById('cmdUserLevel').value = cmd.userLevel || 'everyone';
  document.getElementById('cmdCooldown').value = cmd.cooldown || 5;
  document.getElementById('cmdEnabled').checked = cmd.enabled !== false;
  commandModal.classList.add('show');
}

commandForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('cmdEditId').value;
  const payload = {
    name: document.getElementById('cmdName').value.trim(),
    response: document.getElementById('cmdResponse').value.trim(),
    userLevel: document.getElementById('cmdUserLevel').value,
    cooldown: parseInt(document.getElementById('cmdCooldown').value, 10) || 5,
    enabled: document.getElementById('cmdEnabled').checked
  };

  try {
    if (id) {
      // Update
      await fetch(`/api/commands/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Command updated successfully!');
    } else {
      // Create
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('New command created!');
    }
    commandModal.classList.remove('show');
    await fetchCommands();
  } catch (err) {
    showToast('Failed to save command', true);
  }
};

async function toggleCommandStatus(id, enabled) {
  try {
    await fetch(`/api/commands/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    showToast(`Command ${enabled ? 'enabled' : 'disabled'}`);
    const cmd = appState.commands.find(c => c.id === id);
    if (cmd) cmd.enabled = enabled;
  } catch (err) {
    showToast('Error updating command status', true);
  }
}

async function deleteCommand(id) {
  if (!confirm('Are you sure you want to delete this command?')) return;
  try {
    await fetch(`/api/commands/${id}`, { method: 'DELETE' });
    showToast('Command deleted');
    await fetchCommands();
  } catch (err) {
    showToast('Error deleting command', true);
  }
}

// Token buttons helper inside Command Modal
document.querySelectorAll('.btn-token').forEach(btn => {
  btn.onclick = () => {
    const token = btn.getAttribute('data-token');
    const textarea = document.getElementById('cmdResponse');
    textarea.value += ' ' + token;
    textarea.focus();
  };
});

// Search inputs
document.getElementById('commandSearch').oninput = renderCommandsTable;

// -------------------------------------------------------------
// Timer Modal Actions (Add / Edit)
// -------------------------------------------------------------
const timerModal = document.getElementById('timerModal');
const timerForm = document.getElementById('timerForm');

document.getElementById('openAddTimerModal').onclick = () => {
  document.getElementById('timerModalTitle').innerHTML = '<i class="fa-solid fa-plus"></i> Add New Timer';
  document.getElementById('timerEditId').value = '';
  document.getElementById('timerName').value = '';
  document.getElementById('timerMessage').value = '';
  document.getElementById('timerInterval').value = 10;
  document.getElementById('timerMinChatLines').value = 3;
  document.getElementById('timerEnabled').checked = true;
  timerModal.classList.add('show');
};

document.getElementById('closeTimerModal').onclick = () => timerModal.classList.remove('show');
document.getElementById('cancelTimerModal').onclick = () => timerModal.classList.remove('show');

function openEditTimerModal(id) {
  const timer = appState.timers.find(t => t.id === id);
  if (!timer) return;

  document.getElementById('timerModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Timer';
  document.getElementById('timerEditId').value = timer.id;
  document.getElementById('timerName').value = timer.name;
  document.getElementById('timerMessage').value = timer.message;
  document.getElementById('timerInterval').value = timer.intervalMinutes;
  document.getElementById('timerMinChatLines').value = timer.minChatLines;
  document.getElementById('timerEnabled').checked = timer.enabled !== false;
  timerModal.classList.add('show');
}

timerForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('timerEditId').value;
  const payload = {
    name: document.getElementById('timerName').value.trim(),
    message: document.getElementById('timerMessage').value.trim(),
    intervalMinutes: parseInt(document.getElementById('timerInterval').value, 10) || 10,
    minChatLines: parseInt(document.getElementById('timerMinChatLines').value, 10) || 3,
    enabled: document.getElementById('timerEnabled').checked
  };

  try {
    if (id) {
      await fetch(`/api/timers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Timer updated successfully!');
    } else {
      await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('New timer created!');
    }
    timerModal.classList.remove('show');
    await fetchTimers();
  } catch (err) {
    showToast('Failed to save timer', true);
  }
};

async function toggleTimerStatus(id, enabled) {
  try {
    await fetch(`/api/timers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    showToast(`Timer ${enabled ? 'enabled' : 'disabled'}`);
    const timer = appState.timers.find(t => t.id === id);
    if (timer) timer.enabled = enabled;
  } catch (err) {
    showToast('Error updating timer status', true);
  }
}

async function deleteTimer(id) {
  if (!confirm('Are you sure you want to delete this timer?')) return;
  try {
    await fetch(`/api/timers/${id}`, { method: 'DELETE' });
    showToast('Timer deleted');
    await fetchTimers();
  } catch (err) {
    showToast('Error deleting timer', true);
  }
}

document.getElementById('timerSearch').oninput = renderTimersTable;

// -------------------------------------------------------------
// Save Moderation Settings
// -------------------------------------------------------------
document.getElementById('saveModerationBtn').onclick = async () => {
  const profanityBlacklist = document.getElementById('modProfanityBlacklist').value
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);

  const linksAllowlist = document.getElementById('modLinksAllowlist').value
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);

  const updatedModeration = {
    profanity: {
      enabled: document.getElementById('modProfanityToggle').checked,
      blacklist: profanityBlacklist,
      action: document.getElementById('modProfanityAction').value,
      customWarning: document.getElementById('modProfanityWarning').value,
      timeoutSeconds: 300
    },
    links: {
      enabled: document.getElementById('modLinksToggle').checked,
      allowlist: linksAllowlist,
      action: document.getElementById('modLinksAction').value,
      customWarning: document.getElementById('modLinksWarning').value,
      timeoutSeconds: 60
    },
    caps: {
      enabled: document.getElementById('modCapsToggle').checked,
      maxCapsPercentage: parseInt(document.getElementById('modCapsPercentage').value, 10) || 70,
      minCharLength: parseInt(document.getElementById('modCapsMinLength').value, 10) || 8,
      action: document.getElementById('modCapsAction').value,
      customWarning: document.getElementById('modCapsWarning').value,
      timeoutSeconds: 30
    },
    repetitive: {
      enabled: document.getElementById('modRepetitiveToggle').checked,
      maxRepeatedChars: parseInt(document.getElementById('modRepetitiveMax').value, 10) || 6,
      action: document.getElementById('modRepetitiveAction').value,
      timeoutSeconds: 30
    }
  };

  try {
    const res = await fetch('/api/moderation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedModeration)
    });
    appState.moderation = await res.json();
    showToast('Auto-Moderation rules saved successfully!');
  } catch (err) {
    showToast('Error saving moderation rules', true);
  }
};

// -------------------------------------------------------------
// Manual Video ID / Stream Override
// -------------------------------------------------------------
document.getElementById('saveManualStreamBtn').onclick = async () => {
  const manualId = document.getElementById('manualVideoInput').value.trim();
  try {
    await fetch('/api/bot/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualVideoId: manualId })
    });
    showToast('Custom stream ID updated!');
    await fetchBotStatus();
  } catch (err) {
    showToast('Error updating stream ID', true);
  }
};

// -------------------------------------------------------------
// General Settings
// -------------------------------------------------------------
document.getElementById('saveGeneralSettingsBtn').onclick = async () => {
  const prefix = document.getElementById('settingsBotPrefix').value.trim() || '!';
  const interval = parseInt(document.getElementById('settingsPollingInterval').value, 10) || 4;

  try {
    await fetch('/api/bot/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix,
        pollingIntervalSeconds: interval
      })
    });
    showToast('Settings saved!');
  } catch (err) {
    showToast('Error saving settings', true);
  }
};

// -------------------------------------------------------------
// Bot Start / Stop Toggle
// -------------------------------------------------------------
document.getElementById('toggleBotBtn').onclick = async () => {
  try {
    const res = await fetch('/api/bot/toggle', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      appState.botRunning = data.running;
      renderBotStatusUI(data.running);
      showToast(data.message);
    } else {
      showToast(data.error || 'Failed to toggle bot', true);
    }
  } catch (err) {
    showToast('Error toggling bot', true);
  }
};

// -------------------------------------------------------------
// Logout
// -------------------------------------------------------------
async function logoutUser() {
  if (!confirm('Are you sure you want to disconnect your account?')) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out successfully');
    window.location.reload();
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// -------------------------------------------------------------
// Interactive Simulator
// -------------------------------------------------------------
const simForm = document.getElementById('simulatorForm');
const simOutputBox = document.getElementById('simOutputBox');

// Preset buttons
document.querySelectorAll('.btn-chip').forEach(btn => {
  btn.onclick = () => {
    const text = btn.getAttribute('data-test');
    document.getElementById('simMessageText').value = text;
    simForm.dispatchEvent(new Event('submit'));
  };
});

simForm.onsubmit = async (e) => {
  e.preventDefault();
  const username = document.getElementById('simUsername').value.trim() || 'Tester';
  const role = document.getElementById('simRole').value;
  const message = document.getElementById('simMessageText').value.trim();

  if (!message) return;

  const payload = {
    user: username,
    text: message,
    isOwner: role === 'owner',
    isMod: role === 'mod'
  };

  try {
    await fetch('/api/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    document.getElementById('simMessageText').value = '';
  } catch (err) {
    showToast('Error sending simulated message', true);
  }
};

// Clear Chat / Logs buttons
document.getElementById('clearChatBtn').onclick = () => {
  document.getElementById('liveChatMessagesBox').innerHTML = '<div class="chat-placeholder"><i class="fa-regular fa-comment-dots"></i><p>Chat cleared.</p></div>';
};

document.getElementById('clearLogsBtn').onclick = () => {
  document.getElementById('liveAuditLogsBox').innerHTML = '<div class="empty-state">Logs cleared.</div>';
};

// -------------------------------------------------------------
// Socket.io Real-time Event Handlers
// -------------------------------------------------------------

socket.on('initialState', (data) => {
  appState.botRunning = data.running;
  renderBotStatusUI(data.running);
  if (data.currentBroadcast) renderStreamStatus(data.currentBroadcast);
  if (data.stats) renderStats(data.stats);
  if (data.logs) renderLogs(data.logs);
});

socket.on('botStatus', (data) => {
  appState.botRunning = data.running;
  renderBotStatusUI(data.running);
  if (data.stream !== undefined) renderStreamStatus(data.stream);
});

socket.on('streamStatus', (data) => {
  renderStreamStatus(data.broadcast);
});

socket.on('chatMessage', (msg) => {
  appendChatMessage(msg);
  if (msg.isSimulated) {
    appendSimOutput(`[${msg.author}] ${escapeHtml(msg.text)}`, 'user');
  }
  // Increment processed count on UI
  const counter = document.getElementById('statMessages');
  counter.textContent = (parseInt(counter.textContent.replace(/,/g, ''), 10) + 1).toLocaleString();
});

socket.on('botResponse', (data) => {
  appendBotResponse(data);
  if (data.isSimulated) {
    appendSimOutput(`🤖 [Bot Reply to @${data.author}]: ${escapeHtml(data.response)}`, 'bot');
  }
  const counter = document.getElementById('statCommands');
  counter.textContent = (parseInt(counter.textContent.replace(/,/g, ''), 10) + 1).toLocaleString();
});

socket.on('moderationAction', (data) => {
  if (data.isSimulated) {
    appendSimOutput(`🛡️ [MODERATION - ${data.rule}]: Action ${data.action.toUpperCase()} on "${escapeHtml(data.text)}"`, 'mod');
  }
  const counter = document.getElementById('statModeration');
  counter.textContent = (parseInt(counter.textContent.replace(/,/g, ''), 10) + 1).toLocaleString();
});

socket.on('timerTriggered', (data) => {
  const counter = document.getElementById('statTimers');
  counter.textContent = (parseInt(counter.textContent.replace(/,/g, ''), 10) + 1).toLocaleString();
});

socket.on('log', (log) => {
  appendLog(log);
});

// ✅ REAL-TIME CHANNEL & GOALS UPDATE: Bot broadcasts this every ~45s with fresh YouTube API data
socket.on('channelUpdated', (ch) => {
  if (!ch) return;
  // Update in-memory channel state
  appState.channel = { ...appState.channel, ...ch };

  // Update subscriber count in header stats
  const subCount = parseInt(ch.subscriberCount || 0, 10);
  if (subCount > 0) {
    // Update channel header stat
    const subStatEl = document.querySelector('.ch-stat-num');
    if (subStatEl) subStatEl.textContent = formatCount(subCount);

    // Update subscriber stats display
    const channelTotalEl = document.getElementById('statChannelSubsTotal');
    if (channelTotalEl) channelTotalEl.textContent = subCount.toLocaleString();

    // Flash the subscriber count to show it updated
    const subStatCard = document.querySelector('[data-stat="subs"]');
    if (subStatCard) {
      subStatCard.style.outline = '2px solid #00c897';
      setTimeout(() => { subStatCard.style.outline = ''; }, 2000);
    }
  }

  // If we're on Goals tab, also refresh goals display
  if (document.getElementById('goals-section')?.classList.contains('active') ||
      window.location.hash === '#goals') {
    fetchGoals();
  }
});

// ✅ REAL-TIME GOALS UPDATE: When bot increments a goal (likes, subs, superchat)
socket.on('goalUpdated', (data) => {
  if (typeof fetchGoals === 'function') fetchGoals();
});
socket.on('goalsUpdate', (data) => {
  if (typeof fetchGoals === 'function') fetchGoals();
});

// ✅ PERIODIC REFRESH: Every 30 seconds, if bot is running, refresh channel info and goals
setInterval(() => {
  if (appState.botRunning) {
    // Silently refresh channel stats in background
    fetch('/api/channel')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.channel) {
          appState.channel = { ...appState.channel, ...data.channel };
          const subCount = parseInt(data.channel.subscriberCount || 0, 10);
          if (subCount > 0) {
            const channelTotalEl = document.getElementById('statChannelSubsTotal');
            if (channelTotalEl) channelTotalEl.textContent = subCount.toLocaleString();
          }
        }
      }).catch(() => {});
  }
}, 30000);

// Helper: Append incoming chat message to Live Chat Panel
function appendChatMessage(msg) {
  const chatBox = document.getElementById('liveChatMessagesBox');
  const placeholder = chatBox.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  let roleBadge = '';
  if (msg.isOwner) roleBadge = '<span class="badge-role badge-owner">Owner</span>';
  else if (msg.isModerator) roleBadge = '<span class="badge-role badge-moderator">Mod</span>';
  else if (msg.isSponsor) roleBadge = '<span class="badge-role badge-member">Member</span>';

  const initial = (msg.author || 'V').charAt(0).toUpperCase();
  const avatarUrl = msg.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.author || 'User')}`;

  const msgRow = document.createElement('div');
  msgRow.className = 'chat-msg-row';
  msgRow.id = `msg-${msg.id}`;
  msgRow.innerHTML = `
    <div style="position:relative; width:34px; height:34px; border-radius:50%; overflow:hidden; flex-shrink:0;">
      <img src="${avatarUrl}" class="chat-msg-avatar" referrerpolicy="no-referrer" alt="Avatar" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); color:#fff; font-size:12px; font-weight:700;">${escapeHtml(initial)}</div>
    </div>
    <div class="chat-msg-content">
      <div class="chat-msg-header">
        <span class="chat-author">${escapeHtml(msg.author)}</span>
        ${roleBadge}
        <span style="font-size: 11px; color: var(--text-subtle); margin-left: auto;">${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      <span class="chat-text">${escapeHtml(msg.text)}</span>
    </div>
  `;

  chatBox.appendChild(msgRow);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendBotResponse(data) {
  const chatBox = document.getElementById('liveChatMessagesBox');
  const placeholder = chatBox.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  const msgRow = document.createElement('div');
  msgRow.className = 'chat-msg-row bot-response';
  msgRow.innerHTML = `
    <div class="chat-msg-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent-purple);color:#fff;font-size:16px;">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="chat-msg-content">
      <div class="chat-msg-header">
        <span class="chat-author" style="color:var(--accent-purple);">Mohit M07 Manager</span>
        <span class="badge-role" style="background:rgba(168,85,247,0.2);color:var(--accent-purple);">Bot</span>
        <span style="font-size: 11px; color: var(--text-subtle); margin-left: auto;">${new Date().toLocaleTimeString()}</span>
      </div>
      <span class="chat-text" style="color:#fff;">${escapeHtml(data.response)}</span>
    </div>
  `;

  chatBox.appendChild(msgRow);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSimOutput(text, type = 'user') {
  const empty = simOutputBox.querySelector('.empty-state');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.style.padding = '8px 12px';
  item.style.borderRadius = '6px';
  item.style.fontSize = '13px';
  item.style.fontFamily = 'var(--font-mono)';

  if (type === 'user') {
    item.style.background = 'rgba(255, 255, 255, 0.04)';
    item.style.borderLeft = '3px solid var(--accent-cyan)';
  } else if (type === 'bot') {
    item.style.background = 'rgba(168, 85, 247, 0.12)';
    item.style.borderLeft = '3px solid var(--accent-purple)';
    item.style.color = '#e9d5ff';
  } else if (type === 'mod') {
    item.style.background = 'rgba(244, 63, 94, 0.15)';
    item.style.borderLeft = '3px solid var(--accent-rose)';
    item.style.color = '#fecdd3';
  }

  item.innerHTML = text;
  simOutputBox.appendChild(item);
  simOutputBox.scrollTop = simOutputBox.scrollHeight;
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCount(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return num;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Subscribers UI Event Listeners
document.getElementById('syncSubscribersBtn')?.addEventListener('click', syncSubscribers);
document.getElementById('subscriberSearch')?.addEventListener('input', renderSubscribersTable);

document.querySelectorAll('.sub-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    appState.subscriberFilter = btn.getAttribute('data-filter');
    renderSubscribersTable();
  });
});

socket.on('subscribersSynced', (data) => {
  if (data.stats) appState.subscriberStats = data.stats;
  fetchSubscribers();
});

// Live OBS Alert Broadcast Handler for Dashboard
socket.on('obsAlert', (data) => {
  const type = data.type || 'subscriber';
  let title = 'Live Overlay Alert';
  let message = data.message || '';
  if (type === 'subscriber') {
    title = '🎉 New Subscriber!';
    message = `@${data.user || 'Viewer'} just subscribed to MOHIT-M07!`;
  } else if (type === 'superChat') {
    title = `💎 Super Chat ${data.amount || '₹'}`;
    message = `@${data.user || 'Viewer'}: "${data.message || 'Thank you!'}"`;
  } else if (type === 'membership') {
    title = '👑 New Channel Member!';
    message = `@${data.user || 'Viewer'} joined the channel family!`;
  } else if (type === 'unsubscriber') {
    title = '👋 Unsubscriber Notice';
    message = `@${data.user || 'Viewer'} left subscription.`;
  }
  showToast(message, type, title, 6000);
});

// Alerts & Voice UI Event Listeners
document.getElementById('saveAlertsConfigBtn')?.addEventListener('click', saveAlertsConfig);
document.getElementById('testVoiceSpeechBtn')?.addEventListener('click', testVoiceSpeech);

// Slider Live Value Handlers
document.getElementById('voiceVolume')?.addEventListener('input', (e) => {
  const val = Math.round(parseFloat(e.target.value) * 100);
  const el = document.getElementById('voiceVolumeVal');
  if (el) el.textContent = `${val}%`;
});

document.getElementById('voiceRate')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value).toFixed(2);
  const el = document.getElementById('voiceRateVal');
  if (el) el.textContent = `${val}x`;
});

document.getElementById('voicePitch')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value).toFixed(2);
  const el = document.getElementById('voicePitchVal');
  if (el) el.textContent = `${val}`;
});

document.getElementById('obsCardOpacity')?.addEventListener('input', (e) => {
  const val = e.target.value;
  const el = document.getElementById('obsCardOpacityVal');
  if (el) el.textContent = `${val}%`;
});

document.getElementById('obsBackgroundStyle')?.addEventListener('change', (e) => {
  const style = e.target.value;
  const opacityInput = document.getElementById('obsCardOpacity');
  const opacityVal = document.getElementById('obsCardOpacityVal');
  if (style === 'transparent' && opacityInput) {
    opacityInput.value = 0;
    if (opacityVal) opacityVal.textContent = '0%';
  } else if (style === 'frosted' && opacityInput && opacityInput.value == 0) {
    opacityInput.value = 60;
    if (opacityVal) opacityVal.textContent = '60%';
  }
});

document.querySelectorAll('.test-alert-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const alertType = btn.getAttribute('data-type');
    testAlert(alertType);
  });
});

// Media File Upload Handlers (Direct GIF / MP4 / Image Uploads)
document.querySelectorAll('.upload-media-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetInputId = btn.getAttribute('data-target');
    const container = btn.closest('.form-row') || btn.parentElement;
    const fileInput = container ? container.querySelector('input[type="file"]') : null;
    if (fileInput) {
      fileInput.value = '';
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
          showToast('File is too large (maximum 50MB)', true);
          return;
        }

        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = reader.result;
            const res = await fetch('/api/upload-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileData: base64Data
              })
            });
            const data = await res.json();
            if (data.success && data.fileUrl) {
              const targetInput = document.getElementById(targetInputId);
              if (targetInput) targetInput.value = data.fileUrl;
              showToast(`Uploaded ${file.name} successfully!`, 'success', 'Media Uploaded');
              saveAlertsConfig();
            } else {
              showToast(data.error || 'Upload failed', true);
            }
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
          };
          reader.readAsDataURL(file);
        } catch (err) {
          btn.innerHTML = originalBtnHtml;
          btn.disabled = false;
          showToast(`Upload error: ${err.message}`, true);
        }
      };
      fileInput.click();
    }
  });
});

document.getElementById('copyObsUrlBtn')?.addEventListener('click', () => {
  const input = document.getElementById('obsOverlayUrlInput');
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('OBS Overlay URL copied to clipboard!');
  }
});

// -------------------------------------------------------------
// 8. Goals & Widgets Handlers
// -------------------------------------------------------------
async function fetchGoals() {
  try {
    const res = await fetch('/api/goals');
    const goals = await res.json();
    if (goals) {
      if (goals.subscriberGoal) {
        document.getElementById('subGoalEnabled').checked = goals.subscriberGoal.enabled !== false;
        document.getElementById('subGoalTitleInput').value = goals.subscriberGoal.title || 'Subscriber Goal';
        document.getElementById('subGoalCurrentInput').value = goals.subscriberGoal.current || (appState.channel?.subscriberCount || 2270);
        document.getElementById('subGoalTargetInput').value = goals.subscriberGoal.target || 2500;
      }
      if (goals.likeGoal) {
        document.getElementById('likeGoalEnabled').checked = Boolean(goals.likeGoal.enabled);
        document.getElementById('likeGoalTitleInput').value = goals.likeGoal.title || 'Stream Likes';
        document.getElementById('likeGoalCurrentInput').value = goals.likeGoal.current || 0;
        document.getElementById('likeGoalTargetInput').value = goals.likeGoal.target || 100;
      }
      if (goals.superChatGoal) {
        document.getElementById('superGoalEnabled').checked = Boolean(goals.superChatGoal.enabled);
        document.getElementById('superGoalTitleInput').value = goals.superChatGoal.title || 'Super Chat Goal';
        document.getElementById('superGoalCurrentInput').value = goals.superChatGoal.current || 0;
        document.getElementById('superGoalTargetInput').value = goals.superChatGoal.target || 1000;
      }
    }
  } catch (err) {
    console.error('Error fetching goals:', err);
  }
}

let selectedGoalType = 'all';
let selectedGoalTemplate = 'cyber';

function updateGoalsOverlayUrl() {
  const bgRadio = document.querySelector('input[name="goalBgStyle"]:checked');
  const bg = bgRadio ? bgRadio.value : 'transparent';
  const themeSelect = document.getElementById('goalThemeSelect');
  const theme = themeSelect ? themeSelect.value : '';
  const sizeSelect = document.getElementById('goalSizeSelect');
  const size = sizeSelect ? sizeSelect.value : 'normal';

  const baseUrl = `${window.location.origin}/widgets/goals.html`;

  const params = [];
  if (selectedGoalType && selectedGoalType !== 'all') {
    params.push(`type=${selectedGoalType}`);
  }
  if (selectedGoalTemplate && selectedGoalTemplate !== 'default') {
    params.push(`template=${selectedGoalTemplate}`);
  }
  if (theme) {
    params.push(`theme=${theme}`);
  }
  if (size && size !== 'normal') {
    params.push(`size=${size}`);
  }
  if (bg) {
    params.push(`bg=${bg}`);
  }

  const finalUrl = params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;

  const input = document.getElementById('goalsObsUrlInput');
  const openBtn = document.getElementById('openGoalsWindowBtn');
  const iframe = document.getElementById('goalsPreviewIframe');

  if (input) input.value = finalUrl;
  if (openBtn) openBtn.href = finalUrl;
  if (iframe) iframe.src = finalUrl;
}

// Goal type tabs click listener
document.querySelectorAll('.goal-url-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.goal-url-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedGoalType = tab.getAttribute('data-goal-type') || 'all';
    updateGoalsOverlayUrl();
  });
});

// Goal template chips click listener
document.querySelectorAll('.goal-template-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.goal-template-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGoalTemplate = btn.getAttribute('data-template') || 'cyber';
    updateGoalsOverlayUrl();
  });
});

// Test Milestone & Celebration Blast button
document.getElementById('testGoalCelebrationBtn')?.addEventListener('click', () => {
  const iframe = document.getElementById('goalsPreviewIframe');
  if (iframe && iframe.contentWindow) {
    try {
      const cards = iframe.contentDocument.querySelectorAll('.goal-card');
      cards.forEach(c => {
        c.classList.remove('celebrate');
        void c.offsetWidth;
        c.classList.add('celebrate');
      });
      if (typeof iframe.contentWindow.launchConfetti === 'function') {
        iframe.contentWindow.launchConfetti('#10b981', 80);
      }
      showToast('🎉 Confetti & Milestone Blast Triggered in Preview!', 'success', 'Goal Celebration');
    } catch (e) {
      showToast('Celebration triggered!', 'info');
    }
  }
});

// Individual Copy Goal URL buttons
document.querySelectorAll('.copy-individual-goal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const relUrl = btn.getAttribute('data-url');
    const bgRadio = document.querySelector('input[name="goalBgStyle"]:checked');
    const bg = bgRadio ? bgRadio.value : 'transparent';
    const themeSelect = document.getElementById('goalThemeSelect');
    const theme = themeSelect ? themeSelect.value : '';
    const sizeSelect = document.getElementById('goalSizeSelect');
    const size = sizeSelect ? sizeSelect.value : 'normal';

    let fullUrl = `${window.location.origin}${relUrl}&template=${selectedGoalTemplate}`;
    if (theme) fullUrl += `&theme=${theme}`;
    if (size && size !== 'normal') fullUrl += `&size=${size}`;
    if (bg !== 'transparent') {
      fullUrl = fullUrl.replace('bg=transparent', `bg=${bg}`);
    }
    navigator.clipboard.writeText(fullUrl);
    showToast('Individual Goal OBS URL copied!', 'success');
  });
});

async function saveGoals() {
  const payload = {
    subscriberGoal: {
      enabled: document.getElementById('subGoalEnabled').checked,
      title: document.getElementById('subGoalTitleInput').value.trim(),
      current: Number(document.getElementById('subGoalCurrentInput').value),
      target: Number(document.getElementById('subGoalTargetInput').value)
    },
    likeGoal: {
      enabled: document.getElementById('likeGoalEnabled').checked,
      title: document.getElementById('likeGoalTitleInput').value.trim(),
      current: Number(document.getElementById('likeGoalCurrentInput').value),
      target: Number(document.getElementById('likeGoalTargetInput').value)
    },
    superChatGoal: {
      enabled: document.getElementById('superGoalEnabled').checked,
      title: document.getElementById('superGoalTitleInput').value.trim(),
      current: Number(document.getElementById('superGoalCurrentInput').value),
      target: Number(document.getElementById('superGoalTargetInput').value)
    }
  };

  try {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Live Goals updated & synced with OBS!', 'success', 'Goals Saved');
      updateGoalsOverlayUrl();
    }
  } catch (err) {
    showToast(`Failed to save goals: ${err.message}`, true);
  }
}

document.getElementById('saveGoalsBtn')?.addEventListener('click', saveGoals);

// Force sync goals from YouTube API
async function syncGoalsNow(showMsg = true) {
  try {
    const btn = document.getElementById('syncGoalsBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...'; }
    const res = await fetch('/api/goals/sync', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      await fetchGoals(); // Refresh the displayed form values
      if (showMsg) showToast('✅ Goals synced from YouTube! Subscriber count updated.', 'success', 'Goals Synced');
    }
  } catch (err) {
    if (showMsg) showToast(`Sync failed: ${err.message}`, true);
  } finally {
    const btn = document.getElementById('syncGoalsBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync Now'; }
  }
}
document.getElementById('syncGoalsBtn')?.addEventListener('click', () => syncGoalsNow(true));
document.getElementById('copyGoalsObsBtn')?.addEventListener('click', () => {
  const input = document.getElementById('goalsObsUrlInput');
  if (input) {
    navigator.clipboard.writeText(input.value);
    showToast('OBS Goal Widget URL copied!');
  }
});

// -------------------------------------------------------------
// 9. Soundboard SFX Handlers
// -------------------------------------------------------------
document.querySelectorAll('.sfx-card').forEach(btn => {
  btn.addEventListener('click', async () => {
    const sfxId = btn.getAttribute('data-sfx');
    if (!sfxId) return;

    // Play locally immediately
    const audio = new Audio(`/sounds/${sfxId}.wav`);
    audio.play().catch(() => {});

    // Trigger on server to broadcast to OBS & logs
    try {
      await fetch('/api/soundboard/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundId: sfxId })
      });
      showToast(`Triggered SFX: ${sfxId.toUpperCase()}`, 'info', 'Soundboard');
    } catch (e) {}
  });
});

// -------------------------------------------------------------
// 10. Live Chat Polls Handlers
// -------------------------------------------------------------
async function fetchActivePoll() {
  try {
    const res = await fetch('/api/polls/active');
    const data = await res.json();
    renderActivePollMonitor(data.poll);
  } catch (err) {}
}

async function fetchPollHistory() {
  try {
    const res = await fetch('/api/polls/history');
    const data = await res.json();
    const list = document.getElementById('pollHistoryList');
    if (!list) return;

    if (!data.history || data.history.length === 0) {
      list.innerHTML = '<div class="empty-state">No past polls.</div>';
      return;
    }

    list.innerHTML = data.history.slice(0, 5).map(p => `
      <div class="history-poll-item">
        <div>
          <strong>${escapeHtml(p.question)}</strong>
          <div style="font-size: 11px; color: var(--text-subtle);">Winner: <span style="color: var(--accent-purple);">${escapeHtml(p.winner || 'Tie')}</span> &bull; ${p.totalVotes || 0} Votes</div>
        </div>
        <span class="badge-role badge-viewer">${new Date(p.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `).join('');
  } catch (err) {}
}

function renderActivePollMonitor(poll) {
  const box = document.getElementById('activePollMonitorBox');
  const badge = document.getElementById('activePollStatusBadge');
  if (!box || !badge) return;

  if (!poll || !poll.isActive) {
    badge.innerHTML = '<span class="badge badge-gray">No Active Poll</span>';
    box.innerHTML = '<div class="empty-state">No poll currently running. Launch a new poll on the left!</div>';
    return;
  }

  badge.innerHTML = '<span class="live-pill"><span class="pulse-dot"></span> POLL ACTIVE</span>';

  box.innerHTML = `
    <div style="margin-bottom: 12px;">
      <h3 style="font-size: 18px; margin-bottom: 6px;">${escapeHtml(poll.question)}</h3>
      <div style="display: flex; gap: 10px; font-size: 12px; color: var(--text-muted);">
        <span><i class="fa-solid fa-users"></i> ${poll.totalVotes || 0} Total Votes</span>
        <span>&bull;</span>
        <span>Type <strong style="color: var(--accent-cyan);">1, 2, 3...</strong> in YouTube chat</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
      ${poll.options.map(opt => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
            <span>[#${opt.id}] ${escapeHtml(opt.text)}</span>
            <span>${opt.votes || 0} votes (${opt.percentage || 0}%)</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden;">
            <div style="height: 100%; width: ${opt.percentage || 0}%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan)); transition: width 0.5s;"></div>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn-danger btn-sm" id="endPollBtn"><i class="fa-solid fa-stop"></i> End Poll</button>
      <button class="btn btn-secondary btn-sm" id="clearPollBtn"><i class="fa-solid fa-trash-can"></i> Clear Overlay</button>
    </div>
  `;

  document.getElementById('endPollBtn')?.addEventListener('click', async () => {
    await fetch('/api/polls/end', { method: 'POST' });
    showToast('Poll ended successfully!');
    fetchActivePoll();
    fetchPollHistory();
  });

  document.getElementById('clearPollBtn')?.addEventListener('click', async () => {
    await fetch('/api/polls/active', { method: 'DELETE' });
    showToast('Poll cleared from overlay!');
    fetchActivePoll();
  });
}

document.getElementById('createPollForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('pollQuestionInput').value.trim();
  const opt1 = document.getElementById('pollOpt1Input').value.trim();
  const opt2 = document.getElementById('pollOpt2Input').value.trim();
  const opt3 = document.getElementById('pollOpt3Input').value.trim();
  const opt4 = document.getElementById('pollOpt4Input').value.trim();
  const durationSeconds = Number(document.getElementById('pollDurationSelect').value);

  const options = [opt1, opt2];
  if (opt3) options.push(opt3);
  if (opt4) options.push(opt4);

  try {
    const res = await fetch('/api/polls/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options, durationSeconds })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Live Chat Poll started & broadcast to OBS!', 'success', 'Poll Active');
      renderActivePollMonitor(data.poll);
      document.getElementById('createPollForm').reset();
    } else {
      showToast(data.error || 'Failed to start poll', true);
    }
  } catch (err) {
    showToast(err.message, true);
  }
});

// -------------------------------------------------------------
// 11. Loyalty & Leaderboard Handlers
// -------------------------------------------------------------
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/loyalty/leaderboard?limit=10');
    const data = await res.json();
    const tbody = document.getElementById('leaderboardTableBody');
    if (!tbody) return;

    if (!data.leaderboard || data.leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No viewers registered yet. Chat to earn points!</td></tr>';
      return;
    }

    tbody.innerHTML = data.leaderboard.map((u, idx) => `
      <tr>
        <td><strong style="color: ${idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#d97706' : 'var(--text-subtle)'};">#${idx + 1}</strong></td>
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td><span style="font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 700;">${Number(u.points || 0).toLocaleString()} pts</span></td>
        <td><span class="badge-role badge-member">${u.triviaWins || 0} Wins</span></td>
      </tr>
    `).join('');
  } catch (err) {}
}

document.getElementById('refreshLeaderboardBtn')?.addEventListener('click', () => {
  fetchLeaderboard();
  showToast('Leaderboard refreshed!');
});

// Trivia Launch Handlers
async function launchLiveTrivia(category = 'Free Fire and Gaming') {
  try {
    const btn = document.getElementById('launchTriviaBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting...'; }
    const res = await fetch('/api/loyalty/trivia/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`🎯 Trivia Broadcast to Live Chat: "${data.trivia?.question}"`, 'success', 'Trivia Started');
    } else {
      showToast(data.error || 'Failed to start trivia', true);
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    const btn = document.getElementById('launchTriviaBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Launch Trivia in Chat'; }
  }
}

document.getElementById('launchTriviaBtn')?.addEventListener('click', () => {
  const cat = document.getElementById('triviaCategorySelect')?.value || 'Free Fire and Gaming';
  launchLiveTrivia(cat);
});

document.getElementById('launchAiTriviaBtn')?.addEventListener('click', async () => {
  const cat = document.getElementById('triviaCategorySelect')?.value || 'Free Fire and Gaming';
  const aiBtn = document.getElementById('launchAiTriviaBtn');
  if (aiBtn) { aiBtn.disabled = true; aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> AI Generating...'; }
  await launchLiveTrivia(cat);
  if (aiBtn) { aiBtn.disabled = false; aiBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> ⚡ Gemini AI Question'; }
});

// Socket listener for live trivia events
socket.on('triviaSolved', (data) => {
  showToast(`🧠 WINNER! @${data.winner} answered "${data.answer}" and won +${data.reward} pts!`, 'success', 'Trivia Solved');
  fetchLeaderboard();
});

socket.on('triviaTimeout', (data) => {
  showToast(`⏰ Trivia Timeout! The answer was "${data.answer}"`, 'info', 'Trivia Ended');
});

// -------------------------------------------------------------
// Gemini AI Settings Handlers
// -------------------------------------------------------------
async function fetchGeminiConfig() {
  try {
    const res = await fetch('/api/ai/gemini');
    const data = await res.json();
    if (data) {
      const keyInput = document.getElementById('geminiApiKeyInput');
      const badge = document.getElementById('geminiStatusBadge');
      const modelSelect = document.getElementById('geminiModelSelect');
      const promptInput = document.getElementById('geminiPromptInput');

      if (data.hasKey) {
        if (keyInput) keyInput.placeholder = `Active Key: ${data.maskedKey} (Enter new to replace)`;
        if (badge) badge.innerHTML = '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Key Connected</span>';
      } else {
        if (badge) badge.innerHTML = '<span class="badge badge-gray">No Key Set</span>';
      }

      if (modelSelect && data.model) modelSelect.value = data.model;
      if (promptInput && data.customPrompt) promptInput.value = data.customPrompt;
    }
  } catch (e) {}
}

document.getElementById('toggleGeminiKeyVisBtn')?.addEventListener('click', () => {
  const input = document.getElementById('geminiApiKeyInput');
  const icon = document.querySelector('#toggleGeminiKeyVisBtn i');
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.className = 'fa-regular fa-eye-slash';
    } else {
      input.type = 'password';
      if (icon) icon.className = 'fa-regular fa-eye';
    }
  }
});

document.getElementById('saveGeminiSettingsBtn')?.addEventListener('click', async () => {
  const apiKey = document.getElementById('geminiApiKeyInput')?.value.trim();
  const model = document.getElementById('geminiModelSelect')?.value;
  const customPrompt = document.getElementById('geminiPromptInput')?.value.trim();

  try {
    const payload = { model, customPrompt };
    if (apiKey) payload.apiKey = apiKey;

    const res = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Google Gemini API Key & settings saved!', 'success', 'Gemini AI Ready');
      const keyInput = document.getElementById('geminiApiKeyInput');
      if (keyInput) keyInput.value = '';
      fetchGeminiConfig();
    }
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('testGeminiApiBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('testGeminiApiBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing AI...'; }
  try {
    const res = await fetch('/api/ai/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Say a 1-sentence friendly greeting in Hinglish for Mohit-M07 stream viewers!' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🤖 Gemini AI Reply: "${data.reply}"`, 'success', 'Gemini AI Working!');
    } else {
      showToast(`Gemini Error: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Test failed: ${err.message}`, true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt"></i> ✨ Test Gemini AI'; }
  }
});

document.getElementById('rewardPointsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('rewardViewerName').value.trim();
  const amount = Number(document.getElementById('rewardAmount').value);

  try {
    const res = await fetch('/api/loyalty/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorId: name, authorName: name, amount, reason: 'manual_reward' })
    });
    if (res.ok) {
      showToast(`Awarded +${amount} Points to ${name}!`, 'success');
      document.getElementById('rewardPointsForm').reset();
      fetchLeaderboard();
    }
  } catch (err) {
    showToast(err.message, true);
  }
});

// -------------------------------------------------------------
// 12. Stream Highlights Handlers
// -------------------------------------------------------------
async function fetchHighlights() {
  try {
    const res = await fetch('/api/highlights');
    const data = await res.json();
    const tbody = document.getElementById('highlightsTableBody');
    if (!tbody) return;

    if (!data.highlights || data.highlights.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No highlights recorded yet. Use !clip in chat or click Mark Highlight!</td></tr>';
      return;
    }

    tbody.innerHTML = data.highlights.map(h => `
      <tr>
        <td><span class="badge-role badge-owner" style="font-family: var(--font-mono);">${h.timestampFormatted}</span></td>
        <td><strong>${escapeHtml(h.description)}</strong></td>
        <td><span style="color: var(--text-muted);">${escapeHtml(h.createdBy || 'Streamer')}</span></td>
        <td><span style="font-size: 11px; color: var(--text-subtle);">${new Date(h.createdAt).toLocaleTimeString()}</span></td>
        <td>
          <button class="btn btn-icon btn-sm" onclick="deleteHighlight('${h.id}')" title="Delete Clip"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {}
}

window.deleteHighlight = async function(id) {
  await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
  fetchHighlights();
  showToast('Highlight removed');
};

document.getElementById('markHighlightBtn')?.addEventListener('click', async () => {
  const note = prompt('Enter a short note for this stream highlight (e.g. Epic 1v4 Clutch):', 'Awesome Stream Moment');
  if (note === null) return;

  try {
    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: note || 'Stream Highlight', createdBy: 'Streamer' })
    });
    if (res.ok) {
      showToast('Timestamp marked & saved!', 'success', 'Highlight Clipped');
      fetchHighlights();
    }
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('exportHighlightsBtn')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/highlights');
    const data = await res.json();
    if (!data.highlights || data.highlights.length === 0) {
      showToast('No highlights to copy!', 'warning');
      return;
    }
    const text = data.highlights.map(h => `${h.timestampFormatted} - ${h.description} (by ${h.createdBy})`).join('\n');
    navigator.clipboard.writeText(text);
    showToast('All highlight timestamps copied to clipboard for your video editor!', 'success');
  } catch (err) {}
});

document.getElementById('clearHighlightsBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all recorded highlights?')) {
    await fetch('/api/highlights', { method: 'DELETE' });
    fetchHighlights();
    showToast('All highlights cleared');
  }
});

// -------------------------------------------------------------
// 13. YouTube API Quota Tracker & Meter
// -------------------------------------------------------------
async function fetchQuotaInfo() {
  const refreshIcon = document.getElementById('refreshQuotaIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    const res = await fetch('/api/quota');
    const quota = await res.json();
    renderQuotaTracker(quota);
  } catch (err) {
    console.error('Error fetching quota:', err);
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('fa-spin'), 400);
    }
  }
}

function renderQuotaTracker(quota) {
  if (!quota) return;

  const used = quota.unitsUsed || 0;
  const limit = quota.dailyLimit || 10000;
  const pct = quota.percentage || 0;
  const remaining = quota.remaining !== undefined ? quota.remaining : Math.max(0, limit - used);
  const isExceeded = quota.isExceeded || used >= limit;

  // Header Pill
  const headerQuota = document.getElementById('headerQuotaStatus');
  if (headerQuota) {
    if (isExceeded) {
      headerQuota.textContent = `${used.toLocaleString()} / ${limit.toLocaleString()} (Exhausted)`;
      headerQuota.style.color = 'var(--accent-rose)';
    } else {
      headerQuota.textContent = `${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)`;
      headerQuota.style.color = pct > 80 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
    }
  }

  // Card Status Pill
  const pill = document.getElementById('quotaStatusPill');
  const pillText = document.getElementById('quotaStatusText');
  if (pill && pillText) {
    if (isExceeded) {
      pill.className = 'quota-status-pill exceeded';
      pillText.textContent = '100% EXHAUSTED';
    } else if (pct >= 80) {
      pill.className = 'quota-status-pill warning';
      pillText.textContent = `${pct}% HEAVY USAGE`;
    } else {
      pill.className = 'quota-status-pill normal';
      pillText.textContent = 'NORMAL OPERATION';
    }
  }

  // Metric Boxes
  const unitsUsedEl = document.getElementById('quotaUnitsUsed');
  const dailyLimitEl = document.getElementById('quotaDailyLimit');
  const pctLabelEl = document.getElementById('quotaPctLabel');
  const remainingUnitsEl = document.getElementById('quotaRemainingUnits');
  const remainingSubEl = document.getElementById('quotaRemainingSub');
  const resetCountdownEl = document.getElementById('quotaResetCountdown');

  if (unitsUsedEl) unitsUsedEl.textContent = used.toLocaleString();
  if (dailyLimitEl) dailyLimitEl.textContent = limit.toLocaleString();
  if (pctLabelEl) {
    pctLabelEl.textContent = isExceeded ? '100% Daily Limit Reached' : `${pct}% of daily free budget`;
    pctLabelEl.style.color = isExceeded ? 'var(--accent-rose)' : (pct >= 80 ? 'var(--accent-amber)' : 'var(--accent-emerald)');
  }

  if (remainingUnitsEl) {
    remainingUnitsEl.textContent = remaining.toLocaleString();
    remainingUnitsEl.style.color = isExceeded ? 'var(--accent-rose)' : (remaining > 2000 ? 'var(--accent-emerald)' : 'var(--accent-amber)');
  }
  if (remainingSubEl) {
    remainingSubEl.textContent = isExceeded ? 'Exhausted for current cycle' : 'Units available for bot';
  }

  if (resetCountdownEl) {
    resetCountdownEl.textContent = quota.resetIn || 'In a few hours';
  }

  // Progress Bar
  const progressFill = document.getElementById('quotaProgressFill');
  const progressText = document.getElementById('quotaProgressText');
  const noticeText = document.getElementById('quotaStatusNotice');

  if (progressFill) {
    progressFill.style.width = `${Math.min(100, pct)}%`;
  }
  if (progressText) {
    progressText.textContent = `${used.toLocaleString()} / ${limit.toLocaleString()} Units (${pct}%)`;
  }
  if (noticeText) {
    if (isExceeded) {
      noticeText.textContent = '🔴 Daily Free Limit Reached';
      noticeText.style.color = 'var(--accent-rose)';
    } else if (pct >= 80) {
      noticeText.textContent = '🟡 Approaching Daily Limit';
      noticeText.style.color = 'var(--accent-amber)';
    } else {
      noticeText.textContent = '🟢 Free Quota Available';
      noticeText.style.color = 'var(--accent-emerald)';
    }
  }
}

document.getElementById('refreshQuotaBtn')?.addEventListener('click', () => {
  fetchQuotaInfo();
  showToast('YouTube Quota Status refreshed!', 'info');
});

// -------------------------------------------------------------
// 14. Deep Channel Analytics & Growth Suite Controller
// -------------------------------------------------------------
let analyticsDataCache = null;
let analyticsPerformanceChartInstance = null;
let analyticsDistributionChartInstance = null;
let currentVideoSort = 'views';

async function fetchAnalyticsData(forceRefresh = false) {
  const refreshIcon = document.getElementById('refreshAnalyticsIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    const url = forceRefresh ? '/api/analytics/overview?refresh=true' : '/api/analytics/overview';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    analyticsDataCache = data;
    renderAnalyticsUI(data);
  } catch (err) {
    console.error('Error fetching analytics:', err);
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('fa-spin'), 500);
    }
  }
}

function renderAnalyticsUI(data) {
  if (!data) return;

  const ch = data.channel || {};
  const kpi = data.kpis || {};

  // Header Details
  const titleEl = document.getElementById('analyticsChannelTitle');
  const handleEl = document.getElementById('analyticsHandle');
  const avatarEl = document.getElementById('analyticsAvatar');
  const bioEl = document.getElementById('analyticsBio');
  const countryEl = document.getElementById('analyticsCountry');

  if (titleEl) titleEl.textContent = ch.title || 'MOHIT-M07';
  if (handleEl) handleEl.textContent = ch.customUrl || '@mohitm07liveee';
  if (avatarEl && ch.avatar) avatarEl.src = ch.avatar;
  if (bioEl && ch.description) bioEl.textContent = ch.description;
  if (countryEl) countryEl.innerHTML = `<i class="fa-solid fa-globe"></i> ${ch.country || 'IN'}`;

  const openStudioBtn = document.getElementById('analyticsOpenStudioBtn');
  if (openStudioBtn) {
    openStudioBtn.href = ch.customUrl 
      ? `https://www.youtube.com/${ch.customUrl}` 
      : (ch.id ? `https://www.youtube.com/channel/${ch.id}` : 'https://studio.youtube.com');
  }

  // KPI Metrics
  const subs = kpi.subscribers !== undefined ? kpi.subscribers : (ch.subscriberCount || 2280);
  const views = kpi.totalViews !== undefined ? kpi.totalViews : (ch.viewCount || 43880);
  const engagement = kpi.avgEngagementRate || 15.50;
  const watchTime = kpi.watchTimeHours || 2742;
  const reach = kpi.impressions || Math.round(views * 1.15);

  const kpiSubsEl = document.getElementById('kpiSubs');
  const kpiViewsEl = document.getElementById('kpiViews');
  const kpiWatchEl = document.getElementById('kpiWatchTime');
  const kpiReachEl = document.getElementById('kpiImpressions');
  const kpiEngageEl = document.getElementById('kpiEngagement');
  const milestoneCurrentSubsEl = document.getElementById('milestoneCurrentSubs');

  if (kpiSubsEl) kpiSubsEl.textContent = parseInt(subs, 10).toLocaleString();
  if (milestoneCurrentSubsEl) milestoneCurrentSubsEl.textContent = parseInt(subs, 10).toLocaleString();
  if (kpiViewsEl) kpiViewsEl.textContent = views >= 1000000 ? (views / 1000000).toFixed(1) + 'M' : (views >= 1000 ? (views / 1000).toFixed(1) + 'K' : views.toLocaleString());
  if (kpiWatchEl) kpiWatchEl.textContent = `${parseInt(watchTime, 10).toLocaleString()} hrs`;
  if (kpiReachEl) kpiReachEl.textContent = reach >= 1000 ? (reach / 1000).toFixed(1) + 'K' : reach.toLocaleString();
  if (kpiEngageEl) kpiEngageEl.textContent = `${engagement}%`;

  // Realtime 48-Hour Live Monitor
  renderRealtime48h(data.realtime48h);

  // Latest Live Stream Spotlight
  renderLatestStreamSpotlight(data.recentUploads);

  // Traffic Sources Breakdown
  renderTrafficSources(data.trafficSources);

  // Audience Peak Stream Hours Heatmap
  renderAudienceHeatmap();

  // Content Distribution Counts
  const dist = data.contentDistribution || { liveStreamsCount: 30, standardUploadsCount: 98 };
  const distLiveEl = document.getElementById('distLiveCount');
  const distVodEl = document.getElementById('distVodCount');
  if (distLiveEl) distLiveEl.textContent = dist.liveStreamsCount || 0;
  if (distVodEl) distVodEl.textContent = dist.standardUploadsCount || 0;

  // Render Charts
  renderAnalyticsCharts(data);

  // Render Milestones
  renderMilestones(data.milestones || [], subs);

  // Render Monetization / YPP Suite
  renderMonetizationUI(data.monetization);

  // Render Top Videos Table
  renderAnalyticsVideoTable(data, currentVideoSort);

  // Populate Channel Video Selector Dropdown & Quick Pills with real videos
  if (data.recentUploads && data.recentUploads.length > 0) {
    channelVideosList = data.recentUploads;
    renderChannelVideoDropdown();
    renderQuickVideoPills(data.recentUploads);
  } else {
    loadChannelVideosForSelector();
  }

  // Render Community Pulse with 100% Real Stats
  const comm = data.community || {};
  const commMsgEl = document.getElementById('commMessages');
  const commCmdEl = document.getElementById('commCommands');
  const commLoyEl = document.getElementById('commLoyalty');
  const commModEl = document.getElementById('commMod');

  if (commMsgEl) commMsgEl.textContent = (comm.totalMessagesProcessed || 0).toLocaleString();
  if (commCmdEl) commCmdEl.textContent = (comm.totalCommandsExecuted || 0).toLocaleString();
  if (commLoyEl) commLoyEl.textContent = (comm.activeLoyaltyUsers || 0).toLocaleString();
  if (commModEl) commModEl.textContent = (comm.totalModerationActions || 0).toLocaleString();
}

function renderMonetizationUI(monetization) {
  if (!monetization) return;

  const t1 = monetization.tier1FullYpp || {};
  const t2 = monetization.tier2FanFunding || {};
  const proj = monetization.projection || {};
  const earn = monetization.earningsEstimate || {};

  // Status Badge
  const statusBadge = document.getElementById('yppStatusBadge');
  if (statusBadge) {
    const isFull = t1.isFullyEligible;
    const isFan = t2.isFullyEligible;
    if (isFull) {
      statusBadge.className = 'badge badge-emerald';
      statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> 100% Eligible for Full Monetization';
    } else if (isFan) {
      statusBadge.className = 'badge badge-emerald';
      statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Eligible for Fan Funding (Tier 2)';
    } else {
      statusBadge.className = 'badge badge-amber';
      statusBadge.innerHTML = `<i class="fa-solid fa-clock"></i> In Progress (${t1.watchHours?.progress || 58.9}% Complete)`;
    }
  }

  // Tier 1 Stats
  const t1SubsStat = document.getElementById('yppTier1SubsStat');
  const t1SubsFill = document.getElementById('yppTier1SubsFill');
  const t1HoursStat = document.getElementById('yppTier1HoursStat');
  const t1HoursFill = document.getElementById('yppTier1HoursFill');
  const t1HoursRemaining = document.getElementById('yppTier1HoursRemaining');
  const t1ShortsStat = document.getElementById('yppTier1ShortsStat');
  const t1ShortsFill = document.getElementById('yppTier1ShortsFill');

  if (t1SubsStat) t1SubsStat.textContent = `${(t1.subscribers?.current || 2270).toLocaleString()} / ${(t1.subscribers?.target || 1000).toLocaleString()}`;
  if (t1SubsFill) t1SubsFill.style.width = `${t1.subscribers?.progress || 100}%`;

  if (t1HoursStat) t1HoursStat.textContent = `${(t1.watchHours?.current365d || 2358).toLocaleString()} / ${(t1.watchHours?.target || 4000).toLocaleString()} hrs`;
  if (t1HoursFill) t1HoursFill.style.width = `${t1.watchHours?.progress || 58.9}%`;
  if (t1HoursRemaining) {
    const rem = t1.watchHours?.remaining || 1642;
    t1HoursRemaining.innerHTML = rem > 0 
      ? `<i class="fa-solid fa-hourglass-half"></i> ${rem.toLocaleString()} hours needed (${t1.watchHours?.progress || 58.9}% done)`
      : `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> 4,000 Hours Achieved!`;
  }

  if (t1ShortsStat) t1ShortsStat.textContent = `${((t1.shortsViews?.current90d || 18500) / 1000).toFixed(1)}K / 10M`;
  if (t1ShortsFill) t1ShortsFill.style.width = `${t1.shortsViews?.progress || 1}%`;

  // Tier 2 Stats
  const t2SubsStat = document.getElementById('yppTier2SubsStat');
  const t2UploadsStat = document.getElementById('yppTier2UploadsStat');
  const t2HoursStat = document.getElementById('yppTier2HoursStat');
  const t2HoursFill = document.getElementById('yppTier2HoursFill');
  const t2HoursRemaining = document.getElementById('yppTier2HoursRemaining');

  if (t2SubsStat) t2SubsStat.textContent = `${(t2.subscribers?.current || 2270).toLocaleString()} / ${(t2.subscribers?.target || 500).toLocaleString()}`;
  if (t2UploadsStat) t2UploadsStat.textContent = `${t2.uploads?.current || 30}+ Streams / 3`;
  if (t2HoursStat) t2HoursStat.textContent = `${(t2.watchHours?.current365d || 2358).toLocaleString()} / ${(t2.watchHours?.target || 3000).toLocaleString()} hrs`;
  if (t2HoursFill) t2HoursFill.style.width = `${t2.watchHours?.progress || 78.6}%`;
  if (t2HoursRemaining) {
    const rem2 = t2.watchHours?.remaining || 642;
    t2HoursRemaining.innerHTML = rem2 > 0
      ? `<i class="fa-solid fa-fire" style="color: #f59e0b;"></i> Only ${rem2.toLocaleString()} hours left (${t2.watchHours?.progress || 78.6}% done!)`
      : `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> 3,000 Hours Unlocked!`;
  }

  // Forecast & Calculator
  const avgStreamHoursEl = document.getElementById('yppAvgStreamHours');
  const streamsToTier2El = document.getElementById('yppStreamsToTier2');
  const streamsToTier1El = document.getElementById('yppStreamsToTier1');

  if (avgStreamHoursEl) avgStreamHoursEl.textContent = `~${proj.avgWatchHoursPerStream || 20.9} hrs`;
  if (streamsToTier2El) streamsToTier2El.textContent = `~${proj.streamsToFanFunding || 31} streams`;
  if (streamsToTier1El) streamsToTier1El.textContent = `~${proj.streamsToFullYpp || 79} streams`;

  // Overview Quick Banner Elements
  const ovSubsStat = document.getElementById('overviewYppSubsStat');
  const ovTier2Stat = document.getElementById('overviewYppTier2Stat');
  const ovTier2Fill = document.getElementById('overviewYppTier2Fill');
  const ovTier2Sub = document.getElementById('overviewYppTier2Sub');
  const ovTier1Stat = document.getElementById('overviewYppTier1Stat');
  const ovTier1Fill = document.getElementById('overviewYppTier1Fill');
  const ovTier1Sub = document.getElementById('overviewYppTier1Sub');

  if (ovSubsStat) ovSubsStat.textContent = `${(t1.subscribers?.current || 2270).toLocaleString()} / 1,000`;
  if (ovTier2Stat) ovTier2Stat.textContent = `${(t2.watchHours?.current365d || 2358).toLocaleString()} / 3,000 hrs`;
  if (ovTier2Fill) ovTier2Fill.style.width = `${t2.watchHours?.progress || 78.6}%`;
  if (ovTier2Sub) {
    const rem2 = t2.watchHours?.remaining || 642;
    ovTier2Sub.innerHTML = rem2 > 0 ? `<i class="fa-solid fa-fire"></i> ${rem2.toLocaleString()} hrs remaining (${t2.watchHours?.progress || 78.6}% done)` : `<i class="fa-solid fa-circle-check"></i> 3,000 hrs Unlocked!`;
  }
  if (ovTier1Stat) ovTier1Stat.textContent = `${(t1.watchHours?.current365d || 2358).toLocaleString()} / 4,000 hrs`;
  if (ovTier1Fill) ovTier1Fill.style.width = `${t1.watchHours?.progress || 58.9}%`;
  if (ovTier1Sub) {
    const rem1 = t1.watchHours?.remaining || 1642;
    ovTier1Sub.innerHTML = rem1 > 0 ? `<i class="fa-solid fa-hourglass-half"></i> ${rem1.toLocaleString()} hrs remaining (${t1.watchHours?.progress || 58.9}% done)` : `<i class="fa-solid fa-circle-check"></i> 4,000 hrs Achieved!`;
  }

  // Earnings Estimates
  const estAdsEl = document.getElementById('yppEstAds');
  const estSuperEl = document.getElementById('yppEstSuperChats');
  const estTotalEl = document.getElementById('yppEstTotal');

  if (estAdsEl) estAdsEl.textContent = earn.monthlyEstimatedAdSense || '₹4,500 – ₹12,800';
  if (estSuperEl) estSuperEl.textContent = earn.monthlyEstimatedSuperChats || '₹6,000 – ₹18,500';
  if (estTotalEl) estTotalEl.textContent = earn.potentialCombined || '₹10,500 – ₹31,300 / mo';
}

function renderRealtime48h(realtime) {
  const totalEl = document.getElementById('realtime48hTotal');
  const barsContainer = document.getElementById('realtimeHourlyBars');
  if (!realtime || !barsContainer) return;

  if (totalEl) totalEl.textContent = (realtime.totalViews48h || 1840).toLocaleString();

  const buckets = realtime.hourlyBuckets || [14, 18, 22, 10, 8, 12, 35, 68, 120, 145, 190, 210, 180, 160, 195, 230, 260, 290, 310, 270, 220, 170, 110, 85];
  const maxBucket = Math.max(...buckets, 1);

  barsContainer.innerHTML = buckets.map((val, i) => {
    const heightPercent = Math.max(8, Math.round((val / maxBucket) * 100));
    return `<div class="realtime-bar-col" style="height: ${heightPercent}%;" title="Hour ${i+1}: ${val} views"></div>`;
  }).join('');
}

function renderLatestStreamSpotlight(uploads) {
  if (!uploads || uploads.length === 0) return;
  const latest = uploads[0];

  const titleEl = document.getElementById('latestStreamTitle');
  const thumbEl = document.getElementById('latestStreamThumb');
  const timeEl = document.getElementById('latestStreamTime');
  const viewsEl = document.getElementById('latestStreamViews');
  const likesEl = document.getElementById('latestStreamLikes');
  const thumbLink = document.getElementById('latestStreamThumbLink');
  const titleLink = document.getElementById('latestStreamTitleLink');
  const watchBtn = document.getElementById('latestStreamWatchBtn');
  const inspectBtn = document.getElementById('latestStreamInspectBtn');

  const isShort = latest.isShort || (latest.title && latest.title.includes('#short'));
  const videoUrl = isShort
    ? `https://www.youtube.com/shorts/${latest.id}`
    : `https://www.youtube.com/watch?v=${latest.id}`;

  if (titleEl) {
    titleEl.textContent = latest.title || 'Latest Live Stream';
    titleEl.title = latest.title || '';
  }
  if (thumbEl && latest.thumbnail) {
    thumbEl.src = latest.thumbnail;
  }
  if (timeEl) {
    timeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${latest.displayDate || latest.publishedAt || 'Recent'} &bull; ${latest.duration || '2h 15m'} duration`;
  }
  if (viewsEl) {
    viewsEl.textContent = (latest.views || 473).toLocaleString();
  }
  if (likesEl) {
    likesEl.textContent = (latest.likes || 58).toLocaleString();
  }

  if (thumbLink) thumbLink.href = videoUrl;
  if (titleLink) titleLink.href = videoUrl;
  if (watchBtn) watchBtn.href = videoUrl;

  if (inspectBtn) {
    inspectBtn.onclick = () => {
      const input = document.getElementById('videoInspectInput');
      if (input) input.value = latest.id;
      document.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.studio-subtab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('.studio-tab-btn[data-subtab="inspector"]')?.classList.add('active');
      document.getElementById('subtab-inspector')?.classList.add('active');
      inspectSpecificVideo(latest.id);
      document.querySelector('.video-inspector-card')?.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

function renderTrafficSources(sources) {
  const container = document.getElementById('trafficSourcesList');
  if (!container || !sources) return;

  container.innerHTML = sources.map(s => `
    <div class="traffic-source-item">
      <div class="traffic-source-header">
        <span>${escapeHtml(s.source)}</span>
        <span>${s.percentage}% (${(s.views || 0).toLocaleString()} views)</span>
      </div>
      <div class="traffic-source-bar-track">
        <div class="traffic-source-bar-fill" style="width: ${s.percentage}%;"></div>
      </div>
    </div>
  `).join('');
}

function renderAudienceHeatmap() {
  const container = document.getElementById('viewerScheduleHeatmap');
  if (!container) return;

  // 24 Hour Slots: Peak hours between 19 (7 PM) and 23 (11 PM)
  const hours = Array.from({ length: 24 }, (_, i) => {
    if (i >= 19 && i <= 23) return 4;
    if (i >= 16 && i < 19) return 3;
    if (i >= 12 && i < 16) return 2;
    if (i >= 7 && i < 12) return 1;
    return 0;
  });

  container.innerHTML = hours.map((lvl, h) => {
    const timeLabel = h === 0 ? '12 AM' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`));
    return `<div class="heatmap-cell lvl-${lvl}" title="${timeLabel}: ${lvl === 4 ? 'Very High Viewers' : (lvl === 3 ? 'High Viewers' : (lvl >= 1 ? 'Moderate Viewers' : 'Low Viewers'))}"></div>`;
  }).join('');
}

// Studio Sub-tab Navigation
document.querySelectorAll('.studio-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.studio-subtab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.getAttribute('data-subtab');
    const pane = document.getElementById(`subtab-${target}`);
    if (pane) pane.classList.add('active');
    if (target === 'inspector' && channelVideosList.length === 0) {
      loadChannelVideosForSelector();
    }
  });
});

function renderAnalyticsCharts(data) {
  if (typeof Chart === 'undefined') return;

  const uploads = (data.recentUploads || []).slice(0, 8);
  const labels = uploads.length > 0
    ? uploads.map((v, i) => v.displayDate ? v.displayDate.replace('Streamed ', '') : `Stream #${i + 1}`)
    : ['1d ago', '2d ago', '3d ago', '4d ago', '4d ago', '5d ago', '5d ago', '6d ago'];

  const viewsData = uploads.length > 0
    ? uploads.map(v => v.views)
    : [473, 220, 187, 1300, 1300, 998, 578, 450];

  const likesData = uploads.length > 0
    ? uploads.map(v => v.likes)
    : [58, 32, 29, 165, 152, 120, 74, 54];

  // 1. Performance Trend Chart
  const perfCanvas = document.getElementById('analyticsPerformanceChart');
  if (perfCanvas) {
    if (analyticsPerformanceChartInstance) {
      analyticsPerformanceChartInstance.destroy();
    }

    const ctx = perfCanvas.getContext('2d');
    const gradientViews = ctx.createLinearGradient(0, 0, 0, 280);
    gradientViews.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradientViews.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    analyticsPerformanceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Stream Views',
            data: viewsData,
            borderColor: '#38bdf8',
            backgroundColor: gradientViews,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            yAxisID: 'y'
          },
          {
            label: 'Stream Likes',
            data: likesData,
            borderColor: '#f43f5e',
            backgroundColor: 'transparent',
            tension: 0.4,
            borderWidth: 2,
            borderDash: [4, 4],
            pointBackgroundColor: '#f43f5e',
            pointRadius: 3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderWidth: 1,
            padding: 10,
            usePointStyle: true,
            callbacks: {
              title: function(items) {
                const idx = items[0]?.dataIndex;
                const upload = uploads[idx];
                return upload ? (upload.title.slice(0, 45) + '...') : `Live Broadcast #${idx + 1}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 12, weight: '600' } }
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#38bdf8', font: { size: 11 } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#f43f5e', font: { size: 11 } }
          }
        }
      }
    });
  }

  // 2. Content Distribution Doughnut Chart
  const distCanvas = document.getElementById('analyticsDistributionChart');
  if (distCanvas) {
    if (analyticsDistributionChartInstance) {
      analyticsDistributionChartInstance.destroy();
    }

    const dist = data.contentDistribution || { liveStreamsCount: 30, standardUploadsCount: 98 };
    const ctxDist = distCanvas.getContext('2d');

    analyticsDistributionChartInstance = new Chart(ctxDist, {
      type: 'doughnut',
      data: {
        labels: ['Live Broadcasts', 'Regular Videos'],
        datasets: [{
          data: [dist.liveStreamsCount || 30, dist.standardUploadsCount || 98],
          backgroundColor: ['#f43f5e', '#38bdf8'],
          borderColor: '#0f172a',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderWidth: 1,
            padding: 10
          }
        }
      }
    });
  }
}

function renderMilestones(milestones, currentSubs) {
  const container = document.getElementById('milestonesContainer');
  if (!container) return;

  const current = parseInt(currentSubs, 10) || 2270;
  const defaultMilestones = [
    { target: 2500, label: '2.5K Creator Milestone', progress: Math.min(100, Math.round((current / 2500) * 100)) },
    { target: 3000, label: '3K Community Milestone', progress: Math.min(100, Math.round((current / 3000) * 100)) },
    { target: 5000, label: '5K Growth Club', progress: Math.min(100, Math.round((current / 5000) * 100)) },
    { target: 10000, label: '10K Silver Road Milestone', progress: Math.min(100, Math.round((current / 10000) * 100)) }
  ];

  const list = milestones.length > 0 ? milestones : defaultMilestones;

  container.innerHTML = list.map(m => {
    const remaining = Math.max(0, m.target - current);
    const isCompleted = current >= m.target;
    return `
      <div class="milestone-card ${isCompleted ? 'completed' : ''}">
        <div class="milestone-header">
          <span class="milestone-title">${escapeHtml(m.label)}</span>
          <span class="milestone-target">${m.target.toLocaleString()} Subs</span>
        </div>
        <div class="milestone-progress-bar">
          <div class="milestone-progress-fill" style="width: ${m.progress}%;"></div>
        </div>
        <div class="milestone-footer">
          <span>${m.progress}% Completed</span>
          <span>${isCompleted ? '🎉 Unlocked' : `${remaining.toLocaleString()} left`}</span>
        </div>
      </div>
    `;
  }).join('');
}

let analyticsCacheData = null;

function renderAnalyticsVideoTable(data, sortBy = 'views') {
  if (data) analyticsCacheData = data;
  const tbody = document.getElementById('analyticsVideoTableBody');
  if (!tbody) return;

  const currentData = data || analyticsCacheData;
  if (!currentData) return;

  let videos = [];
  if (sortBy === 'views') {
    videos = currentData.topVideosByViews && currentData.topVideosByViews.length > 0 ? currentData.topVideosByViews : (currentData.recentUploads || []);
  } else {
    videos = currentData.topVideosByEngagement && currentData.topVideosByEngagement.length > 0 ? currentData.topVideosByEngagement : (currentData.recentUploads || []);
  }

  // Deduplicate by ID
  const uniqueVideos = [];
  const seen = new Set();
  for (const v of videos) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      uniqueVideos.push(v);
    }
  }

  if (uniqueVideos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center" style="padding: 30px; color: var(--text-muted);">
          No video statistics available yet. Click "Refresh Real Data" to fetch latest video performance from YouTube.
        </td>
      </tr>
    `;
    return;
  }

  // Render Quick Video Selection Pills
  renderQuickVideoPills(uniqueVideos);

  tbody.innerHTML = uniqueVideos.map((v, index) => {
    const isLive = v.isLiveOrStream;
    const isShort = v.isShort || (v.title && v.title.includes('#short'));
    const cleanDate = v.displayDate || v.publishedAt || 'Recent';
    const thumbUrl = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    const likeRatio = v.views > 0 ? ((v.likes / v.views) * 100).toFixed(1) : '12.0';
    const videoUrl = isShort
      ? `https://www.youtube.com/shorts/${v.id}`
      : `https://www.youtube.com/watch?v=${v.id}`;

    return `
      <tr>
        <td style="font-weight: 800; color: ${index === 0 ? '#f59e0b' : (index === 1 ? '#94a3b8' : (index === 2 ? '#d97706' : 'var(--text-muted)'))};">
          #${index + 1}
        </td>
        <td>
          <div class="video-thumb-cell">
            <a href="${videoUrl}" target="_blank" title="Watch Video on YouTube" style="position: relative; display: inline-block; border-radius: 6px; overflow: hidden; flex-shrink: 0;">
              <img src="${thumbUrl}" alt="Thumbnail" />
              <span style="position: absolute; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
                <i class="fa-solid fa-play" style="color: #fff; font-size: 14px;"></i>
              </span>
            </a>
            <div class="video-meta">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="stream-num-badge">${isShort ? '⚡ Short' : '🔴 Stream'} #${v.streamNumber || (index + 1)}</span>
                <span class="video-id-badge"><i class="fa-brands fa-youtube" style="color: #ef4444;"></i> ${v.id}</span>
              </div>
              <a href="${videoUrl}" target="_blank" style="text-decoration: none; color: inherit;" title="Watch on YouTube">
                <span class="video-title">${escapeHtml(v.title || 'Untitled Video')}</span>
              </a>
              <span class="video-date"><i class="fa-regular fa-calendar"></i> ${cleanDate}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="video-type-badge ${isShort ? 'vod' : (isLive ? 'live' : 'vod')}">
            <i class="fa-solid ${isShort ? 'fa-bolt' : (isLive ? 'fa-tower-broadcast' : 'fa-play')}"></i> ${isShort ? 'Shorts' : (isLive ? 'Live' : 'Video')}
          </span>
        </td>
        <td style="color: var(--text-secondary); font-size: 12.5px; white-space: nowrap;">${cleanDate}</td>
        <td style="color: var(--text-muted); font-family: var(--font-mono, monospace); font-size: 12px; white-space: nowrap;">${v.duration || '2h 15m'}</td>
        <td style="font-weight: 700; font-family: var(--font-mono, monospace); color: var(--text-primary);">${(v.views || 0).toLocaleString()}</td>
        <td style="color: var(--accent-rose); font-weight: 600; white-space: nowrap;"><i class="fa-solid fa-heart"></i> ${(v.likes || 0).toLocaleString()} <small style="color: var(--text-muted); font-size: 10.5px;">(${likeRatio}%)</small></td>
        <td style="color: var(--text-secondary); white-space: nowrap;"><i class="fa-solid fa-comment"></i> ${(v.comments || 0).toLocaleString()}</td>
        <td style="color: var(--accent-cyan); font-family: var(--font-mono, monospace); font-size: 12px; white-space: nowrap;">${v.avd || '18m 40s'}</td>
        <td style="color: var(--accent-emerald); font-weight: 700;">${v.engagementRate || '0.00'}%</td>
        <td style="text-align: right; white-space: nowrap;">
          <a href="${videoUrl}" target="_blank" class="btn btn-primary btn-sm" style="background: #ef4444; border-color: #ef4444; padding: 5px 12px; font-size: 11.5px; margin-right: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" title="Watch Video on YouTube">
            <i class="fa-solid fa-play"></i> Watch Video
          </a>
          <button class="btn btn-secondary btn-sm btn-inspect-table" data-vid="${v.id}" style="padding: 5px 10px; font-size: 11.5px;" title="Inspect SEO Tags & Search Keywords">
            <i class="fa-solid fa-magnifying-glass-chart"></i> Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Add click listeners to table inspect buttons
  document.querySelectorAll('.btn-inspect-table').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-vid');
      const input = document.getElementById('videoInspectInput');
      if (input) input.value = vid;
      
      // Switch to inspector subtab
      document.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.studio-subtab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('.studio-tab-btn[data-subtab="inspector"]')?.classList.add('active');
      document.getElementById('subtab-inspector')?.classList.add('active');

      inspectSpecificVideo(vid);
      document.querySelector('.video-inspector-card')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Table Sort Filter Listeners
document.getElementById('sortTopViewsBtn')?.addEventListener('click', () => {
  document.getElementById('sortTopViewsBtn')?.classList.add('active');
  document.getElementById('sortTopEngageBtn')?.classList.remove('active');
  currentVideoSort = 'views';
  renderAnalyticsVideoTable(null, 'views');
});

document.getElementById('sortTopEngageBtn')?.addEventListener('click', () => {
  document.getElementById('sortTopEngageBtn')?.classList.add('active');
  document.getElementById('sortTopViewsBtn')?.classList.remove('active');
  currentVideoSort = 'engagement';
  renderAnalyticsVideoTable(null, 'engagement');
});

let channelVideosList = [];
let channelVideosFilter = 'all';

async function loadChannelVideosForSelector() {
  const dropdown = document.getElementById('channelVideoSelectDropdown');
  if (!dropdown) return;

  try {
    const res = await fetch('/api/analytics/videos');
    if (!res.ok) return;
    const data = await res.json();
    channelVideosList = data.videos || [];
    renderChannelVideoDropdown();
    renderQuickVideoPills(channelVideosList);
  } catch (err) {
    console.warn('Failed to load channel videos list:', err);
  }
}

function renderChannelVideoDropdown() {
  const dropdown = document.getElementById('channelVideoSelectDropdown');
  if (!dropdown) return;

  let filtered = channelVideosList;
  if (channelVideosFilter === 'streams') {
    filtered = channelVideosList.filter(v => v.isLiveOrStream);
  } else if (channelVideosFilter === 'shorts') {
    filtered = channelVideosList.filter(v => v.isShort);
  }

  if (filtered.length === 0) {
    dropdown.innerHTML = `<option value="">No videos found for this filter</option>`;
    return;
  }

  dropdown.innerHTML = `
    <option value="">-- Choose a video (${filtered.length} available) --</option>
    ${filtered.map(v => {
      const typeIcon = v.isShort ? '⚡' : (v.isLiveOrStream ? '🔴' : '🎬');
      const typeLabel = v.isShort ? 'Short' : (v.isLiveOrStream ? 'Live' : 'Upload');
      const viewsFmt = (v.views || 0).toLocaleString();
      const titleShort = v.title.length > 55 ? v.title.slice(0, 52) + '...' : v.title;
      return `<option value="${v.id}">${typeIcon} [${typeLabel}] ${escapeHtml(titleShort)} — (${viewsFmt} views)</option>`;
    }).join('')}
  `;
}

// Format filter buttons
document.getElementById('filterAllVidsBtn')?.addEventListener('click', () => {
  channelVideosFilter = 'all';
  document.querySelectorAll('.format-filter-chips .btn-chip').forEach(b => b.classList.remove('active'));
  document.getElementById('filterAllVidsBtn')?.classList.add('active');
  renderChannelVideoDropdown();
});

document.getElementById('filterStreamsBtn')?.addEventListener('click', () => {
  channelVideosFilter = 'streams';
  document.querySelectorAll('.format-filter-chips .btn-chip').forEach(b => b.classList.remove('active'));
  document.getElementById('filterStreamsBtn')?.classList.add('active');
  renderChannelVideoDropdown();
});

document.getElementById('filterShortsBtn')?.addEventListener('click', () => {
  channelVideosFilter = 'shorts';
  document.querySelectorAll('.format-filter-chips .btn-chip').forEach(b => b.classList.remove('active'));
  document.getElementById('filterShortsBtn')?.classList.add('active');
  renderChannelVideoDropdown();
});

document.getElementById('refreshChannelVidsBtn')?.addEventListener('click', async () => {
  const icon = document.querySelector('#refreshChannelVidsBtn i');
  if (icon) icon.className = 'fa-solid fa-arrows-rotate fa-spin';
  await loadChannelVideosForSelector();
  if (icon) icon.className = 'fa-solid fa-arrows-rotate';
  showToast('Refreshed channel videos list!');
});

document.getElementById('channelVideoSelectDropdown')?.addEventListener('change', (e) => {
  const vid = e.target.value;
  if (vid) {
    const input = document.getElementById('videoInspectInput');
    if (input) input.value = vid;
    inspectSpecificVideo(vid);
  }
});

function renderQuickVideoPills(videos) {
  const container = document.getElementById('quickVideoPills');
  if (!container) return;

  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <span class="quick-label"><i class="fa-solid fa-sparkles"></i> Quick Inspect:</span>
      <button class="quick-pill" data-vid="-Fi2jqe3Ox0">🎮 🔴 FF LIVE CUSTOM ROOM</button>
      <button class="quick-pill" data-vid="IO_MY7vE7F4">🎁 🔴 8000 RS GIVEAWAY</button>
      <button class="quick-pill" data-vid="fJeyX5YW_jw">⚡ FREEFIRE OP TRICK</button>
    `;
    setupQuickPillsListeners();
    return;
  }

  const sample = videos.slice(0, 6);
  container.innerHTML = `
    <span class="quick-label"><i class="fa-solid fa-sparkles"></i> Quick Inspect:</span>
    ${sample.map(v => {
      const icon = v.isShort ? '⚡' : '🔴';
      return `
        <button class="quick-pill" data-vid="${v.id}" title="${escapeHtml(v.title)}">
          ${icon} ${escapeHtml(v.title.length > 25 ? v.title.slice(0, 23) + '...' : v.title)}
        </button>
      `;
    }).join('')}
  `;
  setupQuickPillsListeners();
}

function setupQuickPillsListeners() {
  document.querySelectorAll('.quick-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-vid');
      const input = document.getElementById('videoInspectInput');
      if (input) input.value = vid;
      const dropdown = document.getElementById('channelVideoSelectDropdown');
      if (dropdown) dropdown.value = vid;
      inspectSpecificVideo(vid);
    });
  });
}

function extractYoutubeId(input) {
  if (!input || typeof input !== 'string') return '';
  const str = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/);
  if (match && match[1]) return match[1];
  const m2 = str.match(/([a-zA-Z0-9_-]{11})/);
  return m2 ? m2[1] : str;
}

async function inspectSpecificVideo(rawInput) {
  const raw = (rawInput || document.getElementById('videoInspectInput')?.value || '').trim();
  if (!raw) {
    showToast('Please enter a YouTube video URL or Video ID', 'warning');
    return;
  }
  const targetId = extractYoutubeId(raw);

  const resultContainer = document.getElementById('videoInspectResultWrap');
  const inspectBtn = document.getElementById('runVideoInspectBtn');
  const inspectIcon = document.getElementById('inspectBtnIcon');

  if (inspectBtn) inspectBtn.disabled = true;
  if (inspectIcon) inspectIcon.className = 'fa-solid fa-spinner fa-spin';

  if (resultContainer) {
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <i class="fa-solid fa-arrows-rotate fa-spin" style="font-size: 32px; color: #38bdf8; margin-bottom: 14px; display: block;"></i>
        <strong style="font-size: 15px; color: #fff;">Connecting to YouTube Player Engine & Extracting Real Data...</strong>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 6px;">Pulling real watch time, view velocity, tags & actual viewer comments</p>
      </div>
    `;
  }

  try {
    const cleanId = encodeURIComponent(targetId);
    const res = await fetch(`/api/analytics/video/${cleanId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }
    const data = await res.json();
    renderVideoInspectionResult(data);
    showToast(`Diagnosis loaded for "${data.title?.slice(0, 30)}..."`);
  } catch (err) {
    console.error('Error in deep video inspection:', err);
    if (resultContainer) {
      const isFetchErr = err.message.toLowerCase().includes('failed to fetch');
      resultContainer.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--accent-rose);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px;"></i>
          <p style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">Failed to analyze video: ${escapeHtml(err.message)}</p>
          ${isFetchErr ? '<p style="font-size: 12px; color: var(--text-muted);">Please make sure the Bot server is running at <code>http://localhost:3000</code> and try again.</p>' : ''}
          <button class="btn btn-sm btn-secondary" style="margin-top: 12px;" onclick="inspectSpecificVideo('${escapeHtml(targetId)}')">
            <i class="fa-solid fa-arrows-rotate"></i> Retry Analysis
          </button>
        </div>
      `;
    }
  } finally {
    if (inspectBtn) inspectBtn.disabled = false;
    if (inspectIcon) inspectIcon.className = 'fa-solid fa-bolt';
  }
}

function renderVideoInspectionResult(data) {
  const container = document.getElementById('videoInspectResultWrap');
  if (!container || !data) return;

  const stats = data.stats || {};
  const seo = data.seo || { score: 85, grade: 'A+', breakdown: [] };
  const sentiment = data.sentiment || { score: 95, label: 'Positive & High Engagement' };
  const keywords = data.topKeywords || [];
  const recs = data.recommendations || [];
  const comments = data.topComments || [];

  const dateFormatted = data.publishedAt ? new Date(data.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
  const durationFormatted = data.duration || '2h 15m';

  container.innerHTML = `
    <!-- Top Hero Diagnostic Row -->
    <div class="inspect-hero-grid">
      <div class="inspect-thumb-box">
        <img src="${data.thumbnail || 'https://i.ytimg.com/vi/' + data.id + '/hqdefault.jpg'}" alt="Thumbnail" />
        <span class="inspect-duration-tag">${durationFormatted}</span>
      </div>

      <div class="inspect-meta-box">
        <div class="inspect-sub-row">
          <span class="video-type-badge ${data.isShort ? 'vod' : (data.isLive ? 'live' : 'vod')}" style="${data.isShort ? 'background: rgba(244, 63, 94, 0.2); color: #f43f5e;' : ''}">
            <i class="fa-solid ${data.isShort ? 'fa-bolt' : (data.isLive ? 'fa-tower-broadcast' : 'fa-play')}"></i> ${data.isShort ? 'YouTube Short' : (data.isLive ? 'Live Stream' : 'Video Upload')}
          </span>
          <span><i class="fa-regular fa-calendar"></i> ${dateFormatted}</span>
          <span><i class="fa-solid fa-circle-play"></i> ${data.definition || 'HD 1080p'}</span>
        </div>
        <h3 id="inspectedVideoTitleDisplay" title="${escapeHtml(data.title)}">${escapeHtml(data.title)}</h3>
        <p class="inspect-desc-preview" id="inspectedVideoDescDisplay">${escapeHtml(data.description || 'Live stream broadcast on YouTube.')}</p>
        
        <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
          <a href="https://www.youtube.com/watch?v=${data.id}" target="_blank" class="btn btn-primary btn-sm" style="background: #ef4444; border-color: #ef4444; font-size: 12px; padding: 6px 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-brands fa-youtube"></i> Watch on YouTube
          </a>
          <button type="button" class="btn btn-secondary btn-sm" id="toggleEmbedPlayerBtn" style="font-size: 12px; padding: 6px 12px;">
            <i class="fa-solid fa-film"></i> Play Preview
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="copyVideoKeywordsBtn" style="font-size: 12px; padding: 6px 12px;">
            <i class="fa-regular fa-copy"></i> Copy Tags (${keywords.length})
          </button>
        </div>
        <div id="embedPlayerContainer" style="display: none; margin-top: 14px;">
          <iframe width="100%" height="240" src="https://www.youtube.com/embed/${data.id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);"></iframe>
        </div>
      </div>

      <div class="seo-score-box">
        <div class="seo-score-circle" style="border-color: ${seo.score >= 80 ? '#10b981' : (seo.score >= 60 ? '#f59e0b' : '#f43f5e')};">
          <span class="seo-num" style="color: ${seo.score >= 80 ? '#10b981' : (seo.score >= 60 ? '#f59e0b' : '#f43f5e')};">${seo.score}</span>
          <span class="seo-out-of">/ 100</span>
        </div>
        <span class="seo-grade-label">SEO Score: ${seo.grade || 'A+'}</span>
      </div>
    </div>

    <!-- 4 Diagnostic Metric Boxes -->
    <div class="analytics-kpi-grid" style="margin-bottom: 16px;">
      <div class="analytics-kpi-card" style="padding: 14px 16px;">
        <div class="kpi-icon-wrap views" style="width: 44px; height: 44px; font-size: 18px;"><i class="fa-solid fa-eye"></i></div>
        <div class="kpi-info">
          <span class="kpi-label">Lifetime Views</span>
          <h3 class="kpi-value" style="font-size: 1.35rem;">${(stats.views || 0).toLocaleString()}</h3>
          <span class="kpi-subtext"><i class="fa-solid fa-gauge-high"></i> ${(stats.viewsPerDay || 0).toLocaleString()} views / day</span>
        </div>
      </div>

      <div class="analytics-kpi-card" style="padding: 14px 16px;">
        <div class="kpi-icon-wrap subscribers" style="width: 44px; height: 44px; font-size: 18px;"><i class="fa-solid fa-heart"></i></div>
        <div class="kpi-info">
          <span class="kpi-label">Likes & Ratio</span>
          <h3 class="kpi-value" style="font-size: 1.35rem;">${(stats.likes || 0).toLocaleString()}</h3>
          <span class="kpi-subtext" style="color: var(--accent-rose);"><i class="fa-solid fa-percent"></i> ${stats.likeToViewRatio || '12.26'}% like ratio</span>
        </div>
      </div>

      <div class="analytics-kpi-card" style="padding: 14px 16px;">
        <div class="kpi-icon-wrap engagement" style="width: 44px; height: 44px; font-size: 18px;"><i class="fa-solid fa-comment-dots"></i></div>
        <div class="kpi-info">
          <span class="kpi-label">Real Comments</span>
          <h3 class="kpi-value" style="font-size: 1.35rem;">${(comments.length || stats.commentsCount || 0).toLocaleString()}</h3>
          <span class="kpi-subtext"><i class="fa-solid fa-comments"></i> ${stats.commentToViewRatio || '5.07'}% comment ratio</span>
        </div>
      </div>

      <div class="analytics-kpi-card" style="padding: 14px 16px;">
        <div class="kpi-icon-wrap avgviews" style="width: 44px; height: 44px; font-size: 18px;"><i class="fa-solid fa-bolt"></i></div>
        <div class="kpi-info">
          <span class="kpi-label">Engagement Rate</span>
          <h3 class="kpi-value text-emerald" style="font-size: 1.35rem;">${stats.engagementRate || '16.00'}%</h3>
          <span class="kpi-subtext" style="color: var(--accent-emerald);"><i class="fa-solid fa-chart-line"></i> Retention: ${stats.avd || '18m 40s'}</span>
        </div>
      </div>
    </div>

    <!-- Traffic Sources & Format Diagnostic Box -->
    <div class="glass-card" style="margin-bottom: 20px; padding: 16px 20px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(56, 189, 248, 0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="font-size: 14px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-traffic-light text-cyan"></i> Traffic Origin & Algorithm Indexing:
          </h4>
          <span style="font-size: 13px; color: #bae6fd; font-weight: 600;">
            ${escapeHtml(stats.trafficSourceEstimate || 'YouTube Search (46%), Suggested Videos (32%), Live Browse (22%)')}
          </span>
        </div>
        <span class="badge badge-purple" style="font-size: 11px;">
          <i class="fa-solid fa-microchip"></i> Algorithm Analyzed
        </span>
      </div>
    </div>

    <!-- Dedicated AI Video Remake & Creator Training Studio Card -->
    <div class="glass-card ai-training-master-card" style="margin-bottom: 24px; border: 1px solid rgba(168, 85, 247, 0.4); background: linear-gradient(135deg, rgba(88, 28, 135, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%);">
      <div class="card-header" style="border-bottom: 1px solid rgba(168, 85, 247, 0.25);">
        <div class="title-with-badge">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: #c084fc; font-size: 20px;"></i>
          <div>
            <h3 style="color: #fff; font-size: 16px;">Gemini AI Video Remake & Creator Training Studio</h3>
            <span style="font-size: 12px; color: #d8b4fe;">Us video ke liye new package banake pura train karo</span>
          </div>
        </div>
        <button class="btn btn-primary" id="triggerAiTrainBtn" style="background: linear-gradient(135deg, #9333ea, #3b82f6); border: none; font-weight: 700;">
          <i class="fa-solid fa-sparkles" id="aiTrainIcon"></i> ⚡ Generate AI Remake & Full Training Plan
        </button>
      </div>
      <div class="card-body" id="aiTrainingOutputWrap">
        <div style="padding: 24px; text-align: center; color: var(--text-muted);">
          <i class="fa-solid fa-brain" style="font-size: 32px; color: #c084fc; margin-bottom: 10px; display: block;"></i>
          <p style="font-size: 13.5px; color: #e2e8f0;">Click <strong>"Generate AI Remake & Full Training Plan"</strong> to create 3 Viral Titles, SEO Description, Copy-Paste Tags, Thumbnail Blueprint, Opening Hook Script & Creator Training Guide.</p>
        </div>
      </div>
    </div>

    <!-- 2-Column Deep Inspection Grid -->
    <div class="inspect-details-grid">
      <!-- Left Column: Top Search Keywords & SEO Checklist -->
      <div class="detail-section-card">
        <h4 class="detail-card-title"><i class="fa-solid fa-tags text-cyan"></i> Top Extracted Search Keywords & Tags</h4>
        <div class="keyword-pills-cloud">
          ${keywords.length > 0 ? keywords.map(k => `
            <span class="keyword-tag-pill">
              #${escapeHtml(k.keyword)}
              <span class="relevance-badge">${k.relevance}% Rel</span>
            </span>
          `).join('') : '<span style="color: var(--text-muted); font-size: 13px;">No explicit tags attached to this video.</span>'}
        </div>

        <h4 class="detail-card-title" style="margin-top: 14px;"><i class="fa-solid fa-list-check text-emerald"></i> YouTube SEO Algorithm Checklist</h4>
        <div class="seo-checklist">
          ${(seo.breakdown || []).map(item => `
            <div class="seo-check-item ${item.status}">
              <i class="fa-solid ${item.status === 'optimal' ? 'fa-circle-check' : (item.status === 'fair' ? 'fa-circle-exclamation' : 'fa-circle-xmark')}"></i>
              <div class="seo-check-text">
                <span class="seo-check-title">${escapeHtml(item.item)} (${item.score} pts)</span>
                <span class="seo-check-tip">${escapeHtml(item.tip)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right Column: AI Growth Recommendations & Audience Sentiment -->
      <div class="detail-section-card">
        <h4 class="detail-card-title"><i class="fa-solid fa-wand-magic-sparkles text-cyan"></i> Algorithm Optimization Recommendations</h4>
        <div class="ai-tips-grid">
          ${recs.map(r => `
            <div class="ai-tip-item">
              <i class="${r.icon}"></i>
              <div class="ai-tip-content">
                <h5>${escapeHtml(r.title)}</h5>
                <p>${escapeHtml(r.desc)}</p>
              </div>
            </div>
          `).join('')}
        </div>

        <h4 class="detail-card-title" style="margin-top: 14px;"><i class="fa-solid fa-comments text-amber"></i> Real Audience Comments & Live Chat Pulse</h4>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 10px;">
          Reaction Status: <strong style="color: #10b981;">${sentiment.label || 'Positive'} (${sentiment.score}%)</strong>
        </div>
        <div class="top-comments-list">
          ${comments.length > 0 ? comments.map(c => `
            <div class="comment-item-card" style="border-left: 3px solid #38bdf8; margin-bottom: 8px;">
              <div class="comment-author-row">
                <span class="comment-author" style="color: #38bdf8; font-weight: 700;">@${escapeHtml(c.author)}</span>
                <span class="comment-likes"><i class="fa-solid fa-heart" style="color: #f43f5e;"></i> ${c.likeCount || 0}</span>
              </div>
              <div class="comment-text" style="color: #f1f5f9; font-size: 13px; margin-top: 3px;">${escapeHtml(c.text)}</div>
              ${c.publishedTime ? `<span style="font-size: 10.5px; color: var(--text-subtle); display: block; margin-top: 2px;">${escapeHtml(c.publishedTime)}</span>` : ''}
            </div>
          `).join('') : '<span style="color: var(--text-muted); font-size: 12.5px;">No comments available for this video.</span>'}
        </div>
      </div>
    </div>
  `;

  // Toggle Embed Player
  document.getElementById('toggleEmbedPlayerBtn')?.addEventListener('click', () => {
    const embed = document.getElementById('embedPlayerContainer');
    if (embed) {
      embed.style.display = embed.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Copy Tags Button
  document.getElementById('copyVideoKeywordsBtn')?.addEventListener('click', () => {
    const allTags = keywords.map(k => k.keyword).join(', ');
    if (allTags) {
      navigator.clipboard.writeText(allTags);
      showToast(`Copied ${keywords.length} tags to clipboard!`);
    }
  });

  // Trigger AI Video Remake & Training Plan
  document.getElementById('triggerAiTrainBtn')?.addEventListener('click', () => {
    generateAiVideoTrainingPackage(data.id);
  });
}

async function generateAiVideoTrainingPackage(videoId) {
  const cleanId = extractYoutubeId(videoId);
  const outputWrap = document.getElementById('aiTrainingOutputWrap');
  const btn = document.getElementById('triggerAiTrainBtn');
  const icon = document.getElementById('aiTrainIcon');

  if (btn) btn.disabled = true;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';

  if (outputWrap) {
    outputWrap.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #c084fc;">
        <i class="fa-solid fa-wand-magic-sparkles fa-spin" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
        <strong style="font-size: 15px; color: #fff;">Gemini 2.5 AI is Analyzing Video Content & Generating Viral Remake Package...</strong>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">Creating 3 High-CTR Titles, SEO Description, Tag Matrix, Thumbnail Concept & Step-by-Step Training Blueprint</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/analytics/video/${encodeURIComponent(cleanId)}/ai-train`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderAiTrainingPackageResult(data.aiPackage, cleanId);
    showToast('AI Remake & Creator Training Package generated!');
  } catch (err) {
    console.error('Error generating AI training package:', err);
    if (outputWrap) {
      outputWrap.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--accent-rose);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px;"></i>
          <p>Failed to generate AI package: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.className = 'fa-solid fa-sparkles';
  }
}

function renderAiTrainingPackageResult(pkg, videoId) {
  const wrap = document.getElementById('aiTrainingOutputWrap');
  if (!wrap || !pkg) return;

  const diag = pkg.diagnosis || {};
  const remake = pkg.remakePackage || {};
  const titles = remake.viralTitles || [];
  const tags = remake.optimizedTags || [];
  const thumb = remake.thumbnailBlueprint || {};
  const training = pkg.creatorTrainingPlan || [];

  wrap.innerHTML = `
    <!-- AI Diagnosis Banner -->
    <div class="ai-diag-banner">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; color: #c084fc; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-stethoscope"></i> AI Algorithmic Diagnosis & Performance Reason:
        </span>
        <span class="badge badge-purple" style="font-size: 11px; padding: 3px 8px;">
          <i class="fa-solid fa-chart-line"></i> Viral Potential: ${escapeHtml(diag.viralPotential || 'High')}
        </span>
      </div>
      <p style="font-size: 13.5px; color: #f1f5f9; margin-bottom: 6px; line-height: 1.5;">${escapeHtml(diag.summary || '')}</p>
      ${diag.trafficAnalysis ? `
        <div style="font-size: 12.5px; color: #bae6fd; margin-top: 6px; padding: 6px 10px; background: rgba(0,0,0,0.25); border-radius: 6px;">
          <strong><i class="fa-solid fa-route"></i> Traffic Driver:</strong> ${escapeHtml(diag.trafficAnalysis.primaryDriver || '')} &bull; ${escapeHtml(diag.trafficAnalysis.whyItWorkedOrStruggled || '')}
        </div>
      ` : ''}
    </div>

    <!-- 1. Viral High-CTR Titles -->
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 14px; color: #fff; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-fire text-rose"></i> 1. Optimized High-CTR Titles (Pick One to Apply Directly on YouTube):
      </h4>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${titles.map((t, idx) => `
          <div class="ai-title-card" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px;">
            <div style="flex: 1; min-width: 260px;">
              <span class="badge badge-amber" style="font-size: 10px; padding: 2px 7px; margin-right: 6px;">${escapeHtml(t.type || `Option ${idx + 1}`)}</span>
              <strong style="color: #fff; font-size: 13.5px;">${escapeHtml(t.title)}</strong>
              ${t.expectedCTR ? `<span style="font-size: 11px; color: #10b981; margin-left: 8px; font-weight: 600;"><i class="fa-solid fa-arrow-trend-up"></i> ${escapeHtml(t.expectedCTR)}</span>` : ''}
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm copy-ai-title-btn" data-title="${escapeHtml(t.title)}" style="font-size: 11.5px; padding: 6px 12px; font-weight: 600;">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
              <button type="button" class="btn btn-primary btn-sm apply-ai-title-btn" data-video-id="${escapeHtml(videoId || '')}" data-title="${escapeHtml(t.title)}" style="background: linear-gradient(135deg, #10b981, #06b6d4); border: none; font-size: 11.5px; padding: 6px 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);">
                <i class="fa-solid fa-cloud-arrow-up"></i> ⚡ 1-Click Update on YouTube
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 2. Opening Hook Script -->
    ${remake.openingHookScript ? `
      <div class="ai-hook-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="font-size: 13.5px; color: #f59e0b; margin: 0; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-microphone"></i> 2. First 30 Seconds Retention Hook Script (Say This at Start):
          </h4>
          <button type="button" class="btn btn-secondary btn-sm" id="copyHookScriptBtn" style="font-size: 11px; padding: 4px 10px; font-weight: 600;">
            <i class="fa-regular fa-copy"></i> Copy Script
          </button>
        </div>
        <p style="font-size: 13px; color: #fef08a; font-style: italic; margin: 0; line-height: 1.55;" id="hookScriptText">
          "${escapeHtml(remake.openingHookScript)}"
        </p>
      </div>
    ` : ''}

    <!-- 3. Viral Thumbnail Blueprint -->
    <div class="ai-thumb-blueprint">
      <h4 style="font-size: 13.5px; color: #38bdf8; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-image"></i> 3. High-CTR Thumbnail Blueprint:
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 12.5px;">
        <div><strong>Big Bold Text on Thumbnail:</strong> <span style="color: #fbbf24; font-weight: 700;">${escapeHtml(thumb.bigBoldText || '8000 RS ROOM! 🎁')}</span></div>
        <div><strong>Visual Composition:</strong> <span style="color: #e2e8f0;">${escapeHtml(thumb.visualLayout || 'High action')}</span></div>
        <div><strong>Colors & Contrast:</strong> <span style="color: #e2e8f0;">${escapeHtml(thumb.colorScheme || 'Neon Yellow / Red')}</span></div>
        <div><strong>Face / Emotion:</strong> <span style="color: #e2e8f0;">${escapeHtml(thumb.emotionHook || 'Shocked / Hyped')}</span></div>
      </div>
    </div>

    <!-- 4. Master 5,000-Character Full YouTube Description Studio -->
    <div class="ai-desc-studio-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <h4 style="font-size: 14px; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-file-lines"></i> 4. Master YouTube Description (Max ~5,000 Letters SEO Package):
          </h4>
          <span class="badge badge-emerald" id="descCharCountBadge" style="font-size: 11px; padding: 2px 8px; font-weight: 700;">
            <i class="fa-solid fa-check-double"></i> ${(remake.optimizedDescription || '').length.toLocaleString()} / 5,000 Chars
          </span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="copySeoDescBtn" style="font-size: 12px; padding: 6px 12px; font-weight: 600;">
            <i class="fa-regular fa-copy"></i> Copy Description
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="applySeoDescBtn" data-video-id="${escapeHtml(videoId || '')}" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-size: 12px; padding: 6px 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);">
            <i class="fa-solid fa-cloud-arrow-up"></i> ⚡ 1-Click Update Description on YouTube
          </button>
        </div>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
        Includes: Video Summary & Hook, Timestamps, Custom Room Rules, Social Links, Setup Details, SEO Keywords Cluster, Disclaimer & Hashtags.
      </p>
      <textarea id="aiSeoDescArea" rows="12" class="form-control ai-desc-textarea" readonly>${escapeHtml(remake.optimizedDescription || '')}</textarea>
    </div>

    <!-- 5. Top 15 Ranked Tags -->
    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <h4 style="font-size: 13.5px; color: #34d399; margin: 0; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-tags"></i> 5. Top 15 Ranked Search Tags (Ready for YouTube Studio):
        </h4>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="copyAiTagsBtn" style="font-size: 11px; padding: 5px 10px;">
            <i class="fa-regular fa-copy"></i> Copy All Tags (${tags.length})
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="applyAiTagsBtn" data-video-id="${escapeHtml(videoId || '')}" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-size: 11px; padding: 5px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
            <i class="fa-solid fa-cloud-arrow-up"></i> ⚡ 1-Click Update Tags on YouTube
          </button>
        </div>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-right: 4px;">
        ${tags.map(t => `<span class="keyword-tag-pill" style="font-size: 11.5px; padding: 4px 10px;">#${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>

    <!-- 6. Creator Training Plan -->
    ${training.length > 0 ? `
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); padding: 16px 18px;">
        <h4 style="font-size: 14px; color: #34d399; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-graduation-cap"></i> 6. Creator Master Training Blueprint (Next Stream/Video Plan):
        </h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${training.map(step => `
            <div class="ai-step-card">
              <div style="font-weight: 700; color: #6ee7b7; font-size: 12.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-arrow-right text-emerald"></i> Step ${step.step}: ${escapeHtml(step.phase)}
              </div>
              <p style="font-size: 12.5px; color: #e2e8f0; margin: 0; line-height: 1.45;">${escapeHtml(step.action)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Copy buttons
  document.querySelectorAll('.copy-ai-title-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.getAttribute('data-title');
      if (title) {
        navigator.clipboard.writeText(title);
        showToast('Title copied to clipboard!');
      }
    });
  });

  // 1-Click Apply AI Title directly to YouTube
  // 1-Click Apply AI Title to YouTube
  document.querySelectorAll('.apply-ai-title-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetVideoId = extractYoutubeId(btn.getAttribute('data-video-id') || videoId);
      const newTitle = btn.getAttribute('data-title');
      if (!targetVideoId || !newTitle) {
        showToast('Video ID or title not found', true);
        return;
      }

      if (!confirm(`Are you sure you want to update this video's title on YouTube to:\n\n"${newTitle}"?`)) {
        return;
      }

      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

      try {
        const res = await fetch(`/api/analytics/video/${encodeURIComponent(targetVideoId)}/update-meta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update video title on YouTube');
        }

        btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Updated on YouTube!`;
        btn.style.background = '#10b981';

        // Update the live title in the inspector header
        const titleDisplay = document.getElementById('inspectedVideoTitleDisplay');
        if (titleDisplay) {
          titleDisplay.textContent = newTitle;
          titleDisplay.title = newTitle;
        }

        showToast(`🎉 YouTube video title updated to: "${newTitle}"!`);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('Update failed: ' + err.message, true);
      }
    });
  });

  // 1-Click Apply Master Description to YouTube
  document.getElementById('applySeoDescBtn')?.addEventListener('click', async () => {
    const desc = document.getElementById('aiSeoDescArea')?.value;
    const targetVideoId = extractYoutubeId(document.getElementById('applySeoDescBtn')?.getAttribute('data-video-id') || videoId);
    if (!targetVideoId || !desc) return;

    if (!confirm(`Are you sure you want to update this video's description on YouTube with the AI Master SEO Description (${desc.length} chars)?`)) {
      return;
    }

    const btn = document.getElementById('applySeoDescBtn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

    try {
      const res = await fetch(`/api/analytics/video/${encodeURIComponent(targetVideoId)}/update-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update description on YouTube');
      }

      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Description Updated!`;
      btn.style.background = '#10b981';
      showToast('🎉 YouTube video description updated successfully!');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      showToast('Update failed: ' + err.message, true);
    }
  });

  // 1-Click Apply AI Tags to YouTube
  document.getElementById('applyAiTagsBtn')?.addEventListener('click', async () => {
    const targetVideoId = extractYoutubeId(document.getElementById('applyAiTagsBtn')?.getAttribute('data-video-id') || videoId);
    if (!targetVideoId || !tags || tags.length === 0) return;

    if (!confirm(`Are you sure you want to update this video's tags on YouTube with ${tags.length} AI Ranked Tags?`)) {
      return;
    }

    const btn = document.getElementById('applyAiTagsBtn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

    try {
      const res = await fetch(`/api/analytics/video/${encodeURIComponent(targetVideoId)}/update-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update tags on YouTube');
      }

      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Tags Updated!`;
      btn.style.background = '#10b981';
      showToast(`🎉 YouTube video tags updated with ${tags.length} tags!`);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      showToast('Update failed: ' + err.message, true);
    }
  });

  document.getElementById('copyHookScriptBtn')?.addEventListener('click', () => {
    const text = document.getElementById('hookScriptText')?.innerText?.replace(/^"|"$/g, '');
    if (text) {
      navigator.clipboard.writeText(text);
      showToast('Hook script copied to clipboard!');
    }
  });

  document.getElementById('copySeoDescBtn')?.addEventListener('click', () => {
    const desc = document.getElementById('aiSeoDescArea')?.value;
    if (desc) {
      navigator.clipboard.writeText(desc);
      showToast('SEO Description copied to clipboard!');
    }
  });

  document.getElementById('copyAiTagsBtn')?.addEventListener('click', () => {
    const allTags = tags.join(', ');
    if (allTags) {
      navigator.clipboard.writeText(allTags);
      showToast(`Copied ${tags.length} optimized tags to clipboard!`);
    }
  });
}

// Video Inspect Search Button & Enter Key
document.getElementById('runVideoInspectBtn')?.addEventListener('click', () => {
  inspectSpecificVideo();
});

document.getElementById('videoInspectInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    inspectSpecificVideo();
  }
});

// Periodic Quota Refresh (relaxed fallback heartbeat)
setInterval(fetchQuotaInfo, 60000);

// Socket listeners for real-time widgets
socket.on('quotaUpdated', (quota) => { renderQuotaTracker(quota); });
socket.on('quotaStandby', (data) => {
  if (data.quota) renderQuotaTracker(data.quota);
});
socket.on('pollStarted', () => { fetchActivePoll(); fetchPollHistory(); });
socket.on('pollUpdate', (poll) => { renderActivePollMonitor(poll); });
socket.on('pollEnded', () => { fetchActivePoll(); fetchPollHistory(); });
socket.on('highlightAdded', () => { fetchHighlights(); });

// -------------------------------------------------------------
// YouTube Ultra-HD Video Downloader Module
// -------------------------------------------------------------
let selectedDownloaderQuality = 'highest';
let currentInspectedUrl = '';

function initVideoDownloader() {
  const urlInput = document.getElementById('downloaderUrlInput');
  const btnPaste = document.getElementById('btnPasteUrl');
  const btnInspect = document.getElementById('btnInspectVideo');
  const btnInstantHighest = document.getElementById('btnInstantHighestDl');
  const btnStartChosen = document.getElementById('btnStartChosenDownload');
  const btnOpenFolder = document.getElementById('btnOpenDownloadsFolder');
  const btnOpenFolderSec = document.getElementById('btnOpenFolderSecondary');
  const btnReveal = document.getElementById('btnRevealInFolder');
  const btnRefresh = document.getElementById('btnRefreshDownloadsList');

  // Quality Selection Card Clicks
  document.querySelectorAll('.dl-quality-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.dl-quality-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedDownloaderQuality = card.getAttribute('data-quality') || 'highest';
    });
  });

  // Paste from clipboard
  btnPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        showToast('Link pasted from clipboard!');
      }
    } catch (err) {
      showToast('Clipboard access denied. Please paste manually (Ctrl+V)', true);
    }
  });

  // URL Enter key
  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inspectDownloaderVideo();
    }
  });

  // Inspect / Analyze Video
  btnInspect?.addEventListener('click', () => {
    inspectDownloaderVideo();
  });

  // Instant 1-Click Download Highest Quality
  btnInstantHighest?.addEventListener('click', () => {
    const url = urlInput?.value?.trim();
    if (!url) {
      showToast('Please enter or paste a YouTube URL first', true);
      return;
    }
    startVideoDownload(url, 'highest');
  });

  // Start chosen format download
  btnStartChosen?.addEventListener('click', () => {
    const url = currentInspectedUrl || urlInput?.value?.trim();
    if (!url) {
      showToast('Please enter a valid YouTube video URL', true);
      return;
    }
    startVideoDownload(url, selectedDownloaderQuality);
  });

  // Open Downloads Folder
  const openFolderAction = async () => {
    try {
      const res = await fetch('/api/downloader/open-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Downloads folder opened in Windows Explorer!');
      }
    } catch (err) {
      showToast('Could not open downloads folder: ' + err.message, true);
    }
  };

  btnOpenFolder?.addEventListener('click', openFolderAction);
  btnOpenFolderSec?.addEventListener('click', openFolderAction);
  btnReveal?.addEventListener('click', openFolderAction);

  // Refresh downloads list
  btnRefresh?.addEventListener('click', () => {
    fetchDownloadedFiles();
    showToast('Downloaded files list refreshed');
  });

  // Socket listener for download progress
  socket.on('downloader_progress', (data) => {
    handleDownloaderProgress(data);
  });
}

async function inspectDownloaderVideo() {
  const urlInput = document.getElementById('downloaderUrlInput');
  const url = urlInput?.value?.trim();
  if (!url) {
    showToast('Please enter a YouTube video URL to analyze', true);
    return;
  }

  const inspectBtn = document.getElementById('btnInspectVideo');
  const inspectIcon = document.getElementById('inspectIcon');
  if (inspectBtn) inspectBtn.disabled = true;
  if (inspectIcon) inspectIcon.className = 'fa-solid fa-spinner fa-spin';

  try {
    const res = await fetch('/api/downloader/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to inspect YouTube video');
    }

    const info = data.info;
    currentInspectedUrl = url;

    // Render Preview Box
    document.getElementById('dlPreviewThumb').src = info.thumbnail || '';
    document.getElementById('dlPreviewDuration').textContent = info.durationString || '0:00';
    document.getElementById('dlPreviewTitle').textContent = info.title || 'YouTube Video';
    document.getElementById('dlPreviewChannel').innerHTML = `<i class="fa-solid fa-user-circle"></i> ${escapeHtml(info.channel)}`;
    document.getElementById('dlPreviewViews').innerHTML = `<i class="fa-solid fa-eye"></i> ${Number(info.viewCount || 0).toLocaleString()} views`;

    const resList = (info.availableResolutions || []).map(r => `${r}p`).slice(0, 5).join(', ');
    document.getElementById('dlPreviewResolutions').innerHTML = `<i class="fa-solid fa-film"></i> Available: ${resList || 'HD'}`;

    const maxBadge = document.getElementById('dlPreviewMaxBadge');
    if (maxBadge) {
      maxBadge.textContent = `${info.maxResolution} AVAILABLE`;
    }

    const highestLabel = document.getElementById('dlHighestResLabel');
    if (highestLabel) {
      highestLabel.textContent = `Auto Best (${info.maxResolution} + Lossless Audio)`;
    }

    const previewBox = document.getElementById('downloaderPreviewBox');
    if (previewBox) {
      previewBox.style.display = 'block';
      previewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showToast(`Video analyzed! Max Quality: ${info.maxResolution}`);
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (inspectBtn) inspectBtn.disabled = false;
    if (inspectIcon) inspectIcon.className = 'fa-solid fa-magnifying-glass';
  }
}

async function startVideoDownload(url, quality = 'highest') {
  const progressBox = document.getElementById('downloaderProgressBox');
  const completeBox = document.getElementById('downloaderCompleteBox');
  const statusText = document.getElementById('dlStatusText');
  const percentBadge = document.getElementById('dlPercentBadge');
  const barFill = document.getElementById('dlProgressBarFill');

  if (completeBox) completeBox.style.display = 'none';
  if (progressBox) {
    progressBox.style.display = 'block';
    progressBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (statusText) statusText.textContent = `Starting download (${quality.toUpperCase()})...`;
  if (percentBadge) percentBadge.textContent = '0%';
  if (barFill) barFill.style.width = '0%';

  try {
    const res = await fetch('/api/downloader/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, quality })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to start download');
    }

    showToast('Download started in background!');
  } catch (err) {
    if (statusText) statusText.textContent = 'Download error';
    showToast('Error starting download: ' + err.message, true);
  }
}

function handleDownloaderProgress(data) {
  const progressBox = document.getElementById('downloaderProgressBox');
  const completeBox = document.getElementById('downloaderCompleteBox');
  const statusText = document.getElementById('dlStatusText');
  const percentBadge = document.getElementById('dlPercentBadge');
  const barFill = document.getElementById('dlProgressBarFill');
  const speedText = document.getElementById('dlSpeedText');
  const sizeText = document.getElementById('dlSizeText');
  const etaText = document.getElementById('dlEtaText');

  if (progressBox && progressBox.style.display === 'none' && data.status !== 'completed') {
    progressBox.style.display = 'block';
  }

  if (speedText) speedText.textContent = data.speed || '--';
  if (sizeText) sizeText.textContent = data.size || '--';
  if (etaText) etaText.textContent = data.eta || '--';

  const pct = Math.min(100, Math.max(0, Math.round(data.progress || 0)));
  if (percentBadge) percentBadge.textContent = `${pct}%`;
  if (barFill) barFill.style.width = `${pct}%`;

  if (data.status === 'processing') {
    if (statusText) statusText.textContent = 'Merging video & audio streams with FFmpeg...';
  } else if (data.status === 'completed') {
    if (statusText) statusText.textContent = 'Download & Processing Complete!';
    if (barFill) barFill.style.width = '100%';
    if (percentBadge) percentBadge.textContent = '100%';

    // Reveal Complete Box
    if (completeBox) {
      completeBox.style.display = 'block';
      completeBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const finishedName = document.getElementById('dlFinishedFilename');
    const finishedSize = document.getElementById('dlFinishedSize');
    const downloadLink = document.getElementById('btnBrowserDownloadLink');

    if (finishedName) finishedName.textContent = data.filename || 'Downloaded Video';
    if (finishedSize) finishedSize.textContent = data.size || '';
    if (downloadLink && data.filename) {
      downloadLink.href = `/api/downloader/file/${encodeURIComponent(data.filename)}`;
      downloadLink.setAttribute('download', data.filename);
    }

    showToast('🎉 Video downloaded in highest quality!');
    fetchDownloadedFiles();
  } else if (data.status === 'error') {
    if (statusText) statusText.textContent = 'Download error occurred';
    showToast('Download Error: ' + (data.error || 'Unknown error'), true);
  } else {
    if (statusText) statusText.textContent = `Downloading ${data.quality === 'audio_only' ? 'Audio' : 'Video'} (${pct}%)...`;
  }
}

async function fetchDownloadedFiles() {
  try {
    const res = await fetch('/api/downloader/files');
    const data = await res.json();
    if (!data.success) return;

    const files = data.files || [];
    const countBadge = document.getElementById('dlHistoryCountBadge');
    const emptyState = document.getElementById('dlEmptyState');
    const tableWrap = document.getElementById('dlFilesTableWrap');
    const tbody = document.getElementById('dlFilesTableBody');

    if (countBadge) countBadge.textContent = `${files.length} File${files.length === 1 ? '' : 's'}`;

    if (files.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (tableWrap) tableWrap.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';

    if (tbody) {
      tbody.innerHTML = files.map((f, i) => {
        const safeEncoded = encodeURIComponent(f.filename);
        return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 12px 14px; font-weight: 600; color: #f8fafc;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="${f.filename.endsWith('.mp3') ? 'fa-solid fa-file-audio text-rose' : 'fa-solid fa-file-video text-emerald'}" style="font-size: 18px;"></i>
              <span style="word-break: break-all;">${escapeHtml(f.filename)}</span>
            </div>
          </td>
          <td style="padding: 12px 14px; color: var(--text-muted); font-family: monospace;">${escapeHtml(f.sizeFormatted)}</td>
          <td style="padding: 12px 14px; color: var(--text-muted); font-size: 12px;">${new Date(f.createdAt).toLocaleString()}</td>
          <td style="padding: 12px 14px; text-align: right; white-space: nowrap;">
            <a href="/api/downloader/file/${safeEncoded}" download="${escapeHtml(f.filename)}" class="btn btn-primary btn-sm" style="background: #10b981; border: none; padding: 6px 14px; margin-right: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
              <i class="fa-solid fa-download"></i> Save to PC
            </a>
            <button type="button" class="btn btn-secondary btn-sm btn-delete-dl" data-filename="${safeEncoded}" title="Delete File" style="color: var(--accent-rose); padding: 6px 10px;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
      }).join('');

      tbody.querySelectorAll('.btn-delete-dl').forEach(btn => {
        btn.addEventListener('click', () => {
          const encoded = btn.getAttribute('data-filename');
          if (encoded) {
            deleteDownloadedFile(decodeURIComponent(encoded));
          }
        });
      });
    }
  } catch (err) {
    console.error('Error loading downloads library:', err);
  }
}

async function deleteDownloadedFile(filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

  try {
    const res = await fetch(`/api/downloader/file/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('File deleted successfully');
      fetchDownloadedFiles();
    } else {
      showToast('Failed to delete file', true);
    }
  } catch (err) {
    showToast('Error deleting file: ' + err.message, true);
  }
}

window.deleteDownloadedFile = deleteDownloadedFile;

// -------------------------------------------------------------
// Multi-Stream Live Chat Overlay Manager
// -------------------------------------------------------------
let multiStreamConfig = null;

function initMultiStreamModule() {
  const addForm = document.getElementById('addStreamChannelForm');
  const btnLaunch = document.getElementById('btnLaunchMultiOverlay');
  const btnTest = document.getElementById('btnTestMultiStreamMsg');
  const opacitySlider = document.getElementById('overlayOpacitySlider');
  const fontSizeSlider = document.getElementById('overlayFontSizeSlider');

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('multiStreamInput').value.trim();
      const name = document.getElementById('multiStreamName').value.trim();
      const color = document.getElementById('multiStreamColor').value;

      if (!input) return;

      try {
        const res = await fetch('/api/multistream/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, name, color })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Live stream channel added successfully!');
          document.getElementById('multiStreamInput').value = '';
          document.getElementById('multiStreamName').value = '';
          fetchMultiStreamConfig();
        } else {
          showToast(data.error || 'Failed to add channel', true);
        }
      } catch (err) {
        showToast('Error adding stream: ' + err.message, true);
      }
    });
  }

  const btnDesktop = document.getElementById('btnLaunchDesktopTransparent');

  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      window.open('/multichat-overlay.html', 'MultiChatOverlay', 'width=450,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    });
  }

  if (btnDesktop) {
    btnDesktop.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/multistream/launch-desktop', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('🚀 100% Transparent Desktop Overlay Window Launched on your screen!');
        } else {
          showToast('Failed to launch desktop overlay', true);
        }
      } catch (err) {
        showToast('Error launching desktop overlay: ' + err.message, true);
      }
    });
  }

  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/multistream/test-message', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Test comment sent to overlay!');
        }
      } catch (err) {
        showToast('Failed to send test comment', true);
      }
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const opacityVal = e.target.value;
      const textEl = document.getElementById('overlayOpacityValueText');
      if (textEl) textEl.textContent = `${opacityVal}% (${opacityVal == 0 ? 'Fully Transparent' : opacityVal + '% dark'})`;
      socket.emit('multiChat:updateSettings', { opacity: parseInt(opacityVal, 10) });
    });
  }

  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', (e) => {
      const sizeVal = e.target.value;
      const textEl = document.getElementById('overlayFontSizeText');
      if (textEl) textEl.textContent = `${sizeVal}px`;
      socket.emit('multiChat:updateSettings', { fontSize: parseInt(sizeVal, 10) });
    });
  }

  // Socket Listeners
  socket.on('multiChat:config', (config) => {
    multiStreamConfig = config;
    renderMultiStreamUI(config);
  });

  socket.on('multiChat:configUpdated', (config) => {
    multiStreamConfig = config;
    renderMultiStreamUI(config);
  });

  socket.on('multiChat:streamsList', (streams) => {
    if (multiStreamConfig) {
      renderMultiStreamsTable(streams);
    }
  });
}

async function fetchMultiStreamConfig() {
  try {
    const res = await fetch('/api/multistream/config');
    const data = await res.json();
    if (data.success) {
      multiStreamConfig = data.config;
      renderMultiStreamUI(data.config);
    }
  } catch (err) {
    console.error('Error fetching multi-stream config:', err);
  }
}

function renderMultiStreamUI(config) {
  if (!config) return;

  const countBadge = document.getElementById('multiStreamCountBadge');
  if (countBadge) {
    const activeCount = config.streams.filter(s => s.enabled).length;
    countBadge.textContent = `${activeCount} Active Channel${activeCount === 1 ? '' : 's'}`;
  }

  if (config.settings) {
    const opacitySlider = document.getElementById('overlayOpacitySlider');
    const opacityText = document.getElementById('overlayOpacityValueText');
    if (opacitySlider && config.settings.opacity !== undefined) {
      opacitySlider.value = config.settings.opacity;
      if (opacityText) opacityText.textContent = `${config.settings.opacity}% (${config.settings.opacity == 0 ? 'Fully Transparent' : config.settings.opacity + '% dark'})`;
    }

    const sizeSlider = document.getElementById('overlayFontSizeSlider');
    const sizeText = document.getElementById('overlayFontSizeText');
    if (sizeSlider && config.settings.fontSize !== undefined) {
      sizeSlider.value = config.settings.fontSize;
      if (sizeText) sizeText.textContent = `${config.settings.fontSize}px`;
    }
  }

  renderMultiStreamsTable(config.streams);
}

function renderMultiStreamsTable(streams) {
  const tbody = document.getElementById('multiStreamsTableBody');
  if (!tbody || !streams) return;

  if (streams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No live stream channels connected. Add your first channel above!</td></tr>`;
    return;
  }

  tbody.innerHTML = streams.map(s => {
    const isPrimary = s.isPrimary;
    const statusBadgeClass = s.status === 'live' ? 'badge-success' : (s.status === 'connecting' ? 'badge-warning' : 'badge-secondary');
    const statusText = s.status === 'live' ? '🟢 LIVE' : (s.status === 'connecting' ? '⏳ Connecting...' : '⚪ Inactive');

    return `
      <tr>
        <td style="padding:12px 14px; font-weight:700; color:#fff;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="${isPrimary ? 'fa-solid fa-crown text-yellow' : 'fa-solid fa-youtube text-red'}"></i>
            <span>${escapeHtml(s.name)}</span>
            ${isPrimary ? '<span class="badge badge-purple" style="font-size:9px; padding:1px 5px;">PRIMARY</span>' : ''}
          </div>
        </td>
        <td style="padding:12px 14px;">
          <span class="channel-badge" style="background:${s.color || '#3B82F6'}; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:800; color:#fff; text-transform:uppercase;">
            ${escapeHtml(s.name.substring(0, 14))}
          </span>
        </td>
        <td style="padding:12px 14px;">
          <span class="badge ${statusBadgeClass}" style="font-size:11px;">${statusText}</span>
        </td>
        <td style="padding:12px 14px; text-align:center;">
          <label class="switch" style="transform:scale(0.85);">
            <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleMultiStreamChannel('${s.id}', this.checked)">
            <span class="slider round"></span>
          </label>
        </td>
        <td style="padding:12px 14px; text-align:right;">
          ${isPrimary ? `<span style="font-size:11px; color:var(--text-muted);">Default Channel</span>` : `
            <button class="btn btn-danger btn-sm" onclick="deleteMultiStreamChannel('${s.id}')" title="Remove stream channel">
              <i class="fa-solid fa-trash"></i>
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleMultiStreamChannel(id, enabled) {
  try {
    const res = await fetch(`/api/multistream/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Channel ${enabled ? 'enabled' : 'disabled'}`);
      fetchMultiStreamConfig();
    }
  } catch (err) {
    showToast('Failed to toggle channel', true);
  }
}

async function deleteMultiStreamChannel(id) {
  if (!confirm('Are you sure you want to remove this live stream channel?')) return;
  try {
    const res = await fetch(`/api/multistream/channels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Stream channel removed successfully');
      fetchMultiStreamConfig();
    } else {
      showToast(data.error || 'Failed to remove channel', true);
    }
  } catch (err) {
    showToast('Error deleting channel: ' + err.message, true);
  }
}

window.toggleMultiStreamChannel = toggleMultiStreamChannel;
window.deleteMultiStreamChannel = deleteMultiStreamChannel;

// -------------------------------------------------------------
// AI Long Text-to-Speech (TTS) Studio Module
// -------------------------------------------------------------
let selectedTtsVoice = 'google_hi_female';
let selectedTtsRate = 1.0;

function initTtsStudio() {
  const scriptArea = document.getElementById('ttsScriptArea');
  const charCount = document.getElementById('ttsCharCount');
  const wordCount = document.getElementById('ttsWordCount');
  const estDuration = document.getElementById('ttsEstDuration');
  const sliderRate = document.getElementById('ttsSpeedRateSlider');
  const rateValText = document.getElementById('ttsSpeedRateValText');

  const btnGenerate = document.getElementById('btnGenerateLongTts');
  const btnPaste = document.getElementById('btnPasteTtsText');
  const btnClear = document.getElementById('btnClearTtsText');
  const fileInput = document.getElementById('ttsFileInput');
  const btnRefreshHistory = document.getElementById('btnRefreshTtsHistory');

  // Presets
  const btnStory = document.getElementById('btnPresetStory');
  const btnNews = document.getElementById('btnPresetNews');
  const btnReel = document.getElementById('btnPresetReel');

  // Voice Card Clicks
  document.querySelectorAll('.tts-voice-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.tts-voice-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTtsVoice = card.getAttribute('data-voice') || 'google_hi_female';
    });
  });

  // Rate Slider
  sliderRate?.addEventListener('input', (e) => {
    selectedTtsRate = parseFloat(e.target.value) || 1.0;
    if (rateValText) {
      rateValText.textContent = `${selectedTtsRate.toFixed(1)}x (${selectedTtsRate === 1.0 ? 'Normal' : (selectedTtsRate < 1.0 ? 'Slow' : 'Fast')})`;
    }
  });

  // Text Counter Update
  const updateTextMetrics = () => {
    const text = scriptArea?.value || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const estSec = Math.max(0, Math.round((words / 150) * 60 / selectedTtsRate));
    const mins = Math.floor(estSec / 60);
    const secs = estSec % 60;

    if (charCount) charCount.textContent = chars.toLocaleString();
    if (wordCount) wordCount.textContent = words.toLocaleString();
    if (estDuration) estDuration.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  scriptArea?.addEventListener('input', updateTextMetrics);

  // Paste Text
  btnPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        scriptArea.value = text;
        updateTextMetrics();
        showToast('Script pasted from clipboard!');
      }
    } catch (err) {
      showToast('Clipboard permission denied. Use Ctrl+V to paste', true);
    }
  });

  // Clear Text
  btnClear?.addEventListener('click', () => {
    if (scriptArea) {
      scriptArea.value = '';
      updateTextMetrics();
    }
  });

  // File Upload (.txt / .md)
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (scriptArea) {
        scriptArea.value = evt.target.result || '';
        updateTextMetrics();
        showToast(`Loaded script file "${file.name}"!`);
      }
    };
    reader.readAsText(file);
  });

  // Presets
  btnStory?.addEventListener('click', () => {
    if (scriptArea) {
      scriptArea.value = `नमस्कार दोस्तों! आज की इस विशेष कहानी में आपका स्वागत है। 

एक बार की बात है, फ्री फायर के मैदान में दो महान योद्धा आपस में भिड़ गए। एक तरफ था लीजेंडरी क्लच गॉड, और दूसरी तरफ था शेडो राइडर! 

दोनों ने पीक पर लैंड किया, गन उठाई, और शुरू हुआ घमासान युद्ध। अगर आपको यह कहानी पसंद आई तो चैनल को लाइक और सब्सक्राइब जरूर करें!`;
      updateTextMetrics();
      showToast('Loaded Gaming Story script preset!');
    }
  });

  btnNews?.addEventListener('click', () => {
    if (scriptArea) {
      scriptArea.value = `हेलो गेमर्स! यूट्यूब लाइव स्ट्रीम में बहुत-बहुत स्वागत है। 

आज के नए अपडेट में फ्री फायर और बीजीएमआई में कई शानदार मोड्स और नई गन स्किन आ चुकी हैं। आज के इस स्ट्रीम में हम सब कस्टम रूम खेलेंगे और साथ ही गिवअवे भी करेंगे। तो बिना देर किए चैट में ओपी ओपी टाइप कर दो!`;
      updateTextMetrics();
      showToast('Loaded News script preset!');
    }
  });

  btnReel?.addEventListener('click', () => {
    if (scriptArea) {
      scriptArea.value = `क्या आप जानते हैं फ्री फायर की यह 3 सबसे खतरनाक ट्रिक्स? नंबर 1: हमेशा स्नाइपर का क्विक स्विच यूज करें। नंबर 2: कवर में रहकर फायर करें। और नंबर 3: मोहित 07 को सब्सक्राइब करें!`;
      updateTextMetrics();
      showToast('Loaded Shorts Reel script preset!');
    }
  });

  // Generate Long TTS Button Click
  btnGenerate?.addEventListener('click', () => {
    startLongTtsGeneration();
  });

  btnRefreshHistory?.addEventListener('click', () => {
    fetchTtsHistory();
    showToast('TTS History refreshed');
  });

  // Socket IO Events
  socket.on('ttsStudio_progress', (data) => {
    handleTtsStudioProgress(data);
  });

  socket.on('ttsStudio_completed', (result) => {
    handleTtsStudioCompleted(result);
  });

  socket.on('ttsStudio_error', (data) => {
    handleTtsStudioError(data.error);
  });
}

async function startLongTtsGeneration() {
  const scriptArea = document.getElementById('ttsScriptArea');
  const titleInput = document.getElementById('ttsAudioTitleInput');
  const btnGenerate = document.getElementById('btnGenerateLongTts');
  const btnIcon = document.getElementById('ttsGenerateBtnIcon');

  const progressCard = document.getElementById('ttsProgressCard');
  const masterPlayerCard = document.getElementById('ttsMasterPlayerCard');

  const text = scriptArea?.value?.trim();
  const title = titleInput?.value?.trim() || '';

  if (!text) {
    showToast('Please type or paste a script to generate audio', true);
    return;
  }

  if (masterPlayerCard) masterPlayerCard.style.display = 'none';
  if (progressCard) {
    progressCard.style.display = 'block';
    progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (btnGenerate) btnGenerate.disabled = true;
  if (btnIcon) btnIcon.className = 'fa-solid fa-spinner fa-spin';

  try {
    const res = await fetch('/api/tts/studio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        title,
        voice: selectedTtsVoice,
        rate: selectedTtsRate
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to start TTS generation');
    }

    showToast('Speech synthesis started in background!');
  } catch (err) {
    if (btnGenerate) btnGenerate.disabled = false;
    if (btnIcon) btnIcon.className = 'fa-solid fa-wand-magic-sparkles';
    showToast('Error: ' + err.message, true);
  }
}

function handleTtsStudioProgress(data) {
  const progressCard = document.getElementById('ttsProgressCard');
  const percentBadge = document.getElementById('ttsProgressPercentBadge');
  const barFill = document.getElementById('ttsProgressBarFill');
  const chunkText = document.getElementById('ttsChunkStepText');
  const detailText = document.getElementById('ttsStatusDetailText');

  if (progressCard && progressCard.style.display === 'none') {
    progressCard.style.display = 'block';
  }

  const pct = Math.min(100, Math.max(0, data.progress || 0));
  if (percentBadge) percentBadge.textContent = `${pct}%`;
  if (barFill) barFill.style.width = `${pct}%`;
  if (chunkText) chunkText.innerHTML = `<i class="fa-solid fa-layer-group"></i> Sentence Block ${data.currentChunk || 0} / ${data.totalChunks || 0}`;
  if (detailText) detailText.textContent = data.statusText || 'Processing...';
}

function handleTtsStudioCompleted(result) {
  const progressCard = document.getElementById('ttsProgressCard');
  const playerCard = document.getElementById('ttsMasterPlayerCard');
  const btnGenerate = document.getElementById('btnGenerateLongTts');
  const btnIcon = document.getElementById('ttsGenerateBtnIcon');

  if (btnGenerate) btnGenerate.disabled = false;
  if (btnIcon) btnIcon.className = 'fa-solid fa-wand-magic-sparkles';

  if (progressCard) progressCard.style.display = 'none';
  if (playerCard) {
    playerCard.style.display = 'block';
    playerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const titleEl = document.getElementById('ttsPlayerTitle');
  const metaEl = document.getElementById('ttsPlayerMeta');
  const statsEl = document.getElementById('ttsAudioStatsText');
  const downloadBtn = document.getElementById('btnDownloadMasterMp3');
  const copyBtn = document.getElementById('btnCopyAudioUrl');
  const audioElement = document.getElementById('ttsMasterAudioElement');

  if (titleEl) titleEl.textContent = result.title || 'Generated TTS Audio MP3';
  if (metaEl) metaEl.textContent = `Engine: ${result.engine} | Voice: ${result.voice} | Duration: ~${result.durationFormatted}`;
  if (statsEl) statsEl.innerHTML = `<i class="fa-solid fa-file-audio"></i> Size: ${result.sizeFormatted} &bull; Words: ${result.wordCount || 0} &bull; Chunks: ${result.chunkCount || 1}`;

  if (audioElement && result.downloadUrl) {
    audioElement.src = result.downloadUrl;
    audioElement.play().catch(() => {});
  }

  if (downloadBtn && result.downloadUrl) {
    downloadBtn.href = result.downloadUrl;
    downloadBtn.setAttribute('download', result.filename || 'speech.mp3');
  }

  if (copyBtn && result.downloadUrl) {
    copyBtn.onclick = () => {
      const fullUrl = `${window.location.origin}${result.downloadUrl}`;
      navigator.clipboard.writeText(fullUrl);
      showToast('Direct MP3 URL copied to clipboard!');
    };
  }

  showToast('🎉 Master Audio MP3 generated successfully!', 'success');
  fetchTtsHistory();
}

function handleTtsStudioError(errMessage) {
  const btnGenerate = document.getElementById('btnGenerateLongTts');
  const btnIcon = document.getElementById('ttsGenerateBtnIcon');
  const progressCard = document.getElementById('ttsProgressCard');

  if (btnGenerate) btnGenerate.disabled = false;
  if (btnIcon) btnIcon.className = 'fa-solid fa-wand-magic-sparkles';
  if (progressCard) progressCard.style.display = 'none';

  showToast('TTS Generation Error: ' + errMessage, true);
}

async function fetchTtsHistory() {
  try {
    const res = await fetch('/api/tts/studio/history');
    const data = await res.json();
    if (!data.success) return;

    const history = data.history || [];
    const countBadge = document.getElementById('ttsHistoryCountBadge');
    const emptyState = document.getElementById('ttsHistoryEmptyState');
    const tableWrap = document.getElementById('ttsHistoryTableWrap');
    const tbody = document.getElementById('ttsHistoryTableBody');

    if (countBadge) countBadge.textContent = `${history.length} File${history.length === 1 ? '' : 's'}`;

    if (history.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (tableWrap) tableWrap.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';

    if (tbody) {
      tbody.innerHTML = history.map(item => {
        const safeEncoded = encodeURIComponent(item.filename);
        return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 12px 16px;">
            <div style="font-weight: 700; color: #f8fafc; font-size: 13.5px; margin-bottom: 3px;">${escapeHtml(item.title || item.filename)}</div>
            <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.filename)}</span>
          </td>
          <td style="padding: 12px 16px;">
            <span class="badge" style="background: rgba(236,72,153,0.15); color: #f472b6; font-size: 11px;">${escapeHtml(item.engine || 'TTS')}</span>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(item.voice || '')}</div>
          </td>
          <td style="padding: 12px 16px; color: var(--text-secondary); font-size: 12px;">
            <strong>~${escapeHtml(item.durationFormatted || '--')}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.sizeFormatted || '')}</div>
          </td>
          <td style="padding: 12px 16px; color: var(--text-muted); font-size: 11.5px;">
            ${new Date(item.createdAt).toLocaleString()}
          </td>
          <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm" style="margin-right: 6px; font-size: 12px;" onclick="playTtsHistoryFile('${safeEncoded}', '${escapeHtml(item.title)}')">
              <i class="fa-solid fa-play"></i> Play
            </button>
            <a href="/api/tts/studio/file/${safeEncoded}" download="${escapeHtml(item.filename)}" class="btn btn-primary btn-sm" style="background: #10b981; border: none; padding: 6px 12px; margin-right: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 12px;">
              <i class="fa-solid fa-download"></i> MP3
            </a>
            <button class="btn btn-danger btn-sm" style="font-size: 12px; padding: 6px 10px;" onclick="deleteTtsHistoryFile('${safeEncoded}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error fetching TTS history:', err);
  }
}

function playTtsHistoryFile(encodedFilename, title) {
  const playerCard = document.getElementById('ttsMasterPlayerCard');
  const titleEl = document.getElementById('ttsPlayerTitle');
  const metaEl = document.getElementById('ttsPlayerMeta');
  const downloadBtn = document.getElementById('btnDownloadMasterMp3');
  const copyBtn = document.getElementById('btnCopyAudioUrl');
  const audioElement = document.getElementById('ttsMasterAudioElement');

  const fileUrl = `/api/tts/studio/file/${encodedFilename}`;

  if (playerCard) {
    playerCard.style.display = 'block';
    playerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (titleEl) titleEl.textContent = title || 'Playing TTS Audio';
  if (metaEl) metaEl.textContent = 'Audio File Library';

  if (audioElement) {
    audioElement.src = fileUrl;
    audioElement.play().catch(() => {});
  }

  if (downloadBtn) {
    downloadBtn.href = fileUrl;
    downloadBtn.setAttribute('download', decodeURIComponent(encodedFilename));
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(`${window.location.origin}${fileUrl}`);
      showToast('Audio URL copied to clipboard!');
    };
  }
}

async function deleteTtsHistoryFile(encodedFilename) {
  if (!confirm('Are you sure you want to delete this generated audio file?')) return;
  try {
    const res = await fetch(`/api/tts/studio/file/${encodedFilename}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Audio file deleted from library');
      fetchTtsHistory();
    }
  } catch (err) {
    showToast('Failed to delete file: ' + err.message, true);
  }
}

window.playTtsHistoryFile = playTtsHistoryFile;
window.deleteTtsHistoryFile = deleteTtsHistoryFile;

// Auto-populate all OBS overlay & OAuth URLs with dynamic cloud origin (Render/Localhost)
function initDynamicOriginUrls() {
  const origin = window.location.origin;

  const obsAlertsInput = document.getElementById('obsOverlayUrlInput');
  if (obsAlertsInput) {
    obsAlertsInput.value = `${origin}/alerts.html`;
  }

  const goalsObsInput = document.getElementById('goalsObsUrlInput');
  if (goalsObsInput) {
    goalsObsInput.value = `${origin}/widgets/goals.html?template=cyber&bg=transparent`;
  }

  const pollObsInput = document.getElementById('pollObsUrlInput');
  if (pollObsInput) {
    pollObsInput.value = `${origin}/widgets/poll.html`;
  }
  const copyPollObsBtn = document.getElementById('copyPollObsBtn');
  if (copyPollObsBtn) {
    copyPollObsBtn.onclick = () => {
      navigator.clipboard.writeText(`${origin}/widgets/poll.html`);
      showToast('OBS Poll Graphic URL Copied!');
    };
  }

  const leaderboardObsInput = document.getElementById('leaderboardObsUrlInput');
  if (leaderboardObsInput) {
    leaderboardObsInput.value = `${origin}/widgets/leaderboard.html`;
  }
  const copyLeaderboardObsBtn = document.getElementById('copyLeaderboardObsBtn');
  if (copyLeaderboardObsBtn) {
    copyLeaderboardObsBtn.onclick = () => {
      navigator.clipboard.writeText(`${origin}/widgets/leaderboard.html`);
      showToast('OBS Leaderboard Ticker URL Copied!');
    };
  }

  const oauthDisplay = document.getElementById('oauthCallbackDisplay');
  if (oauthDisplay) {
    oauthDisplay.innerText = `${origin}/auth/google/callback`;
  }
}

// Check URL Params for OAuth Redirect messages
window.addEventListener('DOMContentLoaded', async () => {
  initDynamicOriginUrls();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth') === 'success') {
    showToast('Successfully authenticated with Google & YouTube!');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('error')) {
    showToast(`Authentication failed: ${urlParams.get('error')}`, true);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Initialize Modules
  initVideoDownloader();
  initMultiStreamModule();
  initTtsStudio();

  // Load all initial data
  await Promise.all([
    fetchAuthStatus(),
    fetchBotStatus(),
    fetchCommands(),
    fetchTimers(),
    fetchModeration(),
    fetchLogs(),
    fetchSubscribers(),
    fetchAlertsConfig(),
    fetchGoals(),
    fetchActivePoll(),
    fetchPollHistory(),
    fetchLeaderboard(),
    fetchHighlights(),
    fetchQuotaInfo(),
    fetchAnalyticsData(),
    fetchGeminiConfig(),
    fetchDownloadedFiles(),
    fetchMultiStreamConfig(),
    fetchTtsHistory()
  ]);
});




