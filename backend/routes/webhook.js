const express = require("express");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const router = express.Router();

// Import the CampaignExecutor singleton
const CampaignExecutor = require("../campaign-executor");
const campaignExecutor = CampaignExecutor.getInstance();

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

const usersFile = path.join(__dirname, "../data/users.json");
const sequencesFile = path.join(__dirname, "../data/sequences.json");
const enrollmentsFile = path.join(__dirname, "../data/enrollments.json");
const messageQueueFile = path.join(__dirname, "../data/message_queue.json");

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

// Function to handle user enrollment in sequences
function handleEnrollment(phone, messageText, user, pushName) {
  console.log(`[WEBHOOK] Processing enrollment for ${phone} with keyword: "${messageText}"`);
  
  // Find matching sequence
  const sequences = readSequences();
  const targetSequence = sequences.find(
    (s) =>
      s.username === user.username &&
      s.status === "active" &&
      s.keywords &&
      s.keywords.some(keyword => keyword.toLowerCase() === messageText)
  );

  if (!targetSequence) {
    console.log(`[WEBHOOK] No matching sequence found for keyword: "${messageText}"`);
    return {
      success: true,
      action: "no_match",
      message: `No active sequence found for keyword: ${messageText}`,
      phone: phone
    };
  }

  console.log(`[WEBHOOK] Found matching sequence: ${targetSequence.name} for keyword: "${messageText}"`);

  // Check if user is already enrolled
  const enrollments = readEnrollments();
  const existingEnrollment = enrollments.find(
    (e) =>
      normalizePhoneNumber(e.phone) === phone &&
      e.sequence_id === targetSequence.id &&
      ["active", "paused"].includes(e.status)
  );

  if (existingEnrollment) {
    console.log(`[WEBHOOK] User ${phone} already enrolled in sequence ${targetSequence.name}`);
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
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const { content } = data.message.body_message;
  const fromContact = data.message.from_contact;
  const pushName = data.message.push_name;

  // Skip if from_contact is too long (invalid phone)
  if (!content || !fromContact) {
    return res
      .status(400)
      .json({ error: "Missing message content or contact information" });
  }
  if (fromContact.length > 15) {
    return res.status(400).json({ error: "from_contact is too long, skipping processing" });
  }

  const messageText = content.trim().toLowerCase();
  const phone = normalizePhoneNumber(fromContact);

  console.log(`[WEBHOOK] Processing message from ${phone}: "${content}"`);

  // 1. Find the user by instance_id
  const users = readUsers();
  const user = users.find((u) => u.settings && u.settings.instance_id === instance_id);

  if (!user) {
    console.log(`[WEBHOOK] No user found with instance_id: ${instance_id}`);
    return res
      .status(404)
      .json({ error: "User with the given instance_id not found" });
  }

  console.log(`[WEBHOOK] Found user: ${user.username} for instance_id: ${instance_id}`);

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
  
  const containsStopKeyword = stopKeywords.some((keyword) =>
    messageText.includes(keyword)
  );

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
  console.log("[WEBHOOK] Legacy /whatsapp endpoint called, redirecting to /enroll logic");
  
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
    const containsStopKeyword = stopKeywords.some((keyword) =>
      messageText.includes(keyword)
    );

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

module.exports = router;
