const socket = io();

const alertCard = document.getElementById('alertCard');
const alertIcon = document.getElementById('alertIcon');
const alertTagline = document.getElementById('alertTagline');
const alertUsername = document.getElementById('alertUsername');
const alertSubtext = document.getElementById('alertSubtext');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let animFrameId = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Esports Multi-Shape Particle & Confetti Engine
class Particle {
  constructor(x, y, colorTheme) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 9 + 5;
    this.speedX = (Math.random() - 0.5) * 18;
    this.speedY = Math.random() * -16 - 7;
    this.gravity = 0.42;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 16;
    this.alpha = 1;
    this.decay = Math.random() * 0.012 + 0.009;
    this.theme = colorTheme;

    const palettes = {
      subscriber: ['#10b981', '#06b6d4', '#38bdf8', '#34d399', '#ffffff', '#a7f3d0'],
      superChat: ['#f59e0b', '#fbbf24', '#ef4444', '#f97316', '#ffffff', '#fde047'],
      membership: ['#a855f7', '#c084fc', '#ec4899', '#f43f5e', '#ffffff', '#f472b6'],
      unsubscriber: ['#f43f5e', '#e11d48', '#881337', '#cbd5e1']
    };

    const colors = palettes[colorTheme] || palettes.subscriber;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    
    // Choose shape based on theme
    const rand = Math.random();
    if (colorTheme === 'superChat' && rand > 0.6) {
      this.shape = 'coin'; // Golden coin shape
    } else if (colorTheme === 'subscriber' && rand > 0.6) {
      this.shape = 'heart'; // Floating mini heart
    } else if (rand > 0.75) {
      this.shape = 'star';
    } else if (rand > 0.4) {
      this.shape = 'ribbon';
    } else {
      this.shape = 'circle';
    }
  }

  update() {
    this.speedY += this.gravity;
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'ribbon') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 1.8);
    } else if (this.shape === 'star') {
      this.drawStar(0, 0, 4, this.size, this.size / 2);
    } else if (this.shape === 'coin') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this.shape === 'heart') {
      this.drawHeart(0, 0, this.size);
    }
    ctx.restore();
  }

  drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  drawHeart(cx, cy, size) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s / 4);
    ctx.quadraticCurveTo(cx, cy, cx - s / 2, cy);
    ctx.quadraticCurveTo(cx - s, cy, cx - s, cy + s / 2);
    ctx.quadraticCurveTo(cx - s, cy + s, cx, cy + s * 1.5);
    ctx.quadraticCurveTo(cx + s, cy + s, cx + s, cy + s / 2);
    ctx.quadraticCurveTo(cx + s, cy, cx + s / 2, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + s / 4);
    ctx.fill();
  }
}

function launchConfetti(theme) {
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight / 2;

  for (let i = 0; i < 48; i++) {
    particles.push(new Particle(originX, originY, theme));
  }

  if (!animFrameId) {
    animateParticles();
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  if (particles.length > 0) {
    animFrameId = requestAnimationFrame(animateParticles);
  } else {
    animFrameId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Polyphonic Web Audio API Synthesizer
// Polyphonic High-Impact Web Audio API Synthesizer (OBS CEF Optimized)
class SoundSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.unlocked = false;
    this.init();
    
    // Auto-unlock on any interaction or window event
    const unlockHandler = () => this.unlock();
    ['click', 'touchstart', 'keydown', 'mousemove', 'focus'].forEach(evt => {
      window.addEventListener(evt, unlockHandler, { once: true, passive: true });
    });
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  async ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        this.unlocked = true;
      } catch (e) {
        console.warn('AudioContext resume error:', e);
      }
    }
    return this.ctx;
  }

  async unlock() {
    await this.ensureContext();
    if (this.ctx && !this.unlocked) {
      try {
        // Play silent buffer to unlock browser audio restrictions
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
        this.unlocked = true;
      } catch (e) {}
    }
  }

  async playSubFanfare() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // 1. Bass Warmth Drop
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(130.81, now); // C3
    subOsc.frequency.exponentialRampToValueAtTime(65.41, now + 0.5); // C2
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain || ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.7);

    // 2. Harmonic Major 7th Fanfare + Sparkle Chime
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.65, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 1.2);
    });
  }

  async playSuperChatGold() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Golden Coin Cascade Sparkle Chimes
    const coinFrequencies = [880, 1174.66, 1479.98, 1760, 2093, 2637];
    coinFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.75, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 1.4);
      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 1.4);
    });

    // Sub Boom
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(180, now);
    boomOsc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    boomGain.gain.setValueAtTime(0.6, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    boomOsc.connect(boomGain);
    boomGain.connect(this.masterGain || ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.8);
  }

  async playMembershipCrown() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Majestic regal arpeggio
    const chord = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.7, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 1.3);
      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 1.3);
    });
  }

  async playUnsubChime() {
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 392, 349.23, 293.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.45, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.8);
      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.8);
    });
  }
}

// High-Fidelity TTS Voice Speaker for OBS CEF
class VoiceSpeaker {
  constructor() {
    this.player = document.getElementById('ttsAudioPlayer');
  }

  async speak(text, settings = {}) {
    if (!text || text.trim() === '') return;

    const cleanText = text
      .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
      .replace(/@+/g, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[!*#~_]{2,}/g, '!')
      .trim();

    if (!cleanText) return;

    const voice = settings.voiceURI || settings.voice || '';
    const rate = settings.rate || 1.0;
    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voice)}&rate=${rate}&t=${Date.now()}`;

    try {
      if (this.player) {
        this.player.pause();
        this.player.currentTime = 0;
        this.player.src = ttsUrl;
        this.player.volume = settings.volume !== undefined ? parseFloat(settings.volume) : 1.0;
        const p = this.player.play();
        if (p !== undefined) {
          p.catch(async (e) => {
            console.warn('DOM TTS playback issue, trying Web Audio buffer:', e);
            const ctx = await sound.ensureContext();
            if (ctx) {
              fetch(ttsUrl)
                .then(res => res.arrayBuffer())
                .then(buf => ctx.decodeAudioData(buf))
                .then(audioBuf => {
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuf;
                  source.connect(sound.masterGain || ctx.destination);
                  source.start(0);
                })
                .catch(() => {});
            }
          });
        }
      }
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  }
}

const sound = new SoundSynth();
const voiceSpeaker = new VoiceSpeaker();
const alertQueue = [];
let isPlaying = false;

socket.on('connect', () => {
  sound.unlock();
});

socket.on('obsAlert', (data) => {
  sound.unlock();
  alertQueue.push(data);
  processQueue();
});

function processQueue() {
  if (isPlaying || alertQueue.length === 0) return;
  isPlaying = true;

  const alert = alertQueue.shift();
  displayAlert(alert);
}

const alertMediaBox = document.getElementById('alertMediaBox');
const alertMediaImg = document.getElementById('alertMediaImg');
const alertMediaVideo = document.getElementById('alertMediaVideo');
const alertBadgeBox = document.getElementById('alertBadgeBox');

// Dedicated Alert Chime Player
async function playAlertAudio(type) {
  const soundMap = {
    subscriber: '/sounds/subscriber.wav',
    superChat: '/sounds/superchat.wav',
    membership: '/sounds/membership.wav',
    unsubscriber: '/sounds/unsubscriber.wav'
  };

  const soundSrc = soundMap[type] || soundMap.subscriber;
  const player = document.getElementById('alertAudioPlayer');
  
  if (player) {
    player.pause();
    player.currentTime = 0;
    player.src = soundSrc;
    player.volume = 1.0;
    const p = player.play();
    if (p !== undefined) {
      p.catch(async (e) => {
        console.warn('DOM alert sound failed, fallback to Web Audio:', e);
        const ctx = await sound.ensureContext();
        if (ctx) {
          fetch(soundSrc)
            .then(r => r.arrayBuffer())
            .then(b => ctx.decodeAudioData(b))
            .then(audioBuf => {
              const src = ctx.createBufferSource();
              src.buffer = audioBuf;
              src.connect(sound.masterGain || ctx.destination);
              src.start(0);
            })
            .catch(() => {
              if (type === 'superChat') sound.playSuperChatGold();
              else if (type === 'membership') sound.playMembershipCrown();
              else if (type === 'unsubscriber') sound.playUnsubChime();
              else sound.playSubFanfare();
            });
        }
      });
    }
  }
}

function displayAlert(alert) {
  const type = alert.type || 'subscriber';
  const layout = alert.mediaLayout || 'side';
  const appearance = alert.appearanceSettings || { backgroundStyle: 'frosted', cardOpacity: 60 };
  
  alertTagline.textContent = alert.title || 'NEW NOTIFICATION!';
  alertUsername.textContent = alert.user || 'Viewer';

  // Subtext accuracy fix: Display the exact customized notification message or superchat amount
  if (type === 'superChat') {
    alertSubtext.textContent = alert.chatMsg || `Super Chat: ${alert.amount || '₹500.00'}`;
  } else if (type === 'subscriber') {
    alertSubtext.textContent = alert.chatMsg || `Welcome to the stream family!`;
  } else if (type === 'membership') {
    alertSubtext.textContent = alert.chatMsg || `Joined Channel Membership!`;
  } else if (type === 'unsubscriber') {
    alertSubtext.textContent = alert.chatMsg || `Left channel subscription.`;
  } else {
    alertSubtext.textContent = alert.chatMsg || alert.message || 'Welcome!';
  }

  // Set card classes with layout mode & appearance
  const bgStyle = appearance.backgroundStyle || 'frosted';
  const opacity = appearance.cardOpacity !== undefined ? appearance.cardOpacity : 60;
  alertCard.className = `alert-card ${type} ${layout === 'top' ? 'layout-top' : ''} bg-style-${bgStyle}`;

  // Dynamic background transparency & theme glassmorphic glow
  if (bgStyle === 'transparent' || opacity === 0) {
    alertCard.style.background = 'transparent';
    alertCard.style.borderColor = 'transparent';
    alertCard.style.boxShadow = 'none';
    alertCard.style.backdropFilter = 'none';
  } else if (bgStyle === 'frosted') {
    const alpha = (opacity / 100).toFixed(2);
    alertCard.style.background = `rgba(8, 14, 28, ${alpha})`;
    alertCard.style.borderColor = '';
    alertCard.style.boxShadow = '';
    alertCard.style.backdropFilter = `blur(28px)`;
  } else if (bgStyle === 'dark') {
    const alpha = Math.max(0.75, opacity / 100).toFixed(2);
    alertCard.style.background = `rgba(4, 7, 16, ${alpha})`;
    alertCard.style.borderColor = '';
    alertCard.style.boxShadow = '';
    alertCard.style.backdropFilter = `blur(32px)`;
  } else if (bgStyle === 'neon') {
    alertCard.style.background = `rgba(10, 15, 30, 0.9)`;
    alertCard.style.borderColor = '';
    alertCard.style.boxShadow = '';
    alertCard.style.backdropFilter = `blur(24px)`;
  }

  // Handle Media Animation (GIF, WebM, MP4) vs Default Hologram Icon
  if (alert.mediaUrl) {
    const isVideo = alert.mediaUrl.endsWith('.mp4') || alert.mediaUrl.endsWith('.webm');
    if (isVideo) {
      if (alertMediaImg) alertMediaImg.style.display = 'none';
      if (alertMediaVideo) {
        alertMediaVideo.src = alert.mediaUrl;
        alertMediaVideo.style.display = 'block';
        alertMediaVideo.currentTime = 0;
        alertMediaVideo.play().catch(() => {});
      }
    } else {
      if (alertMediaVideo) alertMediaVideo.style.display = 'none';
      if (alertMediaImg) {
        alertMediaImg.src = alert.mediaUrl;
        alertMediaImg.style.display = 'block';
      }
    }
    if (alertMediaBox) alertMediaBox.style.display = 'flex';
    if (alertBadgeBox) alertBadgeBox.style.display = 'none';
  } else {
    if (alertMediaBox) alertMediaBox.style.display = 'none';
    if (alertBadgeBox) alertBadgeBox.style.display = 'block';
  }

  if (type === 'superChat') {
    alertIcon.className = 'fa-solid fa-gem';
  } else if (type === 'membership') {
    alertIcon.className = 'fa-solid fa-crown';
  } else if (type === 'unsubscriber') {
    alertIcon.className = 'fa-solid fa-user-minus';
  } else {
    alertIcon.className = 'fa-solid fa-heart';
  }

  // Play High-Fidelity Studio Alert Sound via HTML5 Audio + WebAudio
  playAlertAudio(type);

  // Voice Announcement Speech (350ms after fanfare chime)
  if (alert.voiceText && alert.voiceSettings?.enabled !== false) {
    setTimeout(() => {
      voiceSpeaker.speak(alert.voiceText, alert.voiceSettings);
    }, 350);
  }

  // Launch Multi-Shape Confetti Burst
  launchConfetti(type);

  // Force Layout Reflow & Clean Animation Trigger
  alertCard.style.display = 'flex';
  alertCard.classList.remove('hide');
  alertCard.classList.remove('show');
  void alertCard.offsetWidth; // Trigger browser reflow

  const timerBar = document.getElementById('alertTimerBar');
  if (timerBar) {
    timerBar.style.animation = 'none';
    void timerBar.offsetWidth;
    timerBar.style.animation = '';
  }

  alertCard.classList.add('show');

  // Keep on screen for 5.5 seconds
  setTimeout(() => {
    alertCard.classList.remove('show');
    alertCard.classList.add('hide');

    setTimeout(() => {
      alertCard.classList.remove('hide');
      alertCard.style.display = 'none';
      isPlaying = false;
      processQueue();
    }, 450);
  }, 5000);
}
