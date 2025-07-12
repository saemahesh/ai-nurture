const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const sequencesFile = path.join(__dirname, '../data/sequences.json');
const enrollmentsFile = path.join(__dirname, '../data/enrollments.json');

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
    
    // Add stats to each sequence
    const sequencesWithStats = userSequences.map(sequence => ({
      ...sequence,
      stats: getSequenceStats(sequence.id, req.session.user.username)
    }));
    
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
    
    // Add stats to the sequence
    const sequenceWithStats = {
      ...sequence,
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
      keywords: req.body.keywords ? req.body.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : [],
      total_days: Math.max(...messages.map(m => m.day)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    if (req.body.keywords !== undefined) {
      sequences[sequenceIndex].keywords = req.body.keywords ? req.body.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : [];
    }
    
    sequences[sequenceIndex].updated_at = new Date().toISOString();
    
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    sequences[sequenceIndex].updated_at = new Date().toISOString();
    
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
