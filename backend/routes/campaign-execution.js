const express = require('express');
const router = express.Router();
const CampaignExecutor = require('../campaign-executor');

// Create campaign executor instance
const campaignExecutor = new CampaignExecutor();

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Start a campaign
router.post('/start/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const result = campaignExecutor.startCampaign(campaignId, username);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Pause a campaign
router.post('/pause/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const result = campaignExecutor.pauseCampaign(campaignId, username);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// Resume a campaign
router.post('/resume/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const result = campaignExecutor.resumeCampaign(campaignId, username);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

// Get campaign statistics
router.get('/stats/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const stats = campaignExecutor.getCampaignStats(campaignId, username);
    res.json(stats);
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    res.status(500).json({ error: 'Failed to get campaign statistics' });
  }
});

// Get campaign queue status
router.get('/queue', authRequired, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const queueFile = path.join(__dirname, '../data/campaign_queue.json');
    
    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    const username = req.session.user.username;
    
    // Filter queue for current user
    const userQueue = queue.filter(q => q.username === username);
    
    res.json({
      total: userQueue.length,
      pending: userQueue.filter(q => q.status === 'pending').length,
      sent: userQueue.filter(q => q.status === 'sent').length,
      failed: userQueue.filter(q => q.status === 'failed').length,
      queue: userQueue.slice(0, 20) // Return first 20 items
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Get campaign execution logs
router.get('/logs/:campaignId', authRequired, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const messageQueueFile = path.join(__dirname, '../data/message_queue.json');
    const messageQueue = JSON.parse(fs.readFileSync(messageQueueFile, 'utf8'));
    
    // Filter logs for current user and campaign
    const campaignLogs = messageQueue.filter(m => 
      m.campaignId === campaignId && m.username === username
    );
    
    res.json({
      logs: campaignLogs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    });
  } catch (error) {
    console.error('Error getting campaign logs:', error);
    res.status(500).json({ error: 'Failed to get campaign logs' });
  }
});

module.exports = router;
