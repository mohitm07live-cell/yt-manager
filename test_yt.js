const fs = require('fs');

async function testVideo(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();

  // 1. Initial Player Response
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (playerMatch) {
    const p = JSON.parse(playerMatch[1]);
    console.log('Player Response details:');
    console.log('Title:', p.videoDetails?.title);
    console.log('ViewCount:', p.videoDetails?.viewCount);
    console.log('Author:', p.videoDetails?.author);
    console.log('Keywords:', p.videoDetails?.keywords?.length);
    console.log('Length (sec):', p.videoDetails?.lengthSeconds);
  }

  // 2. Initial Data for likes & comments
  const dataMatch = html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (dataMatch) {
    const raw = dataMatch[1];
    // Find like text in initial data
    const likeRegex = /"accessibilityData":\{"label":"([0-9,]+)\s+likes"/;
    const lMatch = raw.match(likeRegex);
    if (lMatch) {
      console.log('Exact Likes:', lMatch[1]);
    } else {
      const altLike = raw.match(/"defaultText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/);
      if (altLike) console.log('Alt Like string:', altLike[1]);
    }

    // Find comment count in initial data
    const commentRegex = /"commentCount":\{"simpleText":"([0-9,]+)"/;
    const cMatch = raw.match(commentRegex);
    if (cMatch) {
      console.log('Exact Comments:', cMatch[1]);
    }
  }
}

testVideo('-Fi2jqe3Ox0');
