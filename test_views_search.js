async function findChannelStats() {
  const res = await fetch('https://www.youtube.com/@mohitm07live', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  
  // Search for anything with "views"
  const viewLines = html.match(/"([^"]*views[^"]*)"/gi) || [];
  console.log('Unique view phrases:');
  const uniqueViews = [...new Set(viewLines.map(v => v.replace(/"/g, '')))];
  console.log(uniqueViews);
}

findChannelStats();
