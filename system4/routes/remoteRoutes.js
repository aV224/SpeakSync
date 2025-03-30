const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateRemoteUser } = require('../middleware/authMiddleware');

// Ensure public/remote directory exists
const remoteDir = path.join(__dirname, '../public/remote');
if (!fs.existsSync(remoteDir)) {
  fs.mkdirSync(remoteDir, { recursive: true });
}

// Middleware to check if remote control is enabled
const checkRemoteControlEnabled = (req, res, next) => {
  const remoteControlEnabled = process.env.ENABLE_REMOTE_CONTROL === 'true';
  if (!remoteControlEnabled) {
    return res.status(403).json({ error: 'Remote control is disabled' });
  }
  next();
};

// Serve the remote control interface
router.get('/', [checkRemoteControlEnabled, authenticateRemoteUser], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/remote/index.html'));
});

// Get remote control status
router.get('/status', (req, res) => {
  const remoteControlEnabled = process.env.ENABLE_REMOTE_CONTROL === 'true';
  res.json({
    enabled: remoteControlEnabled,
    requiresAuth: process.env.REMOTE_CONTROL_AUTH_REQUIRED === 'true'
  });
});

// API endpoint to get screen information
router.get('/screen-info', [checkRemoteControlEnabled, authenticateRemoteUser], (req, res) => {
  res.json({
    width: parseInt(process.env.REMOTE_CONTROL_SCREEN_WIDTH || 1280),
    height: parseInt(process.env.REMOTE_CONTROL_SCREEN_HEIGHT || 720),
    quality: parseInt(process.env.REMOTE_CONTROL_SCREEN_QUALITY || 80),
    fps: parseInt(process.env.REMOTE_CONTROL_SCREEN_FPS || 10)
  });
});

// API endpoint to toggle remote control
router.post('/toggle', authenticateRemoteUser, (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request. "enabled" must be a boolean.' });
  }
  
  // In a real application, you would update the .env file or database
  // This is just a mock implementation for demonstration
  process.env.ENABLE_REMOTE_CONTROL = enabled.toString();
  
  res.json({ 
    enabled: process.env.ENABLE_REMOTE_CONTROL === 'true',
    message: `Remote control ${enabled ? 'enabled' : 'disabled'} successfully`
  });
});

// API endpoint to get active connections
router.get('/connections', [checkRemoteControlEnabled, authenticateRemoteUser], (req, res) => {
  // This would be populated by the remoteController
  // Mocked for demonstration purposes
  res.json({
    active: 0,
    max: parseInt(process.env.REMOTE_CONTROL_MAX_CONNECTIONS || 1)
  });
});

module.exports = router; 