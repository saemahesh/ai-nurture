const express = require("express");
const { getDataFilePath } = require('../data-utils');
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const axios = require("axios");
const router = express.Router();

// Import the CampaignExecutor singleton
const CampaignExecutor = require("../campaign-executor");
const campaignExecutor = CampaignExecutor.getInstance();

// Import AI service for intelligent responses
const { generateAIResponse, shouldRespond, getActiveAgents } = require("../services/ai.service");

// Import chat service for storing message history
const chatService = require("../services/chat.service");

/**
 * Unified Webhook Handler
 * 
 * The /enroll endpoint now handles all incoming WhatsApp messages and decides:
 * 1. If message contains stop keywords -> opt out user from all sequences
 * 2. If message matches sequence keywords -> enroll user in sequence
 * 3. If message doesn't match any keywords -> log and return no action
 * 
 * This consolidates enrollment and opt-out logic into a single endpoint.
 */

// Use environment-based data paths (already imported at top)
const usersFile = getDataFilePath('users.json');
const sequencesFile = getDataFilePath('sequences.json');
const enrollmentsFile = getDataFilePath('enrollments.json');
const messageQueueFile = getDataFilePath('message_queue.json');

// AI Response Timer System - wait 30 seconds before responding to collect full context
const aiResponseTimers = new Map(); // phone -> { timeout, messages, user, instanceId, agent }
const AI_RESPONSE_DELAY = process.env.AI_RESPONSE_DELAY || 30000; // 30 seconds

// Helper functions that are still needed in this file
function readUsers() {
  try {
    const data = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function readSequences() {
  try {
    const data = fs.readFileSync(sequencesFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function readEnrollments() {
  try {
    const data = fs.readFileSync(enrollmentsFile, "utf8");
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
    const data = fs.readFileSync(messageQueueFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeMessageQueue(queue) {
  fs.writeFileSync(messageQueueFile, JSON.stringify(queue, null, 2));
}

function normalizePhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 && !cleaned.startsWith("91")) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

// Function to check if message matches keyword based on sequence settings
function matchesKeyword(message, keyword, matchType, caseSensitive) {
  const msgText = caseSensitive ? message : message.toLowerCase();
  const keywordText = caseSensitive ? keyword : keyword.toLowerCase();
  
  if (matchType === 'exact') {
    return msgText === keywordText;
  } else if (matchType === 'contains') {
    // Use word boundary regex to ensure whole word match
    const regex = new RegExp(`\\b${keywordText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, caseSensitive ? 'g' : 'gi');
    return regex.test(msgText);
  }
  
  return false;
}

// Function to handle user enrollment in sequences
function handleEnrollment(phone, messageText, user, pushName) {
  // Find matching sequence
  const sequences = readSequences();
  const targetSequence = sequences.find((s) => {
    if (s.username !== user.username || s.status !== "active") {
      return false;
    }
    
    // Check exact match keywords
    if (s.exactKeywords && s.exactKeywords.length > 0) {
      const exactMatch = s.exactKeywords.some(keyword => 
        matchesKeyword(messageText, keyword, 'exact', false)
      );
      if (exactMatch) return true;
    }
    
    // Check contains keywords
    if (s.containsKeywords && s.containsKeywords.length > 0) {
      const containsMatch = s.containsKeywords.some(keyword => 
        matchesKeyword(messageText, keyword, 'contains', false)
      );
      if (containsMatch) return true;
    }
    
    // Backward compatibility: check old keywords field
    if (s.keywords && s.keywords.length > 0) {
      const matchType = s.keywordMatchType || 'contains';
      const caseSensitive = s.caseSensitive === true || s.caseSensitive === 'true';
      return s.keywords.some(keyword => matchesKeyword(messageText, keyword, matchType, caseSensitive));
    }
    
    return false;
  });

  if (!targetSequence) {
    return {
      success: true,
      action: "no_match",
      message: `No active sequence found for keyword: ${messageText}`,
      phone: phone
    };
  }

  console.log(`[WEBHOOK] Enrolled in sequence: ${targetSequence.name}`);

  // Check if user is already enrolled
  const enrollments = readEnrollments();
  const existingEnrollment = enrollments.find(
    (e) =>
      normalizePhoneNumber(e.phone) === phone &&
      e.sequence_id === targetSequence.id &&
      ["active", "paused"].includes(e.status)
  );

  if (existingEnrollment) {
    return {
      success: true,
      action: "already_enrolled",
      message: `User already enrolled in sequence: ${targetSequence.name}`,
      phone: phone,
      sequence_name: targetSequence.name
    };
  }

  // Create new enrollment
  const newEnrollment = {
    id: "enroll_" + Date.now(),
    sequence_id: targetSequence.id,
    username: user.username,
    phone: phone,
    name: pushName || "",
    enrolled_at: moment().toISOString(),
    current_day: 0,
    status: "active",
    last_message_sent: null,
    next_message_due: null,
    messages_sent: 0,
    total_messages: targetSequence.messages.length,
    custom_fields: {},
  };

  // Set next message due date
  if (targetSequence.messages && targetSequence.messages.length > 0) {
    const firstMessage = targetSequence.messages[0];
    const enrolledDate = new Date(newEnrollment.enrolled_at);
    const nextMessageDate = new Date(enrolledDate);
    nextMessageDate.setDate(enrolledDate.getDate() + (firstMessage.day - 1));
    if (
      nextMessageDate.getHours() === 0 &&
      nextMessageDate.getMinutes() === 0
    ) {
      nextMessageDate.setHours(9, 0, 0, 0);
    }
    newEnrollment.next_message_due = nextMessageDate.toISOString();
  }

  enrollments.push(newEnrollment);
  writeEnrollments(enrollments);

  // Schedule messages using CampaignExecutor
  try {
    const result = campaignExecutor.processEnrollment({
      ...newEnrollment,
      enrolledAt: newEnrollment.enrolled_at,
    });
    
    console.log(`[WEBHOOK] Successfully enrolled ${phone} in sequence ${targetSequence.name}`);
    
    return {
      success: true,
      action: "enrolled",
      message: `Successfully enrolled in sequence: ${targetSequence.name}`,
      phone: phone,
      sequence_name: targetSequence.name,
      enrollment_id: newEnrollment.id,
      total_messages: targetSequence.messages.length
    };
  } catch (error) {
    console.error(`[WEBHOOK] Error processing enrollment for ${phone}:`, error);
    throw new Error("Failed to process enrollment");
  }
}

// Function to handle user unenrollment (opt-out)
function handleUnenrollment(phone, messageText) {
  console.log(`[WEBHOOK] Processing unenrollment for ${phone}. Stop message: "${messageText}"`);
  
  const enrollments = readEnrollments();
  const userEnrollments = enrollments.filter(
    (e) =>
      normalizePhoneNumber(e.phone) === phone &&
      ["active", "paused"].includes(e.status)
  );

  if (userEnrollments.length === 0) {
    console.log(`[WEBHOOK] No active enrollments found for ${phone}`);
    return {
      success: true,
      action: "stop_attempted",
      message: "No active enrollments found for this number",
      enrollments_stopped: 0,
      phone: phone
    };
  }

  // Update all enrollments to opted_out
  let stoppedCount = 0;
  enrollments.forEach((enrollment, index) => {
    if (
      normalizePhoneNumber(enrollment.phone) === phone &&
      ["active", "paused"].includes(enrollment.status)
    ) {
      enrollments[index].status = "opted_out";
      enrollments[index].opted_out_at = moment().toISOString();
      enrollments[index].updated_at = moment().toISOString();
      stoppedCount++;
    }
  });

  // Cancel all pending messages for this phone number
  const queue = readMessageQueue();
  const updatedQueue = queue.map((msg) => {
    if (
      normalizePhoneNumber(msg.phone) === phone &&
      msg.status === "pending"
    ) {
      return {
        ...msg,
        status: "cancelled",
        cancelled_reason: "user_opted_out",
        cancelled_at: moment().toISOString()
      };
    }
    return msg;
  });

  writeEnrollments(enrollments);
  writeMessageQueue(updatedQueue);

  console.log(`[WEBHOOK] User ${phone} opted out. Stopped ${stoppedCount} enrollments.`);

  return {
    success: true,
    action: "opted_out",
    message: "User successfully opted out of all sequences",
    enrollments_stopped: stoppedCount,
    phone: phone
  };
}

// Webhook endpoint for handling all WhatsApp messages (enrollment and stop)
router.post("/enroll", (req, res) => {
  const { instance_id, data } = req.body;

  if (!instance_id || !data || !data.message || !data.message.body_message) {
    console.error(`[WEBHOOK] Invalid payload - missing required fields`);
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const { content } = data.message.body_message;
  const fromContact = data.message.from_contact;
  const pushName = data.message.push_name;

  // Skip if from_contact is too long (invalid phone)
  if (!content || !fromContact) {
    console.error(`[WEBHOOK] Missing message content or contact`);
    return res
      .status(400)
      .json({ error: "Missing message content or contact information" });
  }
  if (fromContact.length > 15) {
    console.error(`[WEBHOOK] Invalid phone number format: ${fromContact}`);
    return res.status(400).json({ error: "from_contact is too long, skipping processing" });
  }

  const messageText = content.trim().toLowerCase();
  const phone = normalizePhoneNumber(fromContact);

  // 1. Find the user by instance_id first (needed for user-specific chat rooms)
  const users = readUsers();
  const user = users.find((u) => u.settings && u.settings.instance_id === instance_id);

  if (!user) {
    console.error(`[WEBHOOK] No user found with instance_id: ${instance_id}`);
    return res
      .status(404)
      .json({ error: "User with the given instance_id not found" });
  }

  // Store incoming message in chat history immediately
  try {
    const savedMessage = chatService.addMessage({
      phone: phone,
      text: content.trim(), // Use original content, not lowercase
      type: 'incoming',
      username: null, // Incoming messages don't have a username
      timestamp: new Date().toISOString()
    });
    
    // Emit real-time message to user-specific chat room
    const io = req.app.get('io');
    if (io) {
      const roomName = `chat-${user.username}-${phone}`;
      io.to(roomName).emit('new-message', savedMessage);
      
      // Also emit unread count update (this will be handled by client if they're not viewing this chat)
      const chatService = require('../services/chat.service');
      const unreadCount = chatService.getUnreadCount(phone, user.username);
      io.to(roomName).emit('unread-count-update', { phone, unreadCount });
      
      // Emit total unread count update for real-time sidebar updates
      const totalUnreadCount = chatService.getTotalUnreadCount(user.username);
      io.to(roomName).emit('total-unread-update', { totalUnreadCount });
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error storing message in chat history:`, error);
    // Continue processing even if chat storage fails
  }

  // 2. Check if message contains stop keywords first
  const stopKeywords = [
    "stop",
    "unsubscribe", 
    "opt out",
    "optout",
    "quit",
    "end",
    "cancel",
    "remove"
  ];
  
  const containsStopKeyword = stopKeywords.some((keyword) => {
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(messageText);
  });

  if (containsStopKeyword) {
    console.log(`[WEBHOOK] Stop keyword detected in message: "${content}"`);
    
    try {
      const result = handleUnenrollment(phone, messageText);
      return res.json(result);
    } catch (error) {
      console.error(`[WEBHOOK] Error processing unenrollment for ${phone}:`, error);
      return res.status(500).json({
        error: "Failed to process opt-out request",
        phone: phone
      });
    }
  }

  // 3. If not a stop message, check for enrollment keywords
  try {
    const result = handleEnrollment(phone, messageText, user, pushName);
    
    // 4. If no sequence match found, check for AI agent responses
    if (result.action === "no_match") {
      // Try to get AI response (asynchronous, don't wait for response)
      handleAIResponse(phone, content, user, instance_id, req);
    }
    
    return res.json(result);
  } catch (error) {
    console.error(`[WEBHOOK] Error processing enrollment for ${phone}:`, error);
    return res.status(500).json({ 
      error: "Failed to process enrollment",
      phone: phone 
    });
  }
});

// Legacy webhook endpoint - redirects to /enroll for compatibility
router.post("/whatsapp", (req, res) => {
  
  // Transform the request to match /enroll format if needed
  if (req.body.phone && req.body.message) {
    // Legacy format: { phone, message, from }
    const transformedBody = {
      instance_id: req.body.instance_id || req.headers['x-instance-id'],
      data: {
        message: {
          body_message: {
            content: req.body.message
          },
          from_contact: req.body.phone || req.body.from,
          push_name: req.body.name || ""
        }
      }
    };
    
    // Call the main enroll logic
    req.body = transformedBody;
    return router.handle({ ...req, url: '/enroll', method: 'POST' }, res);
  }
  
  // If already in the correct format, proceed with the normal logic
  try {
    const { phone, message, from } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const messageText = message.toLowerCase().trim();

    // Check if message contains stop keywords
    const stopKeywords = [
      "stop",
      "unsubscribe",
      "opt out",
      "optout",
      "quit",
      "end",
    ];
    const containsStopKeyword = stopKeywords.some((keyword) => {
      // Use word boundary regex to match whole words only
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(messageText);
    });

    if (containsStopKeyword) {
      // Find all active enrollments for this phone number
      const enrollments = readEnrollments();
      const userEnrollments = enrollments.filter(
        (e) =>
          normalizePhoneNumber(e.phone) === normalizedPhone &&
          ["active", "paused"].includes(e.status)
      );

      if (userEnrollments.length === 0) {
        return res.json({
          success: true,
          message: "No active enrollments found for this number",
          enrollments_stopped: 0,
        });
      }

      // Update all enrollments to opted_out
      let stoppedCount = 0;
      enrollments.forEach((enrollment, index) => {
        if (
          normalizePhoneNumber(enrollment.phone) === normalizedPhone &&
          ["active", "paused"].includes(enrollment.status)
        ) {
          enrollments[index].status = "opted_out";
          enrollments[index].opted_out_at = moment().toISOString();
          enrollments[index].updated_at = moment().toISOString();
          stoppedCount++;
        }
      });

      // Cancel all pending messages for this phone number
      const queue = readMessageQueue();
      const updatedQueue = queue.map((msg) => {
        if (
          normalizePhoneNumber(msg.phone) === normalizedPhone &&
          msg.status === "pending"
        ) {
          return {
            ...msg,
            status: "cancelled",
            cancelled_reason: "user_opted_out",
          };
        }
        return msg;
      });

      writeEnrollments(enrollments);
      writeMessageQueue(updatedQueue);

      console.log(
        `[WEBHOOK] User ${normalizedPhone} opted out. Stopped ${stoppedCount} enrollments.`
      );

      res.json({
        success: true,
        message: "User successfully opted out of all sequences",
        enrollments_stopped: stoppedCount,
        phone: normalizedPhone,
      });
    } else {
      // Message doesn't contain stop keywords
      res.json({
        success: true,
        message: "Message processed but no action taken",
        action: "none",
      });
    }
  } catch (error) {
    console.error("[WEBHOOK] Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Manual opt-out API endpoint
router.post("/opt-out", (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // Find all active enrollments for this phone number
    const enrollments = readEnrollments();
    let stoppedCount = 0;

    enrollments.forEach((enrollment, index) => {
      if (
        normalizePhoneNumber(enrollment.phone) === normalizedPhone &&
        ["active", "paused"].includes(enrollment.status)
      ) {
        enrollments[index].status = "opted_out";
        enrollments[index].opted_out_at = moment().toISOString();
        enrollments[index].updated_at = moment().toISOString();
        stoppedCount++;
      }
    });

    // Cancel all pending messages
    const queue = readMessageQueue();
    const updatedQueue = queue.map((msg) => {
      if (
        normalizePhoneNumber(msg.phone) === normalizedPhone &&
        msg.status === "pending"
      ) {
        return {
          ...msg,
          status: "cancelled",
          cancelled_reason: "manual_opt_out",
        };
      }
      return msg;
    });

    writeEnrollments(enrollments);
    writeMessageQueue(updatedQueue);

    console.log(
      `[API] User ${normalizedPhone} manually opted out. Stopped ${stoppedCount} enrollments.`
    );

    res.json({
      success: true,
      message: "User successfully opted out of all sequences",
      enrollments_stopped: stoppedCount,
      phone: normalizedPhone,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to opt out user" });
  }
});

// Check opt-out status
router.get("/opt-out-status/:phone", (req, res) => {
  try {
    const normalizedPhone = normalizePhoneNumber(req.params.phone);
    const enrollments = readEnrollments();

    const userEnrollments = enrollments.filter(
      (e) => normalizePhoneNumber(e.phone) === normalizedPhone
    );

    const activeEnrollments = userEnrollments.filter((e) =>
      ["active", "paused"].includes(e.status)
    );

    const optedOutEnrollments = userEnrollments.filter(
      (e) => e.status === "opted_out"
    );

    res.json({
      phone: normalizedPhone,
      has_active_enrollments: activeEnrollments.length > 0,
      active_enrollments: activeEnrollments.length,
      opted_out_enrollments: optedOutEnrollments.length,
      total_enrollments: userEnrollments.length,
      is_opted_out:
        activeEnrollments.length === 0 && optedOutEnrollments.length > 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to check opt-out status" });
  }
});

// Test endpoint for webhook logic
router.post("/test-message", (req, res) => {
  try {
    const { instance_id, phone, message, name } = req.body;
    
    if (!instance_id || !phone || !message) {
      return res.status(400).json({ error: "instance_id, phone, and message are required" });
    }
    
    // Format as webhook payload
    const webhookPayload = {
      instance_id: instance_id,
      data: {
        message: {
          body_message: {
            content: message
          },
          from_contact: phone,
          push_name: name || ""
        }
      }
    };
    
    console.log(`[TEST] Simulating webhook with payload:`, JSON.stringify(webhookPayload, null, 2));
    
    // Call the enroll endpoint logic directly
    const mockReq = { body: webhookPayload };
    const mockRes = {
      status: (code) => ({
        json: (data) => res.status(code).json({ ...data, test_mode: true })
      }),
      json: (data) => res.json({ ...data, test_mode: true })
    };
    
    // This would normally call the enroll handler, but for testing we'll inline the logic
    res.json({
      success: true,
      message: "Test endpoint - use /enroll with proper webhook format for actual testing",
      payload_format: webhookPayload
    });
    
  } catch (error) {
    console.error("[TEST] Error in test endpoint:", error);
    res.status(500).json({ error: "Test failed", details: error.message });
  }
});

// Function to handle AI agent responses
async function handleAIResponse(phone, message, user, instanceId, req) {
  try {
    // Get active AI agents for this user
    const activeAgents = getActiveAgents(user.username);
    
    if (activeAgents.length === 0) {
      return;
    }

    // Find the first agent that should respond to this message
    let responseAgent = null;
    for (const agent of activeAgents) {
      if (shouldRespond(agent, message)) {
        responseAgent = agent;
        break;
      }
    }

    if (!responseAgent) {
      return;
    }

    console.log(`[AI] Agent "${responseAgent.name}" will respond in 30 seconds`);
    
    // Check if there's already a pending response for this phone
    if (aiResponseTimers.has(phone)) {
      const existing = aiResponseTimers.get(phone);
      
      // Clear the existing timeout
      clearTimeout(existing.timeout);
      
      // Add the new message to the existing queue
      existing.messages.push({
        text: message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Create new entry with first message
      aiResponseTimers.set(phone, {
        messages: [{
          text: message,
          timestamp: new Date().toISOString()
        }],
        user: user,
        instanceId: instanceId,
        agent: responseAgent,
        req: req
      });
    }

    // Set/reset the timeout for this phone
    const timerData = aiResponseTimers.get(phone);
    timerData.timeout = setTimeout(() => {
      processDelayedAIResponse(phone);
    }, AI_RESPONSE_DELAY);
    
  } catch (error) {
    console.error(`[AI] Error in handleAIResponse:`, error);
  }
}

// Process the delayed AI response after timer expires
async function processDelayedAIResponse(phone) {
  try {
    if (!aiResponseTimers.has(phone)) {
      return;
    }

    const timerData = aiResponseTimers.get(phone);
    const { messages, user, instanceId, agent, req } = timerData;

    // Combine all messages into context
    const combinedMessage = messages.map(msg => msg.text).join('\n');

    // Clear the timer data
    aiResponseTimers.delete(phone);

    // Generate AI response with full context
    try {
      const aiResponse = await generateAIResponse(agent, combinedMessage, phone);
      
      if (aiResponse) {
        console.log(`[AI] Response generated for ${phone}`);
        
        await sendAIResponse(phone, aiResponse, instanceId, user, agent, req);
        
        // Log the interaction with combined message
        logAIInteraction(agent.id, phone, combinedMessage, aiResponse, user.username);
      }
    } catch (error) {
      console.error(`[AI] Error generating response:`, error);
    }
    
  } catch (error) {
    console.error(`[AI] Error in processDelayedAIResponse:`, error);
    
    // Clean up timer data on error
    if (aiResponseTimers.has(phone)) {
      aiResponseTimers.delete(phone);
    }
  }
}


// Function to send AI response via WhatsApp API
async function sendAIResponse(phone, message, instanceId, user, agent = null, req = null) {
  try {
    console.log(`[AI-SEND] Request object: ${req ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    
    const delay = 2000; // 2 second delay to make it feel more natural
    
    // Get Socket.IO instance to avoid scope issues
    const io = req ? req.app.get('io') : null;
    console.log(`[AI-SEND] Socket.IO instance: ${io ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    
    // Use setTimeout with promise to avoid scope issues
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
    
    try {
        // Get user's WhatsApp API settings
        const accessToken = user.settings?.access_token;
        const instanceId = user.settings?.instance_id;
        
        if (!accessToken || !instanceId) {
          console.error(`[AI] Missing API credentials for user: ${user.username}`);
          return;
        }
        
        // Prepare wa.robomate.in API request
        const qs = require('querystring');
        const whatsappPayload = {
          number: phone,
          type: 'text',
          message: message,
          instance_id: instanceId,
          access_token: accessToken
        };
        
        // Send via wa.robomate.in API
        const axios = require('axios');
        const response = await axios.post(
          'https://wa.robomate.in/api/send',
          qs.stringify(whatsappPayload),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000 // 30 second timeout
          }
        );
        
        // Check for error status in response
        if (response.data && response.data.status === 'error') {
          console.error(`[AI] API error:`, response.data);
          throw new Error(`API error: ${response.data.message || 'Unknown error'}`);
        }
        
        if (response.data && !(response.data.status === 'success' || response.data.success === true)) {
          console.warn(`[AI] Unexpected API response:`, response.data);
        }
        
        // Store AI response in chat history
        try {
          const savedMessage = chatService.addMessage({
            phone: phone,
            text: message,
            type: 'ai',
            username: user.username,
            timestamp: new Date().toISOString(),
            agentId: agent ? agent.id : null
          });
          
          // Emit real-time AI message to user-specific chat room
          if (io) {
            const roomName = `chat-${user.username}-${phone}`;
            io.to(roomName).emit('new-message', savedMessage);
            console.log(`🤖 Emitted AI message to ${roomName}:`, savedMessage.text.substring(0, 50) + '...');
            
            // Also emit unread count update for AI messages
            const chatService = require('../services/chat.service');
            const unreadCount = chatService.getUnreadCount(phone, user.username);
            io.to(roomName).emit('unread-count-update', { phone, unreadCount });
            
            // Emit total unread count update for real-time sidebar updates
            const totalUnreadCount = chatService.getTotalUnreadCount(user.username);
            io.to(roomName).emit('total-unread-update', { totalUnreadCount });
          }
        } catch (error) {
          console.error(`[AI] Error storing AI response in chat history for ${phone}:`, error);
        }
        
    } catch (error) {
      console.error(`[AI] Error sending WhatsApp message:`, error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error(`[AI] Error in sendAIResponse:`, error);
  }
}

// Function to log AI interactions
function logAIInteraction(agentId, phone, userMessage, aiResponse, username) {
  try {
    const interactionLog = {
      id: 'ai_' + Date.now(),
      agent_id: agentId,
      username: username,
      phone: normalizePhoneNumber(phone),
      user_message: userMessage,
      ai_response: aiResponse,
      timestamp: moment().toISOString()
    };
    
    // Read existing interactions
    const interactionsPath = getDataFilePath('ai-interactions.json');
    let interactions = [];
    
    if (fs.existsSync(interactionsPath)) {
      const data = fs.readFileSync(interactionsPath, 'utf8');
      interactions = JSON.parse(data);
    }
    
    // Add new interaction
    interactions.push(interactionLog);
    
    // Keep only last 1000 interactions to prevent file from growing too large
    if (interactions.length > 1000) {
      interactions = interactions.slice(-1000);
    }
    
    // Write back to file
    fs.writeFileSync(interactionsPath, JSON.stringify(interactions, null, 2));
    
  } catch (error) {
    console.error(`[AI] Error logging interaction:`, error);
  }
}

// Cleanup function for AI response timers (useful for server shutdown)
function cleanupAITimers() {
  for (const [phone, timerData] of aiResponseTimers.entries()) {
    if (timerData.timeout) {
      clearTimeout(timerData.timeout);
      console.log(`[AI] Cleared timer for ${phone}`);
    }
  }
  
  aiResponseTimers.clear();
  console.log(`[AI] All timers cleared`);
}

// Debug endpoint to check AI timer status
router.get("/ai-timers-status", (req, res) => {
  try {
    const status = {
      delayDuration: AI_RESPONSE_DELAY,
      activeTimers: aiResponseTimers.size,
      timers: []
    };

    for (const [phone, timerData] of aiResponseTimers.entries()) {
      status.timers.push({
        phone: phone,
        messageCount: timerData.messages.length,
        agent: timerData.agent.name,
        user: timerData.user.username,
        hasTimeout: !!timerData.timeout
      });
    }

    res.json(status);
  } catch (error) {
    console.error(`[AI] Error getting timer status:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Export cleanup function for use in server shutdown
module.exports = router;
module.exports.cleanupAITimers = cleanupAITimers;
