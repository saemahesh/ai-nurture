const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const GROUPS_FILE = path.join(__dirname, '../data/groups.json');
function readGroups() {
  if (!fs.existsSync(GROUPS_FILE)) return [];
  return JSON.parse(fs.readFileSync(GROUPS_FILE));
}
function writeGroups(groups) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper to filter groups by user
function filterByUser(groups, username) {
  return groups.filter(g => g.username === username);
}

router.get('/', authRequired, (req, res) => {
  try {
    const groups = readGroups();
    res.json(filterByUser(groups, req.session.user.username));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read groups' });
  }
});

router.post('/', authRequired, (req, res) => {
  try {
    const { name, groupId } = req.body;
    if (!name || !groupId) return res.status(400).json({ error: 'Missing group name or groupId' });
    const groups = readGroups();
    // Prevent duplicate groupId for the same user
    if (groups.find(g => g.groupId === groupId && g.username === req.session.user.username)) {
      return res.status(409).json({ error: 'Group ID already exists for this user' });
    }
    const id = Date.now().toString();
    groups.push({ id, name, groupId, username: req.session.user.username });
    writeGroups(groups);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.put('/:id', authRequired, (req, res) => {
  try {
    const { id } = req.params;
    const { name, members } = req.body;
    const groups = readGroups();
    const group = groups.find(g => g.id === id && g.username === req.session.user.username);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (name) group.name = name;
    if (members) group.members = members;
    writeGroups(groups);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/:id', authRequired, (req, res) => {
  try {
    const { id } = req.params;
    let groups = readGroups();
    const before = groups.length;
    groups = groups.filter(g => !(g.id === id && g.username === req.session.user.username));
    if (groups.length === before) return res.status(404).json({ error: 'Group not found' });
    writeGroups(groups);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;