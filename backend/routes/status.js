const express = require("express");
const { getDataFilePath } = require('../data-utils');
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cron = require("node-cron");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

// Using getDataFilePath already imported at top
const STATUS_FILE = getDataFilePath('statuses.json');
const USERS_FILE = getDataFilePath('users.json');
const UPLOADS_DIR = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper to filter statuses by user
function filterByUser(statuses, username) {
  return statuses.filter(s => s.username === username);
}

function readStatuses() {
  if (!fs.existsSync(STATUS_FILE)) return [];
  return JSON.parse(fs.readFileSync(STATUS_FILE));
}
function writeStatuses(statuses) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statuses, null, 2));
}
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

// Function to get correct media URL for sending (like other cron jobs)
function getMediaUrl(mediaUrl) {
  // If no media provided, return null
  if (!mediaUrl) {
    return null;
  }
  
  // If in production environment
  if (process.env.NODE_ENV === 'prod') {
    if (!mediaUrl.includes('http')) {
      console.log(`🔗 [PRODUCTION] Converting local media URL "${mediaUrl}" to production URL`);
      return `https://whatspro.robomate.in${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
    }
    return mediaUrl;
  }
  
  // For development/test environments
  if (!mediaUrl.includes('http')) {
    console.log(`🧪 [TESTING] Converting local media URL "${mediaUrl}" to test image for development`);
    return 'https://ezofis.com/wp-content/uploads/2025/03/blog-workflowAutomation-featured-1560x740-copy-1.jpg';
  }
  
  return mediaUrl;
}

async function postWhatsAppStatus(status, token) {
  // Get the correct media URL for sending (handles test URL replacement)
  const mediaUrl = getMediaUrl(status.media);
  
  // Prepare the data object for WhatsApp API
  const data = {
    background_color: status.bgColor,
    caption_color: status.textColor,
    caption: status.caption,
  };
  
  // Only include media if it exists
  if (mediaUrl) {
    data.media = mediaUrl;
  }
  
  const options = {
    method: "POST",
    url: "https://gate.whapi.cloud/stories",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    data: data,
  };

  try {
    console.log(`📤 [STATUS] Posting status with media: ${mediaUrl || 'no media'}`);
    const response = await axios.request(options);
    console.log("✅ [STATUS] WhatsApp status posted successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ [STATUS] Error posting WhatsApp status:");
    console.error("- Error message:", error.message);
    if (error.response) {
      console.error("- Response status:", error.response.status);
      console.error("- Response data:", error.response.data);
    }
    throw error;
  }
}

// Cron job to post scheduled statuses
cron.schedule("* * * * *", async () => {
  const statuses = readStatuses();
  const users = readUsers();
  const now = new Date();
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    now.getDay()
  ];

  console.log(`⏰ [STATUS-CRON] Checking scheduled statuses at ${now.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);

  for (const status of statuses) {
    // Skip paused statuses
    if (status.paused) {
      console.log(`⏸️  [STATUS-CRON] Skipping paused status ${status.id}`);
      continue;
    }
    const user = users.find((u) => u.username === status.username);
    if (!user || !user.settings || !user.settings.whapi_token) {
      console.error(
        `❌ [STATUS-CRON] Could not find user or WHAPI token for status ${status.id}`
      );
      continue;
    }

    let shouldPost = false;
    const scheduledTime = new Date(status.time);

    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const isSameMinute = (d1, d2) =>
      d1.getHours() === d2.getHours() &&
      d1.getMinutes() === d2.getMinutes();

    console.log(`🔍 [STATUS-CRON] Checking status ${status.id} (${status.repeat})`);
    console.log(`   Scheduled: ${scheduledTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);
    console.log(`   Current: ${now.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);

    switch (status.repeat) {
      case "once":
        // For once type: post if scheduled time has passed and not yet posted
        if (!status.posted && scheduledTime <= now) {
          shouldPost = true;
          console.log(`✅ [STATUS-CRON] Status ${status.id} ready to post (once, time passed)`);
        } else if (status.posted) {
          console.log(`⏭️ [STATUS-CRON] Status ${status.id} already posted (once)`);
        } else {
          console.log(`⏳ [STATUS-CRON] Status ${status.id} waiting for scheduled time`);
        }
        break;
      case "daily":
        // For daily type: post if current time matches scheduled time and not posted today
        if (isSameMinute(scheduledTime, now)) {
          if (
            !status.lastPosted ||
            !isSameDay(new Date(status.lastPosted), now)
          ) {
            shouldPost = true;
            console.log(`✅ [STATUS-CRON] Status ${status.id} ready to post (daily, time match)`);
          } else {
            console.log(`⏭️ [STATUS-CRON] Status ${status.id} already posted today`);
          }
        } else {
          console.log(`⏳ [STATUS-CRON] Status ${status.id} waiting for daily time slot`);
        }
        break;
      case "custom":
        // For custom type: post if today is selected day, time matches, and not posted today
        if (status.days[dayOfWeek]) {
          if (isSameMinute(scheduledTime, now)) {
            if (
              !status.lastPosted ||
              !isSameDay(new Date(status.lastPosted), now)
            ) {
              shouldPost = true;
              console.log(`✅ [STATUS-CRON] Status ${status.id} ready to post (custom, ${dayOfWeek} match)`);
            } else {
              console.log(`⏭️ [STATUS-CRON] Status ${status.id} already posted today`);
            }
          } else {
            console.log(`⏳ [STATUS-CRON] Status ${status.id} waiting for custom time slot on ${dayOfWeek}`);
          }
        } else {
          console.log(`📅 [STATUS-CRON] Status ${status.id} not scheduled for ${dayOfWeek}`);
        }
        break;
    }

    if (shouldPost) {
      try {
        console.log(`📤 [STATUS-CRON] Posting status ${status.id}...`);
        await postWhatsAppStatus(status, user.settings.whapi_token);
        if (status.repeat === "once") {
          status.posted = true;
          console.log(`✅ [STATUS-CRON] Status ${status.id} marked as posted (once)`);
        }
        status.lastPosted = now.toISOString();
        console.log(`✅ [STATUS-CRON] Status ${status.id} posted successfully`);
      } catch (error) {
        console.error(`❌ [STATUS-CRON] Failed to post status ${status.id}:`, error.message);
      }
    }
  }

  writeStatuses(statuses);
});

// List scheduled statuses (filtered by current user)
router.get("/", authRequired, (req, res) => {
  try {
    let statuses = readStatuses();
    let needsWrite = false;
    // migrate missing paused field
    statuses = statuses.map(s => {
      if (typeof s.paused === 'undefined') {
        s.paused = false; needsWrite = true;
      }
      return s;
    });
    if (needsWrite) writeStatuses(statuses);
    const userStatuses = filterByUser(statuses, req.session.user.username);
    res.json(userStatuses);
  } catch (err) {
    console.error("Error reading statuses:", err);
    res.status(500).json({ error: 'Failed to read statuses' });
  }
});

// Schedule a new status (mediaUrl from library)
router.post("/", authRequired, (req, res) => {
  console.log('📝 [STATUS-API-POST] Request received:', req.body);
  const { caption, textColor, bgColor, time, repeat, days, mediaUrl } =
    req.body;
  console.log('📝 [STATUS-API-POST] Extracted mediaUrl:', mediaUrl, typeof mediaUrl);
  console.log('📝 [STATUS-API-POST] Extracted time:', time, typeof time);
  
  if (!time) {
    console.log('📝 [STATUS-API-POST] Validation failed: Time is required');
    return res.status(400).json({ error: "Time is required" });
  }
  
  const processedMediaUrl = (mediaUrl && mediaUrl.trim()) || null;
  console.log('📝 [STATUS-API-POST] Processed mediaUrl:', processedMediaUrl);
  
  const status = {
    id: uuidv4(),
    media: processedMediaUrl,
    caption,
    textColor,
    bgColor,
    time,
    repeat,
    days: days || {},
    createdAt: new Date().toISOString(),
    username: req.session.user.username,
    paused: false
  };
  
  console.log('📝 [STATUS-API-POST] Final status object:', status);
  
  const statuses = readStatuses();
  statuses.push(status);
  writeStatuses(statuses);
  
  console.log('📝 [STATUS-API-POST] Status saved successfully');
  res.json({ success: true, id: status.id });
});

// Update a scheduled status (only if user owns it)
router.put("/:id", authRequired, (req, res) => {
  console.log('📝 [STATUS-API-PUT] Request received for ID:', req.params.id);
  console.log('📝 [STATUS-API-PUT] Request body:', req.body);
  
  const { caption, textColor, bgColor, time, repeat, days, mediaUrl } =
    req.body;
  console.log('📝 [STATUS-API-PUT] Extracted mediaUrl:', mediaUrl, typeof mediaUrl);
  console.log('📝 [STATUS-API-PUT] Extracted time:', time, typeof time);
  
  if (!time) {
    console.log('📝 [STATUS-API-PUT] Validation failed: Time is required');
    return res.status(400).json({ error: "Time is required" });
  }

  let statuses = readStatuses();
  const index = statuses.findIndex((s) => s.id === req.params.id);

  if (index === -1) {
    console.log('📝 [STATUS-API-PUT] Status not found:', req.params.id);
    return res.status(404).json({ error: "Status not found" });
  }

  const existingStatus = statuses[index];
  
  // Check if user owns this status
  if (existingStatus.username !== req.session.user.username) {
    console.log('📝 [STATUS-API-PUT] Access denied for user:', req.session.user.username);
    return res.status(403).json({ error: "Access denied: You can only edit your own statuses" });
  }
  
  console.log(`📝 [STATUS-EDIT] Editing status ${req.params.id} - Type: ${repeat}`);
  console.log(`📝 [STATUS-EDIT] Previous posted state: ${existingStatus.posted}`);
  
  const processedMediaUrl = (mediaUrl && mediaUrl.trim()) || null;
  console.log('📝 [STATUS-API-PUT] Processed mediaUrl:', processedMediaUrl);
  
  statuses[index] = {
    ...existingStatus,
    media: processedMediaUrl,
    caption,
    textColor,
    bgColor,
    time,
    repeat,
    days: days || {},
  };

  console.log('📝 [STATUS-API-PUT] Updated status object:', statuses[index]);

  // If editing a "once" type status, reset posted to false so it can be sent again
  if (repeat === "once") {
    statuses[index].posted = false;
    // Remove lastPosted as well since it's a new schedule
    delete statuses[index].lastPosted;
    console.log(`🔄 [STATUS-EDIT] Reset "once" type status ${req.params.id} to unsent state`);
  }

  writeStatuses(statuses);
  console.log(`✅ [STATUS-EDIT] Status ${req.params.id} updated successfully`);
  res.json({ success: true, id: req.params.id });
});

// Delete a scheduled status (only if user owns it)
router.delete("/:id", authRequired, (req, res) => {
  let statuses = readStatuses();
  const statusToDelete = statuses.find((s) => s.id === req.params.id);
  
  if (!statusToDelete) {
    return res.status(404).json({ error: "Status not found" });
  }
  
  // Check if user owns this status
  if (statusToDelete.username !== req.session.user.username) {
    return res.status(403).json({ error: "Access denied: You can only delete your own statuses" });
  }
  
  const before = statuses.length;
  statuses = statuses.filter((s) => s.id !== req.params.id);
  writeStatuses(statuses);
  res.json({ success: true, removed: before - statuses.length });
});

// Pause a status
router.put('/:id/pause', authRequired, (req, res) => {
  try {
    const statuses = readStatuses();
    const idx = statuses.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
    if (idx === -1) return res.status(404).json({ error: 'Status not found or access denied' });
    if (statuses[idx].paused) return res.json(statuses[idx]);
    statuses[idx].paused = true;
    statuses[idx].pausedAt = new Date().toISOString();
    writeStatuses(statuses);
    res.json(statuses[idx]);
  } catch (e) {
    console.error('Error pausing status:', e);
    res.status(500).json({ error: 'Failed to pause status' });
  }
});

// Resume a status
router.put('/:id/resume', authRequired, (req, res) => {
  try {
    const statuses = readStatuses();
    const idx = statuses.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
    if (idx === -1) return res.status(404).json({ error: 'Status not found or access denied' });
    if (!statuses[idx].paused) return res.json(statuses[idx]);
    statuses[idx].paused = false;
    statuses[idx].resumedAt = new Date().toISOString();
    writeStatuses(statuses);
    res.json(statuses[idx]);
  } catch (e) {
    console.error('Error resuming status:', e);
    res.status(500).json({ error: 'Failed to resume status' });
  }
});

// If this router is mounted at /status and also needs /api/status, export normally.
// NOTE: Ensure app.js uses app.use('/api/status', statusRouter) for API style routes.
module.exports = router;
