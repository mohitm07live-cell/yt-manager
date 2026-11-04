const fs = require('fs');

async function testFetch() {
  const videoId = '-Fi2jqe3Ox0';
  const watchRes = await fetch('https://www.youtube.com/watch?v=' + videoId, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await watchRes.text();
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (apiKeyMatch) {
    const key = apiKeyMatch[1];
    const nextRes = await fetch('https://www.youtube.com/youtubei/v1/next?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20231201.00.00', hl: 'en', gl: 'IN' } },
        videoId
      })
    });
    const nextData = await nextRes.json();
    const contents = nextData.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
    const itemSection = contents.find(c => c.itemSectionRenderer?.sectionIdentifier === 'comment-item-section');
    if (itemSection) {
      const continuationToken = itemSection.itemSectionRenderer?.contents?.[0]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (continuationToken) {
        const commentRes = await fetch('https://www.youtube.com/youtubei/v1/next?key=' + key, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion: '2.20231201.00.00', hl: 'en', gl: 'IN' } },
            continuation: continuationToken
          })
        });
        const commentData = await commentRes.json();
        const mutations = commentData.frameworkUpdates?.entityBatchUpdate?.mutations || [];
        console.log('Mutations count:', mutations.length);
        const comments = [];
        for (const m of mutations) {
          const payload = m.payload?.commentEntityPayload;
          if (payload) {
            const author = payload.author?.displayName || 'Viewer';
            const text = payload.properties?.content?.content || '';
            const likes = parseInt(payload.toolbar?.likeCountNotliked || '0', 10) || 0;
            const publishedTime = payload.properties?.publishedTime || '';
            comments.push({ author, text, likes, publishedTime });
          }
        }
        console.log('Successfully extracted real YouTube comments:', comments.length);
        console.log('Real Comments:', comments);
      }
    }
  }
}

testFetch().catch(console.error);
