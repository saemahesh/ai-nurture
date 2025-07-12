const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const CAMPAIGNS_FILE = path.join(__dirname, '../data/campaigns.json');

// Helper functions
function readCampaigns() {
  if (!fs.existsSync(CAMPAIGNS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading campaigns:', error);
    return [];
  }
}

function writeCampaigns(campaigns) {
  try {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  } catch (error) {
    console.error('Error writing campaigns:', error);
    throw error;
  }
}

function generateCampaignId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// GET /api/campaigns - List all campaigns for the authenticated user
router.get('/', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const userCampaigns = campaigns.filter(c => c.username === req.session.user.username);
    res.json(userCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id - Get specific campaign
router.get('/:id', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaign = campaigns.find(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// POST /api/campaigns - Create new campaign
router.post('/', authRequired, (req, res) => {
  try {
    const { name, description, duration, timeline, status = 'draft' } = req.body;
    
    if (!name || !duration || !timeline) {
      return res.status(400).json({ error: 'Campaign name, duration, and timeline are required' });
    }
    
    if (duration < 1 || duration > 90) {
      return res.status(400).json({ error: 'Campaign duration must be between 1 and 90 days' });
    }
    
    const campaigns = readCampaigns();
    const newCampaign = {
      id: generateCampaignId(),
      username: req.session.user.username,
      name: name.trim(),
      description: description ? description.trim() : '',
      duration: parseInt(duration),
      timeline: timeline, // Array of day numbers [1, 3, 5, 10, etc.]
      status: status, // draft, active, paused, completed
      messages: [], // Will be populated in campaign builder
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      stats: {
        totalLeads: 0,
        messagesQueued: 0,
        messagesSent: 0,
        messagesFailed: 0,
        leadsCompleted: 0
      }
    };
    
    campaigns.push(newCampaign);
    writeCampaigns(campaigns);
    
    res.status(201).json(newCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (campaignIndex === -1) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const existingCampaign = campaigns[campaignIndex];
    
    // Don't allow editing of active campaigns
    if (existingCampaign.status === 'active') {
      return res.status(400).json({ error: 'Cannot edit an active campaign' });
    }
    
    const { name, description, duration, timeline, messages } = req.body;
    
    // Update campaign fields
    if (name) existingCampaign.name = name.trim();
    if (description !== undefined) existingCampaign.description = description.trim();
    if (duration) {
      if (duration < 1 || duration > 90) {
        return res.status(400).json({ error: 'Campaign duration must be between 1 and 90 days' });
      }
      existingCampaign.duration = parseInt(duration);
    }
    if (timeline) existingCampaign.timeline = timeline;
    if (messages) existingCampaign.messages = messages;
    
    existingCampaign.updatedAt = new Date().toISOString();
    
    campaigns[campaignIndex] = existingCampaign;
    writeCampaigns(campaigns);
    
    res.json(existingCampaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (campaignIndex === -1) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[campaignIndex];
    
    // Don't allow deletion of active campaigns
    if (campaign.status === 'active') {
      return res.status(400).json({ error: 'Cannot delete an active campaign. Please pause it first.' });
    }
    
    campaigns.splice(campaignIndex, 1);
    writeCampaigns(campaigns);
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// POST /api/campaigns/:id/start - Start campaign
router.post('/:id/start', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (campaignIndex === -1) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[campaignIndex];
    
    if (campaign.status === 'active') {
      return res.status(400).json({ error: 'Campaign is already active' });
    }
    
    if (!campaign.messages || campaign.messages.length === 0) {
      return res.status(400).json({ error: 'Campaign must have at least one message' });
    }
    
    campaign.status = 'active';
    campaign.startedAt = new Date().toISOString();
    campaign.updatedAt = new Date().toISOString();
    
    campaigns[campaignIndex] = campaign;
    writeCampaigns(campaigns);
    
    res.json(campaign);
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// POST /api/campaigns/:id/pause - Pause campaign
router.post('/:id/pause', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (campaignIndex === -1) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[campaignIndex];
    
    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Only active campaigns can be paused' });
    }
    
    campaign.status = 'paused';
    campaign.updatedAt = new Date().toISOString();
    
    campaigns[campaignIndex] = campaign;
    writeCampaigns(campaigns);
    
    res.json(campaign);
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// POST /api/campaigns/:id/resume - Resume campaign
router.post('/:id/resume', authRequired, (req, res) => {
  try {
    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex(c => 
      c.id === req.params.id && c.username === req.session.user.username
    );
    
    if (campaignIndex === -1) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const campaign = campaigns[campaignIndex];
    
    if (campaign.status !== 'paused') {
      return res.status(400).json({ error: 'Only paused campaigns can be resumed' });
    }
    
    campaign.status = 'active';
    campaign.updatedAt = new Date().toISOString();
    
    campaigns[campaignIndex] = campaign;
    writeCampaigns(campaigns);
    
    res.json(campaign);
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

module.exports = router;
