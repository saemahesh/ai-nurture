const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const router = express.Router();

const GROUPS_FILE = path.join(__dirname, '../data/groups.json');
const USERS_FILE = path.join(__dirname, '../data/users.json');

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

// Helper to get user tokens from users.json
function getUserTokens(username) {
  if (!fs.existsSync(USERS_FILE)) return null;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.username === username);
  if (!user || !user.settings) return null;
  return {
    access_token: user.settings.access_token,
    instance_id: user.settings.instance_id,
    whapi_token: user.settings.whapi_token // Add whapi_token to returned tokens
  };
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

// POST /api/groups/sync - Sync groups for logged-in user
router.post('/sync', authRequired, async (req, res) => {
  try {
    const username = req.session.user.username;
    const tokens = getUserTokens(username);
    if (!tokens || !tokens.whapi_token) {
      return res.status(400).json({ error: 'WHAPI token not found' });
    }
    // Call WHAPI to get groups
    const apiRes = await axios.get('https://gate.whapi.cloud/groups?count=100', {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${tokens.whapi_token}`
      }
    });
    console.log('[Groups Sync] WHAPI response:', apiRes.data);
    // Accept both array and { groups: [...] } response
    let groupArr = Array.isArray(apiRes.data) ? apiRes.data : (Array.isArray(apiRes.data.groups) ? apiRes.data.groups : []);
    if (!Array.isArray(groupArr)) {
      return res.status(500).json({ error: 'Invalid WHAPI response', raw: apiRes.data });
    }
    // Filter and map groups
    const newGroups = groupArr
      .filter(g => {
        if (g.adminAddMemberMode === true) return true;
        if (g.isCommunityAnnounce === true) {
          if (!Array.isArray(g.participants)) return false;
          // Ignore if any participant id includes '@lid'
          return !g.participants.some(p => typeof p.id === 'string' && p.id.includes('@lid'));
        }
        return false;
      })
      .map(g => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        name: g.name,
        groupId: g.id,
        username
      }));
    // Remove old groups for this user, add new
    let groups = readGroups().filter(g => g.username !== username);
    groups = groups.concat(newGroups);
    writeGroups(groups);
    res.json({ success: true, count: newGroups.length, raw: apiRes.data });
  } catch (err) {
    console.error('[Groups Sync] Error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to sync groups', details: err.response ? err.response.data : err.message });
  }
});

module.exports = router;