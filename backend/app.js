require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const session = require('express-session');
const cron = require('node-cron');
const axios = require('axios');

// Helper function to get the correct media URL for sending
function getMediaUrlForSending(mediaUrl) {
  // If no media URL, return null
  if (!mediaUrl) return null;
  
  // If NODE_ENV is not production and URL doesn't contain http (local relative path)
  if (process.env.NODE_ENV !== 'prod' && !mediaUrl.includes('http')) {
    console.log(`🧪 [TESTING] Converting local media URL "${mediaUrl}" to test image for development`);
    return 'https://ezofis.com/wp-content/uploads/2025/03/blog-workflowAutomation-featured-1560x740-copy-1.jpg';
  }
  
  // For production or URLs that already contain http, return as is
  return mediaUrl;
}
const fs = require('fs');
const qs = require('querystring');

const SingleFileSessionStore = require('./single-file-session-store');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const groupsRouter = require('./routes/groups');
const scheduleRouter = require('./routes/schedule');
const mediaRouter = require('./routes/media');
const waRouter = require('./routes/wa');
const eventsRouter = require('./routes/events'); // Add the events router
const directScheduleRouter = require('./routes/direct_schedule');
const sequencesRouter = require('./routes/sequences');
const enrollmentsRouter = require('./routes/enrollments');
const webhookRouter = require('./routes/webhook');
const campaignsRouter = require('./routes/campaigns');
const campaignExecutionRouter = require('./routes/campaign-execution');
const analyticsRouter = require('./routes/analytics');
const statusRouter = require('./routes/status');

// Initialize Campaign Executor for automatic message processing
const CampaignExecutor = require('./campaign-executor');
const campaignExecutor = CampaignExecutor.getInstance();
console.log('Campaign executor initialized and started');

// Process existing enrollments on startup
setTimeout(() => {
  try {
    console.log('Processing existing enrollments on startup...');
    const enrollments = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enrollments.json'), 'utf8'));
    const campaignQueue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/campaign_queue.json'), 'utf8'));
    const sequences = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/sequences.json'), 'utf8'));
    
    let processedCount = 0;
    let completedCount = 0;
    let alreadyQueuedCount = 0;
    
    for (const enrollment of enrollments) {
      if (enrollment.status === 'active') {
        const campaignId = enrollment.sequence_id || enrollment.campaignId;
        
        // Find all queue entries for this enrollment
        const enrollmentQueue = campaignQueue.filter(q => 
          q.phone === enrollment.phone && 
          q.username === enrollment.username &&
          q.campaignId === campaignId
        );
        
        // Find the sequence for this enrollment
        const sequence = sequences.find(s => 
          (s.id === campaignId || s.campaignId === campaignId) && 
          s.username === enrollment.username
        );
        
        if (!sequence) {
          console.log(`⚠️  No sequence found for enrollment ${enrollment.phone} (campaign: ${campaignId})`);
          continue;
        }
        
        const totalMessages = sequence.messages ? sequence.messages.length : 0;
        const sentMessages = enrollmentQueue.filter(q => q.status === 'sent').length;
        const pendingMessages = enrollmentQueue.filter(q => q.status === 'pending').length;
        
        console.log(`📋 Enrollment ${enrollment.phone}: ${sentMessages}/${totalMessages} sent, ${pendingMessages} pending`);
        
        if (sentMessages >= totalMessages) {
          // All messages sent - mark enrollment as completed
          console.log(`✅ Enrollment ${enrollment.phone} completed (all ${totalMessages} messages sent)`);
          enrollment.status = 'completed';
          enrollment.completed_at = new Date().toISOString();
          completedCount++;
        } else if (enrollmentQueue.length === 0) {
          // No queue entries - need to process
          console.log(`🔄 Processing enrollment ${enrollment.phone} (no queue entries found)`);
          
          const enrollmentData = {
            sequence_id: enrollment.sequence_id,
            campaignId: enrollment.campaignId,
            username: enrollment.username,
            phone: enrollment.phone,
            enrolledAt: enrollment.enrolled_at || enrollment.enrolledAt || new Date().toISOString()
          };
          
          const result = campaignExecutor.processEnrollment(enrollmentData);
          if (result.success) {
            processedCount++;
          }
        } else {
          // Has queue entries - already processed
          console.log(`ℹ️  Enrollment ${enrollment.phone} already queued (${enrollmentQueue.length} entries)`);
          alreadyQueuedCount++;
        }
      }
    }
    
    // Save updated enrollments if any were marked as completed
    if (completedCount > 0) {
      fs.writeFileSync(path.join(__dirname, 'data/enrollments.json'), JSON.stringify(enrollments, null, 2));
    }
    
    console.log(`📊 Startup summary: ${processedCount} processed, ${completedCount} completed, ${alreadyQueuedCount} already queued`);
  } catch (error) {
    console.error('Error processing existing enrollments on startup:', error);
  }
}, 2000); // Wait 2 seconds for system to fully initialize

var app = express();

app.use(logger('dev'));
// FIX: Use explicit origin for CORS when credentials are true
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// Session middleware
app.use(session({
  store: new SingleFileSessionStore(path.join(__dirname, 'data/sessions.json')),
  secret: 'autopost-wa-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));
// Restore global JSON parser for all routes
app.use(express.json());

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend as the main app
app.use(express.static(path.join(__dirname, 'public/frontend')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
// Only parse JSON for /auth and /events routes
app.use('/auth', express.json(), authRouter);
app.use('/events', express.json(), eventsRouter);
app.use('/groups', express.json(), groupsRouter);
app.use('/schedule', scheduleRouter);
app.use('/media', mediaRouter);
app.use('/api/media', mediaRouter);
app.use('/wa', waRouter);
app.use('/direct-schedule', express.json(), directScheduleRouter);
app.use('/api/sequences', express.json(), sequencesRouter);
app.use('/api/enrollments', express.json(), enrollmentsRouter);
app.use('/api/webhook', express.json(), webhookRouter);
app.use('/api/campaigns', express.json(), campaignsRouter);
app.use('/api/campaign-execution', express.json(), campaignExecutionRouter);
app.use('/api/analytics', express.json(), analyticsRouter);
app.use('/status', statusRouter);

// Centralized WhatsApp group message sender
async function sendWhatsAppGroupMessage({ group_id, type, message, media_url, instance_id, access_token }) {
  const payload = {
    group_id,
    type,
    message,
    instance_id,
    access_token
  };
  if (type === 'media' && media_url) {
    payload.media_url = media_url;
  }
  
  const apiUrl = 'https://wa.robomate.in/api/send_group';
  console.log('[WA API] Target URL:', apiUrl);
  console.log('[WA API] Sending to group:', group_id);
  console.log('[WA API] Instance ID:', instance_id);
  console.log('[WA API] Access Token:', access_token ? access_token.substring(0, 8) + '...' : 'MISSING');
  console.log('[WA API] Payload:', JSON.stringify(payload));
  console.log('[WA API] Form data that will be sent:', qs.stringify(payload));
  
  try {
    const res = await axios.post(
      apiUrl,
      qs.stringify(payload),
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000 // 30 second timeout
      }
    );
    console.log(`[WA API] Response from group ${group_id}:`, res.data);
    
    // Check for error status in response
    if (res.data && res.data.status === 'error') {
      console.error(`[WA API] Error response for group ${group_id}:`, res.data);
      return { success: false, status: 'error', error: res.data.message || 'Unknown API error' };
    }
    
    return res.data;
  } catch (err) {
    console.error(`[WA API] Request failed for group ${group_id}:`, {
      message: err.message,
      response: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      } : 'No response received'
    });
    return { 
      success: false, 
      error: err.response ? err.response.data : err.message,
      details: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText
      } : null
    };
  }
}

// Centralized WhatsApp direct message sender
async function sendWhatsAppDirectMessage({ number, type, message, media_url, instance_id, access_token }) {
  const payload = {
    number,
    type,
    message,
    instance_id,
    access_token
  };
  if (type === 'media' && media_url) {
    payload.media_url = media_url;
  }
  
  const apiUrl = 'https://wa.robomate.in/api/send';
  console.log('[WA API Direct] Target URL:', apiUrl);
  console.log('[WA API Direct] Sending to number:', number);
  console.log('[WA API Direct] Instance ID:', instance_id);
  console.log('[WA API Direct] Access Token:', access_token ? access_token.substring(0, 8) + '...' : 'MISSING');
  console.log('[WA API Direct] Payload:', JSON.stringify(payload));
  console.log('[WA API Direct] Form data that will be sent:', qs.stringify(payload));
  
  try {
    const res = await axios.post(
      apiUrl,
      qs.stringify(payload),
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000 // 30 second timeout
      }
    );
    console.log(`[WA API Direct] Response for number ${number}:`, res.data);
    
    // Check for error status in response
    if (res.data && res.data.status === 'error') {
      console.error(`[WA API Direct] Error response for number ${number}:`, res.data);
      return { success: false, status: 'error', error: res.data.message || 'Unknown API error' };
    }
    
    return res.data;
  } catch (err) {
    console.error(`[WA API Direct] Request failed for number ${number}:`, {
      message: err.message,
      response: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      } : 'No response received'
    });
    return { 
      success: false, 
      error: err.response ? err.response.data : err.message,
      details: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText
      } : null
    };
  }
}

// Helper: sleep for throttling
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Background job: check every minute for due schedules
cron.schedule('* * * * *', async () => {
  try {
    console.log(`[CRON] ${new Date().toISOString()} - Checking for scheduled messages...`);
    
    const schedulePath = path.join(__dirname, 'data/schedule.json');
    if (!fs.existsSync(schedulePath)) {
      console.log('[CRON] Schedule file not found, skipping check');
      return;
    }
    
    const schedule = JSON.parse(fs.readFileSync(schedulePath));
    console.log(`[CRON] Found ${schedule.length} total scheduled items`);
    
    const now = new Date();
    let changed = false;
    let sentCount = 0;
    let pendingCount = 0;
    
    // Group scheduled messages by eventId to help with logging
    const eventSchedules = {};
    const regularSchedules = [];
    
    // Sort items into event-based reminders and regular scheduled messages
    for (const item of schedule) {
      if (item.eventId) {
        if (!eventSchedules[item.eventId]) {
          eventSchedules[item.eventId] = [];
        }
        eventSchedules[item.eventId].push(item);
      } else {
        regularSchedules.push(item);
      }
    }
    
    // Process event-based reminders
    for (const [eventId, items] of Object.entries(eventSchedules)) {
      const pendingItems = items.filter(item => !item.sent);
      if (pendingItems.length > 0) {
        console.log(`[CRON] Event ${eventId} has ${pendingItems.length} pending reminders`);
      }
      
      for (const item of items) {
        const scheduledTime = new Date(item.time);
        const timeUntilSend = scheduledTime - now;
        
        if (!item.sent) {
          // Count pending messages and log those coming up soon (within 10 minutes)
          pendingCount++;
          if (timeUntilSend > 0 && timeUntilSend <= 10 * 60 * 1000) {
            const minutesRemaining = Math.ceil(timeUntilSend / (60 * 1000));
            console.log(`[CRON] Event reminder "${item.reminderType}" for event ${eventId} to group ${item.groupId} due in ~${minutesRemaining} minute(s)`);
          }
          
          // Check if it's time to send
          if (scheduledTime <= now) {
            console.log(`[CRON] Processing due event reminder: "${item.reminderType}" for event ${eventId} to group ${item.groupId}`);
            console.log(`[CRON] Message content: "${item.message.substring(0, 50)}${item.message.length > 50 ? '...' : ''}"`);
            
            // Fetch user settings and group info
            const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json')));
            const groups = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/groups.json')));
            const user = users.find(u => u.username === item.username);
            if (!user || !user.settings || !user.settings.instance_id || !user.settings.access_token) {
              console.error(`[WA API] Missing WhatsApp API credentials for user ${item.username}`);
              continue;
            }
            // Find group for this user
            const group = groups.find(g => g.groupId === item.groupId && g.username === item.username);
            if (!group) {
              console.error(`[WA API] Group ${item.groupId} not found for user ${item.username}`);
              continue;
            }
            // Send text or media
            let sendResult;
            const mediaUrl = item.mediaUrl || item.media; // Support both keys
            
            // Get the correct media URL for sending (handles test URL replacement)
            const mediaUrlForSending = getMediaUrlForSending(mediaUrl);
            
            if (mediaUrlForSending) {
              sendResult = await sendWhatsAppGroupMessage({
                group_id: item.groupId,
                type: 'media',
                message: item.message,
                media_url: mediaUrlForSending,
                instance_id: user.settings.instance_id,
                access_token: user.settings.access_token
              });
              
              console.log(`📸 [GROUP MEDIA] Original URL: ${mediaUrl}`);
              console.log(`📸 [GROUP MEDIA] Sending URL: ${mediaUrlForSending}`);
            } else {
              sendResult = await sendWhatsAppGroupMessage({
                group_id: item.groupId,
                type: 'text',
                message: item.message,
                instance_id: user.settings.instance_id,
                access_token: user.settings.access_token
              });
            }
            // Throttle to avoid rate limits
            await sleep(500);
            
            if (sendResult && (sendResult.status === 'success' || sendResult.success === true)) {
              item.sent = true;
              item.sentAt = now.toISOString();
              changed = true;
              sentCount++;
              console.log(`[CRON] ✅ Successfully sent event reminder to group ${item.groupId}`);
            } else {
              item.sent = false;
              item.sendFailed = true;
              const errorMessage = sendResult?.error || sendResult?.message || 'Unknown error';
              item.sendError = errorMessage;
              
              // Log specific error types for better debugging
              if (errorMessage.includes('Instance ID Invalidated')) {
                console.error(`[WA API] ❌ INSTANCE INVALIDATED for user ${item.username}! Need to reconnect WhatsApp.`);
              } else if (errorMessage.includes('access_token')) {
                console.error(`[WA API] ❌ ACCESS TOKEN ISSUE for user ${item.username}!`);
              } else {
                console.error(`[WA API] ❌ Failed to send reminder for group ${item.groupId}:`, errorMessage);
              }
              
              changed = true; // Mark as changed to save the error
            }
          }
        }
      }
    }
    
    // Process regular scheduled messages (non-event reminders)
    for (const item of regularSchedules) {
      const scheduledTime = new Date(item.time);
      const timeUntilSend = scheduledTime - now;
      
      if (!item.sent) {
        // Count pending messages and log those coming up soon (within 10 minutes)
        pendingCount++;
        if (timeUntilSend > 0 && timeUntilSend <= 10 * 60 * 1000) {
          const minutesRemaining = Math.ceil(timeUntilSend / (60 * 1000));
          console.log(`[CRON] Regular message to group ${item.groupId} due in ~${minutesRemaining} minute(s)`);
        }
        
        // Check if it's time to send
        if (scheduledTime <= now) {
          console.log(`[CRON] Processing due regular message to group ${item.groupId}`);
          console.log(`[CRON] Message content: "${item.message.substring(0, 50)}${item.message.length > 50 ? '...' : ''}"`);
          
          // Fetch user settings and group info
          const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json')));
          const groups = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/groups.json')));
          const user = users.find(u => u.username === item.username);
          if (!user || !user.settings || !user.settings.instance_id || !user.settings.access_token) {
            console.error(`[WA API] Missing WhatsApp API credentials for user ${item.username}`);
            continue;
          }
          // Find group for this user
          const group = groups.find(g => g.groupId === item.groupId && g.username === item.username);
          if (!group) {
            console.error(`[WA API] Group ${item.groupId} not found for user ${item.username}`);
            continue;
          }
          // Send text or media
          let sendResult;
          const mediaUrl = item.mediaUrl || item.media; // Support both keys
          
          // Get the correct media URL for sending (handles test URL replacement)
          const mediaUrlForSending = getMediaUrlForSending(mediaUrl);
          
          if (mediaUrlForSending) {
            sendResult = await sendWhatsAppGroupMessage({
              group_id: item.groupId,
              type: 'media',
              message: item.message,
              media_url: mediaUrlForSending,
              instance_id: user.settings.instance_id,
              access_token: user.settings.access_token
            });
            
            console.log(`📸 [REGULAR SCHEDULE MEDIA] Original URL: ${mediaUrl}`);
            console.log(`📸 [REGULAR SCHEDULE MEDIA] Sending URL: ${mediaUrlForSending}`);
          } else {
            sendResult = await sendWhatsAppGroupMessage({
              group_id: item.groupId,
              type: 'text',
              message: item.message,
              instance_id: user.settings.instance_id,
              access_token: user.settings.access_token
            });
          }
          // Throttle to avoid rate limits
          await sleep(500);
          
          if (sendResult && (sendResult.status === 'success' || sendResult.success === true)) {
            item.sent = true;
            item.sentAt = now.toISOString();
            changed = true;
            sentCount++;
            console.log(`[CRON] ✅ Successfully sent regular message to group ${item.groupId}`);
          } else {
            item.sent = false;
            item.sendFailed = true;
            const errorMessage = sendResult?.error || sendResult?.message || 'Unknown error';
            item.sendError = errorMessage;
            
            // Log specific error types for better debugging
            if (errorMessage.includes('Instance ID Invalidated')) {
              console.error(`[WA API] ❌ INSTANCE INVALIDATED for user ${item.username}! Need to reconnect WhatsApp.`);
            } else if (errorMessage.includes('access_token')) {
              console.error(`[WA API] ❌ ACCESS TOKEN ISSUE for user ${item.username}!`);
            } else {
              console.error(`[WA API] ❌ Failed to send message for group ${item.groupId}:`, errorMessage);
            }
            
            changed = true; // Mark as changed to save the error
          }
        }
      }
    }
    
    if (changed) {
      fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
      console.log(`[CRON] Sent ${sentCount} messages and updated schedule file`);
    } else {
      console.log(`[CRON] No messages sent. ${pendingCount} messages pending.`);
    }

    // Process direct schedules
    const directSchedulePath = path.join(__dirname, 'data/direct_schedules.json');
    if (fs.existsSync(directSchedulePath)) {
      const directSchedules = JSON.parse(fs.readFileSync(directSchedulePath));
      console.log(`[CRON] Found ${directSchedules.length} total direct scheduled items`);
      
      let directChanged = false;
      
      for (const item of directSchedules) {
        if (item.status === 'Scheduled') {
          const scheduledTime = new Date(item.scheduledAt);
          
          if (scheduledTime <= now) {
            console.log(`[CRON] Processing due direct message to number: ${item.number}`);
            
            const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json')));
            const user = users.find(u => u.id === item.userId);
            
            if (!user || !user.settings || !user.settings.instance_id || !user.settings.access_token) {
              console.error(`[WA API Direct] Missing WhatsApp API credentials for user ID ${item.userId}`);
              item.status = 'Failed';
              item.sendError = 'Missing API credentials';
              directChanged = true;
              continue;
            }
            
            const type = item.mediaUrl ? 'media' : 'text';
            
            // Get the correct media URL for sending (handles test URL replacement)
            const mediaUrlForSending = getMediaUrlForSending(item.mediaUrl);
            
            const sendResult = await sendWhatsAppDirectMessage({
              number: item.number,
              type: type,
              message: item.message,
              media_url: mediaUrlForSending,
              instance_id: user.settings.instance_id,
              access_token: user.settings.access_token
            });
            
            console.log(`📸 [DIRECT MEDIA] Original URL: ${item.mediaUrl}`);
            console.log(`📸 [DIRECT MEDIA] Sending URL: ${mediaUrlForSending}`);
            
            await sleep(500); // Throttle
            
            if (sendResult && (sendResult.status === 'success' || sendResult.success === true)) {
              item.status = 'Sent';
              item.sentAt = new Date().toISOString();
              console.log(`[CRON] ✅ Successfully sent direct message to ${item.number}`);
            } else {
              item.status = 'Failed';
              const errorMessage = sendResult?.error || sendResult?.message || 'Unknown error';
              item.sendError = errorMessage;
              
              // Log specific error types for better debugging
              if (errorMessage.includes('Instance ID Invalidated')) {
                console.error(`[WA API Direct] ❌ INSTANCE INVALIDATED for user ID ${item.userId}! Need to reconnect WhatsApp.`);
              } else if (errorMessage.includes('access_token')) {
                console.error(`[WA API Direct] ❌ ACCESS TOKEN ISSUE for user ID ${item.userId}!`);
              } else {
                console.error(`[WA API Direct] ❌ Failed to send to ${item.number}:`, errorMessage);
              }
            }
            directChanged = true;
          }
        }
      }
      
      if (directChanged) {
        fs.writeFileSync(directSchedulePath, JSON.stringify(directSchedules, null, 2));
        console.log('[CRON] Updated direct schedules file.');
      }
    }

  } catch (err) {
    console.error('[CRON] Error in schedule cron job:', err);
  }
});

// === Daily Groups Sync Cron ===
const GROUPS_FILE = path.join(__dirname, 'data/groups.json');
const USERS_FILE = path.join(__dirname, 'data/users.json');

async function syncAllUsersGroups() {
  if (!fs.existsSync(USERS_FILE)) return;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  let allGroups = [];
  for (const user of users) {
    if (!user.username || !user.settings || !user.settings.access_token || !user.settings.instance_id) continue;
    try {
      const apiUrl = `https://wa.robomate.in/api/get_groups?instance_id=${user.settings.instance_id}&access_token=${user.settings.access_token}`;
      const apiRes = await axios.post(apiUrl);
      if (apiRes.data && Array.isArray(apiRes.data.groups)) {
        const userGroups = apiRes.data.groups.map(g => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
          name: g.name,
          groupId: g.id,
          username: user.username
        }));
        allGroups = allGroups.concat(userGroups);
      }
    } catch (err) {
      console.error(`Failed to sync groups for user ${user.username}:`, err.message);
    }
  }
  if (allGroups.length > 0) {
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(allGroups, null, 2));
    console.log(`[CRON] Groups synced for all users at ${new Date().toISOString()}`);
  }
}

// Run daily at 2:30 AM
cron.schedule('30 2 * * *', () => {
  syncAllUsersGroups();
});

// Debug endpoint to check WhatsApp instance status
app.get('/debug/wa-status/:username', async (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json')));
    const user = users.find(u => u.username === req.params.username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.settings || !user.settings.instance_id || !user.settings.access_token) {
      return res.status(400).json({ error: 'WhatsApp API credentials not configured' });
    }
    
    console.log(`[DEBUG] Checking WhatsApp instance status for user: ${user.username}`);
    console.log(`[DEBUG] Instance ID: ${user.settings.instance_id}`);
    console.log(`[DEBUG] Access Token: ${user.settings.access_token.substring(0, 8)}...`);
    
    // Try to check instance status
    const statusPayload = {
      instance_id: user.settings.instance_id,
      access_token: user.settings.access_token
    };
    
    const statusUrl = 'https://wa.robomate.in/api/status';
    console.log(`[DEBUG] Status check URL: ${statusUrl}`);
    console.log(`[DEBUG] Status payload:`, JSON.stringify(statusPayload));
    console.log(`[DEBUG] Status form data:`, qs.stringify(statusPayload));
    
    try {
      const statusRes = await axios.post(
        statusUrl,
        qs.stringify(statusPayload),
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      );
      
      console.log(`[DEBUG] Status API response:`, statusRes.data);
      
      res.json({
        user: user.username,
        instance_id: user.settings.instance_id,
        access_token_preview: user.settings.access_token.substring(0, 8) + '...',
        status_check: statusRes.data,
        timestamp: new Date().toISOString()
      });
      
    } catch (statusErr) {
      console.error(`[DEBUG] Status check failed:`, statusErr.response ? statusErr.response.data : statusErr.message);
      
      res.json({
        user: user.username,
        instance_id: user.settings.instance_id,
        access_token_preview: user.settings.access_token.substring(0, 8) + '...',
        status_error: statusErr.response ? statusErr.response.data : statusErr.message,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('[DEBUG] Error checking WA status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Test endpoint to send a test message
app.post('/debug/wa-test/:username', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({ error: 'Number and message are required' });
    }
    
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json')));
    const user = users.find(u => u.username === req.params.username);
    
    if (!user || !user.settings || !user.settings.instance_id || !user.settings.access_token) {
      return res.status(400).json({ error: 'WhatsApp API credentials not configured' });
    }
    
    console.log(`[DEBUG] Testing WhatsApp message for user: ${user.username}`);
    
    const sendResult = await sendWhatsAppDirectMessage({
      number: number,
      type: 'text',
      message: message,
      instance_id: user.settings.instance_id,
      access_token: user.settings.access_token
    });
    
    res.json({
      user: user.username,
      test_number: number,
      test_message: message,
      send_result: sendResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[DEBUG] Error testing WA message:', error);
    res.status(500).json({ error: 'Failed to test message' });
  }
});

// Debug endpoint to check campaign execution status
app.get('/debug/campaign-status', async (req, res) => {
  try {
    const enrollments = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enrollments.json'), 'utf8'));
    const sequences = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/sequences.json'), 'utf8'));
    const campaignQueue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/campaign_queue.json'), 'utf8'));
    const messageQueue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/message_queue.json'), 'utf8'));
    
    res.json({
      enrollments: enrollments.length,
      sequences: sequences.length,
      campaignQueue: campaignQueue.length,
      messageQueue: messageQueue.length,
      enrollmentDetails: enrollments,
      sequenceDetails: sequences,
      queueDetails: campaignQueue.slice(0, 5), // First 5 entries
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get campaign status', details: error.message });
  }
});

// Endpoint to process existing enrollments and queue their messages
app.post('/debug/process-enrollments', async (req, res) => {
  try {
    const enrollments = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/enrollments.json'), 'utf8'));
    const results = [];
    
    for (const enrollment of enrollments) {
      if (enrollment.status === 'active') {
        console.log(`Processing enrollment: ${enrollment.id} for phone: ${enrollment.phone}`);
        
        const enrollmentData = {
          sequence_id: enrollment.sequence_id,
          campaignId: enrollment.campaignId,
          username: enrollment.username,
          phone: enrollment.phone,
          enrolledAt: enrollment.enrolled_at || enrollment.enrolledAt || new Date().toISOString()
        };
        
        const result = campaignExecutor.processEnrollment(enrollmentData);
        results.push({
          enrollmentId: enrollment.id,
          phone: enrollment.phone,
          result: result
        });
      }
    }
    
    // Check final queue status
    const campaignQueue = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/campaign_queue.json'), 'utf8'));
    
    res.json({
      message: 'Processed existing enrollments',
      processedCount: results.length,
      results: results,
      finalQueueSize: campaignQueue.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing enrollments:', error);
    res.status(500).json({ error: 'Failed to process enrollments', details: error.message });
  }
});

module.exports = app;
