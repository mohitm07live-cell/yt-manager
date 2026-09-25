const fs = require('fs');
const path = require('path');
const geminiService = require('./geminiService');

const DATA_FILE = path.join(__dirname, '../../data/loyalty.json');

const TRIVIA_BANK = [
  { q: "Free Fire me 'Drop the Beat' active skill kis character ki hai?", a: "alok", hint: "DJ..." },
  { q: "Free Fire me 'Riptide Rhythm' skill kis character ki hai?", a: "skyler", hint: "Music star" },
  { q: "Free Fire me Chrono character ki skill ka kya naam hai?", a: "time turner", hint: "Shield bubble" },
  { q: "Free Fire me sabse famous shotgun ka naam kya hai? (M1014 / M1887 / MP40)", a: "m1887", hint: "2-shot gun" },
  { q: "Free Fire me default classic map ka naam kya hai?", a: "bermuda", hint: "Starts with B" },
  { q: "GTA 5 me Franklin ke dog ka naam kya hai?", a: "chop", hint: "Starts with C" },
  { q: "Minecraft me Pickaxe banane ke liye kitne Wooden Planks ya Cobblestone lagte hain?", a: "3", hint: "Number between 1-5" },
  { q: "PUBG / BGMI me standard Battle Royale match me kitne total players hote hain?", a: "100", hint: "Century" },
  { q: "Valorant me 'Jett', 'Omen' aur 'Phoenix' characters kis game ke hain?", a: "valorant", hint: "Riot Games" },
  { q: "GTA San Andreas ke main character ka short name kya hai?", a: "cj", hint: "Carl Johnson" },
  { q: "Free Fire me Gloo Wall ka main use kya hota hai?", a: "defense", hint: "Protection / Cover" },
  { q: "YouTube kis year me launch hua tha? (e.g. 2005)", a: "2005", hint: "Over 19 years ago" },
  { q: "Roblox game ki in-game currency ko kya bolte hain?", a: "robux", hint: "Starts with R" },
  { q: "Free Fire me AWM sniper rifle ka per-shot base damage kitna hota hai?", a: "150", hint: "Heavy damage" },
  { q: "Battle royale game Fortnite kis company ne banaya hai?", a: "epic games", hint: "Epic..." },
  { q: "Pokemon franchise ka Pokédex #001 Pokemon kaun sa hai?", a: "bulbasaur", hint: "Grass/Poison type" },
  { q: "Free Fire me Factory Roof kis map me located hai?", a: "bermuda", hint: "Classic map" },
  { q: "Free Fire me Wukong character ki ability kya hai? Kis cheez me convert hota hai?", a: "bush", hint: "Grass / Bush" },
  { q: "BGMI me Pochinki location kis map me hai?", a: "erangel", hint: "Classic 8x8 map" },
  { q: "Free Fire me MP40 SMG gun kis ammo type pe run karti hai?", a: "smg", hint: "Short Range" }
];

class LoyaltyService {
  constructor() {
    this.users = this.loadData();
    this.activeTrivia = null;
    this.triviaTimer = null;
    this.io = null;
    this.onTimeoutCallback = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setOnTimeoutCallback(cb) {
    this.onTimeoutCallback = cb;
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading loyalty.json:', e);
    }
    return {};
  }

  saveData() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.users, null, 2));
    } catch (e) {
      console.error('Error saving loyalty.json:', e);
    }
  }

  getUser(authorId, authorName = 'Viewer') {
    if (!this.users[authorId]) {
      this.users[authorId] = {
        id: authorId,
        name: authorName,
        points: 100, // Starter bonus
        messagesCount: 0,
        triviaWins: 0,
        gambleWins: 0,
        lastActive: Date.now()
      };
      this.saveData();
    } else if (authorName && this.users[authorId].name !== authorName) {
      this.users[authorId].name = authorName;
    }
    return this.users[authorId];
  }

  addPoints(authorId, authorName, amount = 10, reason = 'chat') {
    const user = this.getUser(authorId, authorName);
    user.points = Math.max(0, (user.points || 0) + amount);
    user.lastActive = Date.now();
    if (reason === 'chat') {
      user.messagesCount = (user.messagesCount || 0) + 1;
    }
    this.saveData();
    return user.points;
  }

  getPoints(authorId, authorName) {
    const user = this.getUser(authorId, authorName);
    return user.points;
  }

  // Mini-Game 1: !gamble <amount>
  gamble(authorId, authorName, amountStr) {
    const user = this.getUser(authorId, authorName);
    let amount = parseInt(amountStr, 10);

    if (amountStr === 'all') {
      amount = user.points;
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: `@${authorName}, please specify a valid amount: !gamble <number> or !gamble all` };
    }

    if (user.points < amount) {
      return { success: false, message: `@${authorName}, aapke paas itne points nahi hain! Balance: ${user.points} pts.` };
    }

    // 50/50 Coin Flip / Dice Roll
    const roll = Math.random();
    const won = roll >= 0.50;

    if (won) {
      user.points += amount;
      user.gambleWins = (user.gambleWins || 0) + 1;
      this.saveData();
      return {
        success: true,
        won: true,
        amount,
        newBalance: user.points,
        message: `🎉 WON! @${authorName} rolled a WIN and gained +${amount} points! New Balance: ${user.points} pts 💎`
      };
    } else {
      user.points -= amount;
      this.saveData();
      return {
        success: true,
        won: false,
        amount,
        newBalance: user.points,
        message: `💀 LOST! @${authorName} rolled a LOSS and lost -${amount} points! New Balance: ${user.points} pts 💔`
      };
    }
  }

  // Mini-Game 2: !spin (Slot Machine)
  spin(authorId, authorName) {
    const cost = 25;
    const user = this.getUser(authorId, authorName);

    if (user.points < cost) {
      return { success: false, message: `@${authorName}, spin karne ke liye kam se kam ${cost} points chahiye! Current: ${user.points} pts.` };
    }

    user.points -= cost;

    const symbols = ['🍒', '🍋', '💎', '7️⃣', '⭐'];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let reward = 0;
    if (r1 === r2 && r2 === r3) {
      if (r1 === '💎' || r1 === '7️⃣') reward = 250;
      else reward = 100;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      reward = 50;
    }

    user.points += reward;
    this.saveData();

    if (reward > 0) {
      return {
        success: true,
        slots: `[ ${r1} | ${r2} | ${r3} ]`,
        reward,
        newBalance: user.points,
        message: `🎰 [ ${r1} | ${r2} | ${r3} ] JACKPOT! @${authorName} won +${reward} points! Balance: ${user.points} pts!`
      };
    } else {
      return {
        success: true,
        slots: `[ ${r1} | ${r2} | ${r3} ]`,
        reward: 0,
        newBalance: user.points,
        message: `🎰 [ ${r1} | ${r2} | ${r3} ] No match! @${authorName} lost ${cost} pts. Balance: ${user.points} pts.`
      };
    }
  }

  // Mini-Game 3: Live Chat Trivia with Gemini AI Support
  async startTrivia(category = 'Free Fire and Gaming') {
    if (this.activeTrivia) return this.activeTrivia;

    let triviaItem = null;
    let isAi = false;

    // Try Gemini AI generation first if API key is set
    if (geminiService.getApiKey()) {
      try {
        const aiTrivia = await geminiService.generateTriviaQuestion(category);
        if (aiTrivia && aiTrivia.question && aiTrivia.answer) {
          triviaItem = aiTrivia;
          isAi = true;
        }
      } catch (e) {}
    }

    if (!triviaItem) {
      const fallback = TRIVIA_BANK[Math.floor(Math.random() * TRIVIA_BANK.length)];
      triviaItem = {
        question: fallback.q,
        answer: fallback.a.toLowerCase(),
        hint: fallback.hint || '',
        reward: 75
      };
    }

    this.activeTrivia = {
      question: triviaItem.question,
      answer: String(triviaItem.answer).toLowerCase().trim(),
      hint: triviaItem.hint || '',
      reward: triviaItem.reward || 75,
      isAiGenerated: isAi,
      startedAt: Date.now()
    };

    if (this.triviaTimer) clearTimeout(this.triviaTimer);
    this.triviaTimer = setTimeout(() => {
      if (this.activeTrivia) {
        const timeoutMsg = `⏰ [TRIVIA TIMEOUT]: Time up ho gaya! Sahi jawab tha "${this.activeTrivia.answer}". Agle question ke liye taiyar raho! 🎮`;
        if (this.io) {
          this.io.emit('triviaTimeout', { question: this.activeTrivia.question, answer: this.activeTrivia.answer, message: timeoutMsg });
        }
        if (this.onTimeoutCallback) {
          this.onTimeoutCallback(timeoutMsg);
        }
        this.activeTrivia = null;
      }
    }, 60000); // 60 seconds

    return this.activeTrivia;
  }

  getActiveTrivia() {
    return this.activeTrivia;
  }

  checkTriviaAnswer(authorId, authorName, text) {
    if (!this.activeTrivia) return null;

    const cleanInput = text.trim().toLowerCase();
    const target = this.activeTrivia.answer;

    // Direct match or word match
    const isMatched = cleanInput === target || 
                      cleanInput.includes(` ${target} `) || 
                      cleanInput.startsWith(`${target} `) || 
                      cleanInput.endsWith(` ${target}`) ||
                      (target.length >= 4 && cleanInput.includes(target));

    if (isMatched) {
      const reward = this.activeTrivia.reward;
      const user = this.getUser(authorId, authorName);
      user.points += reward;
      user.triviaWins = (user.triviaWins || 0) + 1;
      this.saveData();

      const solved = {
        winner: authorName,
        answer: this.activeTrivia.answer,
        reward,
        newBalance: user.points,
        message: `🧠 SAHI JAWAB! 🎉 @${authorName} ne bilkul sahi answer diya: "${this.activeTrivia.answer}"! +${reward} Points mil gaye! New Balance: ${user.points} pts 💎`
      };

      if (this.triviaTimer) clearTimeout(this.triviaTimer);
      this.activeTrivia = null;

      if (this.io) {
        this.io.emit('triviaSolved', solved);
      }

      return solved;
    }
    return null;
  }

  getLeaderboard(limit = 10) {
    const list = Object.values(this.users)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, limit);
    return list;
  }
}

module.exports = new LoyaltyService();
