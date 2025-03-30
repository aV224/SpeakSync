// Load required packages
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const log = require('electron-log');
const mongoose = require('mongoose');
const fs = require('fs');
const projectController = require('./controllers/projectController');
const fileUtils = require('./utils/fileUtils');

// Import routes
const callRoutes = require('./routes/callRoutes');
const transcriptionRoutes = require('./routes/transcriptionRoutes');
const aiController = require('./controllers/aiController');
const aiRoutes = require('./routes/aiRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const DEFAULT_PORT = 3000;
const PORT = parseInt(process.env.PORT || DEFAULT_PORT, 10);

// Configure middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Error handler for body-parser JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err);
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON in request body' 
    });
  }
  
  // For all other errors, pass to next error handler
  next(err);
});

// Add CORS headers for development
app.use((req, res, next) => {
  // Set CORS headers if needed for development
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Handle JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parse error:', err);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body'
    });
  }
  next(err);
});

// Add CORS headers for development environments
app.use((req, res, next) => {
  // Set additional headers for all responses to prevent JSON parsing issues
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Serve static files
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection state
let isDbConnected = false;

// Connect to MongoDB (optional)
async function connectToMongoDB(retries = 1) {
  if (!process.env.MONGODB_URI) {
    log.info('MongoDB connection string not found, skipping database connection');
    return false;
  }
  
  try {
    log.info(`Connecting to MongoDB at ${process.env.MONGODB_URI} (attempt ${retries}/3)`);
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME,
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000  // Shorter timeout to fail faster
    });
    log.info('MongoDB connection successful');
    console.log(`MongoDB connection successful (${process.env.MONGODB_DB_NAME})`);
    isDbConnected = true; // Set connection state
    app.locals.isDbConnected = true;
    return true;
  } catch (error) {
    log.error('MongoDB connection error:', error);
    isDbConnected = false;
    app.locals.isDbConnected = false;
    log.warn('Proceeding without MongoDB connection.');
    // No need to exit, server can run without DB for some features
  } finally {
    app.locals.isDbConnected = isDbConnected;
  }
}

// Use routes
app.use((req, res, next) => {
  console.log(`REQUEST: ${req.method} ${req.url}`);
  next();
});

// Mount routes
app.use('/', callRoutes);
app.use('/transcriptions', transcriptionRoutes);

// Mount AI routes
app.use('/ai', aiRoutes);

// Add a dedicated endpoint for the Claude terminal overlay system
app.post('/ai/claude-overlay', async (req, res) => {
  try {
    // Get the speech from the request body
    const { speech, projectContext, project } = req.body;
    
    if (!speech) {
      return res.status(400).json({
        success: false,
        error: 'Speech input is required'
      });
    }
    
    // Load the Claude Terminal Overlay utility
    const claudeTerminalOverlay = require('./utils/claudeTerminalOverlay');
    
    // Use the speech verbatim - no additional formatting
    // The overlay system will handle typing "claude" and changing directory
    const formattedSpeech = speech.trim();
    
    // Determine which project to use and get its actual path
    let projectPath;
    let projectName;
    
    // If projectContext is provided, use that
    if (projectContext?.path) {
      projectPath = projectContext.path;
      projectName = projectContext.name || 'unknown';
    } 
    // If project name is provided, try to get path from project controller
    else if (project) {
      try {
        const foundProject = await projectController.getProjectByName(project, req);
        if (foundProject) {
          projectPath = foundProject.path;
          projectName = foundProject.name;
        } else {
          // Fallback to default if project name not found
          projectPath = process.env.DEFAULT_PROJECT_PATH || process.cwd();
          projectName = project || 'unknown';
        }
      } catch (error) {
        console.error('Error finding project by name:', error);
        projectPath = process.env.DEFAULT_PROJECT_PATH || process.cwd();
        projectName = project || 'unknown';
      }
    } 
    // No project info provided, use defaults
    else {
      projectPath = process.env.DEFAULT_PROJECT_PATH || process.cwd();
      projectName = process.env.DEFAULT_PROJECT_NAME || 'unknown';
    }
    
    console.log(`Processing overlay command: "${formattedSpeech}" for project: ${projectName} at ${projectPath}`);
    
    // Attempt to send via direct keyboard input first
    const keyboardResult = await claudeTerminalOverlay.sendToClaudeTerminal(
      formattedSpeech, 
      { name: projectName, path: projectPath }
    );
    
    if (keyboardResult) {
      return res.json({
        success: true,
        method: 'keyboard_overlay',
        projectName: projectName,
        projectPath: projectPath,
        message: 'Command sent to Claude terminal successfully'
      });
    }
    
    // If keyboard method failed, try clipboard method
    const clipboardResult = await claudeTerminalOverlay.clipboardToClaudeTerminal(
      formattedSpeech, 
      { name: projectName, path: projectPath }
    );
    
    if (clipboardResult) {
      return res.json({
        success: true,
        method: 'clipboard_overlay',
        projectName: projectName,
        projectPath: projectPath,
        message: 'Command sent to Claude terminal via clipboard'
      });
    }
    
    // If both methods failed
    return res.status(500).json({
      success: false,
      error: 'Failed to send command to Claude terminal'
    });
  } catch (error) {
    console.error('Error in Claude overlay endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing overlay request'
    });
  }
});

// Add a dedicated endpoint for BrainClassify commands
app.post('/ai/brainclassify', async (req, res) => {
  try {
    // Get the speech from the request body
    const { speech } = req.body;
    
    if (!speech) {
      return res.status(400).json({
        success: false,
        error: 'Speech input is required'
      });
    }
    
    // Load the Claude Terminal Overlay utility
    const claudeTerminalOverlay = require('./utils/claudeTerminalOverlay');
    
    // Use the speech verbatim - no additional formatting
    const formattedSpeech = speech.trim();
    
    console.log(`Processing BrainClassify command: "${formattedSpeech}"`);
    
    // Get the BrainClassify project path dynamically
    let projectPath;
    let projectName = 'brainClassify';
    
    try {
      // First try to get from project controller
      const brainProject = await projectController.getProjectByName('brainClassify', req);
      if (brainProject && brainProject.path) {
        projectPath = brainProject.path;
        projectName = brainProject.name;
      } else {
        // Fallback to environment variables
        projectPath = process.env.BRAINCLASSIFY_CWD || 
                     process.env.BRAINCLASSIFY_PATH || 
                     '/Users/kousthubhveturi/Desktop/brainClassify';
      }
    } catch (error) {
      console.error('Error finding BrainClassify project:', error);
      // Fallback to environment variables
      projectPath = process.env.BRAINCLASSIFY_CWD || 
                   process.env.BRAINCLASSIFY_PATH || 
                   '/Users/kousthubhveturi/Desktop/brainClassify';
    }
    
    console.log(`Using project path: ${projectPath}`);
    
    // Attempt to send via direct keyboard input first
    const keyboardResult = await claudeTerminalOverlay.sendToClaudeTerminal(
      formattedSpeech, 
      { name: projectName, path: projectPath }
    );
    
    if (keyboardResult) {
      return res.json({
        success: true,
        method: 'keyboard_overlay',
        projectName: projectName,
        projectPath: projectPath,
        message: 'Command sent to Claude terminal for BrainClassify project'
      });
    }
    
    // If keyboard method failed, try clipboard method
    const clipboardResult = await claudeTerminalOverlay.clipboardToClaudeTerminal(
      formattedSpeech, 
      { name: projectName, path: projectPath }
    );
    
    if (clipboardResult) {
      return res.json({
        success: true,
        method: 'clipboard_overlay',
        projectName: projectName,
        projectPath: projectPath,
        message: 'Command sent to Claude terminal via clipboard for BrainClassify project'
      });
    }
    
    // If both methods failed
    return res.status(500).json({
      success: false,
      error: 'Failed to send command to Claude terminal for BrainClassify'
    });
  } catch (error) {
    console.error('Error in BrainClassify endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error processing BrainClassify request'
    });
  }
});

// Add direct AI process route with error handling middleware
app.post('/ai/process', async (req, res) => {
  try {
    // Get the speech from the request body
    const { speech, callerNumber, projectContext } = req.body;
    
    if (!speech) {
      // If no speech provided, return a helpful error but with status 200
      console.log('No speech provided in request to /ai/process');
      return res.json({
        success: true, // Mark as successful to prevent Twilio freezing
        status: 'error_handled',
        message: 'No speech input provided. Please try again with a voice command.',
        error: 'Missing speech input'
      });
    }
    
    // Improve transcription quality
    const correctedSpeech = aiController.improveTranscription ? 
      aiController.improveTranscription(speech) : speech;
    
    // Get project information for context - make sure we're using the exact path provided
    const projectPath = projectContext?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
    const projectName = projectContext?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
    
    console.log(`Processing speech: "${correctedSpeech}" from caller: ${callerNumber || 'unknown'} for project: ${projectName} at path: ${projectPath}`);
    
    // Always add --auto-enter flag for voice commands
    const speechWithAutoEnter = `${correctedSpeech} --auto-enter`;
    
    // Always use the overlay system for voice commands
    try {
      // Pass the EXACT project context to the overlay system
      const overlayResult = await aiController.processOverlaySpeech(speechWithAutoEnter, {
        path: projectPath,
        name: projectName
      });
      
      if (overlayResult.success) {
        console.log('Successfully processed with Claude Terminal Overlay');
        return res.json(overlayResult);
      } else {
        console.log('Claude Terminal Overlay failed:', overlayResult.error);
        // Even if overlay fails, don't try alternative methods, just return the error
        return res.json({
          success: true, // Mark as successful to prevent Twilio freezing
          status: 'error_handled',
          message: 'There was an issue sending your command to Claude. Please try again.',
          error: overlayResult.error || 'Failed to process with Claude Terminal Overlay'
        });
      }
    } catch (error) {
      console.error('Error in Claude Terminal Overlay:', error);
      
      // Even for catastrophic errors, respond with 200
      return res.json({
        success: true, // Mark as successful to prevent Twilio freezing
        status: 'error_handled',
        message: 'There was a technical issue processing your command. Please try again later.',
        error: error.message || 'Unknown error in speech processing route'
      });
    }
  } catch (error) {
    console.error('Unhandled error in /ai/process route:', error);
    
    // Even for catastrophic errors, respond with 200
    return res.json({
      success: true, // Mark as successful to prevent Twilio freezing
      status: 'error_handled',
      message: 'There was a technical issue processing your command. Please try again later.',
      error: error.message || 'Unknown error in speech processing route'
    });
  }
});

// Directory selection and active project API endpoints
app.post('/api/active-directory', async (req, res) => {
  try {
    const { path, name, id } = req.body;
    
    if (id) {
      // If ID is provided, use it to set the active project
      const success = await projectController.setActiveProjectById(id);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to set active project by ID' });
      }
      
      const activeProject = await projectController.getActiveProject();
      return res.json(activeProject);
    }
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    // Note: We're now passing path as the first parameter, name as the second
    const success = await projectController.setActiveProject(path, name);
    
    if (!success) {
      return res.status(400).json({ 
        error: 'Failed to set active project. Check if the path is valid and not in restricted list.' 
      });
    }
    
    const activeProject = await projectController.getActiveProject();
    res.json(activeProject);
  } catch (error) {
    log.error('Error setting active directory:', error);
    res.status(500).json({ error: error.message || 'Failed to set active directory' });
  }
});

// Get active directory
app.get('/api/active-directory', async (req, res) => {
  try {
    const activeProject = await projectController.getActiveProject();
    
    if (!activeProject) {
      return res.status(404).json({ error: 'No active project set' });
    }
    
    res.json(activeProject);
  } catch (error) {
    log.error('Error getting active directory:', error);
    res.status(500).json({ error: 'Failed to get active directory' });
  }
});

// Projects directory info
app.get('/api/projects-directory', (req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIRECTORY || path.join(__dirname, 'projects');
    const exists = fs.existsSync(projectsDir);
    const isDirectory = exists ? fs.statSync(projectsDir).isDirectory() : false;

    res.json({
      path: projectsDir,
      exists,
      isDirectory
    });
  } catch (error) {
    log.error('Error getting projects directory info:', error);
    res.status(500).json({ error: 'Failed to get projects directory info' });
  }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await projectController.getAllProjects();
    res.json(projects);
  } catch (error) {
    log.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await projectController.getProjectById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    log.error(`Error fetching project ${req.params.projectId}:`, error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
app.post('/api/projects', async (req, res) => {
  try {
    const { name, type, template } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const project = await projectController.createProject(name, type, template);
    res.status(201).json(project);
  } catch (error) {
    log.error('Error creating project:', error);
    res.status(500).json({ error: error.message || 'Failed to create project' });
  }
});

// Import existing project
app.post('/api/projects/import', async (req, res) => {
  try {
    const { name, sourcePath } = req.body;
    
    if (!name || !sourcePath) {
      return res.status(400).json({ error: 'Project name and source path are required' });
    }
    
    const project = await projectController.importProject(sourcePath, name);
    res.status(201).json(project);
  } catch (error) {
    log.error('Error importing project:', error);
    res.status(500).json({ error: error.message || 'Failed to import project' });
  }
});

// Delete project
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const deleteFiles = req.query.deleteFiles === 'true';
    
    const result = await projectController.deleteProject(projectId, deleteFiles);
    res.json({ success: true, message: `Project deleted ${deleteFiles ? 'with' : 'without'} files` });
  } catch (error) {
    log.error(`Error deleting project ${req.params.projectId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to delete project' });
  }
});

// Get project structure
app.get('/api/projects/:projectId/structure', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const depth = parseInt(req.query.depth) || 3;
    
    const project = await projectController.getProjectById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const structure = await fileUtils.getProjectStructure(project.path, depth);
    res.json(structure);
  } catch (error) {
    log.error(`Error getting project structure for ${req.params.projectId}:`, error);
    res.status(500).json({ error: 'Failed to get project structure' });
  }
});

// Get file content
app.get('/api/projects/:projectId/file', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const project = await projectController.getProjectById(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure the file path is within the project directory
    const fullPath = path.join(project.path, filePath);
    if (!fullPath.startsWith(project.path)) {
      return res.status(403).json({ error: 'Access denied: File path is outside the project directory' });
    }
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(fullPath);
    
    // Check if it's a directory
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file' });
    }
    
    // Read file content
    const content = fs.readFileSync(fullPath, 'utf8');
    
    res.json({
      path: filePath,
      content,
      size: stats.size,
      lastModified: stats.mtime
    });
  } catch (error) {
    log.error(`Error reading file content:`, error);
    res.status(500).json({ error: 'Failed to read file content' });
  }
});

app.post('/api/check-permissions', (req, res) => {
  const { path } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  // Check if we can access the directory
  try {
    // Try to read the directory
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    
    // If we get here, we have permission
    return res.json({ 
      hasPermission: true, 
      path,
      message: 'You have read and write permissions for this directory.'
    });
  } catch (err) {
    log.warn(`Permission check failed for path ${path}: ${err.message}`);
    return res.json({ 
      hasPermission: false, 
      path,
      message: `Cannot access directory: ${err.message}`
    });
  }
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      connected: isDbConnected, // Use the tracked state
      type: 'MongoDB'
    }
  });
});

// API AI status endpoint
app.get('/api/ai/status', (req, res) => {
  const perplexityEnabled = process.env.PERPLEXITY_API_KEY && 
    process.env.PERPLEXITY_API_KEY !== 'your_perplexity_api_key_here';
  
  const claudeEnabled = process.env.CLAUDE_API_KEY && 
    process.env.CLAUDE_API_KEY !== 'your_claude_api_key_here';
  
  res.json({
    providers: {
      perplexity: {
        provider: 'Perplexity AI',
        model: process.env.PERPLEXITY_MODEL || 'llama-3-8b-instruct',
        enabled: perplexityEnabled
      },
      claude: {
        provider: 'Claude AI',
        model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20240307',
        enabled: claudeEnabled,
        codeEnabled: claudeEnabled,
        capabilities: ['Code execution', 'Shell commands', 'Project management']
      }
    },
    activeProvider: process.env.DEFAULT_PROVIDER || (claudeEnabled ? 'claude' : (perplexityEnabled ? 'perplexity' : null)),
    enabled: perplexityEnabled || claudeEnabled
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // For API routes, always return JSON
  if (req.path.startsWith('/api/')) {
    // Ensure content type is set to JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Return the error as JSON
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'An unexpected error occurred'
    });
  }
  
  // For non-API routes, render an error page or pass to Express's default error handler
  next(err);
});

// Catch-all handler for API routes that don't exist
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.path}`
  });
});

// Error handling middleware
app.use(errorHandler);

// Global error handler for API routes
app.use('/api', (err, req, res, next) => {
  console.error('API error handler caught:', err);
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    console.error('Multer error:', err);
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`
    });
  }
  
  // Handle other errors
  return res.status(500).json({
    success: false,
    error: err.message || 'An unexpected error occurred'
  });
});

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // If this is an API request, return JSON
  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected error occurred'
    });
  }
  
  // For other routes, send a simple error page
  res.status(500).send(`
    <html>
      <head><title>Error</title></head>
      <body>
        <h1>Something went wrong</h1>
        <p>The server encountered an error processing your request.</p>
        <p>Error: ${err.message || 'Unknown error'}</p>
        <a href="/">Go back to home page</a>
      </body>
    </html>
  `);
});

// Start server
async function start() {
  // Try to connect to MongoDB (but continue if it fails)
  await connectToMongoDB().catch((err) => {
      log.error("MongoDB connection failed during startup, proceeding without it.", err);
      isDbConnected = false;
  });
  
  // Try to start the server
  return new Promise((resolve, reject) => {
    // Try the specified port first
    const server = app.listen(PORT)
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          log.warn(`Port ${PORT} is already in use, trying alternative port...`);
          console.warn(`⚠️ Port ${PORT} is already in use, trying alternative port...`);
          
          // Try an alternative port
          const altPort = PORT === DEFAULT_PORT ? 4000 : PORT + 1;
          
          const altServer = app.listen(altPort)
            .on('error', (altErr) => {
              log.error(`Failed to start server on alternative port ${altPort}:`, altErr.message);
              reject(altErr);
            })
            .on('listening', () => {
              const address = altServer.address();
              const port = address.port;
              const url = `http://localhost:${port}`;
              
              log.info(`Server running on alternative port ${port}`);
              console.log(`\n=== Gaana AI Assistant Server ===`);
              console.log(`Server running on alternative port ${port}`);
              console.log(`Main URL: ${url}`);
              
              printServerInfo(url); // Pass url only
              resolve(altServer);
            });
        } else {
          log.error(`Failed to start server:`, err.message);
          reject(err);
        }
      })
      .on('listening', () => {
        const address = server.address();
        const port = address.port;
        const url = `http://localhost:${port}`;
        
        log.info(`Server running on port ${port}`);
        console.log(`\n=== Gaana AI Assistant Server ===`);
        console.log(`Server running on port ${port}`);
        console.log(`Main URL: ${url}`);
        
        printServerInfo(url); // Pass url only
        resolve(server);
      });
  });
}

// Helper to print server information
function printServerInfo(url) { // Removed dbConnected parameter
  console.log('\nEndpoints:');
  console.log(`- ${url}/voice (POST) - Configure this in Twilio as webhook`);
  console.log(`- ${url}/initiate-call (POST) - Start a call`);
  console.log(`- ${url}/ai/process (POST) - AI endpoint for voice commands`);
  console.log(`- ${url}/directory-selector.html - Set active directory for Claude AI`);
  
  // Log AI configuration
  const perplexityEnabled = process.env.PERPLEXITY_API_KEY && 
    process.env.PERPLEXITY_API_KEY !== 'your_perplexity_api_key_here';
    
  const claudeEnabled = process.env.CLAUDE_API_KEY && 
    process.env.CLAUDE_API_KEY !== 'your_claude_api_key_here';
  
  console.log('\nAI Configuration:');
  if (claudeEnabled) {
    console.log('Claude AI: ENABLED');
    console.log(`Model: ${process.env.CLAUDE_MODEL}`);
    console.log('Features: Code execution, Command execution, Project management');
  } else {
    console.log('Claude AI: DISABLED');
  }
  
  if (perplexityEnabled) {
    console.log('\nPerplexity AI: ENABLED');
    console.log(`Model: ${process.env.PERPLEXITY_MODEL}`);
  } else {
    console.log('\nPerplexity AI: DISABLED');
  }
  
  // Log Twilio configuration
  console.log('\nTwilio Configuration:');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    console.log('Twilio: CONFIGURED');
    console.log(`Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`Default Call Target: ${process.env.DEFAULT_PHONE_NUMBER}`);
  } else {
    console.log('Twilio: NOT PROPERLY CONFIGURED');
  }
  
  // Log MongoDB status
  console.log('\nMongoDB Status:');
  if (isDbConnected) { // Use tracked state
    console.log(`Connected to: ${process.env.MONGODB_DB_NAME}`);
  } else {
    console.log('Not connected or connection failed. Running without database features.');
  }
  
  // Instructions for ngrok
  console.log('\nTo make your server accessible for Twilio:');
  console.log('1. Run: ngrok http [PORT]');
  console.log('2. Copy the ngrok URL (e.g., https://xxxx-xx-xx-xx-xx.ngrok-free.app)');
  console.log('3. Set SERVER_URL in your .env file to this URL');
  console.log('4. Configure your Twilio webhook URL to [ngrok-url]/voice');
  console.log('\n==============================\n');
}

// Start the server if this file is run directly
if (require.main === module) {
  start().catch(err => {
    log.error('Server startup error:', err);
    console.error('Server startup error:', err);
    process.exit(1);
  });
}

// Export for use in other modules
module.exports = { app, start };