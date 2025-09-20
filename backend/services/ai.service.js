
const axios = require('axios');

/**
 * Generate AI response using OpenRouter API with free model
 * @param {Object} agent - The AI agent configuration
 * @param {string} userMessage - The user's message
 * @param {string} [phone] - Phone number for chat history context
 * @returns {Promise<string>} - The AI's response
 */
async function generateAIResponse(agent, userMessage, phone = null) {
  try {
    // Get recent chat history for context if phone is provided
    let chatHistory = '';
    if (phone) {
      try {
        const { getRecentMessagesForAI } = require('./chat.service');
        const recentMessages = getRecentMessagesForAI(phone, 20); // Last 20 messages
        
        if (recentMessages.length > 0) {
          chatHistory = 'Recent Chat History:\n\n';
          recentMessages.forEach((msg, index) => {
            const sender = msg.type === 'incoming' ? 'User' : (msg.type === 'ai' ? 'AI' : 'Support');
            chatHistory += `${sender}: ${msg.text}\n`;
          });
          chatHistory += '\n---\n\n';
        }
      } catch (error) {
        console.error('Error getting chat history for AI context:', error);
        // Continue without chat history if there's an error
      }
    }

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


    
    // Prepare the system prompt with context and WhatsApp formatting instructions
    const whatsappFormatting = `

IMPORTANT FORMATTING INSTRUCTIONS:
- Format your response like a WhatsApp message with proper line breaks
- Keep responses concise and easy to read on mobile
- Use bullet points (•) for lists instead of numbers when appropriate
- Add empty lines between different topics or sections
- If the response is long, break it into digestible chunks
- Use emojis sparingly and only when appropriate
- Make it conversational and friendly like WhatsApp chat and use emojis if relevant`;
    
    const systemPrompt = `${agent.systemPrompt}${whatsappFormatting}\n\n${chatHistory}${context}Based on the above knowledge base and chat history, please answer the following question. Consider the conversation context to provide more relevant responses. If the information is not available in the knowledge base, politely let the user know and provide general helpful information if possible.`;
    
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
    // Get OpenRouter API key from environment variable
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set. Please add it to your .env file.');
    }
    
    console.log('Calling OpenRouter API with messages:', JSON.stringify(messages, null, 2));
    
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
      const rawResponse = response.data.choices[0].message.content.trim();
      return formatWhatsAppMessage(rawResponse);
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
      throw new Error('OpenRouter API authentication failed. Please check your OPENROUTER_API_KEY environment variable.');
    } else {
      throw new Error('OpenRouter API request failed: ' + (error.response?.data?.error?.message || error.message));
    }
  }
}

/**
 * Format AI response for WhatsApp-like messaging
 * @param {string} response - The raw AI response
 * @returns {string} - Formatted response
 */
function formatWhatsAppMessage(response) {
  // Clean up the response
  let formatted = response.trim();
  
  // Ensure proper line breaks between sentences and paragraphs
  formatted = formatted.replace(/\. ([A-Z])/g, '.\n\n$1');
  
  // Format bullet points with proper spacing
  formatted = formatted.replace(/^\* /gm, '• ');
  formatted = formatted.replace(/^- /gm, '• ');
  formatted = formatted.replace(/^\d+\. /gm, '• ');
  
  // Add spacing around bullet points
  formatted = formatted.replace(/(^• .+$)/gm, '\n$1');
  formatted = formatted.replace(/\n\n• /g, '\n• ');
  
  // Clean up multiple line breaks
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Ensure the message doesn't start with a line break
  formatted = formatted.replace(/^\n+/, '');
  
  return formatted;
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
