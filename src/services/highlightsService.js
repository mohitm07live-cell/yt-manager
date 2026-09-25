const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/highlights.json');

class HighlightsService {
  constructor() {
    this.highlights = this.loadHighlights();
    this.streamStartTime = null;
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setStreamStartTime(timeMs) {
    this.streamStartTime = timeMs;
  }

  loadHighlights() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading highlights.json:', e);
    }
    return [];
  }

  saveHighlights() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.highlights, null, 2));
    } catch (e) {
      console.error('Error saving highlights.json:', e);
    }
  }

  getHighlights() {
    return this.highlights;
  }

  formatTimestamp(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = n => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  }

  addHighlight(description = 'Stream Highlight', createdBy = 'Streamer') {
    const now = Date.now();
    let streamElapsed = 0;
    if (this.streamStartTime && now > this.streamStartTime) {
      streamElapsed = now - this.streamStartTime;
    }

    const timestampFormatted = this.formatTimestamp(streamElapsed);

    const item = {
      id: 'hl_' + now,
      description: description.trim(),
      timestampFormatted,
      streamElapsedMs: streamElapsed,
      createdBy,
      createdAt: new Date().toISOString()
    };

    this.highlights.unshift(item);
    this.saveHighlights();

    if (this.io) {
      this.io.emit('highlightAdded', item);
    }

    return item;
  }

  deleteHighlight(id) {
    this.highlights = this.highlights.filter(h => h.id !== id);
    this.saveHighlights();
    if (this.io) {
      this.io.emit('highlightsList', this.highlights);
    }
    return true;
  }

  clearHighlights() {
    this.highlights = [];
    this.saveHighlights();
    if (this.io) {
      this.io.emit('highlightsList', this.highlights);
    }
    return true;
  }
}

module.exports = new HighlightsService();
