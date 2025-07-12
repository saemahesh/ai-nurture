const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Helper to get current date in YYYY-MM-DD
function getToday() {
  return new Date().toISOString().slice(0, 10);
}
// Helper to get expiration date (default 30 days)
function getExpiration(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// List all users (admin only)
router.get('/users', (req, res) => {
  // TODO: Add admin check if needed
  const users = readUsers();
  res.json(users);
});

// Approve user (set status to active)
router.post('/users/:username/approve', (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.status = 'active';
  user.expirationDate = user.expirationDate || getExpiration();
  writeUsers(users);
  res.json({ success: true });
});

// Deny or deactivate user (set status to inactive)
router.post('/users/:username/deny', (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.status = 'inactive';
  writeUsers(users);
  res.json({ success: true });
});

// Update expiration date
router.post('/users/:username/expire', (req, res) => {
  const { expirationDate } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.expirationDate = expirationDate;
  writeUsers(users);
  res.json({ success: true });
});

// Modified registration: set status, registrationDate, expirationDate
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User exists' });
  const now = getToday();
  users.push({
    username,
    password,
    status: 'pending',
    registrationDate: now,
    expirationDate: getExpiration(),
  });
  writeUsers(users);
  res.json({ success: true });
});

// Modified login: check status and expiration
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.status !== 'active') return res.status(403).json({ error: 'Account not active' });
  if (user.expirationDate && new Date(user.expirationDate) < new Date()) {
    return res.status(403).json({ error: 'Access expired' });
  }
  req.session.user = { username: user.username, role: user.role || 'user' };
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json({ user: req.session.user });
});

module.exports = router;