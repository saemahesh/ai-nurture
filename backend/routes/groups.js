const express = require('express');
const { getDataFilePath } = require('../data-utils');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const router = express.Router();

const GROUPS_FILE = getDataFilePath('groups.json');
const USERS_FILE = getDataFilePath('users.json');

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

// GET /api/groups/download-csv - Download groups as CSV
router.get('/download-csv', authRequired, async (req, res) => {
  try {
    const username = req.session.user.username;
    const tokens = getUserTokens(username);
    if (!tokens || !tokens.whapi_token) {
      return res.status(400).json({ error: 'WHAPI token not found' });
    }

    // Call WHAPI to get groups for CSV download
    const apiRes = await axios.get('https://gate.whapi.cloud/groups?count=100', {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${tokens.whapi_token}`
      }
    });

    // Accept both array and { groups: [...] } response
    let groupArr = Array.isArray(apiRes.data) ? apiRes.data : (Array.isArray(apiRes.data.groups) ? apiRes.data.groups : []);
    if (!Array.isArray(groupArr)) {
      return res.status(500).json({ error: 'Invalid WHAPI response for CSV download' });
    }

    // Filter groups (same logic as sync)
    const filteredGroups = groupArr
      .filter(g => {
        if (g.adminAddMemberMode === true) return true;
        if (g.isCommunityAnnounce === true) {
          if (!Array.isArray(g.participants)) return false;
          return !g.participants.some(p => typeof p.id === 'string' && p.id.includes('@lid'));
        }
        return false;
      });

    // Create CSV content
    const csvHeader = 'Group Name,Group ID,Description,Members Count,Created Date\n';
    const csvRows = filteredGroups.map(group => {
      const name = (group.name || '').replace(/"/g, '""'); // Escape quotes
      const id = group.id || '';
      const description = (group.description || '').replace(/"/g, '""');
      const membersCount = Array.isArray(group.participants) ? group.participants.length : 0;
      const createdDate = group.createdAt ? new Date(group.createdAt * 1000).toISOString().split('T')[0] : '';
      
      return `"${name}","${id}","${description}","${membersCount}","${createdDate}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for CSV download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="groups_${username}_${timestamp}.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error('[Groups CSV] Error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to download groups CSV', details: err.response ? err.response.data : err.message });
  }
});

// GET /api/groups/:groupId/download-members-csv - Download members of a specific group as CSV
router.get('/:groupId/download-members-csv', authRequired, async (req, res) => {
  try {
    const { groupId } = req.params;
    const username = req.session.user.username;
    const tokens = getUserTokens(username);
    
    if (!tokens || !tokens.whapi_token) {
      return res.status(400).json({ error: 'WHAPI token not found' });
    }

    // Call WHAPI to get specific group details with members
    const apiRes = await axios.get(`https://gate.whapi.cloud/groups/${groupId}`, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${tokens.whapi_token}`
      }
    });

    console.log('[Group Members CSV] WHAPI response for group:', groupId, apiRes.data);

    if (!apiRes.data) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = apiRes.data;
    const participants = Array.isArray(group.participants) ? group.participants : [];

    // Create CSV content for group members
    const csvHeader = 'Member Name,Phone Number,Role,Is Admin,Join Date,Status\n';
    const csvRows = participants.map(member => {
      const name = (member.name || '').replace(/"/g, '""'); // Escape quotes
      const phone = member.id ? member.id.replace('@c.us', '').replace('@g.us', '') : '';
      const role = member.isAdmin ? 'Admin' : 'Member';
      const isAdmin = member.isAdmin ? 'Yes' : 'No';
      const joinDate = member.joinedAt ? new Date(member.joinedAt * 1000).toISOString().split('T')[0] : '';
      const status = member.isSuperAdmin ? 'Super Admin' : (member.isAdmin ? 'Admin' : 'Member');
      
      return `"${name}","${phone}","${role}","${isAdmin}","${joinDate}","${status}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for CSV download
    const timestamp = new Date().toISOString().split('T')[0];
    const groupName = (group.name || 'group').replace(/[^a-zA-Z0-9]/g, '_'); // Clean group name for filename
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${groupName}_members_${timestamp}.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error('[Group Members CSV] Error:', err.response ? err.response.data : err.message);
    res.status(500).json({ 
      error: 'Failed to download group members CSV', 
      details: err.response ? err.response.data : err.message 
    });
  }
});

module.exports = router;