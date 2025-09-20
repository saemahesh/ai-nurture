const express = require('express');
const router = express.Router();
const { initializeAllFiles, verifyCriticalFiles } = require('../services/data-init.service');
const { requireAuth } = require('../middleware/auth');

// Initialize all data files
router.post('/initialize', requireAuth, (req, res) => {
  try {
    console.log('📁 Manual data initialization requested by user');
    initializeAllFiles();
    res.json({ 
      success: true, 
      message: 'Data files initialized successfully',
      environment: process.env.NODE_ENV || 'local'
    });
  } catch (error) {
    console.error('Error during manual initialization:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize data files',
      error: error.message 
    });
  }
});

// Verify critical files exist
router.get('/verify', requireAuth, (req, res) => {
  try {
    console.log('🔍 File verification requested by user');
    verifyCriticalFiles();
    res.json({ 
      success: true, 
      message: 'Critical files verified successfully',
      environment: process.env.NODE_ENV || 'local'
    });
  } catch (error) {
    console.error('Error during file verification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify critical files',
      error: error.message 
    });
  }
});

// Get data directory status
router.get('/status', requireAuth, (req, res) => {
  try {
    const fs = require('fs');
    const { getDataDir, getDataFilePath } = require('../data-utils');
    
    const dataDir = getDataDir();
    const criticalFiles = ['chats.json', 'ai-agents.json', 'users.json', 'sessions.json'];
    
    const fileStatus = {};
    criticalFiles.forEach(filename => {
      const filePath = getDataFilePath(filename);
      fileStatus[filename] = {
        exists: fs.existsSync(filePath),
        path: filePath
      };
    });
    
    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'local',
      dataDirectory: dataDir,
      criticalFiles: fileStatus
    });
  } catch (error) {
    console.error('Error getting data status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get data status',
      error: error.message 
    });
  }
});

module.exports = router;
