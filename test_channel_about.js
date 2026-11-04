async function testChannel() {
  const res = await fetch('https://www.youtube.com/@mohitm07live', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  const match = html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (!match) {
    console.log('No ytInitialData');
    return;
  }
  const data = JSON.parse(match[1]);
  const str = JSON.stringify(data);

  // 1. Channel metadata
  const header = data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
  console.log('Title:', header?.title?.dynamicTextViewModel?.text?.content);
  
  // 2. Metadata rows (subscribers, videos)
  const metaRows = header?.metadata?.contentMetadataViewModel?.metadataRows || [];
  metaRows.forEach(r => {
    const parts = r.metadataParts || [];
    parts.forEach(p => {
      console.log('Header part:', p.text?.content);
    });
  });

  // 3. Find exact view count in about modal or channel description
  const viewMatch = str.match(/([0-9,]+)\s+views/);
  console.log('View count text:', viewMatch ? viewMatch[0] : 'None');

  // Let's also check all videos sum from the streams tab
  const streamsRes = await fetch('https://www.youtube.com/@mohitm07live/streams', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const streamsHtml = await streamsRes.text();
  const streamsMatch = streamsHtml.match(/var ytInitialData\s*=\s*({.+?});/);
  if (streamsMatch) {
    const sData = JSON.parse(streamsMatch[1]);
    const tabs = sData.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    const streamsTab = tabs.find(t => t.tabRenderer?.content?.richGridRenderer);
    const contents = streamsTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
    
    let totalStreamViews = 0;
    let streamCount = 0;
    const seen = new Set();

    for (const item of contents) {
      const lvm = item.richItemRenderer?.content?.lockupViewModel;
      if (lvm && lvm.contentId) {
        const id = lvm.contentId;
        if (seen.has(id)) continue;
        seen.add(id);

        const rows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
        const rowTexts = rows.flatMap(r => r.metadataParts?.map(p => p.text?.content)).filter(Boolean);
        const viewStr = rowTexts.find(t => t.includes('view') || t.includes('watching'));
        let views = 0;
        if (viewStr) {
          const cleanStr = viewStr.toLowerCase().replace(/[^0-9.kmb]/g, '');
          if (cleanStr.includes('k')) {
            views = Math.round(parseFloat(cleanStr) * 1000);
          } else if (cleanStr.includes('m')) {
            views = Math.round(parseFloat(cleanStr) * 1000000);
          } else {
            views = parseInt(cleanStr, 10) || 0;
          }
        }
        totalStreamViews += views;
        streamCount++;
      }
    }
    console.log(`Scraped ${streamCount} unique streams.`);
    console.log(`Sum of Views across all ${streamCount} recent streams = ${totalStreamViews}`);
    console.log(`Avg views per stream = ${Math.round(totalStreamViews / streamCount)}`);
  }
}

testChannel();
