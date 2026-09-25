const fs = require('fs');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, '../public/sounds');

// High-Fidelity 16-bit PCM Stereo WAV Generator for Soundboard Effects
function generateSoundWav(type) {
  const sampleRate = 44100;
  let duration = 1.2;
  
  if (type === 'airhorn') duration = 1.0;
  else if (type === 'boom') duration = 1.5;
  else if (type === 'applause') duration = 2.0;
  else if (type === 'victory') duration = 1.8;
  else if (type === 'buzzer') duration = 0.8;
  else if (type === 'headshot') duration = 0.9;
  else if (type === 'gg') duration = 1.4;
  else if (type === 'laugh') duration = 1.6;

  const numSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + numSamples * 4); // 16-bit stereo

  // RIFF Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // Stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 4, 40);

  let offset = 44;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    if (type === 'airhorn') {
      // Classic Stadium Reggae Airhorn Pitch Pulses
      const pulse = Math.sin(2 * Math.PI * 466.16 * t) + 0.5 * Math.sin(2 * Math.PI * 932.33 * t) + 0.25 * Math.sin(2 * Math.PI * 1398.5 * t);
      const mod = Math.sin(2 * Math.PI * 15 * t) > 0 ? 1 : 0.4;
      const env = Math.min(1, t * 20) * Math.max(0, 1 - t / duration);
      sampleL = pulse * mod * env * 0.7;
      sampleR = pulse * mod * env * 0.7;
    } else if (type === 'boom') {
      // Sub Bass Cinematic Drop Impact
      const freq = Math.max(30, 220 * Math.exp(-t * 5));
      const sub = Math.sin(2 * Math.PI * freq * t);
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.4;
      const env = Math.exp(-t * 2.5);
      sampleL = (sub + noise) * env * 0.85;
      sampleR = (sub + noise) * env * 0.85;
    } else if (type === 'victory') {
      // Heroic Major Chord Fanfare
      const step = Math.floor(t * 4);
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      const freq = freqs[Math.min(freqs.length - 1, step)];
      const wave = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
      const env = Math.max(0, 1 - (t % 0.4) * 2) * Math.max(0, 1 - t / duration);
      sampleL = wave * env * 0.75;
      sampleR = wave * env * 0.75;
    } else if (type === 'applause') {
      // Crisp Crowd Applause Noise Simulation
      const noise1 = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * t));
      const noise2 = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 11 * t));
      const env = Math.min(1, t * 5) * Math.max(0, 1 - t / duration);
      sampleL = noise1 * env * 0.5;
      sampleR = noise2 * env * 0.5;
    } else if (type === 'buzzer') {
      // Game Show Error Buzzer
      const sq1 = Math.sin(2 * Math.PI * 130.81 * t) > 0 ? 0.6 : -0.6;
      const sq2 = Math.sin(2 * Math.PI * 138.59 * t) > 0 ? 0.6 : -0.6;
      const env = Math.max(0, 1 - t / duration);
      sampleL = (sq1 + sq2) * env * 0.5;
      sampleR = (sq1 + sq2) * env * 0.5;
    } else if (type === 'headshot') {
      // Crisp FPS Sniper Hit Ping
      const ping = Math.sin(2 * Math.PI * 1760 * Math.exp(-t * 2) * t);
      const pop = (Math.random() * 2 - 1) * Math.exp(-t * 20);
      const env = Math.exp(-t * 4);
      sampleL = (ping * 0.7 + pop * 0.3) * env * 0.8;
      sampleR = (ping * 0.7 + pop * 0.3) * env * 0.8;
    } else if (type === 'gg') {
      // Melodic GG Chime
      const freqs = [440, 554.37, 659.25, 880];
      const step = Math.min(3, Math.floor(t * 3.5));
      const f = freqs[step];
      const tone = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
      const env = Math.max(0, 1 - (t % 0.3) * 2.5) * Math.max(0, 1 - t / duration);
      sampleL = tone * env * 0.7;
      sampleR = tone * env * 0.7;
    } else if (type === 'laugh') {
      // Cartoon Bounce Laugh Tone
      const pitch = 350 + 100 * Math.sin(2 * Math.PI * 7 * t);
      const tone = Math.sin(2 * Math.PI * pitch * t);
      const env = Math.sin(2 * Math.PI * 3.5 * t) * Math.max(0, 1 - t / duration);
      sampleL = tone * Math.abs(env) * 0.6;
      sampleR = tone * Math.abs(env) * 0.6;
    }

    const valL = Math.max(-32768, Math.min(32767, Math.floor(sampleL * 32767)));
    const valR = Math.max(-32768, Math.min(32767, Math.floor(sampleR * 32767)));
    buffer.writeInt16LE(valL, offset);
    buffer.writeInt16LE(valR, offset + 2);
    offset += 4;
  }

  return buffer;
}

// Ensure all soundboard sounds exist
const SFX_LIST = [
  { id: 'airhorn', name: 'Air Horn', icon: 'fa-bullhorn', category: 'hype' },
  { id: 'boom', name: 'Dramatic Boom', icon: 'fa-bomb', category: 'hype' },
  { id: 'victory', name: 'Victory Horn', icon: 'fa-trophy', category: 'celebration' },
  { id: 'applause', name: 'Crowd Applause', icon: 'fa-hands-clapping', category: 'celebration' },
  { id: 'gg', name: 'Good Game (GG)', icon: 'fa-gamepad', category: 'gaming' },
  { id: 'headshot', name: 'Headshot / Hit', icon: 'fa-crosshairs', category: 'gaming' },
  { id: 'laugh', name: 'Laugh Track', icon: 'fa-face-laugh-squint', category: 'funny' },
  { id: 'buzzer', name: 'Fail Buzzer', icon: 'fa-ban', category: 'funny' }
];

function initSoundboardFiles() {
  if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, { recursive: true });

  SFX_LIST.forEach(sfx => {
    const filePath = path.join(SOUNDS_DIR, `${sfx.id}.wav`);
    if (!fs.existsSync(filePath)) {
      const wavBuf = generateSoundWav(sfx.id);
      fs.writeFileSync(filePath, wavBuf);
    }
  });
}

initSoundboardFiles();

class SoundboardService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  getSoundsList() {
    return SFX_LIST.map(s => ({
      ...s,
      url: `/sounds/${s.id}.wav`
    }));
  }

  playSound(soundId, triggeredBy = 'Streamer') {
    const sfx = SFX_LIST.find(s => s.id === soundId);
    if (!sfx) return null;

    const payload = {
      id: sfx.id,
      name: sfx.name,
      url: `/sounds/${sfx.id}.wav`,
      triggeredBy,
      timestamp: new Date().toISOString()
    };

    if (this.io) {
      // Broadcast to both dashboard and OBS alerts
      this.io.emit('soundboardPlay', payload);
    }

    return payload;
  }
}

module.exports = new SoundboardService();
