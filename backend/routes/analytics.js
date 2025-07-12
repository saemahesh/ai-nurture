const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// File paths
const analyticsFile = path.join(__dirname, '../data/campaign_analytics.json');
const queueFile = path.join(__dirname, '../data/campaign_queue.json');
const messageQueueFile = path.join(__dirname, '../data/message_queue.json');
const enrollmentsFile = path.join(__dirname, '../data/enrollments.json');
const campaignsFile = path.join(__dirname, '../data/campaigns.json');
const sequencesFile = path.join(__dirname, '../data/sequences.json');

// Helper functions
function loadData(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
}

function saveData(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
    return false;
  }
}

// Calculate comprehensive campaign analytics
function calculateCampaignAnalytics(campaignId, username) {
  const queue = loadData(queueFile);
  const messageQueue = loadData(messageQueueFile);
  const enrollments = loadData(enrollmentsFile);
  const campaigns = loadData(campaignsFile);
  const sequences = loadData(sequencesFile);
  
  // Filter data for this campaign and user
  const campaignQueue = queue.filter(q => q.campaignId === campaignId && q.username === username);
  const campaignMessages = messageQueue.filter(m => m.campaignId === campaignId && m.username === username);
  const campaignEnrollments = enrollments.filter(e => 
    (e.campaignId === campaignId || e.sequence_id === campaignId) && e.username === username
  );
  const campaign = campaigns.find(c => c.id === campaignId && c.username === username);
  const sequence = sequences.find(s => 
    (s.campaignId === campaignId || s.id === campaignId) && s.username === username
  );
  
  // Basic stats
  const totalEnrollments = campaignEnrollments.length;
  const totalMessages = campaignQueue.length;
  const sentMessages = campaignQueue.filter(q => q.status === 'sent').length;
  const failedMessages = campaignQueue.filter(q => q.status === 'failed').length;
  const pendingMessages = campaignQueue.filter(q => q.status === 'pending').length;
  
  // Delivery rate
  const deliveryRate = totalMessages > 0 ? (sentMessages / totalMessages) * 100 : 0;
  
  // Engagement metrics
  const messagesPerLead = totalEnrollments > 0 ? totalMessages / totalEnrollments : 0;
  const completionRate = totalEnrollments > 0 ? 
    (campaignEnrollments.filter(e => e.status === 'completed').length / totalEnrollments) * 100 : 0;
  
  // Time-based analytics
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const messagesLast24h = campaignMessages.filter(m => 
    new Date(m.sentAt) >= last24Hours
  ).length;
  
  const messagesLast7d = campaignMessages.filter(m => 
    new Date(m.sentAt) >= last7Days
  ).length;
  
  // Message performance by day/sequence
  const messagePerformance = [];
  if (sequence && sequence.messages) {
    sequence.messages.forEach((message, index) => {
      const messageQueue = campaignQueue.filter(q => q.messageIndex === index);
      const sent = messageQueue.filter(q => q.status === 'sent').length;
      const failed = messageQueue.filter(q => q.status === 'failed').length;
      const pending = messageQueue.filter(q => q.status === 'pending').length;
      
      messagePerformance.push({
        messageIndex: index,
        messageDay: message.day || Math.floor((message.delay || 0) / (24 * 60)) + 1,
        messageType: message.type,
        messageContent: message.text || message.content || '',
        totalScheduled: messageQueue.length,
        sent,
        failed,
        pending,
        successRate: messageQueue.length > 0 ? (sent / messageQueue.length) * 100 : 0
      });
    });
  }
  
  // Daily activity over last 30 days
  const dailyActivity = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayMessages = campaignMessages.filter(m => 
      m.sentAt && m.sentAt.split('T')[0] === dateStr
    ).length;
    
    const dayEnrollments = campaignEnrollments.filter(e => 
      e.enrolledAt && e.enrolledAt.split('T')[0] === dateStr
    ).length;
    
    dailyActivity.push({
      date: dateStr,
      messagesSent: dayMessages,
      enrollments: dayEnrollments
    });
  }
  
  return {
    campaignId,
    campaignName: campaign?.name || 'Unknown Campaign',
    totalEnrollments,
    totalMessages,
    sentMessages,
    failedMessages,
    pendingMessages,
    deliveryRate: Math.round(deliveryRate * 100) / 100,
    messagesPerLead: Math.round(messagesPerLead * 100) / 100,
    completionRate: Math.round(completionRate * 100) / 100,
    messagesLast24h,
    messagesLast7d,
    messagePerformance,
    dailyActivity,
    lastUpdated: new Date().toISOString()
  };
}

// Get analytics for a specific campaign
router.get('/campaign/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    
    const analytics = calculateCampaignAnalytics(campaignId, username);
    res.json(analytics);
  } catch (error) {
    console.error('Error getting campaign analytics:', error);
    res.status(500).json({ error: 'Failed to get campaign analytics' });
  }
});

// Get overall dashboard analytics
router.get('/dashboard', authRequired, (req, res) => {
  try {
    const username = req.session.user.username;
    
    const campaigns = loadData(campaignsFile);
    const sequences = loadData(sequencesFile);
    const enrollments = loadData(enrollmentsFile);
    const queue = loadData(queueFile);
    const messageQueue = loadData(messageQueueFile);
    
    // Filter data for current user
    const userCampaigns = campaigns.filter(c => c.username === username);
    const userSequences = sequences.filter(s => s.username === username);
    const userEnrollments = enrollments.filter(e => e.username === username);
    const userQueue = queue.filter(q => q.username === username);
    const userMessages = messageQueue.filter(m => m.username === username);
    
    // Calculate overall stats
    const totalCampaigns = userSequences.length;
    const activeCampaigns = userSequences.filter(s => s.status === 'active').length;
    const totalEnrollments = userEnrollments.length;
    const totalMessages = userQueue.length;
    const sentMessages = userQueue.filter(q => q.status === 'sent').length;
    const pendingMessages = userQueue.filter(q => q.status === 'pending').length;
    const failedMessages = userQueue.filter(q => q.status === 'failed').length;
    
    // Recent activity (last 7 days)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = userMessages.filter(m => 
      m.sentAt && new Date(m.sentAt) >= last7Days
    ).length;
    const recentEnrollments = userEnrollments.filter(e => 
      e.enrolledAt && new Date(e.enrolledAt) >= last7Days
    ).length;
    
    // Top performing campaigns
    const campaignPerformance = userSequences.map(sequence => {
      const sequenceEnrollments = userEnrollments.filter(e => 
        e.sequence_id === sequence.id || e.campaignId === sequence.id
      );
      const sequenceMessages = userMessages.filter(m => 
        m.campaignId === sequence.id || m.sequence_id === sequence.id
      );
      
      return {
        campaignId: sequence.id,
        campaignName: sequence.name,
        enrollments: sequenceEnrollments.length,
        messagesSent: sequenceMessages.length,
        status: sequence.status
      };
    }).sort((a, b) => b.messagesSent - a.messagesSent);
    
    // Daily activity for last 30 days
    const dailyStats = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayMessages = userMessages.filter(m => 
        m.sentAt && m.sentAt.split('T')[0] === dateStr
      ).length;
      
      const dayEnrollments = userEnrollments.filter(e => 
        e.enrolledAt && e.enrolledAt.split('T')[0] === dateStr
      ).length;
      
      dailyStats.push({
        date: dateStr,
        messagesSent: dayMessages,
        enrollments: dayEnrollments
      });
    }
    
    res.json({
      totalCampaigns,
      activeCampaigns,
      totalEnrollments,
      totalMessages,
      sentMessages,
      pendingMessages,
      failedMessages,
      deliveryRate: totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 100 * 100) / 100 : 0,
      recentMessages,
      recentEnrollments,
      campaignPerformance: campaignPerformance.slice(0, 10), // Top 10
      dailyStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to get dashboard analytics' });
  }
});

// Get real-time queue status
router.get('/queue-status', authRequired, (req, res) => {
  try {
    const username = req.session.user.username;
    const queue = loadData(queueFile);
    
    const userQueue = queue.filter(q => q.username === username);
    const now = new Date();
    
    // Group by status
    const statusCounts = {
      pending: userQueue.filter(q => q.status === 'pending').length,
      sent: userQueue.filter(q => q.status === 'sent').length,
      failed: userQueue.filter(q => q.status === 'failed').length
    };
    
    // Get next messages to be sent
    const nextMessages = userQueue
      .filter(q => q.status === 'pending' && new Date(q.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 5)
      .map(q => ({
        phone: q.phone,
        scheduledAt: q.scheduledAt,
        campaignId: q.campaignId,
        messageIndex: q.messageIndex,
        messageType: q.message?.type || 'text'
      }));
    
    // Get overdue messages
    const overdueMessages = userQueue
      .filter(q => q.status === 'pending' && new Date(q.scheduledAt) <= now)
      .length;
    
    res.json({
      statusCounts,
      nextMessages,
      overdueMessages,
      totalQueue: userQueue.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Get detailed campaign logs
router.get('/logs/:campaignId', authRequired, (req, res) => {
  try {
    const { campaignId } = req.params;
    const username = req.session.user.username;
    const { page = 1, limit = 50 } = req.query;
    
    const queue = loadData(queueFile);
    const messageQueue = loadData(messageQueueFile);
    
    // Get all logs for this campaign
    const campaignLogs = [
      ...queue.filter(q => q.campaignId === campaignId && q.username === username),
      ...messageQueue.filter(m => m.campaignId === campaignId && m.username === username)
    ];
    
    // Sort by date (newest first)
    campaignLogs.sort((a, b) => {
      const dateA = new Date(a.sentAt || a.scheduledAt || a.createdAt);
      const dateB = new Date(b.sentAt || b.scheduledAt || b.createdAt);
      return dateB - dateA;
    });
    
    // Paginate
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedLogs = campaignLogs.slice(startIndex, endIndex);
    
    res.json({
      logs: paginatedLogs,
      total: campaignLogs.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(campaignLogs.length / parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting campaign logs:', error);
    res.status(500).json({ error: 'Failed to get campaign logs' });
  }
});

module.exports = router;
