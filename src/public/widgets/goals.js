const socket = io();

// Read query params for customization
const urlParams = new URLSearchParams(window.location.search);
const goalFilter = (urlParams.get('type') || urlParams.get('goal') || 'all').toLowerCase();
const bgStyle = (urlParams.get('bg') || urlParams.get('background') || 'transparent').toLowerCase();
const templateStyle = (urlParams.get('template') || urlParams.get('style') || 'cyber').toLowerCase(); // cyber, pill, esports, rpg, minimal, glass
const themeOverride = (urlParams.get('theme') || urlParams.get('color') || '').toLowerCase(); // emerald, cyan, gold, purple, crimson, rainbow
const sizeParam = (urlParams.get('size') || 'normal').toLowerCase(); // small, normal, large, wide

// Apply Body background class
if (bgStyle === 'clean') {
  document.body.classList.add('bg-clean');
} else if (bgStyle === 'frosted') {
  document.body.classList.add('bg-frosted');
} else if (bgStyle === 'solid') {
  document.body.classList.add('bg-solid');
} else {
  document.body.classList.add('bg-transparent');
}

// Apply Size modifier to container
const container = document.getElementById('goalsContainer');
if (container && sizeParam !== 'normal') {
  container.classList.add(`size-${sizeParam}`);
}

// -------------------------------------------------------------
// Confetti & Particle Celebration Engine
// -------------------------------------------------------------
const canvas = document.getElementById('celebrationCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];
let animationId = null;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function launchConfetti(color = '#10b981', count = 60) {
  if (!ctx || !canvas) return;
  const colors = [color, '#ffffff', '#fbbf24', '#38bdf8', '#a855f7', '#ec4899'];
  
  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 300,
      y: canvas.height / 2 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 1.2) * 10 - 2,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      alpha: 1,
      decay: Math.random() * 0.015 + 0.012
    });
  }

  if (!animationId) {
    animateParticles();
  }
}

function animateParticles() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3; // Gravity
    p.rotation += p.vRot;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(animateParticles);
  } else {
    animationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// -------------------------------------------------------------
// Value Tracking & Counter Animation
// -------------------------------------------------------------
const prevValues = {
  sub: null,
  like: null,
  superChat: null
};

function animateCounter(element, startVal, endVal, prefix = '', suffix = '', duration = 1000) {
  if (!element) return;
  if (startVal === endVal) {
    element.textContent = `${prefix}${endVal.toLocaleString()}${suffix}`;
    return;
  }

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = Math.round(startVal + (endVal - startVal) * ease);

    element.textContent = `${prefix}${current.toLocaleString()}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = `${prefix}${endVal.toLocaleString()}${suffix}`;
    }
  }

  requestAnimationFrame(update);
}

function triggerCardCelebration(card, color = '#10b981') {
  if (!card) return;
  card.classList.remove('celebrate');
  void card.offsetWidth;
  card.classList.add('celebrate');
  launchConfetti(color, 45);
}

function getMilestoneTag(pct) {
  if (pct >= 100) return '🎉 GOAL COMPLETED!';
  if (pct >= 90) return '🔥 FINAL SPRINT (LVL 4)';
  if (pct >= 75) return '⚡ BOSS STAGE (LVL 3)';
  if (pct >= 50) return '🚀 HALF WAY (LVL 2)';
  return '🎯 MILESTONE LVL 1';
}

function applyTemplateAndTheme(card, defaultTheme) {
  if (!card) return;
  
  // Apply Template Class
  card.classList.remove('template-cyber', 'template-pill', 'template-esports', 'template-rpg', 'template-minimal', 'template-glass');
  if (templateStyle && templateStyle !== 'default') {
    card.classList.add(`template-${templateStyle}`);
  }

  // Apply Theme Class
  const activeTheme = themeOverride || defaultTheme || 'emerald';
  card.classList.remove('emerald', 'cyan', 'gold', 'purple', 'crimson', 'rainbow');
  card.classList.add(activeTheme);
}

// -------------------------------------------------------------
// Update Goal UI Renderer
// -------------------------------------------------------------
function updateGoalUI(goals) {
  if (!goals) return;

  const sub = goals.subscriberGoal || {};
  const like = goals.likeGoal || {};
  const superChat = goals.superChatGoal || {};

  // 1. Subscriber Goal Card
  const subCard = document.getElementById('subGoalCard');
  if (subCard) {
    const isSubOnly = goalFilter === 'sub' || goalFilter === 'subscriber' || goalFilter === 'subscribergoal';
    const isSubActive = isSubOnly ? true : (goalFilter === 'all' && sub.enabled !== false);

    if (isSubActive) {
      subCard.style.display = 'block';
      applyTemplateAndTheme(subCard, sub.theme || 'emerald');

      if (sub.title) document.getElementById('subGoalTitle').textContent = sub.title;

      const currentSub = Number(sub.current || 0);
      const targetSub = Number(sub.target || 2500);

      const countEl = document.getElementById('subGoalCurrent');
      const startSub = prevValues.sub !== null ? prevValues.sub : currentSub;
      animateCounter(countEl, startSub, currentSub);

      if (prevValues.sub !== null && currentSub > prevValues.sub) {
        triggerCardCelebration(subCard, '#10b981');
      }
      prevValues.sub = currentSub;

      document.getElementById('subGoalTarget').textContent = targetSub.toLocaleString();

      const pct = targetSub > 0 ? Math.min(100, Math.max(0, (currentSub / targetSub) * 100)) : 0;
      document.getElementById('subGoalFill').style.width = `${pct}%`;
      document.getElementById('subGoalPercent').textContent = `${pct.toFixed(1)}% COMPLETED`;
      document.getElementById('subGoalLevelTag').textContent = getMilestoneTag(pct);

      const rem = Math.max(0, targetSub - currentSub);
      document.getElementById('subGoalRemaining').textContent = `${rem.toLocaleString()} Subs to go!`;
    } else {
      subCard.style.display = 'none';
    }
  }

  // 2. Stream Like Goal Card
  const likeCard = document.getElementById('likeGoalCard');
  if (likeCard) {
    const isLikeOnly = goalFilter === 'like' || goalFilter === 'likegoal';
    const isLikeActive = isLikeOnly ? true : (goalFilter === 'all' && like.enabled !== false);

    if (isLikeActive) {
      likeCard.style.display = 'block';
      applyTemplateAndTheme(likeCard, like.theme || 'cyan');

      if (like.title) document.getElementById('likeGoalTitle').textContent = like.title;

      const currentLike = Number(like.current || 0);
      const targetLike = Number(like.target || 100);

      const countEl = document.getElementById('likeGoalCurrent');
      const startLike = prevValues.like !== null ? prevValues.like : currentLike;
      animateCounter(countEl, startLike, currentLike);

      if (prevValues.like !== null && currentLike > prevValues.like) {
        triggerCardCelebration(likeCard, '#06b6d4');
      }
      prevValues.like = currentLike;

      document.getElementById('likeGoalTarget').textContent = targetLike.toLocaleString();

      const pct = targetLike > 0 ? Math.min(100, Math.max(0, (currentLike / targetLike) * 100)) : 0;
      document.getElementById('likeGoalFill').style.width = `${pct}%`;
      document.getElementById('likeGoalPercent').textContent = `${pct.toFixed(1)}% COMPLETED`;
      document.getElementById('likeGoalLevelTag').textContent = getMilestoneTag(pct);

      const rem = Math.max(0, targetLike - currentLike);
      document.getElementById('likeGoalRemaining').textContent = `${rem.toLocaleString()} Likes to go!`;
    } else {
      likeCard.style.display = 'none';
    }
  }

  // 3. Super Chat Goal Card
  const superCard = document.getElementById('superGoalCard');
  if (superCard) {
    const isSuperOnly = goalFilter === 'super' || goalFilter === 'superchat' || goalFilter === 'superchatgoal';
    const isSuperActive = isSuperOnly ? true : (goalFilter === 'all' && superChat.enabled !== false);

    if (isSuperActive) {
      superCard.style.display = 'block';
      applyTemplateAndTheme(superCard, superChat.theme || 'gold');

      if (superChat.title) document.getElementById('superGoalTitle').textContent = superChat.title;

      const currentSuper = Number(superChat.current || 0);
      const targetSuper = Number(superChat.target || 1000);

      const countEl = document.getElementById('superGoalCurrent');
      const startSuper = prevValues.superChat !== null ? prevValues.superChat : currentSuper;
      animateCounter(countEl, startSuper, currentSuper, '₹');

      if (prevValues.superChat !== null && currentSuper > prevValues.superChat) {
        triggerCardCelebration(superCard, '#f59e0b');
      }
      prevValues.superChat = currentSuper;

      document.getElementById('superGoalTarget').textContent = `₹${targetSuper.toLocaleString()}`;

      const pct = targetSuper > 0 ? Math.min(100, Math.max(0, (currentSuper / targetSuper) * 100)) : 0;
      document.getElementById('superGoalFill').style.width = `${pct}%`;
      document.getElementById('superGoalPercent').textContent = `${pct.toFixed(1)}% COMPLETED`;
      document.getElementById('superGoalLevelTag').textContent = getMilestoneTag(pct);

      const rem = Math.max(0, targetSuper - currentSuper);
      document.getElementById('superGoalRemaining').textContent = `₹${rem.toLocaleString()} to go!`;
    } else {
      superCard.style.display = 'none';
    }
  }
}

// Initial Fetch
fetch('/api/goals')
  .then(res => res.json())
  .then(goals => updateGoalUI(goals))
  .catch(err => console.error('Error loading goals:', err));

// Socket listeners for instant real-time sync
socket.on('goalsUpdate', (goals) => {
  updateGoalUI(goals);
});

socket.on('channelUpdated', (ch) => {
  if (ch && ch.subscriberCount) {
    fetch('/api/goals')
      .then(res => res.json())
      .then(goals => updateGoalUI(goals))
      .catch(() => {});
  }
});

socket.on('goalUpdated', () => {
  fetch('/api/goals')
    .then(res => res.json())
    .then(goals => updateGoalUI(goals))
    .catch(() => {});
});

// Periodic fallback polling
setInterval(() => {
  fetch('/api/goals')
    .then(res => res.json())
    .then(goals => updateGoalUI(goals))
    .catch(() => {});
}, 12000);
