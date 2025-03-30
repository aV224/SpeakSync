const ClaudeService = require('../services/claudeService');
const ProjectService = require('../services/projectService');
const logger = require('electron-log');

/**
 * Claude Controller
 * Handles HTTP requests for Claude AI operations
 */
class ClaudeController {
  /**
   * Process code request with Claude
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processCodeRequest(req, res) {
    try {
      const { request, projectId } = req.body;
      
      // Validate request
      if (!request) {
        return res.status(400).json({
          success: false,
          message: 'Request is required'
        });
      }
      
      // Get project information
      let project;
      if (projectId) {
        project = await ProjectService.getProjectById(projectId);
      } else {
        project = await ProjectService.getDefaultProject();
      }
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Track project access
      await ProjectService.trackProjectAccess(project.projectId);
      
      // Process request with Claude
      const result = await ClaudeService.processCodeRequest(request, {
        projectName: project.name,
        workingDir: project.path,
        owner: 'user'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Code request processed successfully',
        result
      });
    } catch (error) {
      logger.error(`Error processing code request: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error processing code request',
        error: error.message
      });
    }
  }
  
  /**
   * Check Claude API status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkStatus(req, res) {
    try {
      const isAvailable = await ClaudeService.isAvailable();
      
      const apiKey = process.env.CLAUDE_API_KEY;
      const isConfigured = !!apiKey && apiKey !== 'your_claude_api_key_here';
      
      return res.status(200).json({
        success: true,
        status: {
          available: isAvailable,
          configured: isConfigured,
          model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219-v1:0',
          features: {
            extendedThinking: true,
            codeExecution: true
          }
        }
      });
    } catch (error) {
      logger.error(`Error checking Claude status: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error checking Claude status',
        error: error.message
      });
    }
  }
  
  /**
   * Execute code with Claude
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async executeCode(req, res) {
    try {
      const { code, language, projectId } = req.body;
      
      // Validate request
      if (!code || !language) {
        return res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
      }
      
      // Get project information
      let project;
      if (projectId) {
        project = await ProjectService.getProjectById(projectId);
      } else {
        project = await ProjectService.getDefaultProject();
      }
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Execute code
      const result = await ClaudeService.executeCode(language, code, project.path);
      
      return res.status(200).json({
        success: true,
        message: 'Code executed successfully',
        result
      });
    } catch (error) {
      logger.error(`Error executing code: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error executing code',
        error: error.message
      });
    }
  }
  
  /**
   * Process speech input and execute Claude AI commands
   * @route POST /ai/process
   */
  static async processSpeech(req, res) {
    try {
      const { speech } = req.body;
      
      if (!speech) {
        return res.status(400).json({
          success: false,
          error: 'Speech input is required'
        });
      }
      
      // Get caller information for context tracking
      const phone = req.body.phone || 'unknown';
      const userId = phone; // Use phone as user ID for tracking conversation state
      
      console.log(`Received speech command from ${userId}: "${speech}"`);
      
      // First, check if this is a project selection command
      const { getProjectNumbers, processProjectSelection, ensureProjectSelected } = require('../services/claudeService');
      const projectResult = await processProjectSelection(speech);
      
      if (projectResult.isProjectSelection) {
        if (projectResult.success) {
          // Store the project selection in the user's conversation state
          if (!req.app.locals.conversationState) {
            req.app.locals.conversationState = {};
          }
          
          req.app.locals.conversationState[userId] = {
            projectNumber: projectResult.projectNumber,
            projectName: projectResult.projectName,
            projectPath: projectResult.projectPath,
            lastInteraction: Date.now()
          };
          
          return res.json({
            success: true,
            message: projectResult.message,
            projectSelected: true,
            projectInfo: {
              number: projectResult.projectNumber,
              name: projectResult.projectName,
              path: projectResult.projectPath
            }
          });
        } else {
          // Project selection was attempted but failed
          return res.json({
            success: false,
            message: projectResult.message
          });
        }
      }
      
      // If not a project selection, check if user has a project selected
      const conversationState = req.app.locals.conversationState || {};
      const userContext = conversationState[userId];
      
      // Check if context is expired (older than 5 minutes)
      if (userContext && userContext.lastInteraction) {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (now - userContext.lastInteraction > fiveMinutes) {
          delete conversationState[userId];
          console.log(`Context expired for user ${userId}`);
        }
      }
      
      // Verify project selection or prompt to select one
      const projectStatus = await ensureProjectSelected(userContext);
      
      if (!projectStatus.hasProject) {
        return res.json({
          success: false,
          message: projectStatus.message,
          needsProjectSelection: true,
          instructions: "First select a project by saying 'project' followed by the project number."
        });
      }
      
      // Update last interaction time
      if (userContext) {
        userContext.lastInteraction = Date.now();
      }
      
      // Add project context to the speech command
      const contextualizedSpeech = `For project "${projectStatus.projectName}" at path "${projectStatus.projectPath}": ${speech}`;
      
      // Execute the command using the appropriate project path
      const claudeService = require('../services/claudeService');
      const result = await claudeService.executeSpeech(contextualizedSpeech, {
        projectPath: projectStatus.projectPath,
        mode: req.body.mode || 'default',
        autoConfirm: req.body.autoConfirm === true
      });
      
      return res.json({
        success: true,
        result,
        projectInfo: {
          name: projectStatus.projectName,
          number: projectStatus.projectNumber,
          path: projectStatus.projectPath
        }
      });
    } catch (error) {
      console.error('Error processing speech:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Process request with Claude's extended thinking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processWithThinking(req, res) {
    try {
      const { request, projectId } = req.body;
      
      // Validate request
      if (!request) {
        return res.status(400).json({
          success: false,
          message: 'Request is required'
        });
      }
      
      // Get project information
      let project;
      if (projectId) {
        project = await ProjectService.getProjectById(projectId);
      } else {
        project = await ProjectService.getDefaultProject();
      }
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Process request with Claude's extended thinking
      const result = await ClaudeService.processWithThinking(request, {
        projectName: project.name,
        workingDir: project.path,
        owner: 'user'
      });
      
      return res.status(200).json({
        success: true,
        message: 'Request processed with extended thinking',
        result
      });
    } catch (error) {
      logger.error(`Error processing request with extended thinking: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error processing request with extended thinking',
        error: error.message
      });
    }
  }
}

module.exports = ClaudeController; 