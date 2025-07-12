const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const router = express.Router();

// Import authentication middleware
const { requireAuth } = require('../middleware/auth');

// Import campaign executor (get singleton instance)
const CampaignExecutor = require('../campaign-executor');
const campaignExecutor = CampaignExecutor.getInstance();

const enrollmentsFile = path.join(__dirname, '../data/enrollments.json');
const sequencesFile = path.join(__dirname, '../data/sequences.json');
const messageQueueFile = path.join(__dirname, '../data/message_queue.json');
const campaignQueueFile = path.join(__dirname, '../data/campaign_queue.json');
const campaignLeadsFile = path.join(__dirname, '../data/campaign_leads.json');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

function readSequences() {
  try {
    const data = fs.readFileSync(sequencesFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
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

function readCampaignQueue() {
  try {
    const data = fs.readFileSync(campaignQueueFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeCampaignQueue(queue) {
  fs.writeFileSync(campaignQueueFile, JSON.stringify(queue, null, 2));
}

function readCampaignLeads() {
  try {
    const data = fs.readFileSync(campaignLeadsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeCampaignLeads(leads) {
  fs.writeFileSync(campaignLeadsFile, JSON.stringify(leads, null, 2));
}

// Helper function to validate and normalize phone number
function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with a country code, assume it's an Indian number
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
}

function validatePhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Helper function to check for duplicates
function findDuplicateEnrollment(enrollments, phone, sequenceId) {
  const normalizedPhone = normalizePhoneNumber(phone);
  return enrollments.find(e => 
    normalizePhoneNumber(e.phone) === normalizedPhone && 
    e.sequence_id === sequenceId &&
    ['active', 'paused'].includes(e.status)
  );
}

// Helper function to schedule messages for enrollment
function scheduleMessagesForEnrollment(enrollment, sequence) {
  console.log(`🎯 [ENROLLMENT] Starting to schedule messages for enrollment ${enrollment.id}`);
  console.log(`📞 [ENROLLMENT] Phone: ${enrollment.phone}`);
  console.log(`👤 [ENROLLMENT] User: ${enrollment.username}`);
  console.log(`📋 [ENROLLMENT] Sequence: ${enrollment.sequence_id}`);
  console.log(`📅 [ENROLLMENT] Enrolled at: ${enrollment.enrolled_at}`);
  
  try {
    // Convert enrollment data to campaign format
    const enrollmentData = {
      campaignId: enrollment.sequence_id,
      username: enrollment.username,
      phone: enrollment.phone,
      enrolledAt: enrollment.enrolled_at,
      name: enrollment.name // Pass name for personalization
    };
    
    console.log(`🔄 [ENROLLMENT] Calling campaign executor with data:`, enrollmentData);
    
    // Process enrollment using campaign executor
    const result = campaignExecutor.processEnrollment(enrollmentData);
    
    console.log(`📤 [ENROLLMENT] Campaign executor result:`, result);
    
    if (result.success) {
      console.log(`✅ [ENROLLMENT] Successfully processed enrollment for ${enrollment.phone}`);
    } else {
      console.error(`❌ [ENROLLMENT] Failed to process enrollment for ${enrollment.phone}:`, result.error);
      console.log(`🔄 [ENROLLMENT] Falling back to original scheduling method`);
      // Fallback to original method if needed
      scheduleMessagesForEnrollmentOriginal(enrollment, sequence);
    }
  } catch (error) {
    console.error(`💥 [ENROLLMENT] Error in scheduleMessagesForEnrollment:`, error);
    console.log(`🔄 [ENROLLMENT] Falling back to original scheduling method`);
    // Fallback to original method
    scheduleMessagesForEnrollmentOriginal(enrollment, sequence);
  }
  
  console.log(`🏁 [ENROLLMENT] Finished scheduling messages for enrollment ${enrollment.id}`);
}

// Original scheduling function as fallback
function scheduleMessagesForEnrollmentOriginal(enrollment, sequence) {
  const queue = readMessageQueue();
  const enrolledDate = new Date(enrollment.enrolled_at);

  sequence.messages.forEach(message => {
    const scheduledDate = new Date(enrolledDate);
    scheduledDate.setDate(scheduledDate.getDate() + (message.day - 1));

    // Set time to 6 AM + random offset up to 16 hours (until 10 PM)
    const randomHours = Math.floor(Math.random() * 16); // 0-15 hours
    const randomMinutes = Math.floor(Math.random() * 60); // 0-59 minutes
    scheduledDate.setHours(6 + randomHours, randomMinutes, 0, 0);

    // Strictly use only the correct field for each type
    let processedMessage = '';
    let mediaUrl = null;
    let type = message.type;
    if (type === 'text') {
      processedMessage = message.content || '';
      mediaUrl = null;
    } else if (type === 'media') {
      processedMessage = message.caption || '';
      mediaUrl = message.mediaUrl || null;
    }

    // Apply personalization
    if (enrollment.name && enrollment.name.trim()) {
      processedMessage = processedMessage.replace(/{name}/g, enrollment.name.trim());
    } else {
      processedMessage = processedMessage.replace(/Hi {name}/g, 'Hi there')
                                       .replace(/Hello {name}/g, 'Hello there')
                                       .replace(/Hey {name}/g, 'Hey there')
                                       .replace(/{name}/g, 'there');
    }

    // Only include the relevant fields in the queue message
    const queueMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      enrollment_id: enrollment.id,
      sequence_id: enrollment.sequence_id,
      username: enrollment.username,
      phone: enrollment.phone,
      message: type === 'text' ? processedMessage : '',
      caption: type === 'media' ? processedMessage : '',
      media_url: mediaUrl,
      type: type,
      day: message.day,
      scheduled_for: scheduledDate.toISOString(),
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString()
    };

    // LOG: Adding new message to queue for validation
    console.log(`[QUEUE] Adding new message to queue for enrollment_id: ${enrollment.id}, phone: ${enrollment.phone}, sequence_id: ${enrollment.sequence_id}, day: ${message.day}, scheduled_for: ${queueMessage.scheduled_for}`);

    queue.push(queueMessage);
  });

  writeMessageQueue(queue);
}

// Get enrollments (with optional sequence filter)
router.get('/', (req, res) => {
  try {
    const enrollments = readEnrollments();
    const { sequenceId } = req.query;
    
    // Filter by user
    const userEnrollments = enrollments.filter(e => e.username === req.session.user.username);
    
    if (sequenceId) {
      const sequenceEnrollments = userEnrollments.filter(e => e.sequence_id === sequenceId);
      res.json(sequenceEnrollments);
    } else {
      res.json(userEnrollments);
    }
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Get enrollments for a sequence (legacy route)
router.get('/:sequenceId', (req, res) => {
  try {
    const enrollments = readEnrollments();
    const sequenceEnrollments = enrollments.filter(e => 
      e.sequence_id === req.params.sequenceId && 
      e.username === req.session.user.username
    );
    
    res.json(sequenceEnrollments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Enroll single user
router.post('/:sequenceId/enroll', (req, res) => {
  console.log(`🎯 [ENROLL_API] New enrollment request received`);
  console.log(`📋 [ENROLL_API] Sequence ID: ${req.params.sequenceId}`);
  console.log(`👤 [ENROLL_API] User: ${req.session.user.username}`);
  console.log(`📞 [ENROLL_API] Request body:`, req.body);
  
  try {
    const { phone, name } = req.body;
    
    if (!phone || !validatePhoneNumber(phone)) {
      console.error(`❌ [ENROLL_API] Invalid phone number: ${phone}`);
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    
    console.log(`🔍 [ENROLL_API] Loading sequences...`);
    const sequences = readSequences();
    const sequence = sequences.find(s => s.id === req.params.sequenceId && s.username === req.session.user.username);
    
    if (!sequence) {
      console.error(`❌ [ENROLL_API] Sequence not found: ${req.params.sequenceId}`);
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to access it' });
    }
    
    console.log(`✅ [ENROLL_API] Found sequence: ${sequence.name || sequence.id}`);
    
    if (sequence.status !== 'active') {
      console.error(`❌ [ENROLL_API] Sequence is not active: ${sequence.status}`);
      return res.status(400).json({ error: 'Cannot enroll in inactive sequence' });
    }
    
    const enrollments = readEnrollments();
    const normalizedPhone = normalizePhoneNumber(phone);
    
    console.log(`🔍 [ENROLL_API] Checking for duplicate enrollment...`);
    // Check for duplicate enrollment
    const duplicate = findDuplicateEnrollment(enrollments, phone, req.params.sequenceId);
    if (duplicate) {
      console.error(`❌ [ENROLL_API] Duplicate enrollment found:`, duplicate);
      return res.status(400).json({ 
        error: 'User already enrolled in this sequence',
        existing_enrollment: duplicate
      });
    }
    
    console.log(`🆕 [ENROLL_API] Creating new enrollment...`);
    const newEnrollment = {
      id: 'enroll_' + Date.now(),
      sequence_id: req.params.sequenceId,
      username: req.session.user.username,
      phone: normalizedPhone,
      name: name ? name.trim() : '',
      enrolled_at: new Date().toISOString(),
      current_day: 0,
      status: 'active',
      last_message_sent: null,
      next_message_due: null,
      messages_sent: 0,
      total_messages: sequence.messages.length,
      custom_fields: {}
    };
    
    console.log(`📋 [ENROLL_API] New enrollment:`, newEnrollment);
    
    enrollments.push(newEnrollment);
    console.log(`💾 [ENROLL_API] Saving enrollment to database...`);
    writeEnrollments(enrollments);
    
    console.log(`🔄 [ENROLL_API] Scheduling messages for enrollment...`);
    // Schedule messages for this enrollment
    scheduleMessagesForEnrollment(newEnrollment, sequence);
    
    console.log(`✅ [ENROLL_API] Enrollment completed successfully`);
    res.json({ success: true, enrollment: newEnrollment });
  } catch (error) {
    console.error(`💥 [ENROLL_API] Error during enrollment:`, error);
    res.status(500).json({ error: 'Failed to enroll user' });
  }
});

// Bulk enrollment from form
router.post('/:sequenceId/enroll/bulk', (req, res) => {
  try {
    const { phones, bulk_text } = req.body;
    let phoneList = [];
    
    if (phones && Array.isArray(phones)) {
      phoneList = phones;
    } else if (bulk_text) {
      // Parse phone numbers from bulk text
      phoneList = bulk_text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Support formats: phone, phone:name, phone,name
          const parts = line.split(/[,:]/);
          return {
            phone: parts[0].trim(),
            name: parts[1] ? parts[1].trim() : ''
          };
        });
    }
    
    if (!phoneList || phoneList.length === 0) {
      return res.status(400).json({ error: 'No phone numbers provided' });
    }
    
    const sequences = readSequences();
    const sequence = sequences.find(s => s.id === req.params.sequenceId);
    
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }
    
    if (sequence.status !== 'active') {
      return res.status(400).json({ error: 'Cannot enroll in inactive sequence' });
    }
    
    const enrollments = readEnrollments();
    const results = {
      enrolled: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    phoneList.forEach(item => {
      const phone = typeof item === 'string' ? item : item.phone;
      const name = typeof item === 'object' ? item.name : '';
      
      if (!validatePhoneNumber(phone)) {
        results.errors++;
        results.details.push({ phone, error: 'Invalid phone number' });
        return;
      }
      
      // Check for duplicate
      const duplicate = findDuplicateEnrollment(enrollments, phone, req.params.sequenceId);
      if (duplicate) {
        results.skipped++;
        results.details.push({ phone, error: 'Already enrolled' });
        return;
      }
      
      const normalizedPhone = normalizePhoneNumber(phone);
      const newEnrollment = {
        id: 'enroll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        sequence_id: req.params.sequenceId,
        phone: normalizedPhone,
        name: name,
        enrolled_at: new Date().toISOString(),
        current_day: 0,
        status: 'active',
        last_message_sent: null,
        next_message_due: null,
        messages_sent: 0,
        total_messages: sequence.messages.length,
        custom_fields: {}
      };
      
      enrollments.push(newEnrollment);
      scheduleMessagesForEnrollment(newEnrollment, sequence);
      
      results.enrolled++;
      results.details.push({ phone, name, status: 'enrolled' });
    });
    
    writeEnrollments(enrollments);
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process bulk enrollment' });
  }
});

// Import from CSV
router.post('/:sequenceId/enroll/csv', upload.single('csvFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }
    
    const sequences = readSequences();
    const sequence = sequences.find(s => s.id === req.params.sequenceId && s.username === req.session.user.username);
    
    if (!sequence) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to access it' });
    }
    
    const enrollments = readEnrollments();
    const results = {
      enrolled: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        const phone = row.phone || row.Phone || row.mobile || row.Mobile;
        const name = row.name || row.Name || row.fullName || row.FullName || '';
        
        if (!phone) {
          results.errors++;
          results.details.push({ row, error: 'Phone number missing' });
          return;
        }
        
        if (!validatePhoneNumber(phone)) {
          results.errors++;
          results.details.push({ phone, error: 'Invalid phone number' });
          return;
        }
        
        // Check for duplicate
        const duplicate = findDuplicateEnrollment(enrollments, phone, req.params.sequenceId);
        if (duplicate) {
          results.skipped++;
          results.details.push({ phone, error: 'Already enrolled' });
          return;
        }
        
        const normalizedPhone = normalizePhoneNumber(phone);
        const newEnrollment = {
          id: 'enroll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          sequence_id: req.params.sequenceId,
          username: req.session.user.username,
          phone: normalizedPhone,
          name: name,
          enrolled_at: new Date().toISOString(),
          current_day: 0,
          status: 'active',
          last_message_sent: null,
          next_message_due: null,
          messages_sent: 0,
          total_messages: sequence.messages.length,
          custom_fields: {}
        };
        
        enrollments.push(newEnrollment);
        scheduleMessagesForEnrollment(newEnrollment, sequence);
        
        results.enrolled++;
        results.details.push({ phone, name, status: 'enrolled' });
      })
      .on('end', () => {
        fs.unlinkSync(req.file.path);
        writeEnrollments(enrollments);
        res.json(results);
      })
      .on('error', (error) => {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to process CSV file' });
      });
      
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Update enrollment status
router.put('/:enrollmentId', (req, res) => {
  try {
    const enrollments = readEnrollments();
    const enrollmentIndex = enrollments.findIndex(e => 
      e.id === req.params.enrollmentId && 
      e.username === req.session.user.username
    );
    
    if (enrollmentIndex === -1) {
      return res.status(404).json({ error: 'Enrollment not found or you do not have permission to update it' });
    }
    
    const { status } = req.body;
    
    if (status && ['active', 'paused', 'completed', 'opted_out', 'stopped'].includes(status)) {
      enrollments[enrollmentIndex].status = status;
      enrollments[enrollmentIndex].updated_at = new Date().toISOString();
      
      // If pausing, stopping, or opting out, update pending messages in queue
      if (['paused', 'opted_out', 'stopped'].includes(status)) {
        const queue = readMessageQueue();
        const updatedQueue = queue.map(msg => {
          if (msg.enrollment_id === req.params.enrollmentId && msg.status === 'pending') {
            return { ...msg, status: status === 'paused' ? 'paused' : 'cancelled' };
          }
          return msg;
        });
        writeMessageQueue(updatedQueue);
      }
    }
    
    writeEnrollments(enrollments);
    res.json({ success: true, enrollment: enrollments[enrollmentIndex] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update enrollment' });
  }
});

// Get enrollment stats
router.get('/:sequenceId/stats', (req, res) => {
  try {
    const enrollments = readEnrollments();
    const sequenceEnrollments = enrollments.filter(e => 
      e.sequence_id === req.params.sequenceId && 
      e.username === req.session.user.username
    );
    
    const stats = {
      total: sequenceEnrollments.length,
      active: sequenceEnrollments.filter(e => e.status === 'active').length,
      paused: sequenceEnrollments.filter(e => e.status === 'paused').length,
      completed: sequenceEnrollments.filter(e => e.status === 'completed').length,
      stopped: sequenceEnrollments.filter(e => e.status === 'stopped').length,
      opted_out: sequenceEnrollments.filter(e => e.status === 'opted_out').length
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get enrollment stats' });
  }
});

// Pause all enrollments for a sequence
router.post('/pause-sequence', (req, res) => {
  try {
    const { sequenceId } = req.body;
    
    if (!sequenceId) {
      return res.status(400).json({ error: 'Sequence ID is required' });
    }

    const enrollments = readEnrollments();
    let pausedCount = 0;

    // Find and pause all active enrollments for this sequence
    const updatedEnrollments = enrollments.map(enrollment => {
      if (enrollment.sequenceId === sequenceId && enrollment.status === 'active') {
        pausedCount++;
        return {
          ...enrollment,
          status: 'paused',
          pausedAt: new Date().toISOString()
        };
      }
      return enrollment;
    });

    writeEnrollments(updatedEnrollments);

    res.json({ 
      message: `Paused ${pausedCount} enrollments for sequence`,
      pausedCount 
    });
  } catch (error) {
    console.error('Error pausing sequence enrollments:', error);
    res.status(500).json({ error: 'Failed to pause sequence enrollments' });
  }
});

// Stop all enrollments for a sequence (bulk unenroll)
router.post('/stop-sequence', (req, res) => {
  try {
    const { sequenceId } = req.body;
    
    if (!sequenceId) {
      return res.status(400).json({ error: 'Sequence ID is required' });
    }

    const enrollments = readEnrollments();
    let stoppedCount = 0;

    // Find and stop all active/paused enrollments for this sequence (user-specific)
    const updatedEnrollments = enrollments.map(enrollment => {
      if (enrollment.sequence_id === sequenceId && 
          enrollment.username === req.session.user.username && 
          ['active', 'paused'].includes(enrollment.status)) {
        stoppedCount++;
        return {
          ...enrollment,
          status: 'stopped',
          stoppedAt: new Date().toISOString()
        };
      }
      return enrollment;
    });

    writeEnrollments(updatedEnrollments);

    // Update message queue to cancel pending messages (user-specific)
    const queue = readMessageQueue();
    const updatedQueue = queue.map(msg => {
      if (msg.sequence_id === sequenceId && 
          msg.username === req.session.user.username && 
          msg.status === 'pending') {
        return { ...msg, status: 'cancelled' };
      }
      return msg;
    });
    writeMessageQueue(updatedQueue);

    res.json({ 
      message: `Stopped ${stoppedCount} enrollments for sequence`,
      stoppedCount 
    });
  } catch (error) {
    console.error('Error stopping sequence enrollments:', error);
    res.status(500).json({ error: 'Failed to stop sequence enrollments' });
  }
});

// Resume all stopped enrollments for a sequence (bulk re-enroll)
router.post('/resume-sequence', (req, res) => {
  try {
    const { sequenceId } = req.body;
    
    if (!sequenceId) {
      return res.status(400).json({ error: 'Sequence ID is required' });
    }

    const sequences = readSequences();
    const sequence = sequences.find(s => s.id === sequenceId && s.username === req.session.user.username);
    
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to access it' });
    }

    if (sequence.status !== 'active') {
      return res.status(400).json({ error: 'Cannot resume enrollments for inactive sequence' });
    }

    const enrollments = readEnrollments();
    let resumedCount = 0;

    // Find and resume all stopped enrollments for this sequence (user-specific)
    const updatedEnrollments = enrollments.map(enrollment => {
      if (enrollment.sequence_id === sequenceId && 
          enrollment.username === req.session.user.username && 
          enrollment.status === 'stopped') {
        resumedCount++;
        return {
          ...enrollment,
          status: 'active',
          resumedAt: new Date().toISOString()
        };
      }
      return enrollment;
    });

    writeEnrollments(updatedEnrollments);

    // Re-schedule messages for resumed enrollments
    const resumedEnrollments = updatedEnrollments.filter(e => 
      e.sequence_id === sequenceId && 
      e.username === req.session.user.username && 
      e.status === 'active' && 
      e.resumedAt
    );
    
    resumedEnrollments.forEach(enrollment => {
      scheduleMessagesForEnrollment(enrollment, sequence);
    });

    res.json({ 
      message: `Resumed ${resumedCount} enrollments for sequence`,
      resumedCount 
    });
  } catch (error) {
    console.error('Error resuming sequence enrollments:', error);
    res.status(500).json({ error: 'Failed to resume sequence enrollments' });
  }
});

// Delete enrollment (individual)
router.delete('/:enrollmentId', (req, res) => {
  try {
    const enrollments = readEnrollments();
    const enrollmentIndex = enrollments.findIndex(e => 
      e.id === req.params.enrollmentId && 
      e.username === req.session.user.username
    );
    
    if (enrollmentIndex === -1) {
      return res.status(404).json({ error: 'Enrollment not found or you do not have permission to delete it' });
    }

    const enrollment = enrollments[enrollmentIndex];
    
    // Remove from enrollments
    enrollments.splice(enrollmentIndex, 1);
    writeEnrollments(enrollments);

    // Remove/cancel pending messages from message queue (historical log)
    const queue = readMessageQueue();
    const updatedQueue = queue.filter(msg => {
      // Remove if matches enrollment_id (legacy/original scheduler)
      if (msg.enrollment_id && msg.enrollment_id === enrollment.id) return false;
      // Remove if matches phone and (sequence_id or campaignId)
      if (
        msg.phone === enrollment.phone &&
        ((msg.sequence_id && msg.sequence_id === enrollment.sequence_id) ||
         (msg.campaignId && msg.campaignId === enrollment.sequence_id))
      ) return false;
      // Remove if matches phone and campaignId (for all messageIndex)
      if (
        msg.phone === enrollment.phone &&
        msg.campaignId &&
        msg.campaignId === enrollment.sequence_id
      ) return false;
      return true;
    });
    writeMessageQueue(updatedQueue);

    // Remove from campaign queue (active queue)
    const campaignQueue = readCampaignQueue();
    const updatedCampaignQueue = campaignQueue.filter(msg => {
      // Remove if matches phone and campaignId
      if (
        msg.phone === enrollment.phone &&
        msg.campaignId === enrollment.sequence_id
      ) return false;
      return true;
    });
    writeCampaignQueue(updatedCampaignQueue);

    // Remove from campaign leads
    const campaignLeads = readCampaignLeads();
    const updatedCampaignLeads = campaignLeads.filter(lead => {
      // Remove if matches phone and campaignId
      if (
        lead.phone === enrollment.phone &&
        lead.campaignId === enrollment.sequence_id
      ) return false;
      return true;
    });
    writeCampaignLeads(updatedCampaignLeads);

    res.json({ 
      message: 'Enrollment deleted successfully',
      deleted_enrollment: enrollment
    });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ error: 'Failed to delete enrollment' });
  }
});

module.exports = router;
