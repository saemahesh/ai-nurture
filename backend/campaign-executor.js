const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const qs = require('querystring');

class CampaignExecutor {
  constructor() {
    // Prevent multiple instances
    if (CampaignExecutor.instance) {
      console.log('⚠️  [CAMPAIGN_EXECUTOR] Returning existing instance');
      return CampaignExecutor.instance;
    }
    
    console.log('🆕 [CAMPAIGN_EXECUTOR] Creating new instance');
    
    this.dataDir = path.join(__dirname, 'data');
    this.queueFile = path.join(this.dataDir, 'campaign_queue.json');
    this.campaignsFile = path.join(this.dataDir, 'campaigns.json');
    this.enrollmentsFile = path.join(this.dataDir, 'enrollments.json');
    this.campaignLeadsFile = path.join(this.dataDir, 'campaign_leads.json');
    this.sequencesFile = path.join(this.dataDir, 'sequences.json');
    this.messageQueueFile = path.join(this.dataDir, 'message_queue.json');
    
    this.isProcessing = false;
    this.activeUsers = new Set();
    this.rateLimits = new Map(); // Track last send time per user
    
    // Initialize data files if they don't exist
    this.initializeDataFiles();
    
    // Initialize queue processor
    this.startQueueProcessor();
    
    // Store the instance
    CampaignExecutor.instance = this;
  }
  
  // Static method to get singleton instance
  static getInstance() {
    if (!CampaignExecutor.instance) {
      new CampaignExecutor();
    }
    return CampaignExecutor.instance;
  }

  // Initialize data files
  initializeDataFiles() {
    const files = [
      { path: this.queueFile, defaultData: [] },
      { path: this.campaignsFile, defaultData: [] },
      { path: this.enrollmentsFile, defaultData: [] },
      { path: this.campaignLeadsFile, defaultData: [] },
      { path: this.sequencesFile, defaultData: [] },
      { path: this.messageQueueFile, defaultData: [] }
    ];
    
    files.forEach(file => {
      if (!fs.existsSync(file.path)) {
        try {
          fs.writeFileSync(file.path, JSON.stringify(file.defaultData, null, 2));
          console.log(`Created ${file.path}`);
        } catch (error) {
          console.error(`Error creating ${file.path}:`, error);
        }
      }
    });
  }

  // Load data files
  loadData(filename) {
    try {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return [];
    }
  }

  // Save data files
  saveData(filename, data) {
    try {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      return false;
    }
  }

  // Check if current time is within allowed hours (6 AM - 9 PM)
  isWithinWorkingHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 6 && hour <= 21;
  }

  // Check rate limit for user (minimum 40 seconds between messages)
  canSendMessage(username) {
    const lastSend = this.rateLimits.get(username);
    if (!lastSend) return true;
    
    const minDelay = 40000; // 40 seconds minimum
    const maxDelay = 100000; // 100 seconds maximum
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    return Date.now() - lastSend >= randomDelay;
  }

  // Update rate limit for user
  updateRateLimit(username) {
    this.rateLimits.set(username, Date.now());
  }

  // Process new enrollment (automatically queue messages)
  processEnrollment(enrollmentData) {
    console.log(`🎯 [CAMPAIGN_EXECUTOR] Starting to process enrollment`);
    console.log(`📋 [CAMPAIGN_EXECUTOR] Enrollment data:`, enrollmentData);
    
    try {
      const { campaignId, sequence_id, username, phone, enrolledAt } = enrollmentData;
      const actualCampaignId = campaignId || sequence_id; // Support both field names
      
      console.log(`🔍 [CAMPAIGN_EXECUTOR] Extracted campaign ID: ${actualCampaignId}`);
      console.log(`👤 [CAMPAIGN_EXECUTOR] Username: ${username}`);
      console.log(`📞 [CAMPAIGN_EXECUTOR] Phone: ${phone}`);
      
      if (!actualCampaignId || !username || !phone) {
        const error = 'Missing required enrollment data';
        console.error(`❌ [CAMPAIGN_EXECUTOR] ${error}`);
        throw new Error(error);
      }
      
      // Get campaign sequence
      console.log(`🔍 [CAMPAIGN_EXECUTOR] Loading sequences from: ${this.sequencesFile}`);
      const sequences = this.loadData(this.sequencesFile);
      console.log(`📋 [CAMPAIGN_EXECUTOR] Found ${sequences.length} sequences`);
      
      const sequence = sequences.find(s => 
        (s.campaignId === actualCampaignId || s.id === actualCampaignId) && 
        s.username === username
      );
      
      if (!sequence) {
        const error = `No sequence found for campaign ${actualCampaignId}, user ${username}`;
        console.error(`❌ [CAMPAIGN_EXECUTOR] ${error}`);
        console.log(`🔍 [CAMPAIGN_EXECUTOR] Available sequences:`, sequences.map(s => ({id: s.id, campaignId: s.campaignId, username: s.username})));
        return { success: false, error: 'Campaign sequence not found' };
      }
      
      if (!sequence.messages) {
        const error = `Sequence ${actualCampaignId} has no messages`;
        console.error(`❌ [CAMPAIGN_EXECUTOR] ${error}`);
        return { success: false, error: 'Campaign sequence has no messages' };
      }
      
      console.log(`✅ [CAMPAIGN_EXECUTOR] Found sequence with ${sequence.messages.length} messages`);
      console.log(`📋 [CAMPAIGN_EXECUTOR] Sequence messages:`, sequence.messages);

      // Create lead data if it doesn't exist
      console.log(`🔍 [CAMPAIGN_EXECUTOR] Loading campaign leads from: ${this.campaignLeadsFile}`);
      let campaignLeads = this.loadData(this.campaignLeadsFile);
      console.log(`📋 [CAMPAIGN_EXECUTOR] Found ${campaignLeads.length} existing leads`);
      
      let lead = campaignLeads.find(l => l.phone === phone && l.username === username);
      if (!lead) {
        console.log(`🆕 [CAMPAIGN_EXECUTOR] Creating new lead for ${phone}`);
        // Use name from enrollmentData if available
        lead = {
          id: `lead-${Date.now()}`,
          campaignId: actualCampaignId,
          username: username,
          phone: phone,
          name: enrollmentData.name || '',
          createdAt: new Date().toISOString()
        };
        campaignLeads.push(lead);
        console.log(`💾 [CAMPAIGN_EXECUTOR] Saving new lead:`, lead);
        this.saveData(this.campaignLeadsFile, campaignLeads);
      } else {
        console.log(`✅ [CAMPAIGN_EXECUTOR] Found existing lead:`, lead);
      }

      // Generate queue entries for this enrollment
      console.log(`🔄 [CAMPAIGN_EXECUTOR] Generating queue entries for lead ${lead.id}`);
      this.generateQueueEntriesForLead(actualCampaignId, username, lead, sequence, enrolledAt);

      console.log(`✅ [CAMPAIGN_EXECUTOR] Enrollment processed successfully`);
      return { success: true, message: 'Enrollment processed successfully' };
    } catch (error) {
      console.error(`💥 [CAMPAIGN_EXECUTOR] Error processing enrollment:`, error);
      return { success: false, error: error.message };
    }
  }

  // Pause a campaign
  pauseCampaign(campaignId, username) {
    try {
      const campaigns = this.loadData(this.campaignsFile);
      const campaign = campaigns.find(c => c.id === campaignId && c.username === username);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      campaign.status = 'paused';
      campaign.pausedAt = new Date().toISOString();
      this.saveData(this.campaignsFile, campaigns);

      // Remove pending queue entries for this campaign
      const queue = this.loadData(this.queueFile);
      const filteredQueue = queue.filter(q => 
        !(q.campaignId === campaignId && q.username === username && q.status === 'pending')
      );
      this.saveData(this.queueFile, filteredQueue);

      return { success: true, message: 'Campaign paused successfully' };
    } catch (error) {
      console.error('Error pausing campaign:', error);
      return { success: false, error: error.message };
    }
  }

  // Resume a campaign
  resumeCampaign(campaignId, username) {
    try {
      const campaigns = this.loadData(this.campaignsFile);
      const campaign = campaigns.find(c => c.id === campaignId && c.username === username);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      campaign.status = 'active';
      campaign.resumedAt = new Date().toISOString();
      this.saveData(this.campaignsFile, campaigns);

      // Regenerate queue entries for remaining messages
      this.generateQueueEntries(campaignId, username);

      return { success: true, message: 'Campaign resumed successfully' };
    } catch (error) {
      console.error('Error resuming campaign:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate queue entries for a specific lead enrollment
  generateQueueEntriesForLead(campaignId, username, lead, sequence, enrolledAt) {
    console.log(`📋 [QUEUE_GENERATOR] Starting queue generation for lead ${lead.id}`);
    console.log(`🎯 [QUEUE_GENERATOR] Campaign: ${campaignId}`);
    console.log(`👤 [QUEUE_GENERATOR] Username: ${username}`);
    console.log(`📞 [QUEUE_GENERATOR] Phone: ${lead.phone}`);
    console.log(`📅 [QUEUE_GENERATOR] Enrolled at: ${enrolledAt}`);
    
    try {
      console.log(`🔍 [QUEUE_GENERATOR] Loading existing queue from: ${this.queueFile}`);
      const queue = this.loadData(this.queueFile);
      console.log(`📋 [QUEUE_GENERATOR] Current queue size: ${queue.length}`);
      
      const baseTime = new Date(enrolledAt);
      console.log(`⏰ [QUEUE_GENERATOR] Base time: ${baseTime.toISOString()}`);
      
      let addedCount = 0;
      
      // Generate queue entries for each message in sequence
      console.log(`🔄 [QUEUE_GENERATOR] Processing ${sequence.messages.length} messages`);
      sequence.messages.forEach((message, index) => {
        console.log(`📝 [QUEUE_GENERATOR] Processing message ${index + 1}/${sequence.messages.length}`);
        console.log(`📋 [QUEUE_GENERATOR] Message content:`, message);
        
        // Calculate send time based on message.day (existing system) or message.delay (new system)
        let sendTime;
        if (message.day) {
          console.log(`📅 [QUEUE_GENERATOR] Using day-based scheduling (day ${message.day})`);
          // Existing system: messages are scheduled by day
          sendTime = new Date(baseTime.getTime() + (message.day - 1) * 24 * 60 * 60 * 1000);
          // Add random time between 6 AM and 9 PM
          const randomHours = Math.floor(Math.random() * 15); // 0-14 hours (6 AM to 9 PM)
          const randomMinutes = Math.floor(Math.random() * 60);
          sendTime.setHours(6 + randomHours, randomMinutes, 0, 0);
        } else {
          console.log(`⏱️ [QUEUE_GENERATOR] Using delay-based scheduling (${message.delay || 0} minutes)`);
          // New system: messages are scheduled by delay in minutes
          sendTime = new Date(baseTime.getTime() + (message.delay || 0) * 60000);
        }
        // FIX: If sendTime is in the past, set to now for immediate sending
        const now = new Date();
        if (sendTime < now) {
          console.log(`⚡ [QUEUE_GENERATOR] Scheduled time (${sendTime.toISOString()}) is in the past. Setting to now.`);
          sendTime = new Date(now.getTime() + 2000); // 2 seconds in the future to avoid race
        }
        console.log(`📅 [QUEUE_GENERATOR] Scheduled time: ${sendTime.toISOString()}`);
        
        // Check if this message hasn't been queued yet
        const existingEntry = queue.find(q => 
          q.campaignId === campaignId && 
          q.username === username &&
          q.phone === lead.phone &&
          q.messageIndex === index
        );

        // Normalize message structure for both old and new systems
        const normalizedMessage = {
          id: message.id || `msg-${index}`,
          type: message.type || 'text',
          message: message.message || message.content || '',
          mediaUrl: message.mediaUrl || message.media_url || null,
          day: message.day || Math.floor((message.delay || 0) / (24 * 60)) + 1
        };

        if (!existingEntry) {
          console.log(`🆕 [QUEUE_GENERATOR] Adding new queue entry for message ${index}`);
          // LOGGING: Validate when a new person/message is added to the queue (for campaign executor path)
          console.log(`🟢 [QUEUE] Adding new message to queue for enrollment_id: ${lead.id || lead.enrollment_id || 'unknown'}, phone: ${lead.phone}, sequence_id: ${campaignId}, day: ${normalizedMessage.day}, scheduled_for: ${sendTime.toISOString()}`);
          
          const queueEntry = {
            id: `${campaignId}-${lead.phone}-${index}-${Date.now()}`,
            campaignId,
            username,
            phone: lead.phone,
            leadData: lead,
            messageIndex: index,
            message: normalizedMessage,
            scheduledAt: sendTime.toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0
          };
          
          console.log(`📋 [QUEUE_GENERATOR] Queue entry:`, queueEntry);
          queue.push(queueEntry);
          addedCount++;
        } else {
          console.log(`⚠️ [QUEUE_GENERATOR] Message ${index} already queued, skipping`);
        }
      });

      // Sort queue by scheduled time
      queue.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
      
      console.log(`💾 [QUEUE_GENERATOR] Saving updated queue (${queue.length} total entries)`);
      this.saveData(this.queueFile, queue);
      
      console.log(`✅ [QUEUE_GENERATOR] Generated ${addedCount} queue entries for lead ${lead.phone}`);
    } catch (error) {
      console.error(`💥 [QUEUE_GENERATOR] Error generating queue entries for lead:`, error);
    }
  }

  // Process message queue
  async processQueue() {
    if (this.isProcessing) {
      console.log(`⏳ [QUEUE] Already processing (${this.constructor.name}), skipping this cycle`);
      return;
    }
    
    this.isProcessing = true;
    const processingId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 [QUEUE] Starting queue processing cycle ${processingId} at ${new Date().toISOString()}`);

    try {
      // Check if we're within working hours
      if (!this.isWithinWorkingHours()) {
        console.log(`🌙 [QUEUE] Outside working hours (6 AM - 9 PM), skipping queue processing`);
        return;
      }

      const queue = this.loadData(this.queueFile);
      const now = new Date();
      
      console.log(`📋 [QUEUE] ${processingId} - Total queue size: ${queue.length}`);

      // Get pending messages that are due (exclude those being processed)
      const dueMessages = queue.filter(q => 
        q.status === 'pending' && 
        new Date(q.scheduledAt) <= now
      );
      
      console.log(`📅 [QUEUE] ${processingId} - Due messages: ${dueMessages.length}`);

      if (dueMessages.length === 0) {
        console.log(`✅ [QUEUE] ${processingId} - No messages due for sending`);
        return;
      }

      // Group by username for rate limiting
      const messagesByUser = {};
      dueMessages.forEach(msg => {
        if (!messagesByUser[msg.username]) {
          messagesByUser[msg.username] = [];
        }
        messagesByUser[msg.username].push(msg);
      });

      console.log(`👥 [QUEUE] ${processingId} - Users with due messages: ${Object.keys(messagesByUser).length}`);

      // Process messages for each user (respecting rate limits)
      for (const [username, messages] of Object.entries(messagesByUser)) {
        console.log(`🔍 [QUEUE] ${processingId} - Checking rate limit for user ${username}`);
        
        if (this.canSendMessage(username)) {
          const message = messages[0]; // Process one message per user per cycle
          console.log(`📤 [QUEUE] ${processingId} - Processing message for user ${username}, phone ${message.phone}`);
          
          // Mark message as being processed to prevent duplicate processing
          message.status = 'processing';
          message.processingId = processingId;
          this.saveData(this.queueFile, queue);
          
          await this.sendMessage(message, queue);
          this.updateRateLimit(username);
          
          console.log(`⏱️  [QUEUE] ${processingId} - Rate limit updated for user ${username}`);
        } else {
          console.log(`🚫 [QUEUE] ${processingId} - Rate limit active for user ${username}, skipping`);
        }
      }

      // Save updated queue
      this.saveData(this.queueFile, queue);
      console.log(`💾 [QUEUE] ${processingId} - Queue saved successfully`);
      
    } catch (error) {
      console.error(`💥 [QUEUE] ${processingId} - Error processing queue:`, error);
    } finally {
      this.isProcessing = false;
      console.log(`🏁 [QUEUE] ${processingId} - Queue processing cycle completed`);
    }
  }

  // Send a message
  async sendMessage(queueEntry, queue) {
    try {
      console.log(`🚀 [CAMPAIGN] Starting to send message to ${queueEntry.phone} for campaign ${queueEntry.campaignId}`);
      
      // Check if message is already being processed or sent
      if (queueEntry.status === 'sent') {
        console.log(`⚠️  [CAMPAIGN] Message already sent to ${queueEntry.phone}, skipping`);
        return;
      }
      
      if (queueEntry.status === 'processing' && queueEntry.processingId !== queueEntry.processingId) {
        console.log(`⚠️  [CAMPAIGN] Message already being processed by another instance for ${queueEntry.phone}, skipping`);
        return;
      }
      
      // Personalize message
      const personalizedMessage = this.personalizeMessage(queueEntry.message, queueEntry.leadData);
      console.log(`📝 [CAMPAIGN] Personalized message:`, personalizedMessage);
      
      // Send via actual WhatsApp API
      const apiResult = await this.sendWhatsAppMessage(queueEntry.phone, personalizedMessage, queueEntry.username);
      
      if (apiResult.success) {
        queueEntry.status = 'sent';
        queueEntry.sentAt = new Date().toISOString();
        queueEntry.apiResponse = apiResult.data;
        
        console.log(`✅ [CAMPAIGN] Message successfully sent to ${queueEntry.phone}`);
        
        // Save the queue immediately to ensure updateEnrollmentStatus sees the updated status
        this.saveData(this.queueFile, queue);
        
        // Log to message queue for tracking
        this.logMessageSent(queueEntry);
        
        // Update enrollment status if all messages are sent
        this.updateEnrollmentStatus(queueEntry.campaignId, queueEntry.username, queueEntry.phone);
      } else {
        queueEntry.status = 'failed';
        queueEntry.attempts += 1;
        queueEntry.lastAttemptAt = new Date().toISOString();
        queueEntry.apiError = apiResult.error;
        
        console.error(`❌ [CAMPAIGN] Failed to send message to ${queueEntry.phone}:`, apiResult.error);
        
        // Retry logic: retry up to 3 times with exponential backoff
        if (queueEntry.attempts < 3) {
          const retryDelay = Math.pow(2, queueEntry.attempts) * 60000; // 2, 4, 8 minutes
          queueEntry.scheduledAt = new Date(Date.now() + retryDelay).toISOString();
          queueEntry.status = 'pending';
          console.log(`🔄 [CAMPAIGN] Scheduling retry ${queueEntry.attempts + 1}/3 for ${queueEntry.phone} in ${retryDelay/1000/60} minutes`);
        } else {
          console.error(`💀 [CAMPAIGN] Max retry attempts reached for ${queueEntry.phone}`);
        }
      }
      
      // Clear processing ID
      delete queueEntry.processingId;
      
    } catch (error) {
      console.error(`💥 [CAMPAIGN] Error sending message to ${queueEntry.phone}:`, error);
      queueEntry.status = 'failed';
      queueEntry.attempts += 1;
      queueEntry.error = error.message;
      queueEntry.lastAttemptAt = new Date().toISOString();
      delete queueEntry.processingId;
    }
  }

  // Spintax parser: replaces {a|b|c} with a random choice
  parseSpintax(text) {
    return text.replace(/\{([^{}]+)\}/g, (match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }

  // Personalize message with lead data
  personalizeMessage(message, leadData) {
    let personalizedMessage = message.message || '';
    // Only support {name} variable
    // Use only 'name' field, fallback to phone if missing
    const name = leadData.name && leadData.name.trim() ? leadData.name : leadData.phone;
    personalizedMessage = personalizedMessage.replace(/\{name\}/g, name);
    // Apply spintax
    personalizedMessage = this.parseSpintax(personalizedMessage);
    return {
      ...message,
      message: personalizedMessage
    };
  }

  // Send actual WhatsApp message via API
  async sendWhatsAppMessage(phone, message, username) {
    console.log(`� [WHATSAPP] Sending message to ${phone} for user ${username}`);
    // For debugging, show all message fields
    console.log(`📄 [WHATSAPP] Message content:`, JSON.stringify(message, null, 2));
    try {
      // Load user settings to get WhatsApp API credentials
      const usersFile = path.join(this.dataDir, 'users.json');
      const users = this.loadData(usersFile);
      const user = users.find(u => u.username === username);
      if (!user || !user.settings || !user.settings.instance_id || !user.settings.access_token) {
        console.error(`❌ [WHATSAPP] Missing API credentials for user ${username}`);
        return { success: false, error: 'Missing WhatsApp API credentials' };
      }
      console.log(`🔑 [WHATSAPP] Using instance ID: ${user.settings.instance_id}`);
      console.log(`🔑 [WHATSAPP] Using access token: ${user.settings.access_token.substring(0, 8)}...`);
      // Prepare API payload
      let payload;
      if (message.type === 'media' || message.mediaUrl) {
        // For media, treat the caption as the main message (caption = message)
        payload = {
          number: phone,
          type: 'media',
          message: message.message, // Use message.message as the caption
          media_url: message.mediaUrl,
          instance_id: user.settings.instance_id,
          access_token: user.settings.access_token
        };
      } else {
        payload = {
          number: phone,
          type: 'text',
          message: message.message, // Use message.message for text messages
          instance_id: user.settings.instance_id,
          access_token: user.settings.access_token
        };
      }
      const apiUrl = 'https://wa.robomate.in/api/send';
      console.log(`🌐 [WHATSAPP] API URL: ${apiUrl}`);
      console.log(`📤 [WHATSAPP] Payload:`, JSON.stringify(payload, null, 2));
      // Make API call
      const response = await axios.post(
        apiUrl,
        qs.stringify(payload),
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000 // 30 second timeout
        }
      );
      console.log(`📨 [WHATSAPP] API Response:`, response.data);
      // Check for error status in response
      if (response.data && response.data.status === 'error') {
        console.error(`❌ [WHATSAPP] Error response:`, response.data);
        return { success: false, error: response.data.message || 'API error' };
      }
      if (response.data && (response.data.status === 'success' || response.data.success === true)) {
        console.log(`✅ [WHATSAPP] Message sent successfully to ${phone}`);
        return { success: true, data: response.data };
      } else {
        console.error(`❌ [WHATSAPP] Unexpected response format:`, response.data);
        return { success: false, error: 'Unexpected response format' };
      }
    } catch (error) {
      console.error(`❌ [WHATSAPP] API call failed for ${phone}:`, {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response received'
      });
      return { 
        success: false, 
        error: error.response ? error.response.data : error.message,
        details: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText
        } : null
      };
    }
  }

  // Log sent message for tracking
  logMessageSent(queueEntry) {
    try {
      const messageQueue = this.loadData(this.messageQueueFile);
      
      messageQueue.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        campaignId: queueEntry.campaignId,
        username: queueEntry.username,
        phone: queueEntry.phone,
        message: queueEntry.message,
        sentAt: queueEntry.sentAt,
        status: 'sent',
        createdAt: new Date().toISOString()
      });
      
      this.saveData(this.messageQueueFile, messageQueue);
    } catch (error) {
      console.error('Error logging message:', error);
    }
  }

  // Start the queue processor (runs every 30 seconds)
  startQueueProcessor() {
    console.log(`🚀 [QUEUE] Starting campaign queue processor...`);
    console.log(`⏰ [QUEUE] Queue will be processed every 30 seconds`);
    console.log(`🕕 [QUEUE] Messages will only be sent between 6 AM - 9 PM`);
    
    // Run every 30 seconds
    cron.schedule('*/30 * * * * *', () => {
      this.processQueue();
    });
  }

  // Get campaign statistics
  getCampaignStats(campaignId, username) {
    try {
      const queue = this.loadData(this.queueFile);
      const messageQueue = this.loadData(this.messageQueueFile);
      
      const campaignQueue = queue.filter(q => 
        q.campaignId === campaignId && q.username === username
      );
      
      const campaignMessages = messageQueue.filter(m => 
        m.campaignId === campaignId && m.username === username
      );
      
      return {
        total: campaignQueue.length,
        pending: campaignQueue.filter(q => q.status === 'pending').length,
        sent: campaignQueue.filter(q => q.status === 'sent').length,
        failed: campaignQueue.filter(q => q.status === 'failed').length,
        messagesSent: campaignMessages.length
      };
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      return { total: 0, pending: 0, sent: 0, failed: 0, messagesSent: 0 };
    }
  }

  // Normalize phone numbers for matching (remove +, spaces, leading zeros)
  normalizePhone(phone) {
    return phone.replace(/[^\d]/g, '').replace(/^0+/, '');
  }

  // Update enrollment status when all messages are sent
  updateEnrollmentStatus(campaignId, username, phone) {
    try {
      const enrollments = this.loadData(this.enrollmentsFile);
      const normalizedPhone = this.normalizePhone(phone);
      
      const enrollment = enrollments.find(e => 
        this.normalizePhone(e.phone) === normalizedPhone && 
        e.username === username &&
        (
          e.sequence_id === campaignId ||
          e.campaignId === campaignId ||
          (campaignId && e.sequence_id && e.sequence_id === campaignId) ||
          (e.campaignId && campaignId && e.campaignId === campaignId)
        )
      );
      
      if (!enrollment) {
        console.log(`⚠️  [ENROLLMENT] No enrollment found for ${phone} in campaign ${campaignId}`);
        return;
      }
      
      // Count sent messages for this enrollment
      const queue = this.loadData(this.queueFile);
      const enrollmentQueue = queue.filter(q => 
        this.normalizePhone(q.phone) === normalizedPhone && 
        q.username === username &&
        (q.campaignId === campaignId || q.sequence_id === campaignId)
      );
      const sentMessages = enrollmentQueue.filter(q => q.status === 'sent').length;
      const totalMessages = enrollmentQueue.length;
      
      console.log(`📊 [ENROLLMENT] ${phone}: ${sentMessages}/${totalMessages} messages sent`);
      
      // Update enrollment with current progress
      enrollment.messages_sent = sentMessages;
      enrollment.current_day = sentMessages; // Update current_day to reflect sent messages
      
      // Find next pending message to set next_message_due
      const nextPendingMessage = enrollmentQueue.find(q => q.status === 'pending');
      if (nextPendingMessage) {
        enrollment.next_message_due = nextPendingMessage.scheduledAt;
      } else {
        enrollment.next_message_due = null;
      }
      
      // Check if all messages have been sent
      if (sentMessages >= totalMessages && totalMessages > 0) {
        enrollment.status = 'completed';
        enrollment.completed_at = new Date().toISOString();
        enrollment.next_message_due = null; // No next message for completed enrollments
        
        console.log(`✅ [ENROLLMENT] ${phone} marked as completed (${sentMessages}/${totalMessages} messages sent)`);
      } else {
        console.log(`🔄 [ENROLLMENT] ${phone} progress updated (${sentMessages}/${totalMessages} messages sent)${nextPendingMessage ? ', next message due: ' + nextPendingMessage.scheduledAt : ''}`);
      }
      
      this.saveData(this.enrollmentsFile, enrollments);
    } catch (error) {
      console.error('❌ [ENROLLMENT] Error updating enrollment status:', error);
    }
  }

  // Delete all queue and message logs for a lead in a sequence
  deleteLeadLogs(sequenceId, username, phone) {
    // Remove from campaign_queue.json
    const queue = this.loadData(this.queueFile);
    const filteredQueue = queue.filter(q => !(q.campaignId === sequenceId && q.username === username && q.phone === phone));
    this.saveData(this.queueFile, filteredQueue);
    // Remove from message_queue.json
    const messageQueue = this.loadData(this.messageQueueFile);
    const filteredMessageQueue = messageQueue.filter(m => !(m.campaignId === sequenceId && m.username === username && m.phone === phone));
    this.saveData(this.messageQueueFile, filteredMessageQueue);
    console.log(`[CLEANUP] Deleted all queue and message logs for ${phone} in sequence ${sequenceId}`);
  }
}

module.exports = CampaignExecutor;
