const fs = require('fs');
const { getDataFilePath, getDataDir } = require('../data-utils');

/**
 * Initialize default data structure for a JSON file
 * @param {string} filename - Name of the JSON file
 * @param {*} defaultData - Default data to initialize with
 */
function initializeFile(filename, defaultData) {
  try {
    const filePath = getDataFilePath(filename);
    
    // Only create if file doesn't exist
    if (!fs.existsSync(filePath)) {
      console.log(`Initializing ${filename} with default data...`);
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      console.log(`✓ Created ${filename}`);
    }
  } catch (error) {
    console.error(`Error initializing ${filename}:`, error);
  }
}

/**
 * Initialize all required JSON files for the application
 */
function initializeAllFiles() {
  console.log('Initializing data files...');
  console.log(`Environment: ${process.env.NODE_ENV || 'local'}`);
  console.log(`Data directory: ${getDataDir()}`);
  
  // Initialize core application files
  initializeFile('users.json', []);
  initializeFile('sessions.json', []);
  initializeFile('customers.json', []);
  initializeFile('groups.json', []);
  initializeFile('sequences.json', []);
  initializeFile('campaigns.json', []);
  initializeFile('enrollments.json', []);
  initializeFile('events.json', []);
  initializeFile('schedule.json', []);
  initializeFile('direct_schedules.json', []);
  initializeFile('message_queue.json', []);
  initializeFile('statuses.json', []);
  initializeFile('user_media.json', []);
  
  // Initialize analytics and tracking files
  initializeFile('campaign_analytics.json', []);
  initializeFile('campaign_leads.json', []);
  initializeFile('campaign_queue.json', []);
  initializeFile('event_reminders.json', []);
  initializeFile('meeting_notifications.json', []);
  
  // Initialize Calendly integration files
  initializeFile('calendly_meetings.json', []);
  initializeFile('calendly_reminder_templates.json', []);
  
  // CRITICAL: Initialize chat feature files
  initializeFile('chats.json', []);
  
  // CRITICAL: Initialize AI agent feature files
  initializeFile('ai-agents.json', []);
  
  // Ensure sessions directory exists
  const sessionsDir = getDataFilePath('sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log('✓ Created sessions directory');
  }
  
  console.log('Data files initialization complete!');
}

/**
 * Verify all critical files exist and create them if missing
 */
function verifyCriticalFiles() {
  const criticalFiles = [
    'chats.json',      // Required for chat feature
    'ai-agents.json',  // Required for AI agent feature
    'users.json',      // Required for authentication
    'sessions.json'    // Required for session management
  ];
  
  console.log('Verifying critical files...');
  
  let missingFiles = [];
  
  criticalFiles.forEach(filename => {
    const filePath = getDataFilePath(filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log(`Missing critical files: ${missingFiles.join(', ')}`);
    console.log('Initializing missing files...');
    
    // Initialize missing critical files
    missingFiles.forEach(filename => {
      switch (filename) {
        case 'chats.json':
          initializeFile(filename, []);
          break;
        case 'ai-agents.json':
          initializeFile(filename, []);
          break;
        case 'users.json':
          initializeFile(filename, []);
          break;
        case 'sessions.json':
          initializeFile(filename, []);
          break;
      }
    });
  } else {
    console.log('✓ All critical files exist');
  }
}

module.exports = {
  initializeFile,
  initializeAllFiles,
  verifyCriticalFiles
};
