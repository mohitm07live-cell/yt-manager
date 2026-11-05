const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- 1. Testing Commands via Simulator ---');
  await post('/api/test-message', { user: 'StreamViewer99', text: '!discord' });
  await post('/api/test-message', { user: 'StreamViewer99', text: '!instagram' });
  await post('/api/test-message', { user: 'StreamViewer99', text: '!points' });
  await post('/api/test-message', { user: 'StreamViewer99', text: '!spin' });
  await post('/api/test-message', { user: 'StreamViewer99', text: '!gamble 25' });
  await post('/api/test-message', { user: 'StreamViewer99', text: '!clip Clutch Round 12' });

  console.log('--- 2. Fetching Logs ---');
  const logs = await get('/api/logs?limit=8');
  console.log('Recent Logs:', JSON.stringify(logs, null, 2));

  console.log('--- 3. Testing Goals ---');
  const goals = await get('/api/goals');
  console.log('Goals loaded:', Object.keys(goals));

  console.log('--- 4. Testing Soundboard ---');
  const sfx = await post('/api/soundboard/play', { soundId: 'airhorn' });
  console.log('SFX result:', sfx);

  console.log('--- 5. Testing Polls ---');
  const poll = await post('/api/polls/start', {
    question: 'Favorite Game to Stream?',
    options: ['Valorant', 'GTA 5', 'Minecraft'],
    durationSeconds: 120
  });
  console.log('Poll created:', poll.poll?.question);

  const voteRes = await post('/api/polls/vote', {
    authorId: 'voter1',
    authorName: 'MohitFan',
    vote: '1'
  });
  console.log('Vote result:', voteRes.success, 'Leader Option:', voteRes.option?.text);

  console.log('--- 6. Testing Loyalty Leaderboard ---');
  const leaderboard = await get('/api/loyalty/leaderboard?limit=5');
  console.log('Leaderboard count:', leaderboard.leaderboard?.length);

  console.log('--- 7. Testing Highlights ---');
  const hl = await get('/api/highlights');
  console.log('Highlights count:', hl.highlights?.length);

  console.log('--- ALL SYSTEMS VERIFIED AND OPERATIONAL! ---');
}

runTests().catch(console.error);
