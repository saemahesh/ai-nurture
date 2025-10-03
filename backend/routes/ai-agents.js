const express = require('express');
const router = express.Router();
const fs = require('fs');
const moment = require('moment');
const { getDataFilePath } = require('../data-utils');
const { requireAuth } = require('../middleware/auth');

// Read AI agents from file
function readAgents() {
  try {
    const agentsPath = getDataFilePath('ai-agents.json');
    if (!fs.existsSync(agentsPath)) {
      return [];
    }
    const data = fs.readFileSync(agentsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading AI agents:', error);
    return [];
  }
}

// Write AI agents to file
function writeAgents(agents) {
  try {
    const agentsPath = getDataFilePath('ai-agents.json');
    fs.writeFileSync(agentsPath, JSON.stringify(agents, null, 2));
  } catch (error) {
    console.error('Error writing AI agents:', error);
    throw error;
  }
}

// Validate agent data
function validateAgent(agentData) {
  const errors = [];
  
  if (!agentData.name || agentData.name.trim() === '') {
    errors.push('Agent name is required');
  }
  
  if (!agentData.knowledgeBases || !Array.isArray(agentData.knowledgeBases)) {
    errors.push('Knowledge bases must be an array');
  } else {
    agentData.knowledgeBases.forEach((kb, index) => {
      if (!kb.name || kb.name.trim() === '') {
        errors.push(`Knowledge base ${index + 1} name is required`);
      }
      if (!kb.content || kb.content.trim() === '') {
        errors.push(`Knowledge base ${index + 1} content is required`);
      }
    });
  }
  
  return errors;
}

// Get all AI agents for user
router.get('/', requireAuth, (req, res) => {
  try {
    const agents = readAgents();
    
    // Filter by user
    const userAgents = agents.filter(agent => agent.username === req.session.user.username);
    
    res.json(userAgents);
  } catch (error) {
    console.error('Error fetching AI agents:', error);
    res.status(500).json({ error: 'Failed to fetch AI agents' });
  }
});

// Get single AI agent
router.get('/:id', requireAuth, (req, res) => {
  try {
    const agents = readAgents();
    const agent = agents.find(a => a.id === req.params.id && a.username === req.session.user.username);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or you do not have permission to access it' });
    }
    
    res.json(agent);
  } catch (error) {
    console.error('Error fetching AI agent:', error);
    res.status(500).json({ error: 'Failed to fetch AI agent' });
  }
});

// Create new AI agent
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, description, status, model, temperature, systemPrompt, knowledgeBases, autoRespond, responseDelay, triggerKeywords, ignoreKeywords, ignoredNumbers } = req.body;
    
    // Validate required fields
    const validationErrors = validateAgent(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors[0] });
    }
    
    const agents = readAgents();
    const newAgent = {
      id: 'agent_' + Date.now(),
      name: name.trim(),
      description: description ? description.trim() : '',
      status: status || 'inactive',
      model: model || 'gpt-4o-mini',
      temperature: temperature || 0.7,
      systemPrompt: systemPrompt || 'You are a helpful assistant that provides accurate and helpful responses based on the provided knowledge base. Always be polite and professional.',
      knowledgeBases: knowledgeBases || [],
      autoRespond: autoRespond !== false, // Default to true
      responseDelay: responseDelay || 2,
      triggerKeywords: Array.isArray(triggerKeywords) ? triggerKeywords : [],
      ignoreKeywords: Array.isArray(ignoreKeywords) ? ignoreKeywords : [],
      ignoredNumbers: Array.isArray(ignoredNumbers) ? ignoredNumbers : [],
      username: req.session.user.username,
      created_at: moment().toISOString(),
      updated_at: moment().toISOString()
    };
    
    agents.push(newAgent);
    writeAgents(agents);
    
    res.json(newAgent);
  } catch (error) {
    console.error('Error creating AI agent:', error);
    res.status(500).json({ error: 'Failed to create AI agent' });
  }
});

// Update AI agent
router.put('/:id', requireAuth, (req, res) => {
  try {
    const agents = readAgents();
    const agentIndex = agents.findIndex(a => a.id === req.params.id && a.username === req.session.user.username);
    
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found or you do not have permission to update it' });
    }
    
    const { name, description, status, model, temperature, systemPrompt, knowledgeBases, autoRespond, responseDelay, triggerKeywords, ignoreKeywords, ignoredNumbers } = req.body;
    
    // If full update, validate
    if (name !== undefined || knowledgeBases !== undefined) {
      const validationErrors = validateAgent(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ error: validationErrors[0] });
      }
    }
    
    // Update fields
    if (name) agents[agentIndex].name = name.trim();
    if (description !== undefined) agents[agentIndex].description = description.trim();
    if (status) agents[agentIndex].status = status;
    if (model) agents[agentIndex].model = model;
    if (temperature !== undefined) agents[agentIndex].temperature = temperature;
    if (systemPrompt !== undefined) agents[agentIndex].systemPrompt = systemPrompt;
    if (knowledgeBases !== undefined) agents[agentIndex].knowledgeBases = knowledgeBases;
    if (autoRespond !== undefined) agents[agentIndex].autoRespond = autoRespond;
    if (responseDelay !== undefined) agents[agentIndex].responseDelay = responseDelay;
    if (triggerKeywords !== undefined) agents[agentIndex].triggerKeywords = Array.isArray(triggerKeywords) ? triggerKeywords : [];
    if (ignoreKeywords !== undefined) agents[agentIndex].ignoreKeywords = Array.isArray(ignoreKeywords) ? ignoreKeywords : [];
    if (ignoredNumbers !== undefined) agents[agentIndex].ignoredNumbers = Array.isArray(ignoredNumbers) ? ignoredNumbers : [];
    
    agents[agentIndex].updated_at = moment().toISOString();
    
    writeAgents(agents);
    
    res.json(agents[agentIndex]);
  } catch (error) {
    console.error('Error updating AI agent:', error);
    res.status(500).json({ error: 'Failed to update AI agent' });
  }
});

// Delete AI agent
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const agents = readAgents();
    const agentIndex = agents.findIndex(a => a.id === req.params.id && a.username === req.session.user.username);
    
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found or you do not have permission to delete it' });
    }
    
    agents.splice(agentIndex, 1);
    writeAgents(agents);
    
    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI agent:', error);
    res.status(500).json({ error: 'Failed to delete AI agent' });
  }
});

// Test AI agent
router.post('/:id/test', requireAuth, async (req, res) => {
  try {
    const agents = readAgents();
    const agent = agents.find(a => a.id === req.params.id && a.username === req.session.user.username);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or you do not have permission to access it' });
    }
    
    const { message, conversationHistory, phone } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Test message is required' });
    }
    
    // Import AI service
    const { generateAIResponse } = require('../services/ai.service');
    
    // Generate response using AI service with conversation history
    // If phone is provided, it will use real chat history, otherwise use test conversation history
    let response;
    if (phone) {
      response = await generateAIResponse(agent, message, phone);
    } else {
      // For test mode, we'll create a temporary test phone number to store conversation history
      const testPhoneId = `test_${agent.id}_${req.session.user.username}`;
      
      // Store the test conversation history temporarily in chat service
      if (conversationHistory && conversationHistory.length > 0) {
        const chatService = require('../services/chat.service');
        // Clear any existing test conversation
        await chatService.clearTestConversation(testPhoneId);
        // Add the conversation history
        for (const msg of conversationHistory) {
          await chatService.addMessage({
            phone: testPhoneId,
            text: msg.text,
            type: msg.type,
            timestamp: msg.timestamp || new Date().toISOString(),
            username: req.session.user.username
          });
        }
      }
      
      response = await generateAIResponse(agent, message, testPhoneId);
    }
    
    res.json({ response });
  } catch (error) {
    console.error('Error testing AI agent:', error.message);
    res.status(500).json({ error: 'Failed to test AI agent: ' + error.message });
  }
});

// Toggle AI for a specific contact (adds/removes from ignored numbers list across all agents)
router.post('/toggle-contact-ai', requireAuth, (req, res) => {
  try {
    const { phone, enabled } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const agents = readAgents();
    const userAgents = agents.filter(a => a.username === req.session.user.username);
    
    let updatedCount = 0;
    
    userAgents.forEach((agent, index) => {
      const agentIndex = agents.findIndex(a => a.id === agent.id);
      
      if (!agents[agentIndex].ignoredNumbers) {
        agents[agentIndex].ignoredNumbers = [];
      }
      
      const phoneIndex = agents[agentIndex].ignoredNumbers.indexOf(phone);
      
      if (enabled) {
        // Enable AI - remove from ignored list if present
        if (phoneIndex > -1) {
          agents[agentIndex].ignoredNumbers.splice(phoneIndex, 1);
          updatedCount++;
        }
      } else {
        // Disable AI - add to ignored list if not present
        if (phoneIndex === -1) {
          agents[agentIndex].ignoredNumbers.push(phone);
          updatedCount++;
        }
      }
      
      agents[agentIndex].updated_at = moment().toISOString();
    });
    
    if (updatedCount > 0) {
      writeAgents(agents);
    }
    
    res.json({ 
      success: true, 
      message: `AI ${enabled ? 'enabled' : 'disabled'} for contact ${phone}`,
      agentsUpdated: updatedCount,
      enabled: enabled
    });
  } catch (error) {
    console.error('Error toggling AI for contact:', error);
    res.status(500).json({ error: 'Failed to toggle AI for contact' });
  }
});

// Check if AI is enabled for a specific contact
router.get('/check-contact-ai/:phone', requireAuth, (req, res) => {
  try {
    const phone = req.params.phone;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const agents = readAgents();
    const userAgents = agents.filter(a => 
      a.username === req.session.user.username && 
      a.status === 'active'
    );
    
    // Check if any active agent has this number in ignored list
    const isIgnored = userAgents.some(agent => 
      agent.ignoredNumbers && agent.ignoredNumbers.includes(phone)
    );
    
    res.json({ 
      phone: phone,
      aiEnabled: !isIgnored,
      agentsCount: userAgents.length
    });
  } catch (error) {
    console.error('Error checking AI status for contact:', error);
    res.status(500).json({ error: 'Failed to check AI status for contact' });
  }
});

module.exports = router;
