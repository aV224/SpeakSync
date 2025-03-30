// Configuration for Remote Desktop Control
require('dotenv').config();

const remoteControlConfig = {
  // Server configuration
  server: {
    port: process.env.REMOTE_CONTROL_PORT || 8900,
    enabled: process.env.ENABLE_REMOTE_CONTROL === 'true',
    secureOnly: process.env.REMOTE_CONTROL_SECURE_ONLY === 'true',
    maxConnections: parseInt(process.env.REMOTE_CONTROL_MAX_CONNECTIONS || '1', 10),
    sessionTimeout: parseInt(process.env.REMOTE_CONTROL_SESSION_TIMEOUT || '3600000', 10) // 1 hour default
  },
  
  // Authorization settings
  auth: {
    required: process.env.REMOTE_CONTROL_AUTH_REQUIRED === 'true',
    token: process.env.REMOTE_CONTROL_AUTH_TOKEN,
    allowedIps: (process.env.REMOTE_CONTROL_ALLOWED_IPS || '127.0.0.1').split(',')
  },
  
  // Integration with AI
  ai: {
    allowControl: process.env.REMOTE_CONTROL_AI_ALLOW_CONTROL === 'true',
    restrictedCommands: (process.env.REMOTE_CONTROL_RESTRICTED_COMMANDS || 'rm,sudo,shutdown,reboot').split(','),
    maxExecutionTime: parseInt(process.env.REMOTE_CONTROL_MAX_EXECUTION_TIME || '30000', 10) // 30 seconds default
  },
  
  // Screen capture settings
  screen: {
    quality: parseInt(process.env.REMOTE_CONTROL_SCREEN_QUALITY || '80', 10),
    fps: parseInt(process.env.REMOTE_CONTROL_SCREEN_FPS || '10', 10),
    width: parseInt(process.env.REMOTE_CONTROL_SCREEN_WIDTH || '1280', 10),
    height: parseInt(process.env.REMOTE_CONTROL_SCREEN_HEIGHT || '720', 10)
  },
  
  // Logging
  logging: {
    enabled: process.env.REMOTE_CONTROL_LOGGING === 'true',
    logActions: process.env.REMOTE_CONTROL_LOG_ACTIONS === 'true',
    logScreenshots: process.env.REMOTE_CONTROL_LOG_SCREENSHOTS === 'true',
    logPath: process.env.REMOTE_CONTROL_LOG_PATH || './logs/remote-control'
  }
};

module.exports = remoteControlConfig; 