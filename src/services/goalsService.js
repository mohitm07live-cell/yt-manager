const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA_FILE = path.join(__dirname, '../../data/goals.json');

function getRealChannelSubscribers() {
  try {
    const ch = db.getChannelInfo();
    if (ch && ch.subscriberCount) {
      return parseInt(ch.subscriberCount, 10) || 2270;
    }
  } catch (e) {}
  return 2270;
}

const DEFAULT_GOALS = {
  subscriberGoal: {
    enabled: true,
    title: 'Subscriber Goal',
    current: 2270,
    target: 2500,
    unit: 'Subs',
    theme: 'emerald', // emerald, gold, purple, cyan
    autoSync: true
  },
  likeGoal: {
    enabled: false,
    title: 'Stream Like Goal',
    current: 0,
    target: 100,
    unit: 'Likes',
    theme: 'cyan',
    autoSync: true
  },
  superChatGoal: {
    enabled: false,
    title: 'Super Chat Goal',
    current: 0,
    target: 1000,
    unit: '₹',
    theme: 'gold',
    autoSync: true
  }
};

class GoalsService {
  constructor() {
    this.goals = this.loadGoals();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  loadGoals() {
    const realSubs = getRealChannelSubscribers();
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULT_GOALS, ...parsed };
        // Only sync if subscriber count was on old mock value (8540) or not set
        if (!merged.subscriberGoal.current || merged.subscriberGoal.current === 8540) {
          merged.subscriberGoal.current = realSubs;
        } else if (realSubs > merged.subscriberGoal.current) {
          merged.subscriberGoal.current = realSubs;
        }
        return merged;
      }
    } catch (e) {
      console.error('Error loading goals.json:', e);
    }
    const initGoals = { ...DEFAULT_GOALS };
    initGoals.subscriberGoal.current = realSubs;
    this.saveGoals(initGoals);
    return initGoals;
  }

  saveGoals(goals) {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(goals || this.goals, null, 2));
    } catch (e) {
      console.error('Error saving goals.json:', e);
    }
  }

  getGoals() {
    return this.goals;
  }

  updateGoals(newGoals) {
    this.goals = { ...this.goals, ...newGoals };
    this.saveGoals(this.goals);
    if (this.io) {
      this.io.emit('goalsUpdate', this.goals);
    }
    return this.goals;
  }

  incrementGoal(goalKey, amount = 1) {
    if (this.goals[goalKey]) {
      this.goals[goalKey].current = Math.max(0, (this.goals[goalKey].current || 0) + amount);
      this.saveGoals(this.goals);
      if (this.io) {
        this.io.emit('goalsUpdate', this.goals);
      }
    }
  }

  setGoalValue(goalKey, current, target) {
    if (this.goals[goalKey]) {
      if (current !== undefined) this.goals[goalKey].current = Number(current);
      if (target !== undefined) this.goals[goalKey].target = Number(target);
      this.saveGoals(this.goals);
      if (this.io) {
        this.io.emit('goalsUpdate', this.goals);
      }
    }
  }
}

module.exports = new GoalsService();
