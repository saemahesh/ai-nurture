const express = require('express');
const router = express.Router();
const fs = require('fs');
const qs = require('querystring');
const { requireAuth } = require('../middleware/auth');
const chatService = require('../services/chat.service');
const axios = require('axios');

// Get contacts list with latest message info
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = chatService.getContacts(req.session.user.username);
    res.json(contacts);
  } catch (error) {
    console.error('Error getting contacts:', error);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

// Get chat messages for a specific phone number
router.get('/messages/:phone', requireAuth, async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const messages = chatService.getChatHistory(phone, 100); // Last 100 messages
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Send message to WhatsApp
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    // Get user settings for WhatsApp API configuration
    const { getDataFilePath } = require('../data-utils');
    const usersFile = getDataFilePath('users.json');
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const user = users.find(u => u.username === req.session.user.username);
    
    if (!user || !user.settings) {
      return res.status(400).json({ error: 'User settings not found' });
    }

    // Get WhatsApp API configuration from user settings
    const accessToken = user.settings.access_token;
    const instanceId = user.settings.instance_id;
    
    if (!accessToken || !instanceId) {
      return res.status(400).json({ error: 'WhatsApp API not configured in user settings' });
    }

    // Prepare payload for wa.robomate.in API
    const payload = {
      number: phone,
      type: 'text',
      message: message,
      instance_id: instanceId,
      access_token: accessToken
    };

    // Send message via wa.robomate.in API
    const whatsappResponse = await axios.post(
      'https://wa.robomate.in/api/send',
      qs.stringify(payload),
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000 // 30 second timeout
      }
    );

    // Check for error status in response
    if (whatsappResponse.data && whatsappResponse.data.status === 'error') {
      console.error('WhatsApp API error:', whatsappResponse.data);
      return res.status(500).json({ 
        error: 'Failed to send message: ' + (whatsappResponse.data.message || 'Unknown API error')
      });
    }

    // Store the outgoing message in chat history
    const savedMessage = chatService.addMessage({
      phone: phone,
      text: message,
      type: 'outgoing',
      username: req.session.user.username,
      timestamp: new Date().toISOString()
    });

    // Emit real-time message to user-specific chat room
    const io = req.app.get('io');
    if (io) {
      const roomName = `chat-${req.session.user.username}-${phone}`;
      io.to(roomName).emit('new-message', savedMessage);
      console.log(`📤 Emitted new message to ${roomName}:`, savedMessage.text.substring(0, 50) + '...');
    }

    res.json({ 
      success: true, 
      message: savedMessage,
      whatsappResponse: whatsappResponse.data
    });

  } catch (error) {
    console.error('Error sending message:', error);
    
    // Still save the message locally even if WhatsApp API fails
    try {
      const savedMessage = chatService.addMessage({
        phone: req.body.phone,
        text: req.body.message,
        type: 'outgoing',
        username: req.session.user.username,
        timestamp: new Date().toISOString()
      });
      
      // Emit real-time message even if WhatsApp API failed
      const io = req.app.get('io');
      if (io) {
        const roomName = `chat-${req.session.user.username}-${req.body.phone}`;
        io.to(roomName).emit('new-message', savedMessage);
        console.log(`📤 Emitted new message to ${roomName} (API failed):`, savedMessage.text.substring(0, 50) + '...');
      }
      
      res.status(500).json({ 
        error: 'Message saved locally but failed to send via WhatsApp: ' + error.message,
        message: savedMessage
      });
    } catch (saveError) {
      res.status(500).json({ error: 'Failed to send message and save locally' });
    }
  }
});

// Get chat history for AI context (internal API)
router.get('/context/:phone', requireAuth, async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const limit = parseInt(req.query.limit) || 10;
    const messages = chatService.getRecentMessagesForAI(phone, limit);
    res.json(messages);
  } catch (error) {
    console.error('Error getting chat context:', error);
    res.status(500).json({ error: 'Failed to load chat context' });
  }
});

// Mark messages as read for a specific phone number
router.post('/read/:phone', requireAuth, async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const username = req.session.user.username;
    
    const markedCount = chatService.markMessagesAsRead(phone, username);
    
    // Emit unread count update to user-specific room
    const io = req.app.get('io');
    if (io) {
      const roomName = `chat-${username}-${phone}`;
      io.to(roomName).emit('unread-count-update', { phone, unreadCount: 0 });
      console.log(`📖 Marked ${markedCount} messages as read for ${username} - ${phone}`);
      
      // Emit total unread count update for real-time sidebar updates
      const totalUnreadCount = chatService.getTotalUnreadCount(username);
      io.to(roomName).emit('total-unread-update', { totalUnreadCount });
    }
    
    res.json({ success: true, markedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread count for a specific phone number  
router.get('/unread/:phone', requireAuth, async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const username = req.session.user.username;
    
    const unreadCount = chatService.getUnreadCount(phone, username);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Get total unread count across all contacts
router.get('/unread-total', requireAuth, async (req, res) => {
  try {
    const username = req.session.user.username;
    
    const totalUnreadCount = chatService.getTotalUnreadCount(username);
    res.json({ totalUnreadCount });
  } catch (error) {
    console.error('Error getting total unread count:', error);
    res.status(500).json({ error: 'Failed to get total unread count' });
  }
});

// Clear test conversation (for test agents only)
router.delete('/messages/:phone', requireAuth, async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    
    // Only allow clearing test phone conversations
    if (!phone.startsWith('test_')) {
      return res.status(403).json({ error: 'Can only clear test conversations' });
    }
    
    await chatService.clearTestConversation(phone);
    res.json({ success: true, message: 'Test conversation cleared successfully' });
  } catch (error) {
    console.error('Error clearing test conversation:', error);
    res.status(500).json({ error: 'Failed to clear test conversation' });
  }
});

module.exports = router;
