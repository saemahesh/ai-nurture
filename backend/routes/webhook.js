const express = require("express");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const router = express.Router();

// Import the CampaignExecutor singleton
const CampaignExecutor = require("../campaign-executor");
const campaignExecutor = CampaignExecutor.getInstance();

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

// Webhook endpoint for auto-enrollment
router.post("/enroll", (req, res) => {
  const { instance_id, data } = req.body;

  if (!instance_id || !data || !data.message || !data.message.body_message) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const { content } = data.message.body_message;
  const fromContact = data.message.from_contact;
  const pushName = data.message.push_name;

  if (!content || !fromContact) {
    return res
      .status(400)
      .json({ error: "Missing message content or contact information" });
  }

  const keyword = content.trim().toLowerCase();
  const phone = normalizePhoneNumber(fromContact);

  // 1. Find the user by instance_id
  const users = readUsers();
  const user = users.find((u) => u.settings.instance_id === instance_id);

  if (!user) {
    return res
      .status(404)
      .json({ error: "User with the given instance_id not found" });
  }

  // 2. Find a sequence with the matching keyword for that user
  const sequences = readSequences();
  const targetSequence = sequences.find(
    (s) =>
      s.username === user.username &&
      s.status === "active" &&
      s.keywords &&
      s.keywords.includes(keyword)
  );

  if (!targetSequence) {
    return res
      .status(404)
      .json({ error: `No active sequence found for keyword: ${keyword}` });
  }

  // 3. Check if the user is already enrolled
  const enrollments = readEnrollments();
  const existingEnrollment = enrollments.find(
    (e) =>
      e.phone === phone &&
      e.sequence_id === targetSequence.id &&
      ["active", "paused"].includes(e.status)
  );

  if (existingEnrollment) {
    return res
      .status(200)
      .json({ message: "User already enrolled in this sequence" });
  }

  // 4. Enroll the user
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

  // 5. Schedule messages using the CampaignExecutor
  campaignExecutor.processEnrollment(newEnrollment);

  res
    .status(200)
    .json({
      success: true,
      message: "Successfully enrolled in sequence: " + targetSequence.name,
    });
});

// Webhook to handle WhatsApp messages (for STOP functionality)
router.post("/whatsapp", (req, res) => {
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

module.exports = router;
