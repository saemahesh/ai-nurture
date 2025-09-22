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
 * Add a new message to chat history with automatic cleanup
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
    
    // Optimize performance: Keep only last 50 messages per phone number
    const MESSAGE_LIMIT_PER_PHONE = 50;
    
    // Get all messages for this phone number
    const phoneMessages = chats
      .filter(chat => chat.phone === message.phone)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // If we exceed the limit, remove oldest messages
    if (phoneMessages.length > MESSAGE_LIMIT_PER_PHONE) {
      const messagesToRemove = phoneMessages.slice(0, phoneMessages.length - MESSAGE_LIMIT_PER_PHONE);
      const messageIdsToRemove = new Set(messagesToRemove.map(msg => msg.id));
      
      // Filter out the old messages for this phone number
      const optimizedChats = chats.filter(chat => 
        !(chat.phone === message.phone && messageIdsToRemove.has(chat.id))
      );
      
      console.log(`📱 Optimized chat history for ${message.phone}: removed ${messagesToRemove.length} old messages, keeping ${MESSAGE_LIMIT_PER_PHONE} most recent`);
      
      writeChats(optimizedChats);
    } else {
      writeChats(chats);
    }
    
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
          unreadCount: getUnreadCount(chat.phone, username)
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
 * Read message read status from JSON file
 * @returns {Object} Object mapping messageId to array of usernames who read it
 */
function readMessageReadStatus() {
  try {
    const readStatusPath = getDataFilePath('message_read_status.json');
    if (!fs.existsSync(readStatusPath)) {
      return {};
    }
    const data = fs.readFileSync(readStatusPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading message read status:', error);
    return {};
  }
}

/**
 * Write message read status to JSON file
 * @param {Object} readStatus - Object mapping messageId to array of usernames
 */
function writeMessageReadStatus(readStatus) {
  try {
    const readStatusPath = getDataFilePath('message_read_status.json');
    fs.writeFileSync(readStatusPath, JSON.stringify(readStatus, null, 2));
  } catch (error) {
    console.error('Error writing message read status:', error);
    throw error;
  }
}

/**
 * Mark messages as read by a user for a specific phone number
 * @param {string} phone - Phone number
 * @param {string} username - Username who read the messages
 * @returns {number} Number of messages marked as read
 */
function markMessagesAsRead(phone, username) {
  try {
    const chats = readChats();
    const readStatus = readMessageReadStatus();
    
    // Get all messages for this phone that are not from this user (incoming or AI messages)
    const unreadMessages = chats.filter(chat => 
      chat.phone === phone && 
      (chat.type === 'incoming' || chat.type === 'ai') &&
      (!readStatus[chat.id] || !readStatus[chat.id].includes(username))
    );
    
    let markedCount = 0;
    
    // Mark these messages as read by this user
    unreadMessages.forEach(message => {
      if (!readStatus[message.id]) {
        readStatus[message.id] = [];
      }
      if (!readStatus[message.id].includes(username)) {
        readStatus[message.id].push(username);
        markedCount++;
      }
    });
    
    if (markedCount > 0) {
      writeMessageReadStatus(readStatus);
    }
    
    return markedCount;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
}

/**
 * Get unread message count for a phone number and user
 * @param {string} phone - Phone number
 * @param {string} username - Username
 * @returns {number} Number of unread messages
 */
function getUnreadCount(phone, username) {
  try {
    const chats = readChats();
    const readStatus = readMessageReadStatus();
    
    // Count incoming and AI messages that haven't been read by this user
    const unreadCount = chats.filter(chat => 
      chat.phone === phone && 
      (chat.type === 'incoming' || chat.type === 'ai') &&
      (!readStatus[chat.id] || !readStatus[chat.id].includes(username))
    ).length;
    
    return unreadCount;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get total unread message count across all contacts for a user
 * @param {string} username - Username
 * @returns {number} Total number of unread messages
 */
function getTotalUnreadCount(username) {
  try {
    const chats = readChats();
    const readStatus = readMessageReadStatus();
    
    // Count all incoming and AI messages that haven't been read by this user
    // Skip test phone numbers
    const unreadCount = chats.filter(chat => 
      !chat.phone.startsWith('test_') &&
      (chat.type === 'incoming' || chat.type === 'ai') &&
      (!readStatus[chat.id] || !readStatus[chat.id].includes(username))
    ).length;
    
    return unreadCount;
  } catch (error) {
    console.error('Error getting total unread count:', error);
    return 0;
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

/**
 * Delete all chat history for a specific phone number and username
 * @param {string} phone - Phone number
 * @param {string} username - Username to filter messages
 */
function deleteChatHistory(phone, username) {
  try {
    const chats = readChats();
    // Remove all messages for this phone number - both sent by username and incoming messages
    const filteredChats = chats.filter(chat => {
      if (chat.phone === phone) {
        // Delete if message is from this username OR if it's an incoming message
        if (chat.username === username || chat.type === 'incoming') {
          return false; // Delete this message
        }
      }
      return true; // Keep this message
    });
    writeChats(filteredChats);
    
    // Also clear read status for this phone number and user
    const readStatus = readMessageReadStatus();
    for (const messageId in readStatus) {
      if (readStatus[messageId] && readStatus[messageId].includes(username)) {
        // Find the message to check if it belongs to this phone
        const message = chats.find(c => c.id === messageId);
        if (message && message.phone === phone) {
          readStatus[messageId] = readStatus[messageId].filter(u => u !== username);
          if (readStatus[messageId].length === 0) {
            delete readStatus[messageId];
          }
        }
      }
    }
    writeMessageReadStatus(readStatus);
    
  } catch (error) {
    console.error('Error deleting chat history:', error);
    throw error;
  }
}

/**
 * Optimize all chat history by keeping only last 50 messages per phone number
 * This function can be called to clean up existing data
 */
function optimizeAllChatHistory() {
  try {
    const chats = readChats();
    const MESSAGE_LIMIT_PER_PHONE = 50;
    
    // Group messages by phone number
    const messagesByPhone = {};
    chats.forEach(chat => {
      if (!messagesByPhone[chat.phone]) {
        messagesByPhone[chat.phone] = [];
      }
      messagesByPhone[chat.phone].push(chat);
    });
    
    let totalRemoved = 0;
    const optimizedChats = [];
    
    // Process each phone number
    Object.keys(messagesByPhone).forEach(phone => {
      const phoneMessages = messagesByPhone[phone]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      if (phoneMessages.length > MESSAGE_LIMIT_PER_PHONE) {
        const messagesToKeep = phoneMessages.slice(-MESSAGE_LIMIT_PER_PHONE);
        const removedCount = phoneMessages.length - MESSAGE_LIMIT_PER_PHONE;
        totalRemoved += removedCount;
        
        console.log(`📱 Optimized chat history for ${phone}: removed ${removedCount} old messages, kept ${messagesToKeep.length}`);
        optimizedChats.push(...messagesToKeep);
      } else {
        optimizedChats.push(...phoneMessages);
      }
    });
    
    if (totalRemoved > 0) {
      writeChats(optimizedChats);
      console.log(`🚀 Chat history optimization complete: removed ${totalRemoved} old messages across all conversations`);
    } else {
      console.log('📱 Chat history already optimized - no cleanup needed');
    }
    
    return { totalRemoved, totalKept: optimizedChats.length };
  } catch (error) {
    console.error('Error optimizing chat history:', error);
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
  clearTestConversation,
  deleteChatHistory,
  optimizeAllChatHistory,
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount,
  readMessageReadStatus,
  writeMessageReadStatus
};
