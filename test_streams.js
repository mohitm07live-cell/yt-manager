async function testStreams() {
  const res = await fetch('https://www.youtube.com/@mohitm07live/streams', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  const match = html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (!match) {
    console.log('No ytInitialData match');
    return;
  }
  const data = JSON.parse(match[1]);
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const streamsTab = tabs.find(t => t.tabRenderer?.content?.richGridRenderer);
  const contents = streamsTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
  console.log('Total contents:', contents.length);
  const seen = new Set();
  contents.forEach((item, idx) => {
    const lvm = item.richItemRenderer?.content?.lockupViewModel;
    if (lvm && lvm.contentId) {
      const id = lvm.contentId;
      const title = lvm.metadata?.lockupMetadataViewModel?.title?.content;
      const rows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
      const rowTexts = rows.flatMap(r => r.metadataParts?.map(p => p.text?.content)).filter(Boolean);
      console.log(`#${idx+1}: ID=${id}, Duplicate=${seen.has(id)}, Title=${title?.slice(0, 35)}, Meta=${rowTexts.join(' | ')}`);
      seen.add(id);
    }
  });
}

testStreams();
