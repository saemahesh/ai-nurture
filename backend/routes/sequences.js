const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { requireAuth } = require('../middleware/auth');
const { getDataFilePath } = require('../data-utils');
const router = express.Router();

const sequencesFile = getDataFilePath('sequences.json');
const enrollmentsFile = getDataFilePath('enrollments.json');

// Helper function to read sequences
function readSequences() {
  try {
    const data = fs.readFileSync(sequencesFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to write sequences
function writeSequences(sequences) {
  fs.writeFileSync(sequencesFile, JSON.stringify(sequences, null, 2));
}

// Helper function to read enrollments
function readEnrollments() {
  try {
    const data = fs.readFileSync(enrollmentsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to get sequence stats
function getSequenceStats(sequenceId, username) {
  const enrollments = readEnrollments();
  const sequenceEnrollments = enrollments.filter(e => 
    e.sequence_id === sequenceId && e.username === username
  );
  
  return {
    total_enrolled: sequenceEnrollments.length,
    active: sequenceEnrollments.filter(e => e.status === 'active').length,
    completed: sequenceEnrollments.filter(e => e.status === 'completed').length,
    paused: sequenceEnrollments.filter(e => e.status === 'paused').length,
    opted_out: sequenceEnrollments.filter(e => e.status === 'opted_out').length
  };
}

// Helper function to validate message structure
function validateMessage(message) {
  if (!message.day || !message.type) {
    return false;
  }
  
  if (!['text', 'media'].includes(message.type)) {
    return false;
  }
  
  if (message.type === 'text' && (!message.message || message.message.trim() === '')) {
    return false;
  }
  
  if (message.type === 'media') {
    // Check if media is provided (file, URL, or selected)
    if (!message.mediaUrl && !message.mediaFile && !message.selectedMedia) {
      return false;
    }
    // Check if message is provided (required for media)
    if (!message.message || message.message.trim() === '') {
      return false;
    }
  }
  
  return true;
}

// Get all sequences
router.get('/', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    
    // Filter by user
    const userSequences = sequences.filter(s => s.username === req.session.user.username);
    
    // Add stats to each sequence and clean up old fields
    const sequencesWithStats = userSequences.map(sequence => {
      const cleanedSequence = { ...sequence };
      // Remove old fields for backward compatibility
      if (cleanedSequence.keywords) {
        delete cleanedSequence.keywords;
      }
      if (cleanedSequence.keywordMatchType) {
        delete cleanedSequence.keywordMatchType;
      }
      
      return {
        ...cleanedSequence,
        stats: getSequenceStats(sequence.id, req.session.user.username)
      };
    });
    
    res.json(sequencesWithStats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// Get single sequence
router.get('/:id', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    const sequence = sequences.find(s => s.id === req.params.id && s.username === req.session.user.username);
    
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to access it' });
    }
    
    // Clean up old fields for backward compatibility
    const cleanedSequence = { ...sequence };
    if (cleanedSequence.keywords) {
      delete cleanedSequence.keywords;
    }
    if (cleanedSequence.keywordMatchType) {
      delete cleanedSequence.keywordMatchType;
    }
    
    // Add stats to the sequence
    const sequenceWithStats = {
      ...cleanedSequence,
      stats: getSequenceStats(sequence.id, req.session.user.username)
    };
    
    res.json(sequenceWithStats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sequence' });
  }
});

// Create new sequence
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, description, messages } = req.body;
    
    if (!name || !messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Name and messages are required' });
    }
    
    // Validate keywords - at least one keyword field must be provided
    const hasExactKeywords = req.body.exactKeywords && 
      (Array.isArray(req.body.exactKeywords) ? req.body.exactKeywords.length > 0 : req.body.exactKeywords.trim() !== '');
    const hasContainsKeywords = req.body.containsKeywords && 
      (Array.isArray(req.body.containsKeywords) ? req.body.containsKeywords.length > 0 : req.body.containsKeywords.trim() !== '');
    
    if (!hasExactKeywords && !hasContainsKeywords) {
      return res.status(400).json({ error: 'At least one keyword field (exact match or contains) is required for auto-enrollment' });
    }
    
    // Validate messages
    for (const message of messages) {
      if (!validateMessage(message)) {
        return res.status(400).json({ 
          error: `Invalid message structure. Message on day ${message.day}: ${message.type === 'text' ? 'message is required' : 'media and message are required'}.` 
        });
      }
    }
    
    // Sort messages by day
    messages.sort((a, b) => a.day - b.day);
    
    const sequences = readSequences();
    const newSequence = {
      id: 'seq_' + Date.now(),
      name: name.trim(),
      description: description ? description.trim() : '',
      status: req.body.status || 'inactive', // Use status from request or default to inactive
      username: req.session.user.username,
      messages: messages,
      exactKeywords: Array.isArray(req.body.exactKeywords) 
        ? req.body.exactKeywords.map(k => k.trim().toLowerCase()).filter(k => k) 
        : (req.body.exactKeywords ? req.body.exactKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : []),
      containsKeywords: Array.isArray(req.body.containsKeywords) 
        ? req.body.containsKeywords.map(k => k.trim().toLowerCase()).filter(k => k) 
        : (req.body.containsKeywords ? req.body.containsKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : []),
      total_days: Math.max(...messages.map(m => m.day)),
      created_at: moment().toISOString(),
      updated_at: moment().toISOString()
    };
    
    sequences.push(newSequence);
    writeSequences(sequences);
    
    res.json({
      ...newSequence,
      stats: getSequenceStats(newSequence.id, req.session.user.username)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

// Update sequence
router.put('/:id', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    const sequenceIndex = sequences.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
    
    if (sequenceIndex === -1) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to update it' });
    }
    
    const { name, description, messages, status } = req.body;
    
    if (messages && Array.isArray(messages)) {
      // Validate messages
      for (const message of messages) {
        if (!validateMessage(message)) {
          return res.status(400).json({ 
            error: `Invalid message structure. Message on day ${message.day}: ${message.type === 'text' ? 'message is required' : 'media and message are required'}.` 
          });
        }
      }
      
      // Sort messages by day
      messages.sort((a, b) => a.day - b.day);
      sequences[sequenceIndex].messages = messages;
      sequences[sequenceIndex].total_days = Math.max(...messages.map(m => m.day));
    }
    
    if (name) sequences[sequenceIndex].name = name.trim();
    if (description !== undefined) sequences[sequenceIndex].description = description.trim();
    if (status) sequences[sequenceIndex].status = status;
    if (req.body.exactKeywords !== undefined) {
      sequences[sequenceIndex].exactKeywords = Array.isArray(req.body.exactKeywords) 
        ? req.body.exactKeywords.map(k => k.trim().toLowerCase()).filter(k => k) 
        : (req.body.exactKeywords ? req.body.exactKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : []);
    }
    if (req.body.containsKeywords !== undefined) {
      sequences[sequenceIndex].containsKeywords = Array.isArray(req.body.containsKeywords) 
        ? req.body.containsKeywords.map(k => k.trim().toLowerCase()).filter(k => k) 
        : (req.body.containsKeywords ? req.body.containsKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : []);
    }
    
    // Remove old keywords field if it exists (cleanup for backward compatibility)
    if (sequences[sequenceIndex].keywords) {
      delete sequences[sequenceIndex].keywords;
    }
    // Also remove keywordMatchType as it's no longer needed
    if (sequences[sequenceIndex].keywordMatchType) {
      delete sequences[sequenceIndex].keywordMatchType;
    }
    
    // Validate that at least one keyword field has content after update
    const updatedSequence = sequences[sequenceIndex];
    const hasExactKeywords = updatedSequence.exactKeywords && updatedSequence.exactKeywords.length > 0;
    const hasContainsKeywords = updatedSequence.containsKeywords && updatedSequence.containsKeywords.length > 0;
    
    if (!hasExactKeywords && !hasContainsKeywords) {
      return res.status(400).json({ error: 'At least one keyword field (exact match or contains) is required for auto-enrollment' });
    }
    
    sequences[sequenceIndex].updated_at = moment().toISOString();
    
    writeSequences(sequences);
    
    res.json({
      ...sequences[sequenceIndex],
      stats: getSequenceStats(sequences[sequenceIndex].id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sequence' });
  }
});

// Delete sequence
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    const sequenceIndex = sequences.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
    
    if (sequenceIndex === -1) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to delete it' });
    }
    
    // Check if sequence has active enrollments
    const enrollments = readEnrollments();
    const activeEnrollments = enrollments.filter(e => 
      e.sequence_id === req.params.id && 
      e.username === req.session.user.username &&
      ['active', 'paused'].includes(e.status)
    );
    
    if (activeEnrollments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete sequence with active enrollments. Please complete or stop all enrollments first.' 
      });
    }
    
    sequences.splice(sequenceIndex, 1);
    writeSequences(sequences);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sequence' });
  }
});

// Duplicate sequence
router.post('/:id/duplicate', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    const originalSequence = sequences.find(s => s.id === req.params.id && s.username === req.session.user.username);
    
    if (!originalSequence) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to duplicate it' });
    }
    
    const duplicatedSequence = {
      ...originalSequence,
      id: 'seq_' + Date.now(),
      name: originalSequence.name + ' (Copy)',
      created_at: moment().toISOString(),
      updated_at: moment().toISOString()
    };
    
    sequences.push(duplicatedSequence);
    writeSequences(sequences);
    
    res.json({
      ...duplicatedSequence,
      stats: getSequenceStats(duplicatedSequence.id, req.session.user.username)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate sequence' });
  }
});

// Toggle sequence status
router.patch('/:id/toggle', requireAuth, (req, res) => {
  try {
    const sequences = readSequences();
    const sequenceIndex = sequences.findIndex(s => s.id === req.params.id && s.username === req.session.user.username);
    
    if (sequenceIndex === -1) {
      return res.status(404).json({ error: 'Sequence not found or you do not have permission to toggle it' });
    }
    
    const currentStatus = sequences[sequenceIndex].status;
    sequences[sequenceIndex].status = currentStatus === 'active' ? 'paused' : 'active';
    sequences[sequenceIndex].updated_at = moment().toISOString();
    
    writeSequences(sequences);
    
    res.json({
      ...sequences[sequenceIndex],
      stats: getSequenceStats(sequences[sequenceIndex].id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle sequence status' });
  }
});

module.exports = router;
