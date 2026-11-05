const db = require('../src/services/db');

function setupGamingConfig() {
  console.log('--- Setting up Gaming Commands ---');
  const newCommands = [
    { name: 'uid', response: '🎮 Mohit Bhai In-Game UID: MOHIT-M07 (Guild: MOHIT ARMY 🏆) Add request bhej do $(user)!' },
    { name: 'room', response: '🔥 Custom Room ID & Password live chat me drop hoga jab 100 Likes complete honge! Jaldi stream LIKE karo $(user)! 🎁' },
    { name: 'custom', response: '⚔️ Custom Match Rules: 1. No grenade/hack 2. Fair play 3. Room ID & Pass chat me pin hoga! Active raho $(user)!' },
    { name: 'sensi', response: '🎯 Headshot Sensi: General: 98 | Red Dot: 95 | 2X: 90 | 4X: 85 | Sniper: 70 | Free Look: 60 ⚡' },
    { name: 'device', response: '💻 Setup: High-Performance PC & Mobile (Ultra Graphics, 60 FPS, Zero Lag) $(user)!' },
    { name: 'giveaway', response: '🎁 Mega Giveaway: Special Custom Room Cash Prizes & Play Store Redeem Codes! Channel Subscribe karke active raho $(user)!' },
    { name: 'rank', response: '🏆 Current Rank: Grandmaster Push on Fire! 🔥 Solo vs Squad gameplay $(user)!' },
    { name: 'discord', response: '🎮 Join Mohit Army Discord: https://discord.gg/mkHSm7mrdT - Voice chat, squad matches & tournaments $(user)!' },
    { name: 'instagram', response: '📸 Follow Mohit on Instagram: https://www.instagram.com/mohitm07live/ for daily reels & stories $(user)!' },
    { name: 'rules', response: '📜 Chat Rules: 1. No abusive words 2. No link spam 3. Support each other 4. Enjoy the stream $(user)!' },
    { name: 'commands', response: '🤖 Gaming Commands: !uid, !room, !custom, !sensi, !device, !giveaway, !rank, !discord, !instagram, !rules, !uptime, !points' }
  ];

  const existingCommands = db.getCommands();
  for (const cmd of newCommands) {
    const existing = existingCommands.find(c => c.name.toLowerCase() === cmd.name.toLowerCase());
    if (existing) {
      db.updateCommand(existing.id, { response: cmd.response, enabled: true });
      console.log(`Updated command: !${cmd.name}`);
    } else {
      db.addCommand({ name: cmd.name, response: cmd.response, enabled: true, userLevel: 'everyone', cooldown: 5 });
      console.log(`Created command: !${cmd.name}`);
    }
  }

  console.log('\n--- Setting up Gaming Timers ---');
  const newTimers = [
    { name: 'Like & Subscribe Hype', message: '🔥 High-energy gaming stream chal rahi hai! Like button thoko aur channel Subscribe karke bell icon ON karlo squad! 🔔', intervalMinutes: 8, minChatLines: 2, enabled: true },
    { name: 'Custom Room Match Alert', message: '🎁 Next Custom Room Match target likes par create hoga! Stream share karo aur UID drop karo chat me! 🏆', intervalMinutes: 12, minChatLines: 3, enabled: true },
    { name: 'Discord Squad Community', message: '💬 Voice chat aur squad tournaments ke liye Discord join karo: https://discord.gg/mkHSm7mrdT 🎮', intervalMinutes: 15, minChatLines: 3, enabled: true }
  ];

  const existingTimers = db.getTimers();
  for (const tm of newTimers) {
    const existing = existingTimers.find(t => t.name.toLowerCase() === tm.name.toLowerCase());
    if (existing) {
      db.updateTimer(existing.id, tm);
      console.log(`Updated timer: "${tm.name}"`);
    } else {
      db.addTimer(tm);
      console.log(`Created timer: "${tm.name}"`);
    }
  }

  console.log('\n✅ Gaming profile configured successfully!');
}

setupGamingConfig();
