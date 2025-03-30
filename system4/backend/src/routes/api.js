const express = require('express');
const router = express.Router();
const logger = require('electron-log');
const CallController = require('../controllers/callController');
const ProjectController = require('../controllers/projectController');
const DirectoryController = require('../controllers/directoryController');
const ClaudeController = require('../controllers/claudeController');
const SettingsController = require('../controllers/settingsController');

// Project Routes
router.post('/projects', async (req, res) => {
  try {
    const project = await ProjectController.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const projects = await ProjectController.getProjects();
    res.json(projects);
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/default', ProjectController.getDefaultProject);
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await ProjectController.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    logger.error(`Error fetching project ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const project = await ProjectController.updateProject(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    logger.error(`Error updating project ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/projects/:projectId/default', ProjectController.setDefaultProject);
router.post('/projects/:projectId/archive', ProjectController.archiveProject);
router.delete('/projects/:id', async (req, res) => {
  try {
    const success = await ProjectController.deleteProject(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting project ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects/validate-path', ProjectController.validatePath);
router.get('/projects/:projectId/files', ProjectController.getProjectFiles);

// Call Routes
router.post('/calls', CallController.createCall);
router.get('/calls', CallController.getRecentCalls);
router.get('/calls/:callSid', CallController.getCallBySid);
router.put('/calls/:callSid/status', CallController.updateCallStatus);
router.post('/calls/:callSid/interactions', CallController.addSpeechInteraction);
router.post('/calls/:callSid/recordings', CallController.addRecording);
router.post('/calls/:callSid/transcriptions', CallController.addTranscription);
router.get('/calls/phone/:phoneNumber', CallController.getCallsByPhoneNumber);
router.delete('/calls/:callSid', CallController.deleteCall);

// Directory routes
router.get('/directories', async (req, res) => {
  try {
    const directories = await DirectoryController.getAllDirectories();
    res.json(directories);
  } catch (error) {
    logger.error('Error fetching directories:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/directories/active', async (req, res) => {
  try {
    const directories = await DirectoryController.getActiveDirectories();
    res.json(directories);
  } catch (error) {
    logger.error('Error fetching active directories:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/directories', async (req, res) => {
  try {
    const directory = await DirectoryController.addDirectory(req.body);
    res.status(201).json(directory);
  } catch (error) {
    logger.error('Error adding directory:', error);
    res.status(400).json({ error: error.message });
  }
});

router.put('/directories/:id', async (req, res) => {
  try {
    const directory = await DirectoryController.updateDirectory(req.params.id, req.body);
    res.json(directory);
  } catch (error) {
    logger.error(`Error updating directory ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/directories/:id', async (req, res) => {
  try {
    const success = await DirectoryController.deleteDirectory(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting directory ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/directories/project/:projectId', async (req, res) => {
  try {
    const directories = await DirectoryController.getDirectoriesByProject(req.params.projectId);
    res.json(directories);
  } catch (error) {
    logger.error(`Error fetching directories for project ${req.params.projectId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/directories/init', async (req, res) => {
  try {
    const directories = await DirectoryController.initializeDefaultDirectories();
    res.json({
      success: true,
      count: directories.length,
      directories
    });
  } catch (error) {
    logger.error('Error initializing directories:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/directories/check-path', async (req, res) => {
  try {
    const { path, operation } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const allowed = await DirectoryController.isPathAllowed(path, operation || 'read');
    res.json({ allowed, path, operation: operation || 'read' });
  } catch (error) {
    logger.error('Error checking path permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/directories/check-command', async (req, res) => {
  try {
    const { path, command } = req.body;
    if (!path || !command) {
      return res.status(400).json({ error: 'Path and command are required' });
    }
    
    const allowed = await DirectoryController.isCommandAllowed(path, command);
    res.json({ allowed, path, command });
  } catch (error) {
    logger.error('Error checking command permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/directories/claude-context', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const context = await DirectoryController.buildClaudeSecurityContext(path);
    res.json(context);
  } catch (error) {
    logger.error('Error building Claude security context:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claude AI Routes
router.post('/claude/code', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const result = await ClaudeController.generateCode(prompt, context);
    res.json(result);
  } catch (error) {
    logger.error('Error generating code with Claude:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/claude/execute', async (req, res) => {
  try {
    const { command, workingDir } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // Security check - ensure command is allowed in the working directory
    if (workingDir) {
      const allowed = await DirectoryController.isCommandAllowed(workingDir, command);
      if (!allowed) {
        return res.status(403).json({ 
          error: 'Command not allowed in this directory',
          command,
          workingDir
        });
      }
    }
    
    const result = await ClaudeController.executeCommand(command, workingDir);
    res.json(result);
  } catch (error) {
    logger.error('Error executing command with Claude:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/claude/speech', async (req, res) => {
  try {
    const { speech, projectPath } = req.body;
    if (!speech) {
      return res.status(400).json({ error: 'Speech command is required' });
    }
    
    const result = await ClaudeController.processSpeech(speech, projectPath);
    res.json(result);
  } catch (error) {
    logger.error('Error processing speech with Claude:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/claude/thinking', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const result = await ClaudeController.processWithThinking(prompt, context);
    res.json(result);
  } catch (error) {
    logger.error('Error using Claude extended thinking:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/claude/status', async (req, res) => {
  try {
    const status = await ClaudeController.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting Claude status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Twilio webhook routes
router.post('/twilio/voice', (req, res) => {
  // We'll implement this later - direct webhook from Twilio to create call
  res.status(200).send('OK');
});

router.post('/twilio/status', (req, res) => {
  // We'll implement this later - status callback from Twilio
  res.status(200).send('OK');
});

router.post('/twilio/recording', (req, res) => {
  // We'll implement this later - recording callback from Twilio
  res.status(200).send('OK');
});

router.post('/twilio/transcription', (req, res) => {
  // We'll implement this later - transcription callback from Twilio
  res.status(200).send('OK');
});

// Settings Routes
router.get('/settings', async (req, res) => {
  try {
    const settings = await SettingsController.getAllSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/update-keys', async (req, res) => {
  try {
    const { apiKeys } = req.body;
    if (!apiKeys) {
      return res.status(400).json({ error: 'API keys are required' });
    }
    
    const result = await SettingsController.updateAPIKeys(apiKeys);
    res.json(result);
  } catch (error) {
    logger.error('Error updating API keys:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/update-paths', async (req, res) => {
  try {
    const { projectPaths } = req.body;
    if (!projectPaths) {
      return res.status(400).json({ error: 'Project paths are required' });
    }
    
    const result = await SettingsController.updateProjectPaths(projectPaths);
    res.json(result);
  } catch (error) {
    logger.error('Error updating project paths:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai/status', async (req, res) => {
  try {
    const status = await SettingsController.getAPIStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting AI status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 