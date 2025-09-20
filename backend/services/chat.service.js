const fs = require('fs');
const path = require('path');
const { getDataFilePath } = require('../data-utils');

/**
 * Read chats from JSON file
 * @returns {Array} Array of chat messages
 */
function readChats() {
  try {
    const chatsPath = getDataFilePath('chats.json');
    if (!fs.existsSync(chatsPath)) {
      return [];
    }
    const data = fs.readFileSync(chatsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading chats:', error);
    return [];
  }
}

/**
 * Write chats to JSON file
 * @param {Array} chats - Array of chat messages
 */
function writeChats(chats) {
  try {
    const chatsPath = getDataFilePath('chats.json');
    fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
  } catch (error) {
    console.error('Error writing chats:', error);
    throw error;
  }
}

/**
 * Add a new message to chat history
 * @param {Object} message - Message object
 * @param {string} message.phone - Phone number
 * @param {string} message.text - Message text
 * @param {string} message.type - Message type: 'incoming', 'outgoing', 'ai'
 * @param {string} message.username - Username (for manual messages)
 * @param {string} message.timestamp - ISO timestamp
 * @param {string} [message.agentId] - AI agent ID (for AI messages)
 * @returns {Object} The saved message with ID
 */
function addMessage(message) {
  try {
    const chats = readChats();
    
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      phone: message.phone,
      text: message.text,
      type: message.type, // 'incoming', 'outgoing', 'ai'
      username: message.username || null,
      timestamp: message.timestamp || new Date().toISOString(),
      agentId: message.agentId || null
    };
    
    chats.push(newMessage);
    writeChats(chats);
    
    return newMessage;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

/**
 * Get chat history for a specific phone number
 * @param {string} phone - Phone number
 * @param {number} [limit=50] - Maximum number of messages to return
 * @returns {Array} Array of messages for the phone number
 */
function getChatHistory(phone, limit = 50) {
  try {
    const chats = readChats();
    const phoneChats = chats
      .filter(chat => chat.phone === phone)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
    
    return phoneChats;
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
}

/**
 * Get all unique phone numbers with their latest message
 * @param {string} username - Username to filter by
 * @returns {Array} Array of contacts with latest message info
 */
function getContacts(username) {
  try {
    const chats = readChats();
    const contactMap = new Map();
    
    // Load customers data to get contact names
    const customersPath = getDataFilePath('customers.json');
    let customers = [];
    if (fs.existsSync(customersPath)) {
      customers = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
    }
    
    // Create a phone-to-name mapping for quick lookup
    const phoneToName = new Map();
    customers.forEach(customer => {
      if (customer.phone && customer.name) {
        phoneToName.set(customer.phone, customer.name);
      }
    });
    
    // Group messages by phone number and get latest message
    // Filter out test phone numbers (they start with 'test_')
    chats.forEach(chat => {
      // Skip test phone numbers - they shouldn't appear in regular WhatsApp chat
      if (chat.phone && chat.phone.startsWith('test_')) {
        return;
      }
      
      if (!contactMap.has(chat.phone) || 
          new Date(chat.timestamp) > new Date(contactMap.get(chat.phone).timestamp)) {
        contactMap.set(chat.phone, {
          phone: chat.phone,
          name: phoneToName.get(chat.phone) || chat.phone, // Use name from customers or fallback to phone
          lastMessage: chat.text,
          lastMessageType: chat.type,
          timestamp: chat.timestamp,
          unreadCount: 0 // TODO: Implement unread count logic
        });
      }
    });
    
    // Also add all customers who don't have chat history yet
    customers.forEach(customer => {
      if (customer.phone && !contactMap.has(customer.phone)) {
        contactMap.set(customer.phone, {
          phone: customer.phone,
          name: customer.name || customer.phone,
          lastMessage: 'No messages yet',
          lastMessageType: 'system',
          timestamp: new Date().toISOString(),
          unreadCount: 0
        });
      }
    });
    
    // Convert to array and sort by latest message timestamp
    return Array.from(contactMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error getting contacts:', error);
    return [];
  }
}

/**
 * Get recent messages for AI context (last N messages from a phone number)
 * @param {string} phone - Phone number
 * @param {number} [limit=10] - Number of recent messages to get
 * @returns {Array} Array of recent messages for AI context
 */
function getRecentMessagesForAI(phone, limit = 10) {
  try {
    const chats = readChats();
    const recentChats = chats
      .filter(chat => chat.phone === phone)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .reverse(); // Reverse to get chronological order
    
    return recentChats.map(chat => ({
      text: chat.text,
      type: chat.type,
      timestamp: chat.timestamp
    }));
  } catch (error) {
    console.error('Error getting recent messages for AI:', error);
    return [];
  }
}

/**
 * Clear test conversation history for a specific test phone ID
 * @param {string} testPhoneId - Test phone identifier
 */
function clearTestConversation(testPhoneId) {
  try {
    const chats = readChats();
    const filteredChats = chats.filter(chat => chat.phone !== testPhoneId);
    writeChats(filteredChats);
  } catch (error) {
    console.error('Error clearing test conversation:', error);
    throw error;
  }
}

module.exports = {
  readChats,
  writeChats,
  addMessage,
  getChatHistory,
  getContacts,
  getRecentMessagesForAI,
  clearTestConversation
};
