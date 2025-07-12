const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const router = express.Router();

const campaignLeadsFile = path.join(__dirname, '../data/campaign_leads.json');
const campaignQueueFile = path.join(__dirname, '../data/campaign_queue.json');

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

// Helper function to read campaign leads
function readCampaignLeads() {
  try {
    const data = fs.readFileSync(campaignLeadsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to write campaign leads
function writeCampaignLeads(leads) {
  fs.writeFileSync(campaignLeadsFile, JSON.stringify(leads, null, 2));
}

// Helper function to read campaign queue
function readCampaignQueue() {
  try {
    const data = fs.readFileSync(campaignQueueFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to find next message for a lead
function findNextMessage(campaignId, phone) {
  const queue = readCampaignQueue();
  const pendingMessages = queue.filter(item => 
    item.campaignId === campaignId && 
    item.phone === phone && 
    item.status === 'pending'
  );
  
  if (pendingMessages.length === 0) {
    return null;
  }
  
  // Sort by scheduled time and return the earliest
  pendingMessages.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const nextMessage = pendingMessages[0];
  
  return {
    day: nextMessage.message.day,
    message: nextMessage.message.message,
    scheduledAt: nextMessage.scheduledAt,
    type: nextMessage.message.type
  };
}

// Helper function to validate phone number
function validatePhoneNumber(phone) {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Check if it's a valid length (10-15 digits)
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// Helper function to normalize phone number
function normalizePhoneNumber(phone) {
  // Remove all non-digit characters and ensure it starts with country code
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with a country code, assume it's an Indian number
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
}

// Helper function to detect duplicates
function findDuplicates(leads, newLead) {
  const normalizedPhone = normalizePhoneNumber(newLead.phone);
  return leads.filter(lead => 
    normalizePhoneNumber(lead.phone) === normalizedPhone ||
    (lead.email && newLead.email && lead.email.toLowerCase() === newLead.email.toLowerCase())
  );
}

// Get all leads for a campaign
router.get('/:campaignId', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const campaignLeads = leads.filter(lead => lead.campaignId === req.params.campaignId);
    
    // Add next message information to each lead
    const leadsWithNextMessage = campaignLeads.map(lead => {
      const nextMessage = findNextMessage(lead.campaignId, lead.phone);
      return {
        ...lead,
        nextMessage
      };
    });
    
    res.json(leadsWithNextMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaign leads' });
  }
});

// Add a single lead to a campaign
router.post('/:campaignId/add', (req, res) => {
  try {
    const { phone, name, email, customFields } = req.body;
    
    if (!phone || !validatePhoneNumber(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    
    const leads = readCampaignLeads();
    const newLead = {
      id: Date.now().toString(),
      campaignId: req.params.campaignId,
      phone: normalizePhoneNumber(phone),
      name: name || '',
      email: email || '',
      customFields: customFields || {},
      status: 'pending',
      addedAt: new Date().toISOString(),
      lastMessageSent: null,
      currentStep: 0,
      totalSteps: 0,
      isOptedOut: false
    };
    
    // Check for duplicates
    const duplicates = findDuplicates(leads, newLead);
    if (duplicates.length > 0) {
      return res.status(400).json({ 
        error: 'Duplicate lead found',
        duplicates: duplicates.map(d => ({ id: d.id, phone: d.phone, name: d.name }))
      });
    }
    
    leads.push(newLead);
    writeCampaignLeads(leads);
    
    res.json({ success: true, lead: newLead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add lead' });
  }
});

// Import leads from CSV
router.post('/:campaignId/import', upload.single('csvFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }
    
    const leads = readCampaignLeads();
    const newLeads = [];
    const errors = [];
    const duplicates = [];
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        const phone = row.phone || row.Phone || row.mobile || row.Mobile;
        const name = row.name || row.Name || row.fullName || row.FullName || '';
        const email = row.email || row.Email || '';
        
        if (!phone) {
          errors.push({ row, error: 'Phone number missing' });
          return;
        }
        
        if (!validatePhoneNumber(phone)) {
          errors.push({ row, error: 'Invalid phone number format' });
          return;
        }
        
        const newLead = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          campaignId: req.params.campaignId,
          phone: normalizePhoneNumber(phone),
          name: name,
          email: email,
          customFields: {},
          status: 'pending',
          addedAt: new Date().toISOString(),
          lastMessageSent: null,
          currentStep: 0,
          totalSteps: 0,
          isOptedOut: false
        };
        
        // Add any additional fields as custom fields
        Object.keys(row).forEach(key => {
          if (!['phone', 'Phone', 'mobile', 'Mobile', 'name', 'Name', 'fullName', 'FullName', 'email', 'Email'].includes(key)) {
            newLead.customFields[key] = row[key];
          }
        });
        
        // Check for duplicates
        const existingDuplicates = findDuplicates(leads, newLead);
        const newDuplicates = findDuplicates(newLeads, newLead);
        
        if (existingDuplicates.length > 0 || newDuplicates.length > 0) {
          duplicates.push({ lead: newLead, reason: 'Duplicate phone number or email' });
        } else {
          newLeads.push(newLead);
        }
      })
      .on('end', () => {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        if (newLeads.length > 0) {
          leads.push(...newLeads);
          writeCampaignLeads(leads);
        }
        
        res.json({
          success: true,
          imported: newLeads.length,
          errors: errors.length,
          duplicates: duplicates.length,
          details: {
            newLeads: newLeads.map(l => ({ id: l.id, phone: l.phone, name: l.name })),
            errors,
            duplicates
          }
        });
      })
      .on('error', (error) => {
        // Clean up uploaded file on error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process CSV file' });
      });
      
  } catch (error) {
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// Export leads to CSV
router.get('/:campaignId/export', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const campaignLeads = leads.filter(lead => lead.campaignId === req.params.campaignId);
    
    if (campaignLeads.length === 0) {
      return res.status(404).json({ error: 'No leads found for this campaign' });
    }
    
    const csvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '../temp/campaign_leads_export.csv'),
      header: [
        { id: 'phone', title: 'Phone' },
        { id: 'name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'status', title: 'Status' },
        { id: 'currentStep', title: 'Current Step' },
        { id: 'addedAt', title: 'Added At' },
        { id: 'lastMessageSent', title: 'Last Message Sent' },
        { id: 'isOptedOut', title: 'Opted Out' }
      ]
    });
    
    csvWriter.writeRecords(campaignLeads)
      .then(() => {
        res.download(path.join(__dirname, '../temp/campaign_leads_export.csv'), 'campaign_leads.csv', (err) => {
          if (err) {
            console.error('Download error:', err);
          }
          // Clean up the temporary file
          fs.unlinkSync(path.join(__dirname, '../temp/campaign_leads_export.csv'));
        });
      })
      .catch(error => {
        res.status(500).json({ error: 'Failed to export leads' });
      });
      
  } catch (error) {
    res.status(500).json({ error: 'Failed to export leads' });
  }
});

// Update lead status
router.put('/:campaignId/leads/:leadId', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const leadIndex = leads.findIndex(lead => 
      lead.id === req.params.leadId && lead.campaignId === req.params.campaignId
    );
    
    if (leadIndex === -1) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const { status, currentStep, isOptedOut, lastMessageSent } = req.body;
    
    if (status) leads[leadIndex].status = status;
    if (currentStep !== undefined) leads[leadIndex].currentStep = currentStep;
    if (isOptedOut !== undefined) leads[leadIndex].isOptedOut = isOptedOut;
    if (lastMessageSent) leads[leadIndex].lastMessageSent = lastMessageSent;
    
    leads[leadIndex].updatedAt = new Date().toISOString();
    
    writeCampaignLeads(leads);
    res.json({ success: true, lead: leads[leadIndex] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete a lead
router.delete('/:campaignId/leads/:leadId', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const leadIndex = leads.findIndex(lead => 
      lead.id === req.params.leadId && lead.campaignId === req.params.campaignId
    );
    
    if (leadIndex === -1) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    leads.splice(leadIndex, 1);
    writeCampaignLeads(leads);

    // Also remove all campaign_queue.json entries for this lead
    const campaignQueueFile = path.join(__dirname, '../data/campaign_queue.json');
    let queue = [];
    try {
      queue = JSON.parse(fs.readFileSync(campaignQueueFile, 'utf8'));
    } catch (e) {}
    const lead = leads[leadIndex]; // leadIndex is now out of bounds, so get from req.params
    const filteredQueue = queue.filter(q => !(q.campaignId === req.params.campaignId && q.phone === req.body.phone));
    fs.writeFileSync(campaignQueueFile, JSON.stringify(filteredQueue, null, 2));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Add a new endpoint to delete a lead globally from campaign_leads.json
router.delete('/global-campaign-leads/:leadId', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const leadIndex = leads.findIndex(lead => lead.id === req.params.leadId);
    if (leadIndex === -1) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    leads.splice(leadIndex, 1);
    writeCampaignLeads(leads);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lead globally' });
  }
});

// Get campaign lead statistics
router.get('/:campaignId/stats', (req, res) => {
  try {
    const leads = readCampaignLeads();
    const campaignLeads = leads.filter(lead => lead.campaignId === req.params.campaignId);
    
    const stats = {
      total: campaignLeads.length,
      pending: campaignLeads.filter(l => l.status === 'pending').length,
      active: campaignLeads.filter(l => l.status === 'active').length,
      completed: campaignLeads.filter(l => l.status === 'completed').length,
      failed: campaignLeads.filter(l => l.status === 'failed').length,
      optedOut: campaignLeads.filter(l => l.isOptedOut).length
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get campaign stats' });
  }
});

module.exports = router;
