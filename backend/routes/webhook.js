const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const enrollmentsFile = path.join(__dirname, '../data/enrollments.json');
const messageQueueFile = path.join(__dirname, '../data/message_queue.json');

// Helper functions
function readEnrollments() {
  try {
    const data = fs.readFileSync(enrollmentsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeEnrollments(enrollments) {
  fs.writeFileSync(enrollmentsFile, JSON.stringify(enrollments, null, 2));
}

function readMessageQueue() {
  try {
    const data = fs.readFileSync(messageQueueFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeMessageQueue(queue) {
  fs.writeFileSync(messageQueueFile, JSON.stringify(queue, null, 2));
}

// Helper function to normalize phone number
function normalizePhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Webhook to handle WhatsApp messages (for STOP functionality)
router.post('/webhook', (req, res) => {
  try {
    const { phone, message, from } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }
    
    const normalizedPhone = normalizePhoneNumber(phone);
    const messageText = message.toLowerCase().trim();
    
    // Check if message contains stop keywords
    const stopKeywords = ['stop', 'unsubscribe', 'opt out', 'optout', 'quit', 'end'];
    const containsStopKeyword = stopKeywords.some(keyword => messageText.includes(keyword));
    
    if (containsStopKeyword) {
      // Find all active enrollments for this phone number
      const enrollments = readEnrollments();
      const userEnrollments = enrollments.filter(e => 
        normalizePhoneNumber(e.phone) === normalizedPhone && 
        ['active', 'paused'].includes(e.status)
      );
      
      if (userEnrollments.length === 0) {
        return res.json({ 
          success: true, 
          message: 'No active enrollments found for this number',
          enrollments_stopped: 0
        });
      }
      
      // Update all enrollments to opted_out
      let stoppedCount = 0;
      enrollments.forEach((enrollment, index) => {
        if (normalizePhoneNumber(enrollment.phone) === normalizedPhone && 
            ['active', 'paused'].includes(enrollment.status)) {
          enrollments[index].status = 'opted_out';
          enrollments[index].opted_out_at = new Date().toISOString();
          enrollments[index].updated_at = new Date().toISOString();
          stoppedCount++;
        }
      });
      
      // Cancel all pending messages for this phone number
      const queue = readMessageQueue();
      const updatedQueue = queue.map(msg => {
        if (normalizePhoneNumber(msg.phone) === normalizedPhone && msg.status === 'pending') {
          return { ...msg, status: 'cancelled', cancelled_reason: 'user_opted_out' };
        }
        return msg;
      });
      
      writeEnrollments(enrollments);
      writeMessageQueue(updatedQueue);
      
      console.log(`[WEBHOOK] User ${normalizedPhone} opted out. Stopped ${stoppedCount} enrollments.`);
      
      res.json({ 
        success: true, 
        message: 'User successfully opted out of all sequences',
        enrollments_stopped: stoppedCount,
        phone: normalizedPhone
      });
    } else {
      // Message doesn't contain stop keywords
      res.json({ 
        success: true, 
        message: 'Message processed but no action taken',
        action: 'none'
      });
    }
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Manual opt-out API endpoint
router.post('/opt-out', (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // Find all active enrollments for this phone number
    const enrollments = readEnrollments();
    let stoppedCount = 0;
    
    enrollments.forEach((enrollment, index) => {
      if (normalizePhoneNumber(enrollment.phone) === normalizedPhone && 
          ['active', 'paused'].includes(enrollment.status)) {
        enrollments[index].status = 'opted_out';
        enrollments[index].opted_out_at = new Date().toISOString();
        enrollments[index].updated_at = new Date().toISOString();
        stoppedCount++;
      }
    });
    
    // Cancel all pending messages
    const queue = readMessageQueue();
    const updatedQueue = queue.map(msg => {
      if (normalizePhoneNumber(msg.phone) === normalizedPhone && msg.status === 'pending') {
        return { ...msg, status: 'cancelled', cancelled_reason: 'manual_opt_out' };
      }
      return msg;
    });
    
    writeEnrollments(enrollments);
    writeMessageQueue(updatedQueue);
    
    console.log(`[API] User ${normalizedPhone} manually opted out. Stopped ${stoppedCount} enrollments.`);
    
    res.json({ 
      success: true, 
      message: 'User successfully opted out of all sequences',
      enrollments_stopped: stoppedCount,
      phone: normalizedPhone
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to opt out user' });
  }
});

// Check opt-out status
router.get('/opt-out-status/:phone', (req, res) => {
  try {
    const normalizedPhone = normalizePhoneNumber(req.params.phone);
    const enrollments = readEnrollments();
    
    const userEnrollments = enrollments.filter(e => 
      normalizePhoneNumber(e.phone) === normalizedPhone
    );
    
    const activeEnrollments = userEnrollments.filter(e => 
      ['active', 'paused'].includes(e.status)
    );
    
    const optedOutEnrollments = userEnrollments.filter(e => 
      e.status === 'opted_out'
    );
    
    res.json({
      phone: normalizedPhone,
      has_active_enrollments: activeEnrollments.length > 0,
      active_enrollments: activeEnrollments.length,
      opted_out_enrollments: optedOutEnrollments.length,
      total_enrollments: userEnrollments.length,
      is_opted_out: activeEnrollments.length === 0 && optedOutEnrollments.length > 0
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to check opt-out status' });
  }
});

module.exports = router;
