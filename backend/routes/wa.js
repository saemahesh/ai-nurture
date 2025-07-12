const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Placeholder for WhatsApp API integration
router.post('/send', authRequired, (req, res) => {
  try {
    // Here you would integrate with WhatsApp API
    res.json({ success: true, message: 'Message sent (placeholder)' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;