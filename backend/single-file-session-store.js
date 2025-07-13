const fs = require('fs');
const path = require('path');
const session = require('express-session');

class SingleFileSessionStore extends session.Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    // Initialize file if not present
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '{}');
    }
  }

  // Get session by ID
  get(sid, callback) {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      callback(null, data[sid] || null);
    } catch (err) {
      callback(err);
    }
  }

  // Set session by ID
  set(sid, sessionData, callback) {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      data[sid] = sessionData;
      fs.writeFileSync(this.filePath, JSON.stringify(data));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // Destroy session by ID
  destroy(sid, callback) {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      delete data[sid];
      fs.writeFileSync(this.filePath, JSON.stringify(data));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // Optional: all() for listing all sessions
  all(callback) {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      callback(null, Object.values(data));
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SingleFileSessionStore;
