var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Middleware to require authentication
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

// GET current user's settings
router.get('/settings', authRequired, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.session.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Return the settings object, or defaults if not set
  res.json({
    access_token: user.settings?.access_token || '',
    instance_id: user.settings?.instance_id || '',
    wa_phone: user.settings?.wa_phone || '',
    notification_enabled: user.settings?.notification_enabled !== false,
    timezone: 'Asia/Kolkata',
    test_mobile: user.settings?.test_mobile || '',
    whapi_token: user.settings?.whapi_token || ''
  });
});

// POST update current user's settings
router.post('/settings', authRequired, (req, res) => {
  const { access_token, instance_id, wa_phone, notification_enabled, test_mobile, whapi_token } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === req.session.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.settings = user.settings || {};
  user.settings.access_token = access_token || '';
  user.settings.instance_id = instance_id || '';
  user.settings.wa_phone = wa_phone || '';
  user.settings.notification_enabled = notification_enabled !== false;
  user.settings.timezone = 'Asia/Kolkata';
  user.settings.test_mobile = test_mobile || '';
  user.settings.whapi_token = whapi_token || '';
  // Remove any legacy root-level fields
  delete user.access_token;
  delete user.instance_id;
  delete user.wa_phone;
  delete user.notification_enabled;
  delete user.timezone;
  delete user.test_mobile;
  delete user.whapi_token;
  writeUsers(users);
  res.json({ success: true });
});

module.exports = router;
