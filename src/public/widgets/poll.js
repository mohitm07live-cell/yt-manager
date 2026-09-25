const socket = io();

const pollOverlay = document.getElementById('pollOverlay');
const pollQuestion = document.getElementById('pollQuestion');
const pollOptionsList = document.getElementById('pollOptionsList');
const pollTimerBadge = document.getElementById('pollTimerBadge');
const pollVoteGuide = document.getElementById('pollVoteGuide');
const pollTotalVotes = document.getElementById('pollTotalVotes');

let countdownInterval = null;

function renderPoll(poll) {
  if (!poll || !poll.isActive) {
    if (pollOverlay) pollOverlay.style.display = 'none';
    if (countdownInterval) clearInterval(countdownInterval);
    return;
  }

  pollOverlay.style.display = 'flex';
  pollQuestion.textContent = poll.question;
  pollTotalVotes.textContent = `${poll.totalVotes || 0} Votes`;

  const guideNumbers = poll.options.map(o => o.id).join(', ');
  pollVoteGuide.textContent = guideNumbers;

  // Render options
  const maxVotes = Math.max(...poll.options.map(o => o.votes || 0), 0);

  pollOptionsList.innerHTML = poll.options.map(opt => {
    const isLeader = maxVotes > 0 && opt.votes === maxVotes;
    return `
      <div class="poll-option-row">
        <div class="poll-option-fill ${isLeader ? 'leader' : ''}" style="width: ${opt.percentage || 0}%;"></div>
        <div class="poll-option-info">
          <span class="option-badge">${opt.id}</span>
          <span class="option-text">${opt.text}</span>
        </div>
        <div class="poll-option-stats">
          ${opt.percentage || 0}%
        </div>
      </div>
    `;
  }).join('');

  // Countdown timer
  if (poll.endsAt) {
    if (countdownInterval) clearInterval(countdownInterval);
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 1000));
      pollTimerBadge.innerHTML = `<i class="fa-regular fa-clock"></i> ${remaining}s`;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
      }
    };
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
  }
}

// Fetch active poll
fetch('/api/polls/active')
  .then(res => res.json())
  .then(data => {
    if (data.poll) renderPoll(data.poll);
  })
  .catch(err => console.error('Error fetching active poll:', err));

socket.on('pollStarted', (poll) => renderPoll(poll));
socket.on('pollUpdate', (poll) => renderPoll(poll));
socket.on('pollEnded', (poll) => {
  renderPoll(poll);
  setTimeout(() => {
    if (pollOverlay) pollOverlay.style.display = 'none';
  }, 8000); // Display results for 8s
});
socket.on('pollCleared', () => {
  if (pollOverlay) pollOverlay.style.display = 'none';
});
