const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/polls.json');

class PollsService {
  constructor() {
    this.activePoll = null;
    this.pollHistory = this.loadHistory();
    this.io = null;
    this.timer = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  loadHistory() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading polls.json:', e);
    }
    return [];
  }

  saveHistory() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.pollHistory.slice(0, 50), null, 2));
    } catch (e) {
      console.error('Error saving polls.json:', e);
    }
  }

  getActivePoll() {
    return this.activePoll;
  }

  getPollHistory() {
    return this.pollHistory;
  }

  startPoll({ question, options, durationSeconds = 120 }) {
    if (this.timer) clearTimeout(this.timer);

    if (!question || !options || options.length < 2) {
      throw new Error('Poll requires a question and at least 2 options');
    }

    const formattedOptions = options.map((opt, idx) => ({
      id: idx + 1,
      text: opt.trim(),
      votes: 0,
      percentage: 0
    }));

    this.activePoll = {
      id: 'poll_' + Date.now(),
      question: question.trim(),
      options: formattedOptions,
      totalVotes: 0,
      voters: {}, // authorId -> optionId
      durationSeconds: Number(durationSeconds),
      startedAt: Date.now(),
      endsAt: Date.now() + durationSeconds * 1000,
      isActive: true
    };

    if (this.io) {
      this.io.emit('pollStarted', this.activePoll);
    }

    if (durationSeconds > 0) {
      this.timer = setTimeout(() => {
        this.endPoll();
      }, durationSeconds * 1000);
    }

    return this.activePoll;
  }

  recordVote(authorId, authorName, voteInput) {
    if (!this.activePoll || !this.activePoll.isActive) return false;

    // Check if already voted
    if (this.activePoll.voters[authorId]) return false;

    const inputClean = String(voteInput).trim().toLowerCase().replace(/^!vote\s+/, '');
    
    // Check by number 1, 2, 3...
    let matchedOption = null;
    const num = parseInt(inputClean, 10);
    if (!isNaN(num)) {
      matchedOption = this.activePoll.options.find(o => o.id === num);
    }

    // Check by option text match
    if (!matchedOption) {
      matchedOption = this.activePoll.options.find(o => o.text.toLowerCase() === inputClean);
    }

    if (!matchedOption) return false;

    matchedOption.votes += 1;
    this.activePoll.totalVotes += 1;
    this.activePoll.voters[authorId] = {
      optionId: matchedOption.id,
      name: authorName,
      timestamp: Date.now()
    };

    // Recalculate percentages
    this.activePoll.options.forEach(opt => {
      opt.percentage = this.activePoll.totalVotes > 0 
        ? Math.round((opt.votes / this.activePoll.totalVotes) * 100) 
        : 0;
    });

    if (this.io) {
      this.io.emit('pollUpdate', this.activePoll);
    }

    return matchedOption;
  }

  endPoll() {
    if (!this.activePoll || !this.activePoll.isActive) return null;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.activePoll.isActive = false;
    this.activePoll.endedAt = Date.now();

    // Determine winner
    let maxVotes = -1;
    let winner = null;
    this.activePoll.options.forEach(opt => {
      if (opt.votes > maxVotes) {
        maxVotes = opt.votes;
        winner = opt;
      }
    });

    this.activePoll.winner = winner && maxVotes > 0 ? winner.text : 'Tie / No Votes';

    // Save to history
    this.pollHistory.unshift(this.activePoll);
    this.saveHistory();

    if (this.io) {
      this.io.emit('pollEnded', this.activePoll);
    }

    const completed = this.activePoll;
    return completed;
  }

  clearPoll() {
    if (this.timer) clearTimeout(this.timer);
    this.activePoll = null;
    if (this.io) {
      this.io.emit('pollCleared');
    }
  }
}

module.exports = new PollsService();
