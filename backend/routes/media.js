const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const uploadDir = path.join(__dirname, '../public/frontend/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Middleware to check if user is authenticated
function authRequired(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper to store uploaded files by user
const USER_MEDIA_FILE = path.join(__dirname, '../data/user_media.json');

// Helper to generate full URL
function getFullUrl(req, relativePath) {
  const env = process.env.NODE_ENV || 'dev';
  
  let baseUrl;
  if (env === 'prod') {
    baseUrl = 'https://whatspro.robomate.in';
  } else {
    baseUrl = 'http://localhost:3000';
  }
  
  return `${baseUrl}${relativePath}`;
}

function readUserMedia() {
  if (!fs.existsSync(USER_MEDIA_FILE)) return [];
  return JSON.parse(fs.readFileSync(USER_MEDIA_FILE));
}
function writeUserMedia(data) {
  fs.writeFileSync(USER_MEDIA_FILE, JSON.stringify(data, null, 2));
}

// Generate a unique ID for media items
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Get file size in bytes
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

router.post('/upload', authRequired, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const filePath = path.join(uploadDir, req.file.filename);
    const fileSize = getFileSize(filePath);
    const uploadDate = new Date().toISOString();
    const relativePath = `/uploads/${req.file.filename}`;
    
    // Save file info by user
    const userMedia = readUserMedia();
    const mediaItem = {
      id: generateUniqueId(),
      username: req.session.user.username,
      name: req.body.name || req.file.originalname,
      type: req.body.type || 'image',
      filename: req.file.filename,
      url: relativePath, // Store relative path in DB
      fileSize,
      uploadDate,
      originalName: req.file.originalname
    };
    
    userMedia.push(mediaItem);
    writeUserMedia(userMedia);
    
    // Return full URL in response
    res.json({ 
      success: true, 
      ...mediaItem,
      url: getFullUrl(req, relativePath) // Return full URL to client
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload endpoint for sequence media
router.post('/api/media/upload', authRequired, upload.single('media'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = getFullUrl(req, `/uploads/${req.file.filename}`);
    const mediaData = {
      id: generateUniqueId(),
      name: req.file.originalname,
      filename: req.file.filename,
      url: fileUrl,
      type: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.session.user.username
    };

    // Save to user media
    const userMedia = readUserMedia();
    userMedia.push(mediaData);
    writeUserMedia(userMedia);

    res.json({
      url: fileUrl,
      type: req.file.mimetype,
      name: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Update existing media records - run once to fix missing fields in existing media
router.get('/fix-media-records', authRequired, (req, res) => {
  try {
    const userMedia = readUserMedia();
    const updatedMedia = userMedia.map(media => {
      // If record already has all fields, don't modify it
      if (media.id && media.name && media.type && media.fileSize) {
        return media;
      }
      
      // Add missing fields
      const filePath = path.join(uploadDir, media.filename);
      const fileSize = getFileSize(filePath);
      
      return {
        ...media,
        id: media.id || generateUniqueId(),
        name: media.name || path.basename(media.filename, path.extname(media.filename)),
        type: media.type || (path.extname(media.filename).toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'video'),
        fileSize: media.fileSize || fileSize,
        uploadDate: media.uploadDate || new Date().toISOString()
      };
    });
    
    writeUserMedia(updatedMedia);
    res.json({ 
      success: true, 
      message: 'Media records updated',
      count: updatedMedia.length
    });
  } catch (err) {
    console.error('Fix media records error:', err);
    res.status(500).json({ error: 'Failed to fix media records' });
  }
});

router.get('/list', authRequired, (req, res) => {
  try {
    const userMedia = readUserMedia();
    const files = userMedia
      .filter(m => m.username === req.session.user.username)
      .map(media => {
        // Ensure all media records have required fields
        if (!media.id) media.id = generateUniqueId();
        if (!media.name) media.name = path.basename(media.filename, path.extname(media.filename));
        if (!media.type) media.type = path.extname(media.filename).toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'video';
        if (!media.fileSize) {
          const filePath = path.join(uploadDir, media.filename);
          media.fileSize = getFileSize(filePath);
        }
        if (!media.uploadDate) media.uploadDate = new Date().toISOString();
        
        // For frontend use, return relative URLs (they work better in the browser)
        // For external APIs, we can generate full URLs when needed
        
        return {
          ...media,
          url: media.url, // Keep original relative path for frontend use
          fullUrl: getFullUrl(req, media.url), // Provide full URL as separate field if needed
          originalUrl: media.url // Keep original relative path for reference
        };
      })
      .sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0)); // Sort by date desc
    
    res.json(files);
  } catch (err) {
    console.error('List media error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get single media details
router.get('/:id', authRequired, (req, res) => {
  try {
    const userMedia = readUserMedia();
    const media = userMedia.find(m => 
      m.id === req.params.id && 
      m.username === req.session.user.username
    );
    
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    res.json(media);
  } catch (err) {
    console.error('Get media details error:', err);
    res.status(500).json({ error: 'Failed to get media details' });
  }
});

// Update media name
router.put('/:id', authRequired, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Invalid media name' });
    }
    
    const userMedia = readUserMedia();
    const mediaIndex = userMedia.findIndex(m => 
      m.id === req.params.id && 
      m.username === req.session.user.username
    );
    
    if (mediaIndex === -1) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    // Update the name
    userMedia[mediaIndex].name = name.trim();
    writeUserMedia(userMedia);
    
    res.json({ 
      success: true, 
      media: userMedia[mediaIndex] 
    });
  } catch (err) {
    console.error('Update media error:', err);
    res.status(500).json({ error: 'Failed to update media' });
  }
});

// Delete media
router.delete('/:id', authRequired, (req, res) => {
  try {
    const userMedia = readUserMedia();
    const mediaIndex = userMedia.findIndex(m => 
      m.id === req.params.id && 
      m.username === req.session.user.username
    );
    
    if (mediaIndex === -1) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    const media = userMedia[mediaIndex];
    
    // Delete the file from disk
    const filePath = path.join(uploadDir, media.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from database
    userMedia.splice(mediaIndex, 1);
    writeUserMedia(userMedia);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

module.exports = router;