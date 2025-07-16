const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const EVENTS_FILE = path.join(__dirname, '../data/events.json');
const REMINDERS_FILE = path.join(__dirname, '../data/event_reminders.json');
const SCHEDULE_FILE = path.join(__dirname, '../data/schedule.json');

// Set up multer storage for file uploads
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept images and videos only
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'));
    }
  }
});

// Helper function to read events data
function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify([]));
    return [];
  }
  return JSON.parse(fs.readFileSync(EVENTS_FILE));
}

// Helper function to write events data
function writeEvents(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

// Helper function to read reminders data
function readReminders() {
  if (!fs.existsSync(REMINDERS_FILE)) {
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify({}));
    return {};
  }
  return JSON.parse(fs.readFileSync(REMINDERS_FILE));
}

// Helper function to write reminders data
function writeReminders(reminders) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

// Helper function to read schedule data
function readSchedule() {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify([]));
    return [];
  }
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE));
}

// Helper function to write schedule data
function writeSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
}

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper to filter by user
function filterByUser(items, username) {
  return items.filter(item => item.username === username);
}

// Helper function to generate a unique ID
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// POST /events/:id/reminders - Configure all reminders for an event at once
router.post('/:id/reminders', authRequired, (req, res) => {
  try {
    console.log('DEBUG: req.headers:', req.headers);
    console.log('DEBUG: req.body:', req.body);
    const eventId = req.params.id;
    const events = readEvents();
    const allReminders = readReminders();
    const event = events.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.username !== req.session.user.username) {
      return res.status(403).json({ error: 'Not authorized to modify this event' });
    }
    const reminderConfig = req.body.reminderConfig;
    // If reminderConfig is a string (e.g., due to double-encoding), parse it
    let parsedConfig = reminderConfig;
    if (typeof reminderConfig === 'string') {
      try {
        parsedConfig = JSON.parse(reminderConfig);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid reminder configuration format' });
      }
    }
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid reminder configuration format' });
    }
    console.log('DEBUG: req.session before save:', req.session);
    // No file processing needed, just save config
    event.remindersConfigured = true;
    writeEvents(events);
    allReminders[eventId] = parsedConfig;
    writeReminders(allReminders);
    const scheduleInfo = generateRemindersSchedule(event, parsedConfig);
    console.log('DEBUG: req.session after save:', req.session);
    res.json({ 
      success: true, 
      message: 'Reminder settings saved successfully',
      scheduleInfo: scheduleInfo
    });
  } catch (error) {
    console.error('Failed to configure reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all events for the logged-in user
router.get('/', authRequired, (req, res) => {
  try {
    const events = readEvents();
    const userEvents = filterByUser(events, req.session.user.username);
    res.json(userEvents);
  } catch (err) {
    console.error('Failed to get events:', err);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// POST a new event
router.post('/', authRequired, upload.single('media'), (req, res) => {
  try {
    const { name, description, time, groups } = req.body;
    const newEvent = {
      id: generateId(),
      username: req.session.user.username,
      name,
      description: description || '',
      time,
      groups,
      media: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const events = readEvents();
    events.push(newEvent);
    writeEvents(events);
    res.status(201).json(newEvent);
  } catch (err) {
    console.error('Failed to create event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT to update an event
router.put('/:id', authRequired, upload.single('media'), (req, res) => {
  try {
    const eventId = req.params.id;
    const { name, description, time, groups } = req.body;
    const events = readEvents();
    const eventIndex = events.findIndex(e => e.id === eventId && e.username === req.session.user.username);
    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    events[eventIndex] = {
      ...events[eventIndex],
      name,
      description: description || '',
      time,
      groups,
      updatedAt: new Date().toISOString()
    };
    
    writeEvents(events);
    
    // If there are reminder schedules for this event, update them with the new time
    updateReminderSchedulesForEvent(events[eventIndex]);
    
    res.json(events[eventIndex]);
  } catch (err) {
    console.error('Failed to update event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE an event
router.delete('/:id', authRequired, (req, res) => {
  try {
    const eventId = req.params.id;
    
    let events = readEvents();
    const initialCount = events.length;
    
    events = events.filter(e => 
      !(e.id === eventId && e.username === req.session.user.username)
    );
    
    if (events.length === initialCount) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    writeEvents(events);
    
    // Delete associated reminders
    deleteRemindersForEvent(eventId);
    // Delete scheduled messages for this event
    deleteSchedulesForEvent(eventId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET reminders configuration for an event
router.get('/:id/reminders', authRequired, (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Check if event exists and belongs to user
    const events = readEvents();
    const event = events.find(e => 
      e.id === eventId && e.username === req.session.user.username
    );
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get reminders for this event
    const allReminders = readReminders();
    const defaultReminders = getDefaultReminders();
    const existingReminders = allReminders[eventId] || {};
    
    // Merge default reminders with existing ones
    const eventReminders = {};
    for (const key in defaultReminders) {
      eventReminders[key] = {
        ...defaultReminders[key],
        ...existingReminders[key]
      };
    }
    
    res.json(eventReminders);
  } catch (err) {
    console.error('Failed to get reminders:', err);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

// Helper function to generate default reminder structure
function getDefaultReminders() {
  return {
    '5days': { enabled: true, text: '5 days to go until {{eventName}}!', media: null },
    '4days': { enabled: true, text: '4 days to go until {{eventName}}!', media: null },
    '3days': { enabled: true, text: '3 days to go until {{eventName}}!', media: null },
    '2days': { enabled: true, text: '2 days to go until {{eventName}}!', media: null },
    '1day': { enabled: true, text: 'Only 1 day to go until {{eventName}}!', media: null },
    '12hours': { enabled: true, text: 'Just 12 hours to go until {{eventName}}!', media: null },
    '6hours': { enabled: true, text: '6 hours to go until {{eventName}}!', media: null },
    '3hours': { enabled: true, text: '3 hours to go until {{eventName}}!', media: null },
    '1hour': { enabled: true, text: '1 hour to go until {{eventName}}!', media: null },
    '30mins': { enabled: true, text: 'Only 30 minutes to go until {{eventName}}!', media: null },
    'live': { enabled: true, text: 'We are LIVE now! {{eventName}} has started!', media: null }
  };
}

// Helper function to delete reminders for an event
function deleteRemindersForEvent(eventId) {
  const allReminders = readReminders();
  delete allReminders[eventId];
  writeReminders(allReminders);
}

// Helper function to delete scheduled messages for an event
function deleteSchedulesForEvent(eventId) {
  const schedule = readSchedule();
  const updatedSchedule = schedule.filter(item => item.eventId !== eventId);
  writeSchedule(updatedSchedule);
}

// Helper function to generate scheduled messages based on event and reminders
function generateRemindersSchedule(event, reminderConfig) {
  const schedule = readSchedule();
  const username = event.username;
  const eventId = event.id;
  const eventName = event.name;
  const eventTime = new Date(event.time);
  const nowTime = new Date();
  
  // Remove existing schedules for this event
  const filteredSchedule = schedule.filter(item => item.eventId !== eventId);
  
  // Time offsets (in milliseconds)
  const offsets = {
    '5days': 5 * 24 * 60 * 60 * 1000,
    '4days': 4 * 24 * 60 * 60 * 1000,
    '3days': 3 * 24 * 60 * 60 * 1000,
    '2days': 2 * 24 * 60 * 60 * 1000,
    '1day': 1 * 24 * 60 * 60 * 1000,
    '12hours': 12 * 60 * 60 * 1000,
    '6hours': 6 * 60 * 60 * 1000,
    '3hours': 3 * 60 * 60 * 1000,
    '1hour': 1 * 60 * 60 * 1000,
    '30mins': 30 * 60 * 1000,
    'live': 0
  };
  
  // Track skipped reminders
  const skippedReminders = [];
  
  // Create new schedules for enabled reminders
  for (const [key, config] of Object.entries(reminderConfig)) {
    if (config.enabled) {
      const offset = offsets[key];
      const scheduleTime = new Date(eventTime.getTime() - offset);
      
      // Skip this reminder if it's in the past
      if (scheduleTime < nowTime) {
        console.log(`Skipping ${key} reminder for event '${eventName}' as scheduled time is in the past`);
        skippedReminders.push(key);
        continue;
      }
      
      // Process text template
      let message = config.text || '';
      message = message.replace(/\{\{eventName\}\}/g, eventName);
      
      // Determine media URL for this reminder
      // If mediaUrl is explicitly set to null, don't use any media
      let mediaUrl = null;
      if (config.mediaUrl !== null && config.mediaUrl !== undefined) {
        mediaUrl = config.mediaUrl;
      } else if (config.media) {
        mediaUrl = config.media;
      } else if (config.mediaFromLibrary && config.mediaFromLibrary.url) {
        mediaUrl = config.mediaFromLibrary.url;
      }
      
      // Create a schedule for each group
      for (const groupId of event.groups) {
        filteredSchedule.push({
          id: generateId(),
          eventId,
          reminderType: key,
          groupId,
          message,
          time: scheduleTime.toISOString(),
          media: mediaUrl,
          username,
          sent: false
        });
      }
    }
  }
  
  // Save the updated schedule
  writeSchedule(filteredSchedule);
  
  // Return information about skipped reminders
  return {
    scheduledCount: filteredSchedule.length - schedule.length,
    skippedReminders
  };
}

// Helper function to update reminder schedules when an event is updated
function updateReminderSchedulesForEvent(event) {
  const allReminders = readReminders();
  const eventReminders = allReminders[event.id];
  
  // If reminders exist for this event, regenerate the schedules
  if (eventReminders) {
    generateRemindersSchedule(event, eventReminders);
  }
}

module.exports = router;