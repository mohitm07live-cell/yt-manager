const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const cacheDir = path.join(__dirname, '..', '..', 'data', 'tts_cache');
const studioDir = path.join(__dirname, '..', '..', 'data', 'tts_studio');
const chunksDir = path.join(__dirname, '..', '..', 'data', 'tts_chunks');

[cacheDir, studioDir, chunksDir].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// In-memory buffer cache for short response TTS (Capped at 50 items to fit in Render 512MB RAM)
const MAX_MEMORY_CACHE_ITEMS = 50;
const memoryCache = new Map();

function setMemoryCache(key, value) {
  if (memoryCache.size >= MAX_MEMORY_CACHE_ITEMS) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, value);
}

/**
 * Locate workspace FFmpeg binary
 */
function getFFmpegExe() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  if (process.platform === 'win32') {
    const localBin = path.join(process.cwd(), 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localBin)) {
      return localBin;
    }
  }
  return 'ffmpeg';
}

/**
 * Clean text for TTS engine while preserving Hindi/English punctuation
 */
function cleanTextForSpeech(text, maxLen = null) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/@+/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[!*#~_]{2,}/g, '!')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (maxLen && cleaned.length > maxLen) {
    cleaned = cleaned.substring(0, maxLen);
  }
  return cleaned;
}

/**
 * Smart Sentence Chunking for Long Text
 * Splits text into natural clause & sentence groups of max ~100 characters
 * for seamless compatibility with all TTS engines (Google Translate & SAPI5).
 */
function chunkTextForSpeech(text, maxChunkLen = 100) {
  const sanitized = cleanTextForSpeech(text);
  if (!sanitized) return [];

  const paragraphs = sanitized.split(/\n+/);
  const chunks = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Split by sentence and clause punctuation: ., !, ?, ;, :, ,, ।, |, or newlines
    const clauses = trimmedPara.match(/[^.!?;:,,।|\n]+[.!?;:,,।|\n]*/g) || [trimmedPara];
    let currentChunk = '';

    for (let clause of clauses) {
      clause = clause.trim();
      if (!clause) continue;

      if (clause.length > maxChunkLen) {
        const words = clause.split(' ');
        for (const word of words) {
          if (!word) continue;
          if ((currentChunk + ' ' + word).trim().length <= maxChunkLen) {
            currentChunk = (currentChunk + ' ' + word).trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      } else {
        if ((currentChunk + ' ' + clause).trim().length <= maxChunkLen) {
          currentChunk = (currentChunk + ' ' + clause).trim();
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = clause;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  }

  return chunks;
}

function resolveSapiVoice(voiceParam = '') {
  const lower = (voiceParam || '').toLowerCase();
  if (lower.includes('david') || lower.includes('male')) {
    return 'Microsoft David Desktop';
  }
  return 'Microsoft Zira Desktop';
}

/**
 * Fetch Audio Chunk from Google Translate TTS API
 */
function generateGoogleAudioChunk(text, lang = 'hi', outPath) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Google TTS status code ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(outPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outPath);
      });
      fileStream.on('error', (err) => {
        fs.unlink(outPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate Audio Chunk via Windows SAPI5 PowerShell
 */
function generateSapiWavChunk(text, voiceName, rate = 1.0, outPath) {
  return new Promise((resolve, reject) => {
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '`"');
    const escapedOutput = outPath.replace(/'/g, "''");
    const escapedVoice = voiceName.replace(/'/g, "''");

    const rateInt = Math.max(-5, Math.min(5, Math.round((rate - 1.0) * 8)));

    const psScript = `
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $speaker.SelectVoice('${escapedVoice}')
} catch {}
$speaker.Rate = ${rateInt}
$speaker.Volume = 100
$speaker.SetOutputToWaveFile('${escapedOutput}')
$speaker.Speak("${escapedText}")
$speaker.Dispose()
`;

    const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err) => {
      if (err || !fs.existsSync(outPath)) {
        return reject(err || new Error('SAPI output file missing'));
      }
      resolve(outPath);
    });
  });
}

/**
 * Stitch multiple audio chunks into a single master MP3 audio file using FFmpeg
 * Supports dynamic audio filter modulation for distinct male & female voice pitch
 */
function stitchAudioChunks(chunkFilePaths, masterOutputPath, audioFilter = null) {
  return new Promise((resolve, reject) => {
    if (!chunkFilePaths || chunkFilePaths.length === 0) {
      return reject(new Error('No audio chunks provided for stitching'));
    }

    const concatListPath = path.join(chunksDir, `concat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.txt`);
    const fileLines = chunkFilePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, fileLines, 'utf8');

    const ffmpegExe = getFFmpegExe();
    const firstChunk = chunkFilePaths[0] || '';
    const isWav = firstChunk.endsWith('.wav');

    let filterStr = isWav ? '-ar 44100' : '-c copy';
    if (audioFilter) {
      filterStr = `-af "${audioFilter}" -ar 44100`;
    }

    const cmd = `"${ffmpegExe}" -f concat -safe 0 -i "${concatListPath}" ${filterStr} "${masterOutputPath}" -y`;

    exec(cmd, (err) => {
      // Clean up concat list file
      try { fs.unlinkSync(concatListPath); } catch (e) {}

      if (err || !fs.existsSync(masterOutputPath) || fs.statSync(masterOutputPath).size === 0) {
        // Fallback concat
        const fallbackCmd = `"${ffmpegExe}" -f concat -safe 0 -i "${concatListPath}" -ar 44100 "${masterOutputPath}" -y`;
        exec(fallbackCmd, (err2) => {
          if (err2 || !fs.existsSync(masterOutputPath) || fs.statSync(masterOutputPath).size === 0) {
            try {
              const writeStream = fs.createWriteStream(masterOutputPath);
              for (const chunkPath of chunkFilePaths) {
                const data = fs.readFileSync(chunkPath);
                writeStream.write(data);
              }
              writeStream.end();
              return resolve(masterOutputPath);
            } catch (fallbackErr) {
              return reject(new Error('Failed to stitch audio files: ' + (err?.message || fallbackErr.message)));
            }
          }
          resolve(masterOutputPath);
        });
        return;
      }

      resolve(masterOutputPath);
    });
  });
}

/**
 * Core Long Speech Generation Function
 */
async function generateLongSpeechAudio({ text, voice = 'google_hi_female', rate = 1.0, title = 'Speech Audio' }, onProgress = () => {}) {
  const jobId = 'tts_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const chunks = chunkTextForSpeech(text);

  if (chunks.length === 0) {
    throw new Error('Please enter valid text to convert to speech');
  }

  // On non-Windows platforms (like Render/Linux), SAPI is unavailable, so default to Google Neural TTS
  const isGoogle = (process.platform !== 'win32') || voice.startsWith('google_') || voice === 'hi' || voice === 'en';
  let lang = 'hi';
  if (voice.includes('en')) lang = 'en';
  if (voice.includes('es')) lang = 'es';
  if (voice.includes('fr')) lang = 'fr';

  const sapiVoiceName = resolveSapiVoice(voice);
  const chunkFilePaths = [];
  const tempFilesToClean = [];

  // Determine pitch & character filter for Google Male vs Female voices
  let audioFilter = null;
  if (isGoogle) {
    if (voice.includes('male')) {
      // Deep baritone male pitch shift
      audioFilter = 'asetrate=24000*0.82,aresample=44100,atempo=1.22';
    } else if (voice.includes('female')) {
      // Crisp studio female tone
      audioFilter = 'asetrate=24000*1.05,aresample=44100,atempo=0.952';
    }
  }

  onProgress({
    jobId,
    status: 'starting',
    progress: 0,
    currentChunk: 0,
    totalChunks: chunks.length,
    statusText: `Preparing script into ${chunks.length} sentence block${chunks.length === 1 ? '' : 's'}...`
  });

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkFile = path.join(chunksDir, `${jobId}_chunk_${i}.${isGoogle ? 'mp3' : 'wav'}`);
      tempFilesToClean.push(chunkFile);

      const currentPct = Math.round(((i + 0.5) / chunks.length) * 85);
      onProgress({
        jobId,
        status: 'generating',
        progress: currentPct,
        currentChunk: i + 1,
        totalChunks: chunks.length,
        statusText: `Synthesizing sentence ${i + 1} of ${chunks.length}...`
      });

      if (isGoogle) {
        await generateGoogleAudioChunk(chunkText, lang, chunkFile);
      } else {
        await generateSapiWavChunk(chunkText, sapiVoiceName, rate, chunkFile);
      }

      chunkFilePaths.push(chunkFile);
    }

    onProgress({
      jobId,
      status: 'stitching',
      progress: 90,
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      statusText: 'Stitching all audio chunks into master MP3 audio file with FFmpeg...'
    });

    const sanitizedTitle = (title || text.slice(0, 30))
      .replace(/[^\w\s\u0900-\u097F-]/gi, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40);

    const masterFilename = `TTS_${sanitizedTitle}_${Date.now()}.mp3`;
    const masterFullPath = path.join(studioDir, masterFilename);

    await stitchAudioChunks(chunkFilePaths, masterFullPath, audioFilter);

    // Clean up temporary chunk files
    for (const tmp of tempFilesToClean) {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }

    // Get file size and estimate duration
    const stat = fs.statSync(masterFullPath);
    const sizeBytes = stat.size;
    const sizeFormatted = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
    
    // Estimate audio duration based on word count (~150 words per minute)
    const totalWords = text.trim().split(/\s+/).length;
    const estSec = Math.max(2, Math.round((totalWords / 150) * 60));
    const mins = Math.floor(estSec / 60);
    const secs = estSec % 60;
    const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const result = {
      id: jobId,
      title: title || text.slice(0, 45) + '...',
      filename: masterFilename,
      fullPath: masterFullPath,
      downloadUrl: `/api/tts/studio/file/${encodeURIComponent(masterFilename)}`,
      sizeBytes,
      sizeFormatted,
      durationFormatted,
      wordCount: totalWords,
      charCount: text.length,
      chunkCount: chunks.length,
      voice,
      engine: isGoogle ? 'Google Neural TTS' : 'Windows SAPI5 Studio',
      rate,
      createdAt: new Date().toISOString()
    };

    onProgress({
      jobId,
      status: 'completed',
      progress: 100,
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      statusText: 'Audio Generation Complete!',
      result
    });

    return result;

  } catch (err) {
    // Clean temp files on failure
    for (const tmp of tempFilesToClean) {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
    onProgress({
      jobId,
      status: 'error',
      progress: 0,
      statusText: `TTS Generation Error: ${err.message}`
    });
    throw err;
  }
}

/**
 * Short chat TTS fallback helper (used by live bot engine)
 */
async function generateSpeechAudio(text, options = {}) {
  const cleaned = cleanTextForSpeech(text, 250);
  if (!cleaned) return null;

  const voiceName = resolveSapiVoice(options.voice || options.voiceURI || '');
  const rate = options.rate !== undefined ? parseFloat(options.rate) : 1.0;

  const hashKey = `${cleaned}__${voiceName}__${rate}`;
  const hash = crypto.createHash('md5').update(hashKey).digest('hex');

  if (memoryCache.has(hash)) {
    return memoryCache.get(hash);
  }

  const cachedFileWav = path.join(cacheDir, `${hash}.wav`);
  const cachedFileMp3 = path.join(cacheDir, `${hash}.mp3`);

  if (fs.existsSync(cachedFileWav)) {
    try {
      const data = { buffer: fs.readFileSync(cachedFileWav), contentType: 'audio/wav' };
      setMemoryCache(hash, data);
      return data;
    } catch (e) {}
  }

  if (fs.existsSync(cachedFileMp3)) {
    try {
      const data = { buffer: fs.readFileSync(cachedFileMp3), contentType: 'audio/mpeg' };
      setMemoryCache(hash, data);
      return data;
    } catch (e) {}
  }

  // Windows SAPI synthesizer
  if (process.platform === 'win32') {
    try {
      await generateSapiWavChunk(cleaned, voiceName, rate, cachedFileWav);
      if (fs.existsSync(cachedFileWav)) {
        const buf = fs.readFileSync(cachedFileWav);
        const data = { buffer: buf, contentType: 'audio/wav' };
        setMemoryCache(hash, data);
        return data;
      }
    } catch (e) {}
  }

  // Linux / Render cloud fallback to Google TTS
  try {
    const lang = (options.voice || '').includes('en') ? 'en' : 'hi';
    await generateGoogleAudioChunk(cleaned.slice(0, 150), lang, cachedFileMp3);
    if (fs.existsSync(cachedFileMp3)) {
      const buf = fs.readFileSync(cachedFileMp3);
      const data = { buffer: buf, contentType: 'audio/mpeg' };
      setMemoryCache(hash, data);
      return data;
    }
  } catch (e) {}

  return null;
}

function getAvailableVoices() {
  return [
    { id: 'google_hi_female', name: 'Hindi Female (Swara Neural)', lang: 'hi', gender: 'Female', engine: 'Google TTS', desc: 'Crisp, natural Hindi female voice for stories & news' },
    { id: 'google_hi_male', name: 'Hindi Male (Madhur Neural)', lang: 'hi', gender: 'Male', engine: 'Google TTS', desc: 'Deep, engaging Hindi male voice for gaming & commentaries' },
    { id: 'google_en_female', name: 'English Studio Female', lang: 'en', gender: 'Female', engine: 'Google TTS', desc: 'Fluent American English studio voice' },
    { id: 'google_en_male', name: 'English Studio Male', lang: 'en', gender: 'Male', engine: 'Google TTS', desc: 'Clear, energetic English male announcer voice' },
    { id: 'sapi_zira', name: 'Microsoft Zira (Windows Studio)', lang: 'en-US', gender: 'Female', engine: 'SAPI5 System', desc: 'Built-in Windows female Desktop voice' },
    { id: 'sapi_david', name: 'Microsoft David (Windows Studio)', lang: 'en-US', gender: 'Male', engine: 'SAPI5 System', desc: 'Built-in Windows male Desktop voice' }
  ];
}

module.exports = {
  cleanTextForSpeech,
  chunkTextForSpeech,
  generateSpeechAudio,
  generateLongSpeechAudio,
  resolveSapiVoice,
  getAvailableVoices,
  studioDir
};
