const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const STATUS_FILE = path.join(__dirname, '../data/statuses.json');
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function readStatuses() {
  if (!fs.existsSync(STATUS_FILE)) return [];
  return JSON.parse(fs.readFileSync(STATUS_FILE));
}
function writeStatuses(statuses) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statuses, null, 2));
}

// List scheduled statuses
router.get('/', (req, res) => {
  res.json(readStatuses());
});

// Schedule a new status (mediaUrl from library)
router.post('/', (req, res) => {
  const { caption, textColor, bgColor, time, repeat, days, mediaUrl } = req.body;
  if (!mediaUrl || !time) return res.status(400).json({ error: 'Media and time required' });
  const status = {
    id: uuidv4(),
    media: mediaUrl,
    caption,
    textColor,
    bgColor,
    time,
    repeat,
    days: days || {},
    createdAt: new Date().toISOString()
  };
  const statuses = readStatuses();
  statuses.push(status);
  writeStatuses(statuses);
  res.json({ success: true, id: status.id });
});

// Delete a scheduled status
router.delete('/:id', (req, res) => {
  let statuses = readStatuses();
  const before = statuses.length;
  statuses = statuses.filter(s => s.id !== req.params.id);
  writeStatuses(statuses);
  res.json({ success: true, removed: before - statuses.length });
});

// TODO: Add cron logic to post status at scheduled time using WhatsApp API

module.exports = router;
