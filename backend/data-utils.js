const path = require('path');
const fs = require('fs');

/**
 * Get the appropriate data directory based on environment
 * @returns {string} Path to the data directory
 */
function getDataDir() {
  // Check NODE_ENV or default to local
  const env = process.env.NODE_ENV === 'prod' ? 'production' : 'local';
  const dataDir = path.join(__dirname, 'db', env);
  
  // Ensure directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return dataDir;
}

/**
 * Get full path to a data file
 * @param {string} filename - Name of the data file (e.g., 'users.json')
 * @returns {string} Full path to the data file
 */
function getDataFilePath(filename) {
  const dataDir = getDataDir();
  return path.join(dataDir, filename);
}

module.exports = {
  getDataDir,
  getDataFilePath
};
