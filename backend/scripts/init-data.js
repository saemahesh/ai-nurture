#!/usr/bin/env node

/**
 * Data Initialization Script
 * 
 * This script initializes all required JSON files for the AI-Nurture application.
 * It can be run manually or as part of deployment scripts.
 * 
 * Usage:
 *   node scripts/init-data.js [environment]
 * 
 * Examples:
 *   node scripts/init-data.js local
 *   node scripts/init-data.js prod
 *   NODE_ENV=prod node scripts/init-data.js
 */

const path = require('path');

// Set the working directory to backend
process.chdir(path.join(__dirname, '..'));

const { initializeAllFiles, verifyCriticalFiles } = require('../services/data-init.service');

function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || process.env.NODE_ENV || 'local';
  
  // Set environment
  process.env.NODE_ENV = environment === 'production' ? 'prod' : environment;
  
  console.log('📋 AI-Nurture Data Initialization Script');
  console.log('========================================');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Working Directory: ${process.cwd()}`);
  console.log('');
  
  try {
    console.log('🔍 Step 1: Verifying existing files...');
    verifyCriticalFiles();
    console.log('');
    
    console.log('🔧 Step 2: Initializing all data files...');
    initializeAllFiles();
    console.log('');
    
    console.log('✅ Step 3: Final verification...');
    verifyCriticalFiles();
    console.log('');
    
    console.log('🎉 Data initialization completed successfully!');
    console.log('');
    console.log('📌 Critical files verified:');
    console.log('   ✓ chats.json (chat feature)');
    console.log('   ✓ ai-agents.json (AI agent feature)');
    console.log('   ✓ users.json (authentication)');
    console.log('   ✓ sessions.json (session management)');
    console.log('');
    console.log('🚀 Your application is ready to start!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Data initialization failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('1. File permissions in the backend directory');
    console.error('2. Available disk space');
    console.error('3. Node.js version compatibility');
    
    process.exit(1);
  }
}

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main();
