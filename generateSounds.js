const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, 'src', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

function createWavBuffer(sampleRate, durationSec, generateSample) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt Chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data Chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = generateSample(t, i, totalSamples, sampleRate);
    
    // Clamp to -1.0 .. 1.0 and convert to 16-bit PCM integer
    const sampleL = Math.max(-1, Math.min(1, left));
    const sampleR = Math.max(-1, Math.min(1, right));
    
    buffer.writeInt16LE(Math.floor(sampleL < 0 ? sampleL * 32768 : sampleL * 32767), offset);
    buffer.writeInt16LE(Math.floor(sampleR < 0 ? sampleR * 32768 : sampleR * 32767), offset + 2);
    offset += 4;
  }

  return buffer;
}

// 1. Subscriber Alert Sound (Fanfare + Sparkle + Sub-Drop)
const subWav = createWavBuffer(44100, 2.4, (t) => {
  let left = 0;
  let right = 0;

  // Sub bass impact
  if (t < 0.6) {
    const subFreq = 120 * Math.exp(-t * 4);
    const subEnv = Math.exp(-t * 5) * 0.7;
    const sub = Math.sin(2 * Math.PI * subFreq * t) * subEnv;
    left += sub;
    right += sub;
  }

  // Harmonic Major Arpeggio notes: C5 (523), E5 (659), G5 (784), B5 (988), C6 (1046), E6 (1318), G6 (1568)
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98];
  notes.forEach((freq, idx) => {
    const noteStart = idx * 0.085;
    if (t >= noteStart) {
      const dt = t - noteStart;
      const env = Math.exp(-dt * (idx === notes.length - 1 ? 2.2 : 4.5)) * 0.45;
      
      // Fundamental + Harmonics
      const val = (Math.sin(2 * Math.PI * freq * dt) + 
                   0.35 * Math.sin(2 * Math.PI * freq * 2 * dt) + 
                   0.15 * Math.sin(2 * Math.PI * freq * 3 * dt)) * env;
      
      const pan = (idx / (notes.length - 1)) * 0.6 + 0.2; // 0.2 to 0.8
      left += val * (1 - pan);
      right += val * pan;
    }
  });

  // Sparkle Chimes
  if (t > 0.4) {
    const sparkleNotes = [2093, 2637, 3135, 3520, 4186];
    sparkleNotes.forEach((f, i) => {
      const st = 0.45 + i * 0.06;
      if (t >= st) {
        const sdt = t - st;
        const sEnv = Math.exp(-sdt * 6) * 0.15;
        const sVal = Math.sin(2 * Math.PI * f * sdt) * sEnv;
        left += sVal * (i % 2 === 0 ? 0.8 : 0.2);
        right += sVal * (i % 2 === 0 ? 0.2 : 0.8);
      }
    });
  }

  return [left * 0.85, right * 0.85];
});
fs.writeFileSync(path.join(soundsDir, 'subscriber.wav'), subWav);

// 2. Super Chat Alert Sound (Jackpot Coins + Golden Bells + Power Chime)
const superChatWav = createWavBuffer(44100, 2.6, (t) => {
  let left = 0;
  let right = 0;

  // Initial energetic punch
  if (t < 0.5) {
    const kick = Math.sin(2 * Math.PI * 150 * Math.exp(-t * 6) * t) * Math.exp(-t * 6) * 0.6;
    left += kick;
    right += kick;
  }

  // Golden Coin Cascade Sparkles
  const coinTones = [880, 1174, 1479, 1760, 2093, 2349, 2793, 3135, 3520];
  coinTones.forEach((freq, idx) => {
    const start = idx * 0.06;
    if (t >= start) {
      const dt = t - start;
      const env = Math.exp(-dt * (idx >= coinTones.length - 2 ? 1.8 : 4.0)) * 0.4;
      const coin = (Math.sin(2 * Math.PI * freq * dt) + 0.3 * Math.sin(2 * Math.PI * freq * 2.5 * dt)) * env;
      const pan = (idx % 2 === 0) ? 0.3 : 0.7;
      left += coin * (1 - pan);
      right += coin * pan;
    }
  });

  // Final sustained triumphant chord
  if (t >= 0.5) {
    const cdt = t - 0.5;
    const cEnv = Math.exp(-cdt * 1.5) * 0.35;
    [1046.5, 1318.5, 1567.98, 2093].forEach(freq => {
      const v = Math.sin(2 * Math.PI * freq * cdt) * cEnv;
      left += v * 0.5;
      right += v * 0.5;
    });
  }

  return [left * 0.85, right * 0.85];
});
fs.writeFileSync(path.join(soundsDir, 'superchat.wav'), superChatWav);

// 3. Membership Alert Sound (Royal Fanfare & Warm Pad)
const memberWav = createWavBuffer(44100, 2.5, (t) => {
  let left = 0;
  let right = 0;

  const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760];
  notes.forEach((freq, idx) => {
    const start = idx * 0.08;
    if (t >= start) {
      const dt = t - start;
      const env = Math.exp(-dt * (idx === notes.length - 1 ? 1.8 : 3.5)) * 0.45;
      // Rich brass-like wave (fundamental + odd harmonics)
      const val = (Math.sin(2 * Math.PI * freq * dt) + 
                   0.4 * Math.sin(2 * Math.PI * freq * 2 * dt) + 
                   0.25 * Math.sin(2 * Math.PI * freq * 3 * dt) + 
                   0.1 * Math.sin(2 * Math.PI * freq * 4 * dt)) * env;
      const pan = (idx / notes.length) * 0.6 + 0.2;
      left += val * (1 - pan);
      right += val * pan;
    }
  });

  return [left * 0.85, right * 0.85];
});
fs.writeFileSync(path.join(soundsDir, 'membership.wav'), memberWav);

// 4. Unsubscriber Alert Sound (Soft Gentle Pop)
const unsubWav = createWavBuffer(44100, 1.2, (t) => {
  let left = 0;
  let right = 0;

  const notes = [523.25, 440, 349.23, 261.63];
  notes.forEach((freq, idx) => {
    const start = idx * 0.1;
    if (t >= start) {
      const dt = t - start;
      const env = Math.exp(-dt * 4.5) * 0.4;
      const val = Math.sin(2 * Math.PI * freq * dt) * env;
      left += val * 0.5;
      right += val * 0.5;
    }
  });

  return [left * 0.85, right * 0.85];
});
fs.writeFileSync(path.join(soundsDir, 'unsubscriber.wav'), unsubWav);

console.log('✅ All 4 studio alert sound files successfully generated in src/public/sounds/!');
