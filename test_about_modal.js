async function getAboutChannel() {
  const res = await fetch('https://www.youtube.com/@mohitm07live', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  const match = html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (!match) return;

  const data = JSON.parse(match[1]);
  const str = JSON.stringify(data);

  // Find all occurrences of view count or stats in about modal
  const matches = str.match(/"viewCountText":\{"simpleText":"([^"]+)"\}/g);
  console.log('Matches:', matches);

  const aboutMatch = str.match(/"aboutChannelViewModel":\{.+?\}/);
  if (aboutMatch) {
    console.log('About model:', aboutMatch[0].slice(0, 500));
  }
}

getAboutChannel();
