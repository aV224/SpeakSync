// Remote Desktop Control Controller
require('dotenv').config();
const robot = require('robotjs');
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { Server } = require('socket.io');
const screenshot = require('screenshot-desktop');
const { v4: uuidv4 } = require('uuid');
const Jimp = require('jimp');
const perplexityConfig = require('../config/perplexity');
const remoteControlConfig = require('../config/remoteControl');

// Initialize Express app for remote control server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Track active connections
const activeConnections = new Map();
const activeScreenshots = new Map();

// Set up session directory for logging if enabled
let sessionDir;
if (remoteControlConfig.logging.enabled) {
  const logsDir = remoteControlConfig.logging.logPath;
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  sessionDir = path.join(logsDir, `session-${Date.now()}`);
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Middleware for authentication
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Check IP restriction
  if (remoteControlConfig.auth.required && 
      !remoteControlConfig.auth.allowedIps.includes(ip)) {
    return res.status(403).json({ error: 'IP not authorized' });
  }
  
  // Check auth token if required
  if (remoteControlConfig.auth.required && 
      req.headers.authorization !== `Bearer ${remoteControlConfig.auth.token}`) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public/remote')));

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/remote/index.html'));
});

// Get screen information
app.get('/api/screen-info', (req, res) => {
  try {
    const screenSize = robot.getScreenSize();
    res.json({
      width: screenSize.width,
      height: screenSize.height,
      currentWidth: remoteControlConfig.screen.width,
      currentHeight: remoteControlConfig.screen.height,
      quality: remoteControlConfig.screen.quality,
      fps: remoteControlConfig.screen.fps
    });
  } catch (error) {
    console.error('Error getting screen info:', error);
    res.status(500).json({ error: 'Failed to get screen information' });
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  // Generate a unique ID for this connection
  const connectionId = uuidv4();
  const connectionTime = Date.now();
  const clientIp = socket.handshake.address;
  
  console.log(`New connection: ${connectionId} from ${clientIp}`);
  
  // Check max connections
  if (activeConnections.size >= remoteControlConfig.server.maxConnections) {
    console.log('Max connections reached, rejecting connection');
    socket.emit('error', { message: 'Maximum connections reached' });
    socket.disconnect();
    return;
  }
  
  // Store connection
  activeConnections.set(connectionId, {
    id: connectionId,
    socket,
    ip: clientIp,
    startTime: connectionTime,
    lastActivity: connectionTime,
    actions: []
  });
  
  // Log connection
  if (remoteControlConfig.logging.enabled) {
    const connectionLog = {
      id: connectionId,
      ip: clientIp,
      time: new Date(connectionTime).toISOString()
    };
    
    fs.writeFileSync(
      path.join(sessionDir, `connection-${connectionId}.json`),
      JSON.stringify(connectionLog, null, 2)
    );
  }
  
  // Start sending screenshots
  let screenshotInterval;
  const startScreenCapture = () => {
    if (screenshotInterval) clearInterval(screenshotInterval);
    
    screenshotInterval = setInterval(async () => {
      try {
        // Capture screenshot
        const image = await screenshot();
        
        // Process with Jimp to resize and adjust quality
        const jimpImage = await Jimp.read(image);
        jimpImage.resize(
          remoteControlConfig.screen.width, 
          remoteControlConfig.screen.height
        );
        
        // Convert to buffer and send
        const buffer = await jimpImage.getBufferAsync(Jimp.MIME_JPEG);
        
        // Store latest screenshot
        activeScreenshots.set(connectionId, buffer);
        
        // Emit to this client
        socket.emit('screenshot', {
          image: buffer.toString('base64'),
          timestamp: Date.now()
        });
        
        // Log screenshot if enabled
        if (remoteControlConfig.logging.enabled && 
            remoteControlConfig.logging.logScreenshots) {
          const screenshotPath = path.join(
            sessionDir, 
            `screenshot-${connectionId}-${Date.now()}.jpg`
          );
          fs.writeFileSync(screenshotPath, buffer);
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        socket.emit('error', { message: 'Failed to capture screenshot' });
      }
    }, 1000 / remoteControlConfig.screen.fps);
  };
  
  // Start screen capture
  startScreenCapture();
  
  // Handle mouse events
  socket.on('mouse-move', (data) => {
    if (!remoteControlConfig.ai.allowControl) {
      socket.emit('error', { message: 'AI control is disabled' });
      return;
    }
    
    try {
      // Get screen size for scaling
      const screenSize = robot.getScreenSize();
      
      // Scale coordinates from client view to actual screen
      const x = Math.floor((data.x / remoteControlConfig.screen.width) * screenSize.width);
      const y = Math.floor((data.y / remoteControlConfig.screen.height) * screenSize.height);
      
      // Move mouse
      robot.moveMouse(x, y);
      
      // Log action
      logAction(connectionId, 'mouse-move', { x, y });
    } catch (error) {
      console.error('Error moving mouse:', error);
      socket.emit('error', { message: 'Failed to move mouse' });
    }
  });
  
  socket.on('mouse-click', (data) => {
    if (!remoteControlConfig.ai.allowControl) {
      socket.emit('error', { message: 'AI control is disabled' });
      return;
    }
    
    try {
      // Click with specified button
      robot.mouseClick(data.button || 'left', data.double || false);
      
      // Log action
      logAction(connectionId, 'mouse-click', data);
    } catch (error) {
      console.error('Error clicking mouse:', error);
      socket.emit('error', { message: 'Failed to click mouse' });
    }
  });
  
  // Handle keyboard events
  socket.on('key-tap', (data) => {
    if (!remoteControlConfig.ai.allowControl) {
      socket.emit('error', { message: 'AI control is disabled' });
      return;
    }
    
    try {
      // Tap key with specified modifiers
      robot.keyTap(data.key, data.modifiers || []);
      
      // Log action
      logAction(connectionId, 'key-tap', data);
    } catch (error) {
      console.error('Error tapping key:', error);
      socket.emit('error', { message: 'Failed to tap key' });
    }
  });
  
  socket.on('type-string', (data) => {
    if (!remoteControlConfig.ai.allowControl) {
      socket.emit('error', { message: 'AI control is disabled' });
      return;
    }
    
    try {
      // Type string
      robot.typeString(data.text);
      
      // Log action
      logAction(connectionId, 'type-string', { text: data.text });
    } catch (error) {
      console.error('Error typing string:', error);
      socket.emit('error', { message: 'Failed to type string' });
    }
  });
  
  // Handle AI-specific commands
  socket.on('ai-command', async (data) => {
    if (!remoteControlConfig.ai.allowControl) {
      socket.emit('error', { message: 'AI control is disabled' });
      return;
    }
    
    try {
      // Process AI command through Perplexity
      const result = await processAICommand(data.command, connectionId);
      
      // Send result back to client
      socket.emit('ai-command-result', {
        command: data.command,
        result
      });
      
      // Log action
      logAction(connectionId, 'ai-command', {
        command: data.command,
        result
      });
    } catch (error) {
      console.error('Error processing AI command:', error);
      socket.emit('error', { message: 'Failed to process AI command' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Connection closed: ${connectionId}`);
    
    // Clean up resources
    clearInterval(screenshotInterval);
    activeConnections.delete(connectionId);
    activeScreenshots.delete(connectionId);
    
    // Log disconnection
    if (remoteControlConfig.logging.enabled) {
      const disconnectionLog = {
        id: connectionId,
        ip: clientIp,
        time: new Date().toISOString(),
        duration: Date.now() - connectionTime
      };
      
      fs.writeFileSync(
        path.join(sessionDir, `disconnection-${connectionId}.json`),
        JSON.stringify(disconnectionLog, null, 2)
      );
    }
  });
});

// Process AI command using Perplexity
async function processAICommand(command, connectionId) {
  try {
    // Create a detailed prompt for the AI
    const prompt = `
    I'm controlling a desktop via a remote interface. Here's what I need to do:
    
    Command: "${command}"
    
    Please help me accomplish this by breaking it down into specific actions I should perform.
    Respond with step-by-step instructions that include mouse movements, clicks, keyboard actions, etc.
    `;
    
    // Send to Perplexity API
    const result = await perplexityConfig.generateRequest(prompt, {
      systemPrompt: `You are an AI assistant helping to control a computer through specific commands.
      The user will give you a task to accomplish on their desktop.
      Break down the task into a series of mouse and keyboard operations.
      Be specific and step-by-step. Consider that mouse coordinates are relative to screen.
      Response should be in JSON format with an array of actions like:
      {
        "actions": [
          {"type": "mouse-move", "x": 100, "y": 200},
          {"type": "mouse-click", "button": "left"},
          {"type": "key-tap", "key": "enter"}
        ],
        "explanation": "Brief explanation of what these steps accomplish"
      }`
    });
    
    // Check result format and potentially execute the actions
    if (typeof result === 'object' && Array.isArray(result.actions)) {
      // For security, we only return the plan, actual execution must be approved by the client
      return {
        success: true,
        plan: result.actions,
        explanation: result.explanation || 'Actions generated based on your command'
      };
    }
    
    return {
      success: false,
      error: 'Invalid AI response format',
      rawResponse: result
    };
  } catch (error) {
    console.error('Error in AI command processing:', error);
    return {
      success: false,
      error: `Failed to process command: ${error.message}`
    };
  }
}

// Log remote control actions
function logAction(connectionId, actionType, data) {
  // Update last activity time
  const connection = activeConnections.get(connectionId);
  if (connection) {
    connection.lastActivity = Date.now();
    connection.actions.push({
      type: actionType,
      data,
      timestamp: connection.lastActivity
    });
  }
  
  // Log to file if enabled
  if (remoteControlConfig.logging.enabled && 
      remoteControlConfig.logging.logActions) {
    const actionLog = {
      connectionId,
      type: actionType,
      data,
      timestamp: new Date().toISOString()
    };
    
    fs.appendFileSync(
      path.join(sessionDir, `actions-${connectionId}.json`),
      JSON.stringify(actionLog) + '\n'
    );
  }
}

// Check for expired sessions
setInterval(() => {
  const now = Date.now();
  
  for (const [id, connection] of activeConnections.entries()) {
    const inactiveTime = now - connection.lastActivity;
    
    if (inactiveTime > remoteControlConfig.server.sessionTimeout) {
      console.log(`Session ${id} expired due to inactivity`);
      connection.socket.disconnect();
      activeConnections.delete(id);
      activeScreenshots.delete(id);
    }
  }
}, 60000); // Check every minute

// AI command route
app.post('/remote/ai-command', async (req, res) => {
  try {
    const { command, user } = req.body;
    
    if (!command) {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }
    
    // Check if AI control is allowed
    if (!remoteControlConfig.ai.allowControl) {
      return res.status(403).json({ 
        success: false, 
        error: 'AI control is not allowed',
        explanation: 'The server is configured to disable AI-driven desktop control. Enable REMOTE_CONTROL_AI_ALLOW_CONTROL in settings.'
      });
    }
    
    log(`Received AI command: ${command} from user: ${user || 'unknown'}`, 'command');
    
    // Process the command with AI
    const result = await processAICommand(command);
    
    return res.json({
      success: true,
      command,
      result,
      explanation: result.explanation || 'Command processed successfully'
    });
  } catch (error) {
    log(`Error processing AI command: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      error: error.message,
      explanation: 'Failed to process command with AI. See server logs for details.'
    });
  }
});

// Start the server if run directly (not required from another file)
if (require.main === module) {
  const port = remoteControlConfig.server.port;
  server.listen(port, () => {
    console.log(`Remote Control Server running on port ${port}`);
    console.log(`AI control is ${remoteControlConfig.ai.allowControl ? 'enabled' : 'disabled'}`);
    console.log(`Web interface: http://localhost:${port}`);
  });
}

module.exports = {
  app,
  server,
  io,
  processAICommand,
  getActiveConnections: () => activeConnections,
  getActiveScreenshots: () => activeScreenshots,
  getScreenInfo: () => {
    return {
      size: robot.getScreenSize(),
      config: {
        width: remoteControlConfig.screen.width,
        height: remoteControlConfig.screen.height,
        quality: remoteControlConfig.screen.quality,
        fps: remoteControlConfig.screen.fps
      }
    };
  }
}; 