const axios = require('axios');

/**
 * Generate AI response using OpenRouter API with Grok-4 model
 * @param {Object} agent - The AI agent configuration
 * @param {string} userMessage - The user's message
 * @returns {Promise<string>} - The AI's response
 */
async function generateAIResponse(agent, userMessage) {
  try {
    // Build the context from active knowledge bases only
    let context = '';
    if (agent.knowledgeBases && agent.knowledgeBases.length > 0) {
      const activeKBs = agent.knowledgeBases.filter(kb => kb.active !== false);
      if (activeKBs.length > 0) {
        context = 'Knowledge Base:\n\n';
        activeKBs.forEach((kb, index) => {
          context += `${index + 1}. ${kb.name}:\n${kb.content}\n\n`;
        });
        context += '---\n\n';
      }
    }
    
    // Prepare the system prompt with context
    const systemPrompt = `${agent.systemPrompt}\n\n${context}Based on the above knowledge base, please answer the following question. If the information is not available in the knowledge base, politely let the user know and provide general helpful information if possible.`;
    
    // Prepare messages for the API call
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ];
    
    // Use OpenRouter API with Grok-4 model
    return await callOpenRouterAPI(messages);
    
  } catch (error) {
    throw new Error('Failed to generate AI response: ' + error.message);
  }
}

/**
 * Call OpenRouter API with Grok-4 free model
 * @param {Array} messages - The conversation messages
 * @returns {Promise<string>} - The AI's response
 */
async function callOpenRouterAPI(messages) {
  try {
    // Hardcoded OpenRouter API key as requested
    const apiKey = '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';
    // console.log('Calling OpenRouter API with messages:', JSON.stringify(messages, null, 2));
    
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'x-ai/grok-4-fast:free',
      messages: messages,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('OpenRouter API response:', response.data);
    
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response from OpenRouter API: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    console.error('OpenRouter API Status:', error.response?.status);
    
    // If it's a rate limit or server error, provide a more helpful message
    if (error.response?.status === 503) {
      throw new Error('OpenRouter API is currently unavailable (503). Please try again later.');
    } else if (error.response?.status === 429) {
      throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
    } else if (error.response?.status === 401) {
      throw new Error('OpenRouter API authentication failed. Please check your API key.');
    } else {
      throw new Error('OpenRouter API request failed: ' + (error.response?.data?.error?.message || error.message));
    }
  }
}

/**
 * Check if a message should trigger an AI response based on agent settings
 * @param {Object} agent - The AI agent configuration
 * @param {string} message - The incoming message
 * @returns {boolean} - Whether to respond
 */
function shouldRespond(agent, message) {
  // Check if auto-respond is enabled
  if (!agent.autoRespond) {
    return false;
  }
  
  // Check if agent is active
  if (agent.status !== 'active') {
    return false;
  }
  
  const messageLower = message.toLowerCase();
  
  // Check ignore keywords first - if found, don't respond
  if (agent.ignoreKeywords && agent.ignoreKeywords.length > 0) {
    const hasIgnoreKeyword = agent.ignoreKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    
    if (hasIgnoreKeyword) {
      return false;
    }
  }
  
  // Check trigger keywords
  if (agent.triggerKeywords && agent.triggerKeywords.length > 0) {
    const hasKeyword = agent.triggerKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    
    if (!hasKeyword) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all active AI agents for a user
 * @param {string} username - The username
 * @returns {Array} - Array of active agents
 */
function getActiveAgents(username) {
  try {
    const fs = require('fs');
    const { getDataFilePath } = require('../data-utils');
    
    const agentsPath = getDataFilePath('ai-agents.json');
    if (!fs.existsSync(agentsPath)) {
      return [];
    }
    
    const data = fs.readFileSync(agentsPath, 'utf8');
    const agents = JSON.parse(data);
    
    return agents.filter(agent => 
      agent.username === username && 
      agent.status === 'active' && 
      agent.autoRespond
    );
  } catch (error) {
    console.error('Error getting active agents:', error);
    return [];
  }
}

module.exports = {
  generateAIResponse,
  shouldRespond,
  getActiveAgents
};
