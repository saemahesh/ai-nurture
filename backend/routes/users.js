var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qs = require('querystring');
const { getDataFilePath } = require('../data-utils');
const { registerWebhook } = require('../services/webhook.service');
const USERS_FILE = getDataFilePath('users.json');

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
    whapi_token: user.settings?.whapi_token || '',
    default_language: user.settings?.default_language || 'en',
    autosave_interval: user.settings?.autosave_interval || '60',
    log_messages: user.settings?.log_messages || false,
    auto_delete: user.settings?.auto_delete || false,
    session_timeout: user.settings?.session_timeout || '60',
    calendly_token: user.settings?.calendly_token || '',
    webhook_url: user.settings?.webhook_url || ''
  });
});

// POST update current user's settings
router.post('/settings', authRequired, async (req, res) => {
  try {
    console.log(`\n=== SETTINGS SAVE REQUEST START ===`);
    console.log(`[SETTINGS] User: ${req.session.user.username}`);
    console.log(`[SETTINGS] Request timestamp: ${new Date().toISOString()}`);
    
    const { access_token, instance_id, wa_phone, notification_enabled, test_mobile, whapi_token, 
            default_language, autosave_interval, log_messages, auto_delete, session_timeout, calendly_token, webhook_url } = req.body;
    
    console.log(`[SETTINGS] Received settings data:`, {
      access_token: access_token ? access_token.substring(0, 10) + '...' : 'MISSING',
      instance_id: instance_id || 'MISSING',
      wa_phone: wa_phone || 'MISSING',
      test_mobile: test_mobile || 'MISSING',
      whapi_token: whapi_token ? whapi_token.substring(0, 10) + '...' : 'MISSING'
    });
    
    const users = readUsers();
    const user = users.find(u => u.username === req.session.user.username);
    if (!user) {
      console.error(`[SETTINGS] User not found: ${req.session.user.username}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[SETTINGS] Found user in database: ${user.username}`);
    
    // Get previous settings to check if WhatsApp API settings changed
    const previousSettings = user.settings || {};
    const previousInstanceId = previousSettings.instance_id;
    const previousAccessToken = previousSettings.access_token;
    
    // Update user settings
    user.settings = user.settings || {};
    user.settings.access_token = access_token || '';
    user.settings.instance_id = instance_id || '';
    user.settings.wa_phone = wa_phone || '';
    user.settings.notification_enabled = notification_enabled !== false;
    user.settings.timezone = 'Asia/Kolkata';
    user.settings.test_mobile = test_mobile || '';
    user.settings.whapi_token = whapi_token || '';
    user.settings.default_language = default_language || 'en';
    user.settings.autosave_interval = autosave_interval || '60';
    user.settings.log_messages = log_messages || false;
    user.settings.auto_delete = auto_delete || false;
    user.settings.session_timeout = session_timeout || '60';
    user.settings.calendly_token = calendly_token || '';
    user.settings.webhook_url = webhook_url || '';
    
    // Remove any legacy root-level fields
    delete user.access_token;
    delete user.instance_id;
    delete user.wa_phone;
    delete user.notification_enabled;
    delete user.timezone;
    delete user.test_mobile;
    delete user.whapi_token;
    
    // Save user settings first
    writeUsers(users);
    console.log(`[SETTINGS] User settings saved to database for ${user.username}`);
    
    // Register webhook if WhatsApp API settings are provided - ALWAYS register if both fields exist
    let webhookResult = null;
    
    console.log(`\n=== WEBHOOK REGISTRATION ===`);
    console.log(`[SETTINGS] User: ${user.username}`);
    
    const hasRequiredFields = access_token && instance_id;
    console.log(`[SETTINGS] Access Token: ${access_token ? 'PROVIDED' : 'MISSING'}`);
    console.log(`[SETTINGS] Instance ID: ${instance_id ? 'PROVIDED' : 'MISSING'}`);
    console.log(`[SETTINGS] Has required fields: ${hasRequiredFields}`);
    
    if (hasRequiredFields) {
      console.log(`[SETTINGS] 🚀 REGISTERING WEBHOOK for user ${user.username}`);
      console.log(`[SETTINGS] Instance ID: ${instance_id}`);
      console.log(`[SETTINGS] Access Token: ${access_token.substring(0, 10)}...`);
      
      // Always use the fixed webhook URL as specified by user
      const webhookUrl = 'https://whatspro.robomate.in/api/webhook/enroll';
      console.log(`[SETTINGS] Webhook URL: ${webhookUrl}`);
      
      webhookResult = await registerWebhook(instance_id, access_token, webhookUrl);
      
      if (webhookResult.success) {
        console.log(`[SETTINGS] ✅ Webhook registration COMPLETED successfully`);
        console.log(`[SETTINGS] Duration: ${webhookResult.duration}ms`);
        if (webhookResult.response) {
          console.log(`[SETTINGS] API Response:`, webhookResult.response.data);
        }
      } else {
        console.error(`[SETTINGS] ❌ Webhook registration FAILED`);
        console.error(`[SETTINGS] Error: ${webhookResult.error}`);
      }
    } else {
      console.log(`[SETTINGS] ⏭️  SKIPPING webhook registration - missing required fields`);
    }
    console.log(`=== WEBHOOK REGISTRATION END ===\n`);
    
    // Return simple success response (webhook registration happens silently in background)
    res.json({ success: true });
    
  } catch (error) {
    console.error('[SETTINGS] Error saving settings:', error);
    res.status(500).json({ 
      error: 'Failed to save settings',
      details: error.message
    });
  }
});



// POST test WhatsApp connection
router.post('/test-connection', authRequired, async (req, res) => {
  try {
    const { test_mobile, access_token, instance_id } = req.body;
    
    // Validate required fields
    if (!test_mobile || !access_token || !instance_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: test_mobile, access_token, and instance_id' 
      });
    }

    // Prepare the payload for wa.robomate.in API
    const payload = {
      number: test_mobile,
      type: 'text',
      message: 'WhatsApp API connection is working! You are ready to go! 🚀',
      instance_id: instance_id,
      access_token: access_token
    };

    console.log(`[TEST CONNECTION] Testing for user: ${req.session.user.username}`);
    console.log(`[TEST CONNECTION] Target number: ${test_mobile}`);
    console.log(`[TEST CONNECTION] Instance ID: ${instance_id}`);

    // Make the API call to wa.robomate.in
    const response = await axios.post(
      'https://wa.robomate.in/api/send',
      qs.stringify(payload),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log(`[TEST CONNECTION] API Response:`, response.data);

    // Check for successful response
    if (response.data && (response.data.status === 'success' || response.data.success === true)) {
      res.json({ 
        success: true, 
        message: 'Test message sent successfully!',
        details: response.data 
      });
    } else {
      res.status(400).json({ 
        error: response.data?.message || 'Failed to send test message',
        details: response.data 
      });
    }

  } catch (error) {
    console.error(`[TEST CONNECTION] Error:`, error.response?.data || error.message);
    
    // Handle different types of errors
    if (error.response) {
      res.status(400).json({ 
        error: error.response.data?.message || 'API request failed',
        details: error.response.data
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Request timeout - please try again' });
    } else {
      res.status(500).json({ error: 'Network error - please check your connection' });
    }
  }
});

// Test route for webhook registration debugging
router.post('/test-webhook-registration', authRequired, async (req, res) => {
  try {
    console.log(`\n=== WEBHOOK REGISTRATION TEST ===`);
    console.log(`[TEST] User: ${req.session.user.username}`);
    console.log(`[TEST] Request timestamp: ${new Date().toISOString()}`);
    
    const users = readUsers();
    const user = users.find(u => u.username === req.session.user.username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { instance_id, access_token, webhook_url } = req.body;
    
    if (!instance_id || !access_token) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        required: ['instance_id', 'access_token'] 
      });
    }
    
    console.log(`[TEST] Instance ID: ${instance_id}`);
    console.log(`[TEST] Access Token: ${access_token.substring(0, 10)}...`);
    
    // Always use the fixed webhook URL
    const fixedWebhookUrl = 'https://whatspro.robomate.in/api/webhook/enroll';
    console.log(`[TEST] Webhook URL: ${fixedWebhookUrl}`);
    
    const result = await registerWebhook(instance_id, access_token, fixedWebhookUrl);
    
    console.log(`[TEST] Registration result:`, result);
    console.log(`=== WEBHOOK REGISTRATION TEST END ===\n`);
    
    res.json({
      success: true,
      message: 'Webhook registration test completed',
      result: result
    });
    
  } catch (error) {
    console.error(`[TEST] Error during webhook registration test:`, error);
    res.status(500).json({ 
      error: 'Webhook registration test failed', 
      details: error.message 
    });
  }
});

module.exports = router;
