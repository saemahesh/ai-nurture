const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const SCHEDULE_FILE = path.join(__dirname, '../data/schedule.json');
function readSchedule() {
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE));
}
function writeSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
}

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper to filter schedules by user
function filterByUser(schedule, username) {
  return schedule.filter(s => s.username === username);
}

// Helper for countdown schedule
function getCountdownSchedule(baseDate) {
  const schedule = [];
  const base = new Date(baseDate);
  const countdowns = [
    { days: 5, text: '5 days to go' },
    { days: 4, text: '4 days to go' },
    { days: 3, text: '3 days to go' },
    { days: 2, text: '2 days to go' },
    { days: 1, text: '1 day to go' },
    { hours: 12, text: '12 hours to go' },
    { hours: 6, text: '6 hours to go' },
    { hours: 3, text: '3 hours to go' },
    { hours: 1, text: '1 hour to go' },
    { mins: 30, text: '30 mins to go' },
    { mins: 0, text: 'we are live' }
  ];
  countdowns.forEach(c => {
    let d = new Date(base);
    if (c.days) d.setDate(d.getDate() - c.days);
    if (c.hours) d.setHours(d.getHours() - c.hours);
    if (c.mins) d.setMinutes(d.getMinutes() - c.mins);
    schedule.push({
      time: d.toISOString(),
      countdown: c.text
    });
  });
  return schedule;
}

router.get('/', authRequired, (req, res) => {
  try {
    const schedule = readSchedule();
    res.json(filterByUser(schedule, req.session.user.username));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read schedule' });
  }
});

router.post('/', authRequired, upload.single('image'), (req, res) => {
  try {
    // Detailed debug logging
    console.log('=== DEBUG: POST /schedule ===');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file ? {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file uploaded');
    
    const { message, time } = req.body;
    let groupIds = req.body.groupIds;
    
    console.log('message:', message);
    console.log('time:', time);
    console.log('groupIds (raw):', groupIds);
    
    // Check if we received the image file
    if (!req.file) {
      console.log('ERROR: Image file is missing');
      return res.status(400).json({ error: 'Image file is required' });
    }
    
    // Check for required fields
    if (!message || !time || !groupIds) {
      console.log('ERROR: Missing required fields');
      console.log('message exists:', !!message);
      console.log('time exists:', !!time);
      console.log('groupIds exists:', !!groupIds);
      return res.status(400).json({ error: 'Missing fields (message, time, or groupIds)' });
    }
    
    // Convert groupIds to array if it's a string
    if (typeof groupIds === 'string') {
      console.log('groupIds is a string, attempting to parse');
      try {
        // Try to parse as JSON if it's a stringified array
        if (groupIds.startsWith('[') && groupIds.endsWith(']')) {
          groupIds = JSON.parse(groupIds);
          console.log('Successfully parsed groupIds as JSON array:', groupIds);
        } else {
          // Otherwise treat as a single ID
          groupIds = [groupIds];
          console.log('Treating groupIds as single value array:', groupIds);
        }
      } catch (e) {
        console.log('Error parsing groupIds:', e.message);
        groupIds = [groupIds];
        console.log('Falling back to treating as single value:', groupIds);
      }
    }
    
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      console.log('ERROR: Invalid groupIds format or empty array');
      console.log('Is array:', Array.isArray(groupIds));
      console.log('Length:', groupIds ? groupIds.length : 0);
      return res.status(400).json({ error: 'Invalid or empty groupIds' });
    }
    
    console.log('Final processed groupIds:', groupIds);
    
    const schedule = readSchedule();
    const username = req.session.user.username;
    const imageUrl = `/uploads/${req.file.filename}`;
    const createdIds = [];
    
    // Create a schedule entry for each group ID
    groupIds.forEach(groupId => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      schedule.push({ 
        id, 
        groupId, 
        message, 
        time, 
        media: imageUrl, 
        username 
      });
      createdIds.push(id);
    });
    
    writeSchedule(schedule);
    console.log('Successfully created', createdIds.length, 'schedules');
    res.json({ success: true, ids: createdIds, count: groupIds.length });
  } catch (err) {
    console.error('Schedule creation error:', err);
    res.status(500).json({ error: 'Failed to create schedule: ' + err.message });
  }
});

// Keep the old single-group API endpoint for backward compatibility
router.post('/single', authRequired, (req, res) => {
  try {
    const { groupId, message, time, media } = req.body;
    if (!groupId || !message || !time) return res.status(400).json({ error: 'Missing fields' });
    const schedule = readSchedule();
    const id = Date.now().toString();
    schedule.push({ id, groupId, message, time, media, username: req.session.user.username });
    writeSchedule(schedule);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/:id', authRequired, upload.single('image'), (req, res) => {
  try {
    console.log('=== DEBUG: PUT /schedule/:id ===');
    console.log('req.body:', req.body);
    console.log('req.params:', req.params);
    console.log('req.file:', req.file ? {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No new image uploaded');

    const { id } = req.params;
    const { groupId, message, time } = req.body;
    
    if (!groupId && !message && !time && !req.file) {
      return res.status(400).json({ error: 'No changes provided' });
    }
    
    const schedule = readSchedule();
    const item = schedule.find(s => s.id === id && s.username === req.session.user.username);
    
    if (!item) {
      console.log('Schedule item not found with id:', id);
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // Update fields if provided
    if (groupId) item.groupId = groupId;
    if (message) item.message = message;
    if (time) item.time = time;
    
    // If a new image was uploaded, update the media path
    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
      item.media = imageUrl;
      console.log('Updated media URL to:', imageUrl);
    }
    
    writeSchedule(schedule);
    console.log('Successfully updated schedule:', id);
    res.json({ 
      success: true,
      schedule: {
        id: item.id,
        groupId: item.groupId,
        message: item.message,
        time: item.time,
        media: item.media,
        sent: item.sent || false
      } 
    });
  } catch (err) {
    console.error('Schedule update error:', err);
    res.status(500).json({ error: 'Failed to update schedule: ' + err.message });
  }
});

router.delete('/:id', authRequired, (req, res) => {
  try {
    const { id } = req.params;
    let schedule = readSchedule();
    const before = schedule.length;
    schedule = schedule.filter(s => !(s.id === id && s.username === req.session.user.username));
    if (schedule.length === before) return res.status(404).json({ error: 'Not found' });
    writeSchedule(schedule);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

router.post('/automation', authRequired, upload.single('image'), (req, res) => {
  try {
    const { groupId, date, text } = req.body;
    if (!groupId || !date || !text || !req.file) return res.status(400).json({ error: 'Missing fields' });
    const schedule = readSchedule();
    const username = req.session.user.username;
    const imageUrl = `/uploads/${req.file.filename}`;
    const countdowns = getCountdownSchedule(date);
    countdowns.forEach(c => {
      // Replace {{countdown}} in text
      const message = text.replace(/\{\{countdown\}\}/g, c.countdown);
      schedule.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        groupId,
        message,
        time: c.time,
        media: imageUrl,
        username
      });
    });
    writeSchedule(schedule);
    res.json({ success: true, count: countdowns.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule automation' });
  }
});

module.exports = router;