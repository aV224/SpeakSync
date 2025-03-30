// Import required dependencies
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const log = require('electron-log');
const { v4: uuidv4 } = require('uuid'); // For generating unique change IDs
const twilio = require('twilio');
const projectController = require('./projectController'); // Import the project controller
const logUtils = require('../utils/logUtils'); // Import the log utilities

// Import Perplexity configuration
const perplexityConfig = require('../config/perplexity');

// Import Claude direct executor finder
let claudeExecutorFinder;
try {
  claudeExecutorFinder = require('../utils/claudeExecutorFinder');
} catch (err) {
  console.log('Claude executor finder not available:', err.message);
}

// Import Claude terminal overlay
let claudeTerminalOverlay;
try {
  claudeTerminalOverlay = require('../utils/claudeTerminalOverlay');
  console.log('Claude Terminal Overlay loaded successfully');
} catch (err) {
  console.log('Claude Terminal Overlay not available:', err.message);
}

// Import Claude direct executor if available
let claudeDirectExecutor;
if (claudeExecutorFinder) {
  claudeDirectExecutor = claudeExecutorFinder.findClaudeDirectExecutor();
  if (claudeDirectExecutor) {
    console.log('Claude Direct Executor loaded successfully');
  } else {
    console.log('Claude Direct Executor not found by finder');
  }
} else {
  try {
    claudeDirectExecutor = require('../backend/src/config/claude_direct_executor');
    console.log('Claude Direct Executor loaded using direct path');
  } catch (err) {
    try {
      claudeDirectExecutor = require('./backend/src/config/claude_direct_executor');
      console.log('Claude Direct Executor loaded from alternate path');
    } catch (err2) {
      console.log('Claude Direct Executor not available, will use standard methods');
    }
  }
}

/**
 * Helper function to format a phone number to E.164 format
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove any non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Check if it already has country code
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  
  // Add US country code if needed (assuming US numbers)
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's already in E.164 but missing +, add it
  if (digits.length > 10 && !phoneNumber.startsWith('+')) {
    return `+${digits}`;
  }
  
  // Return original if already formatted or can't be determined
  return phoneNumber;
}

// Import Claude configuration if available
let claudeConfig;
// Standardize the paths to Claude configuration
const possibleConfigPaths = [
  '../backend/src/config/claude',
  '../src/config/claude',
  './backend/src/config/claude',
  './src/config/claude'
];

for (const configPath of possibleConfigPaths) {
  try {
    claudeConfig = require(configPath);
    console.log(`Loaded Claude config from: ${configPath}`);
    break;
  } catch (error) {
    // Continue to next path
  }
}

if (!claudeConfig) {
  console.log('Claude config not available, will fall back to Perplexity or rule-based processing');
}

// Import Claude service if available
let ClaudeService;
// Standardize the paths to Claude service
const possibleServicePaths = [
  '../backend/src/services/claudeService',
  '../src/services/claudeService',
  './backend/src/services/claudeService',
  './src/services/claudeService'
];

for (const servicePath of possibleServicePaths) {
  try {
    ClaudeService = require(servicePath);
    console.log(`Loaded Claude service from: ${servicePath}`);
    break;
  } catch (error) {
    // Continue to next path
  }
}

if (!ClaudeService) {
  console.log('Claude service not available, will fall back to Perplexity or rule-based processing');
}

// Promisify exec for async usage
const execAsync = util.promisify(exec);

// Get projects data file path
const projectsFilePath = path.join(__dirname, '../data/projects.json');

// Store context for different users
const userContexts = {};

// Store staged changes temporarily (in-memory for local testing)
// TODO: Replace with a more persistent store (e.g., database or file) for production
const stagedChanges = {}; 

// Helper function to get projects from the project management system
const getProjects = () => {
  try {
    if (!fs.existsSync(projectsFilePath)) {
      return { projects: [], defaultProject: null };
    }
    return JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
  } catch (error) {
    console.error('Error reading projects file:', error);
    return { projects: [], defaultProject: null };
  }
};

// Helper function to get a project by ID
const getProjectById = (id) => {
  const { projects } = getProjects();
  return projects.find(project => project.id === id);
};

// Helper function to get the default project
const getDefaultProject = () => {
  const { projects, defaultProject } = getProjects();
  if (!defaultProject) return null;
  return projects.find(project => project.id === defaultProject);
};

// Helper functions for speech correction
const speechCorrection = {
  // Correct speech using similarity matching instead of hardcoded patterns
  correctSpeech: (speech) => {
    if (!speech) return '';
    
    // Define common command words and their variations for flexible matching
    const commandIntents = {
      edit: ['edit', 'eddie', 'at it', 'headed', 'modify', 'change', 'update'],
      create: ['create', 'make', 'new', 'add', 'generate'],
      delete: ['delete', 'remove', 'erase', 'eliminate'],
      list: ['list', 'show', 'display', 'see'],
      run: ['run', 'execute', 'start', 'wrong', 'launch'],
      use: ['use', 'jews', 'juice', 'choose', 'used', 'whose', 'youtube', 'youth']
    };
    
    // Get words from speech
    const words = speech.toLowerCase().split(/\s+/);
    
    // Process the speech to identify and correct common misinterpretations
    let processed = words.map(word => {
      // Check each command intent for a match
      for (const [intent, variations] of Object.entries(commandIntents)) {
        if (variations.includes(word) || speechCorrection.isSimilar(word, variations)) {
          console.log(`Speech correction: "${word}" → "${intent}"`);
          return intent;
        }
      }
      return word;
    }).join(' ');
    
    // Apply additional contextual corrections
    processed = processed
      .replace(/\b(use|switch|change)(\s+to)?\s+game\b/gi, 'use game project')
      .replace(/\bsnake\s+game\b/gi, 'snake game')
      .replace(/\bedit(\s+the)?\s+file\b/gi, 'edit file')
      .replace(/\bcreate(\s+a)?\s+file\b/gi, 'create file');
    
    return processed;
  },
  
  // Check if a word is similar to any of the variations using Levenshtein distance
  isSimilar: (word, variations, threshold = 2) => {
    for (const variation of variations) {
      if (speechCorrection.levenshteinDistance(word, variation) <= threshold) {
        return true;
      }
    }
    return false;
  },
  
  // Calculate Levenshtein distance between two strings
  levenshteinDistance: (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  },
  
  // Extract the most likely intent from speech using NLP patterns
  extractIntent: (speech) => {
    const lowerSpeech = speech.toLowerCase();
    
    // Use more flexible pattern matching instead of hardcoded strings
    const intentPatterns = [
      { 
        intent: 'switch_project', 
        patterns: [/\b(use|switch|change|go\s+to|open)\s+(?:the\s+)?(game|project)\b/i]
      },
      { 
        intent: 'create_file', 
        patterns: [/\b(create|make|new|add)\s+(?:a\s+)?(?:new\s+)?(?:file|class)\b/i]
      },
      { 
        intent: 'edit_file', 
        patterns: [/\b(edit|modify|change|update)\s+(?:the\s+)?(?:file|class)\b/i]
      },
      { 
        intent: 'delete_file', 
        patterns: [/\b(delete|remove|erase)\s+(?:the\s+)?(?:file|class)\b/i]
      },
      { 
        intent: 'list_files', 
        patterns: [/\b(list|show|display)\s+(?:the\s+)?(?:files|directory|folders)\b/i]
      },
      { 
        intent: 'run_command', 
        patterns: [/\b(run|execute|start)\s+(?:the\s+)?(?:command|program|server)\b/i]
      }
    ];
    
    // Check for each intent pattern
    for (const { intent, patterns } of intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(lowerSpeech)) {
          return intent;
        }
      }
    }
    
    // If no specific intent is found, use keyword-based approach
    if (/\b(create|make|new|add)\b/i.test(lowerSpeech)) {
      return 'create_something';
    }
    if (/\b(edit|modify|change|update)\b/i.test(lowerSpeech)) {
      return 'edit_something';
    }
    if (/\b(delete|remove|erase)\b/i.test(lowerSpeech)) {
      return 'delete_something';
    }
    if (/\b(list|show|display)\b/i.test(lowerSpeech)) {
      return 'list_something';
    }
    if (/\b(run|execute|start)\b/i.test(lowerSpeech)) {
      return 'run_something';
    }
    
    return 'unknown';
  }
};

// NLP helper functions for more flexible command parsing
const nlpHelper = {
  // Extract file names from speech using dynamic patterns
  extractFileName: (speech) => {
    // Regular expression patterns that can be extended dynamically
    const filePatterns = [
      // Direct file name pattern with extension
      /\b\w+\.\w+\b/g,
      // File called/named pattern
      /(?:file|class)(?:\s+called|\s+named)?\s+(\w+)/i,
      // Create/edit/modify/delete file pattern
      /(?:create|make|edit|modify|update|delete|remove)\s+(?:a\s+)?(?:file|class)?\s+(?:called|named)?\s+(\w+)/i,
      // Generic file reference pattern
      /(?:create|make|edit|modify|update|delete|remove)\s+(?:a\s+)?(\w+)(?:\s+file|\s+class)?/i
    ];
    
    // Try all patterns to extract a filename
    for (const pattern of filePatterns) {
      const matches = speech.match(pattern);
      if (matches) {
        let fileName;
        if (pattern.toString().includes('\\b\\w+\\.\\w+\\b')) {
          // Direct file pattern with extension already
          fileName = matches[0];
        } else if (matches[1]) {
          // Extract name from capture group
          fileName = matches[1].trim();
          
          // Add appropriate extension if needed
          if (!fileName.includes('.')) {
            // Determine extension based on context
            if (speech.toLowerCase().includes('java') || speech.toLowerCase().includes('class')) {
              fileName += '.java';
            } else if (speech.toLowerCase().includes('javascript') || speech.toLowerCase().includes('js')) {
              fileName += '.js';
            } else if (speech.toLowerCase().includes('html')) {
              fileName += '.html';
            } else if (speech.toLowerCase().includes('css')) {
              fileName += '.css';
            } else {
              // Default to JS for this project
              fileName += '.js';
            }
          }
        }
        
        if (fileName) return fileName;
      }
    }
    
    return null;
  },
  
  // Extract content from speech for file creation/modification
  extractContent: (speech) => {
    // Try to extract content after specific markers
    const contentMarkers = [
      'with content', 'containing', 'that contains', 'with', 'to contain',
      'that says', 'that has', 'to say', 'to have', 'to read'
    ];
    
    for (const marker of contentMarkers) {
      const markerIndex = speech.toLowerCase().indexOf(marker);
      if (markerIndex >= 0) {
        // Extract content after the marker
        const contentStartIndex = markerIndex + marker.length;
        let content = speech.substring(contentStartIndex).trim();
        
        // Remove quotes if they exist
        if ((content.startsWith('"') && content.endsWith('"')) || 
            (content.startsWith("'") && content.endsWith("'"))) {
          content = content.substring(1, content.length - 1);
        }
        
        return content;
      }
    }
    
    return '';
  },
  
  // Extract command from speech 
  extractCommand: (speech) => {
    // Match patterns like "run X" or "execute Y"
    const commandPatterns = [
      /(?:run|execute|start)\s+(?:command\s+)?(.+)/i,
      /(?:run|execute|start)\s+(.+)/i
    ];
    
    for (const pattern of commandPatterns) {
      const match = speech.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  },
  
  // Generate appropriate template content based on file type
  generateTemplateContent: (fileName) => {
    if (!fileName) return '';
    
    const extension = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, extension);
    
    switch (extension) {
      case '.java':
        return `public class ${baseName} {\n    \n    public ${baseName}() {\n        // Constructor\n    }\n    \n    public static void main(String[] args) {\n        System.out.println("Hello from ${baseName}");\n    }\n}`;
        
      case '.js':
        return `// ${fileName} - Created via voice command\n\nconsole.log('This file was created via voice command');\n\n// Add your JavaScript code here\nfunction main() {\n  console.log('Hello from ${baseName}');\n}\n\nmain();`;
        
      case '.html':
        return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${baseName}</title>\n</head>\n<body>\n  <h1>${baseName}</h1>\n  <p>This file was created via voice command</p>\n</body>\n</html>`;
        
      case '.css':
        return `/* ${fileName} - Created via voice command */\n\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  line-height: 1.6;\n}\n\nh1 {\n  color: #333;\n}\n`;
        
      default:
        return `// ${fileName} - Created via voice command\n\n// Add your code here\n`;
    }
  }
};

// Helper function to send commands directly to Claude terminal
// This is used to quickly get commands to Claude without waiting for full processing
async function _sendToClaudeTerminal(speech, callerNumber) {
  try {
    // Make sure logs directory exists
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Log the command to a file for debugging
    const logFile = path.join(logsDir, 'claude-commands.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] [${callerNumber}] ${speech}\n`);
    
    console.log(`Sending to Claude terminal: "claude ${speech}"`);
    
    // Try to execute the script to send the command to Claude terminal
    try {
      const execPromise = util.promisify(exec);
      
      // Properly escape quotes for shell command but preserve them for Claude
      // We use triple quotes for the outer shell command to preserve inner quotes
      const escapedSpeech = speech
        .replace(/'/g, "'\\''")  // Escape single quotes for shell
        .replace(/"/g, '\\"');   // Escape double quotes for shell
      
      const command = `echo 'claude "${escapedSpeech}"' | pbcopy`;
      await execPromise(command);
      console.log('Successfully sent command to clipboard');
      return true;
    } catch (error) {
      console.error('Error sending to Claude terminal:', error);
      
      // Fallback to clipboard copy based on OS
      try {
        let clipboardCmd;
        const platform = process.platform;
        
        // Properly escape quotes based on platform
        const escapedSpeech = speech
          .replace(/'/g, platform === 'win32' ? "'" : "'\\''")
          .replace(/"/g, platform === 'win32' ? '\\"' : '\\"');
        
        if (platform === 'darwin') {
          // macOS
          clipboardCmd = `echo 'claude "${escapedSpeech}"' | pbcopy`;
        } else if (platform === 'win32') {
          // Windows
          clipboardCmd = `echo claude "${escapedSpeech}" | clip`;
        } else if (platform === 'linux') {
          // Linux with xclip
          clipboardCmd = `echo 'claude "${escapedSpeech}"' | xclip -selection clipboard`;
        } else {
          throw new Error(`Unsupported platform: ${platform}`);
        }
        
        await execPromise(clipboardCmd);
        console.log(`Fallback clipboard command successful on ${platform}`);
        return true;
      } catch (clipboardError) {
        console.error('Clipboard fallback failed:', clipboardError);
        throw error; // Re-throw the original error
      }
    }
  } catch (error) {
    console.error('Error in _sendToClaudeTerminal:', error);
    return false;
  }
}

// Controller for handling AI-related operations
const aiController = {
  // Expose the _sendToClaudeTerminal function for direct use
  _sendToClaudeTerminal,
  
  // Get user context
  getUserContext: (callerNumber) => {
    return userContexts[callerNumber];
  },
  
  // Process speech input from Twilio or direct API calls
  processSpeechInput: async (req, res) => {
    // Get the speech from the request body
    const { speech, From, phone, callerNumber: reqCallerNumber, projectContext } = req.body;
    
    // Skip processing if no speech provided
    if (!speech || speech.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Speech input is required'
      });
    }

    // Standardize caller number format across different input sources
    const formattedCallerNumber = formatPhoneNumber(reqCallerNumber || phone || From || 'unknown');
    
    // Log the incoming speech request
    log.info(`[${formattedCallerNumber}] Received speech input: "${speech}"`);
    
    try {
      // Improve transcription and correct common errors
      const correctedSpeech = aiController.improveTranscription ? 
        aiController.improveTranscription(speech) : speech;
      
      // Initialize user context if not already present
      if (!userContexts[formattedCallerNumber]) {
        userContexts[formattedCallerNumber] = {
          currentProject: null,
          projectPath: process.cwd(),
          lastCommand: null,
          lastCommandTime: null
        };
      }
      
      // Track the user's command history
      userContexts[formattedCallerNumber].lastCommand = correctedSpeech;
      userContexts[formattedCallerNumber].lastCommandTime = new Date();
      
      // Get project path from context or user's current project
      const projectPath = projectContext?.path || userContexts[formattedCallerNumber].projectPath || process.cwd();
      const currentProject = projectContext?.name || userContexts[formattedCallerNumber].currentProject || null;
      
      log.info(`[${formattedCallerNumber}] Using project: ${currentProject || 'default'} at path: ${projectPath}`);
      
      // Check if directory exists
      if (!fs.existsSync(projectPath)) {
        log.info(`[Project ${currentProject || 'default'}] Directory does not exist: ${projectPath}`);
      }
      
      // ALWAYS use the overlay system for all voice commands - no direct CLI execution
      const overlayResult = await aiController.processOverlaySpeech(correctedSpeech, {
        path: projectPath,
        name: currentProject || 'gaana'
      });
      
      if (overlayResult.success) {
        log.info(`[${formattedCallerNumber}] Successfully processed with Claude Terminal Overlay`);
        return res.json(overlayResult);
      } else {
        // If overlay fails, return a helpful error message
        log.error(`[${formattedCallerNumber}] Overlay method failed: ${overlayResult.error}`);
        
        // Notify user about the failure
        await aiController.notifyUser(
          formattedCallerNumber,
          'processing_error',
          `🤯 Sorry, I couldn't process that: ${overlayResult.error}`
        );
        
        return res.json({
          success: true, // Mark as "success" to prevent Twilio freezing
          status: 'error_handled',
          method: 'overlay_failed',
          error: overlayResult.error,
          message: "I'm having trouble processing your command. Please try again."
        });
      }

    } catch (error) {
      log.error(`[${formattedCallerNumber}] Error processing speech:`, error);
      
      // Notify user about the error
      await aiController.notifyUser(
        formattedCallerNumber,
        'processing_error',
        `🤯 Sorry, I couldn't process that: ${error.message}`
      );
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Unknown error processing speech input'
      });
    }
  },
  
  // Confirm or reject a staged change
  confirmChange: async (req, res) => {
    try {
      const { changeId } = req.params;
      const { confirmed, callerNumber } = req.body;
      
      log.info(`Confirmation request for change ${changeId}, confirmed: ${confirmed}`);
      
      // Check if the change exists
      if (!stagedChanges[changeId]) {
        log.warn(`Change with ID ${changeId} not found`);
        return res.json({
          success: false,
          error: 'Change not found'
        });
      }
      
      const change = stagedChanges[changeId];
      
      // Update change status
      change.status = confirmed ? 'confirmed' : 'rejected';
      
      if (confirmed) {
        // Execute the change
        let result = null;
        
        try {
          if (change.action === 'code_modification') {
            result = await ClaudeService.executeCodeModification(change.details, change.projectPath);
            
            await aiController.notifyUser(
              change.callerNumber, 
              'action_success', 
              `✅ Code modification executed successfully: ${change.details.description || 'No description provided'}`
            );
          } else if (change.action === 'execute_command') {
            result = await aiController.executeCommand(change.details.command, change.projectPath);
            
            await aiController.notifyUser(
              change.callerNumber, 
              'action_success', 
              `✅ Command executed successfully: ${change.details.command}`
            );
          }
          
          // Store the result
          stagedChanges[changeId].result = result;
          stagedChanges[changeId].executedAt = new Date();
          
          return res.json({
            success: true,
            status: 'executed',
            result: result
          });
        } catch (error) {
          log.error(`Error executing confirmed change ${changeId}:`, error);
          
          // Update change status to failed
          stagedChanges[changeId].status = 'failed';
          stagedChanges[changeId].error = error.message;
          
          await aiController.notifyUser(
            change.callerNumber, 
            'action_error', 
            `❌ Error executing change: ${error.message}`
          );
          
          return res.json({
            success: false,
            status: 'execution_failed',
            error: error.message
          });
        }
      } else {
        // Change was rejected
        await aiController.notifyUser(
          change.callerNumber, 
          'action_rejected', 
          `🚫 The requested change has been rejected and will not be executed.`
        );
        
        return res.json({
          success: true,
          status: 'rejected'
        });
      }
    } catch (error) {
      log.error('Error confirming change:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // Renamed modifyCode to reflect its new role: executing a *planned* modification
  executeCodeModification: async (details, projectPath) => {
    try {
      const { operation, file, content } = details;
      log.info(`Executing code modification: ${operation} on ${file} in ${projectPath}`);
      const filePath = path.join(projectPath, file);
      
      let resultMessage;
      switch (operation) {
        case 'create':
          await fs.promises.writeFile(filePath, content || ''); // Ensure content is not undefined
          resultMessage = `File ${file} created successfully.`;
        break;
        case 'edit': // Overwrite for simplicity in this stage
          await fs.promises.writeFile(filePath, content || '');
          resultMessage = `File ${file} updated successfully.`;
        break;
        case 'delete':
          await fs.promises.unlink(filePath);
          resultMessage = `File ${file} deleted successfully.`;
          break;
        default:
          throw new Error(`Unsupported code operation: ${operation}`);
      }
      
      log.info(resultMessage);
      return resultMessage;
    } catch (error) {
      log.error('Error executing code modification:', error);
      throw new Error(`Code modification failed: ${error.message}`); // Re-throw for handling in confirmChange
    }
  },
  
  // Renamed executeCommand to reflect its new role: executing a *planned* command
  executeCommand: async (command, projectPath) => {
    try {
      log.info(`Executing command: ${command} in ${projectPath}`);
      // Ensure projectPath exists and is a directory (basic check)
      if (!fs.existsSync(projectPath) || !fs.lstatSync(projectPath).isDirectory()) {
        throw new Error(`Project path does not exist or is not a directory: ${projectPath}`);
      }
      
      // TODO: Add security checks here - validate the command against allowed patterns
      // Example: if (!command.startsWith('ls') && !command.startsWith('cat')) throw new Error('Command not allowed');
      
      const { stdout, stderr } = await execAsync(command, { cwd: projectPath });
      
      if (stderr) {
        log.warn(`Command execution produced stderr: ${stderr}`);
        // Decide if stderr should be treated as an error or just output
      }
      
      const result = stdout.trim();
      log.info(`Command executed. Output:
${result}`);
      return result || 'Command executed successfully (no output).';
    } catch (error) {
      log.error('Error executing command:', error);
      throw new Error(`Command execution failed: ${error.message}`); // Re-throw
    }
  },
  
  // List files in the current project directory
  listFiles: async (callerNumber) => {
    try {
      const projectDir = userContexts[callerNumber]?.currentProject || process.cwd();
      
      return new Promise((resolve, reject) => {
        exec('ls -la', { cwd: projectDir }, (error, stdout, stderr) => {
          if (error) {
            reject(`Error listing files: ${error.message}`);
            return;
          }
          resolve(`Files in ${projectDir}:\n${stdout}`);
        });
      });
    } catch (error) {
      console.error('Error listing files:', error);
      return `Error listing files: ${error.message}`;
    }
  },
  
  // Set the project directory for a specific caller
  setProjectDirectory: async (directory, callerNumber, req) => {
    const formattedCallerNumber = formatPhoneNumber(callerNumber);
    log.info(`[${formattedCallerNumber}] Attempting to set project directory based on input: "${directory}"`);
    
    try {
      let targetProjectName = directory || process.env.DEFAULT_PROJECT_NAME || 'default';
      let project = null;

      // Use projectController to find the project (handles DB/JSON fallback)
      project = await projectController.getProjectByName(targetProjectName, req); 

      if (project && project.path) {
        // Project found
        const fullPath = project.path; // Assuming path is resolved
        const projectName = project.name;
        log.info(`[${formattedCallerNumber}] Switching context to project: ${projectName} at ${fullPath}`);
        
        // Ensure user context exists
        if (!userContexts[formattedCallerNumber]) {
          userContexts[formattedCallerNumber] = {};
        }
      // Update user context
        userContexts[formattedCallerNumber].currentProject = fullPath;
        userContexts[formattedCallerNumber].projectName = projectName;
        // Reset potentially stale context info from previous project
        userContexts[formattedCallerNumber].lastCommand = null; 
        userContexts[formattedCallerNumber].commandHistory = []; 
        userContexts[formattedCallerNumber].conversationContext = []; 
      
      return {
        success: true,
        action: 'set_project',
          result: `Switched context to project: ${projectName}.`, 
        context: {
          currentProject: fullPath,
            projectName: projectName
          }
        };
      } else {
        // Project not found
        log.warn(`[${formattedCallerNumber}] Could not find project matching "${targetProjectName}" using projectController.`);
        return {
          success: false,
          error: `Could not find a project matching "${targetProjectName}". Please check the name.`,
          action: 'set_project_failed'
        };
      }
    } catch (error) {
      log.error(`[${formattedCallerNumber}] Error setting project directory:`, error);
      return {
        success: false,
        error: `An error occurred while trying to switch projects: ${error.message}`,
        action: 'set_project_error'
      };
    }
  },
  
  // Get current project information
  getCurrentProjectInfo: (callerNumber) => {
    const { projects, defaultProject } = getProjects();
    const project = projects.find(p => p.id === defaultProject) || projects.find(p => p.path === userContexts[callerNumber].currentProject);
    if (!project) {
      throw new Error('Project not found');
    }
    return {
      name: project.name,
      path: project.path,
      type: project.type
    };
  },
  
  // Notify user
  notifyUser: async (callerNumber, action, message) => {
    try {
      // Format caller number to E.164 format if not already
      const formattedNumber = formatPhoneNumber(callerNumber);
      
      // Truncate message if too long
      const maxMessageLength = 1500;
      let messageContent = typeof message === 'string' ? message : JSON.stringify(message);
      
      if (messageContent.length > maxMessageLength) {
        messageContent = messageContent.substring(0, maxMessageLength - 3) + '...';
      }
      
      // Format message based on action type
      const actionEmojis = {
        code_modification: '📝',
        execute_command: '⚡',
        set_project: '📁',
        list_files: '📋',
        project_info: 'ℹ️',
        error: '❌',
        no_action: '⚠️',
        staged_change: '⏳',
        action_success: '✅',
        action_rejected: '🚫',
        confirmation_error: '❓',
        list_files_result: '📋',
        set_project_result: '📁',
        config_error: '⚙️',
        processing_error: '🤯'
      };
      
      const emoji = actionEmojis[action] || '🤖';
      const formattedMessage = `${emoji} ${messageContent}`;
      
      // Print to terminal instead of sending SMS
      console.log('\n========== NOTIFICATION ==========');
      console.log(`TO: ${formattedNumber}`);
      console.log(`TYPE: ${action}`);
      console.log(`MESSAGE: ${formattedMessage}`);
      console.log('==================================\n');
      
      // Also log to file logger if available
      if (global.log && typeof global.log.info === 'function') {
        global.log.info(`[NOTIFICATION][${formattedNumber}][${action}] ${messageContent}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  },
  
  // Improved improveTranscription method
  improveTranscription: (speech) => {
    if (!speech) return speech;
     
    // Common transcription errors and their corrections
    const corrections = [
      { pattern: /ion syndication/i, replacement: "authentication" },
      { pattern: /brain classify/i, replacement: "brainClassify" },
      { pattern: /no chairs for frame cost/i, replacement: "for brainClassify" },
      { pattern: /claude terminal/i, replacement: "Claude terminal" },
      { pattern: /create fall/i, replacement: "create file" },
      { pattern: /modify fall/i, replacement: "modify file" },
      { pattern: /delete fall/i, replacement: "delete file" },
      { pattern: /node gs/i, replacement: "node.js" },
      { pattern: /non-interact/i, replacement: "non-interactive" },
      { pattern: /jason/i, replacement: "JSON" },
      { pattern: /python/i, replacement: "Python" },
      { pattern: /javascript/i, replacement: "JavaScript" },
      { pattern: /typescript/i, replacement: "TypeScript" },
      { pattern: /API/i, replacement: "API" },
      { pattern: /html/i, replacement: "HTML" },
      { pattern: /css/i, replacement: "CSS" },
      { pattern: /sql/i, replacement: "SQL" }
    ];
     
    let correctedSpeech = speech;
     
    // Apply corrections
    for (const correction of corrections) {
      correctedSpeech = correctedSpeech.replace(correction.pattern, correction.replacement);
    }
     
    // Fix "ion syndication and no chairs for frame cost" specific case
    if (speech.toLowerCase().includes('ion syndication') && 
        speech.toLowerCase().includes('no chairs for frame cost')) {
      correctedSpeech = "authentication for brainClassify";
    }
     
    // Handle quoted phrases (quote unquote)
    correctedSpeech = correctedSpeech.replace(/quote\s+unquote\s+([^,.!?;]+)/gi, (match, phrase) => {
      return `"${phrase.trim()}"`;
    });
     
    // Also handle "quote ... end quote" pattern
    correctedSpeech = correctedSpeech.replace(/quote\s+([^,.!?;]+)\s+(?:end quote|unquote)/gi, (match, phrase) => {
      return `"${phrase.trim()}"`;
    });
     
    // Handle single "quote" without explicit end
    correctedSpeech = correctedSpeech.replace(/quote\s+([^,.!?;]{3,})/gi, (match, phrase) => {
      return `"${phrase.trim()}"`;
    });
     
    return correctedSpeech;
  },
  
  // Process speech directly with Claude CLI 
  processDirectSpeech: async (speech, projectContext) => {
    if (!claudeDirectExecutor) {
      return { success: false, error: 'Claude Direct Executor not available' };
    }
    
    try {
      // Get project information
      const projectPath = projectContext?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
      const projectName = projectContext?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
      
      console.log(`Processing speech with Claude CLI: "${speech}" for project: ${projectName} at ${projectPath}`);
      
      // Format the command to include project context
      const formattedCommand = `For project ${projectName}, ${speech}`;
      
      // Execute the command using the direct executor
      const result = await claudeDirectExecutor.executeSpeechCommand(formattedCommand, projectPath);
      
      return {
        success: true,
        status: 'completed',
        result: result,
        provider: 'claude_cli'
      };
    } catch (error) {
      console.error('Error in processDirectSpeech:', error);
      return {
        success: false,
        error: error.message || 'Unknown error in Claude CLI processing'
      };
    }
  },
  
  // Process speech using the Claude terminal overlay
  processOverlaySpeech: async (speech, projectContext) => {
    if (!claudeTerminalOverlay) {
      return { success: false, error: 'Claude Terminal Overlay not available' };
    }
    
    try {
      // Get project information - use actual path from context instead of hardcoded values
      const projectPath = projectContext?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
      const projectName = projectContext?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
      
      // Determine which project to use for Claude terminal
      // Instead of using hardcoded identifier, pass the actual project path
      console.log(`Processing speech with Claude Terminal Overlay: "${speech}" (for project: ${projectName} at ${projectPath})`);
      
      // Use the speech verbatim - the overlay system will handle adding claude and changing directory
      // Always add auto-enter flag to ensure it works with prompts
      const formattedCommand = speech.includes('--auto-enter') ? speech.trim() : `${speech.trim()} --auto-enter`;
      
      // Pass the actual project path to the overlay system with auto-enter enabled
      const keyboardSuccess = await claudeTerminalOverlay.sendToClaudeTerminal(
        formattedCommand, 
        { name: projectName, path: projectPath },
        true  // Always enable auto-enter for voice commands
      );
      
      if (keyboardSuccess) {
        return {
          success: true,
          status: 'command_sent',
          method: 'keyboard_overlay',
          projectName: projectName,
          projectPath: projectPath,
          message: 'Command sent to Claude terminal successfully'
        };
      }
      
      // Fall back to clipboard method if keyboard method fails
      const clipboardSuccess = await claudeTerminalOverlay.clipboardToClaudeTerminal(
        formattedCommand,
        { name: projectName, path: projectPath },
        true  // Always enable auto-enter for clipboard method too
      );
      
      if (clipboardSuccess) {
        return {
          success: true,
          status: 'command_sent',
          method: 'clipboard_overlay',
          projectName: projectName,
          projectPath: projectPath,
          message: 'Command sent to Claude terminal via clipboard'
        };
      }
      
      // Both methods failed
      return {
        success: false,
        error: 'Failed to send command to Claude terminal via both methods'
      };
    } catch (error) {
      console.error('Error in processOverlaySpeech:', error);
      return {
        success: false,
        error: error.message || 'Unknown error in Claude terminal overlay processing'
      };
    }
  },
  
  // Utility function to respond with a voice message  
  respondWithVoice: async (res, message) => {
    // ... existing code ...
  },
};

/**
 * Get project-specific restrictions based on the project path
 * @param {string} projectPath - The project directory path
 * @returns {Object} - Project restrictions
 */
function getProjectRestrictions(projectPath) {
  // Default restrictions (no restrictions)
  const defaultRestrictions = {
    restricted: false,
    allowedPaths: [],
    allowedCommands: [
      'ls', 'ls -la', 'ls -l', 'ls *', 
      'find', 'find *', 
      'cat', 'cat *', 
      'grep', 'grep *',
      'node', 'node *',
      'npm', 'npm *',
      'git status', 'git diff', 'git log',
      'echo', 'echo *',
      'mkdir', 'touch'
    ],
    restrictedPatterns: [
      // File patterns to restrict
      '/.env', '/password', '/secret', '/token',
      // Command patterns to restrict
      'rm -rf', 'sudo', 'format', 'mkfs', 'dd', 'shutdown', 'reboot'
    ],
    message: '',
    preferredStyle: {}
  };

  try {
    // Read from environment variables first
    const restrictedProjects = (process.env.RESTRICTED_PROJECTS || '').split(',')
      .map(p => p.trim())
      .filter(Boolean);
    
    // Check if this project is in the restricted list
    const projectName = path.basename(projectPath);
    const isRestricted = restrictedProjects.some(rp => 
      projectPath.includes(rp) || projectName === rp
    );
    
    if (isRestricted) {
      return {
        restricted: true,
        // These paths can be configured in .env as ALLOWED_PATHS_{projectName}
        allowedPaths: (process.env[`ALLOWED_PATHS_${projectName.toUpperCase()}`] || 'test,docs,examples')
          .split(',').map(p => p.trim()).filter(Boolean),
        // These commands can be configured in .env as ALLOWED_COMMANDS_{projectName}
        allowedCommands: (process.env[`ALLOWED_COMMANDS_${projectName.toUpperCase()}`] || 'ls,git status,npm test')
          .split(',').map(c => c.trim()).filter(Boolean),
        restrictedPatterns: defaultRestrictions.restrictedPatterns,
        message: `This project has restricted access. You may only modify files in test, docs, or examples directories.`,
        preferredStyle: {}
      };
    }
    
    // Check for project-specific config file for more detailed restrictions
    const configPath = path.join(projectPath, '.claude-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return {
          restricted: config.restricted || false,
          allowedPaths: config.allowedPaths || defaultRestrictions.allowedPaths,
          allowedCommands: config.allowedCommands || defaultRestrictions.allowedCommands,
          restrictedPatterns: config.restrictedPatterns || defaultRestrictions.restrictedPatterns,
          message: config.message || '',
          preferredStyle: config.preferredStyle || {}
        };
      } catch (e) {
        console.error('Error reading project config:', e);
      }
    }
    
    return defaultRestrictions;
  } catch (error) {
    console.error('Error determining project restrictions:', error);
    return defaultRestrictions;
  }
}

// Add new helper function to load projects config with project numbers
const getProjectsConfig = () => {
  try {
    const configPath = path.join(process.env.PROJECTS_DIRECTORY || path.join(__dirname, '..', 'projects'), 'projects_config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } else {
      console.log('Projects config file not found at:', configPath);
      return { projects: {}, projectsByNumber: {} };
    }
  } catch (error) {
    console.error('Error loading projects config:', error.message);
    return { projects: {}, projectsByNumber: {} };
  }
};

// Add project selection logic to the processSpeech function
async function processSpeech(req, res) {
  try {
    const { speech, phone, force, autoExecute } = req.body;
    
    if (!speech || speech.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Speech input is required'
      });
    }
    
    // Standardize the phone number format
    const callerNumber = formatPhoneNumber(phone || req.body.From || 'unknown');
    
    console.log(`[${callerNumber}] Received speech input: "${speech}"`);
    
    // Check if this is a project selection command (matches "project NUMBER" or "number NUMBER")
    const projectSelectionMatch = speech.toLowerCase().match(/(?:project|number)\s+(\d+)/i);
    if (projectSelectionMatch) {
      const projectNumber = projectSelectionMatch[1];
      const projectsConfig = getProjectsConfig();
      
      const projectName = projectsConfig.projectsByNumber[projectNumber];
      if (!projectName) {
        // Project number not found
        return res.json({
          success: true,
          result: `Project ${projectNumber} not found. Available projects: ${Object.keys(projectsConfig.projectsByNumber).join(', ')}`,
          action: "speak"
        });
      }
      
      const project = projectsConfig.projects[projectName];
      if (!project || !project.path) {
        return res.json({
          success: true,
          result: `Project ${projectNumber} (${projectName}) configuration is incomplete or invalid.`,
          action: "speak"
        });
      }
      
      // Store the selected project in the conversationState
      const callerState = conversationState[callerNumber] || {};
      conversationState[callerNumber] = {
        ...callerState,
        projectNumber: projectNumber,
        projectName: projectName,
        projectPath: project.path,
        awaitingCommand: true,
        lastCommandTime: Date.now()
      };
      
      console.log(`Selected project ${projectNumber} (${projectName}) for caller ${callerNumber}`);
      
      return res.json({
        success: true,
        result: `Project ${projectNumber} (${projectName}) selected. What would you like me to do?`,
        action: "speak",
        projectSelected: {
          number: projectNumber,
          name: projectName,
          path: project.path
        }
      });
    }
    
    // Check if the caller has a selected project in state
    const callerState = conversationState[callerNumber];
    let projectPath = null;
    let projectContext = null;
    
    if (callerState && callerState.projectPath) {
      // If the last command was within 5 minutes, assume we're still in the same project context
      const timeSinceLastCommand = Date.now() - (callerState.lastCommandTime || 0);
      if (timeSinceLastCommand < 5 * 60 * 1000) { // 5 minutes
        projectPath = callerState.projectPath;
        projectContext = `For project "${callerState.projectName}" at path "${projectPath}": `;
        
        // Update last command time
        callerState.lastCommandTime = Date.now();
        
        console.log(`Using selected project context: ${callerState.projectName} at ${projectPath}`);
      } else {
        // Context has expired, clear it
        delete conversationState[callerNumber];
        console.log(`Project context expired for caller ${callerNumber}`);
      }
    }
    
    // If no project is selected, ask the user to select one first
    if (!projectPath) {
      // Get available projects
      const projectsConfig = getProjectsConfig();
      const availableProjects = Object.keys(projectsConfig.projectsByNumber)
        .map(number => `Project ${number}: ${projectsConfig.projectsByNumber[number]}`)
        .join(', ');
      
      return res.json({
        success: true,
        result: `Please select a project number first. Available projects: ${availableProjects}`,
        action: "speak",
        requireProjectSelection: true,
        availableProjects: projectsConfig.projectsByNumber
      });
    }

    // Continue with normal processing using the project context
    // ...
    
    // The rest of your existing processSpeech function...

    // When you execute Claude, prefix the command with the project context
    const result = await _sendToClaudeTerminal(
      projectContext + speech,
      callerNumber
    );

    // Return the result
    return res.json({
      success: true,
      result,
      action: "speak"
    });
    
  } catch (error) {
    console.error('Error processing speech:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Export the controller object which contains all the methods
module.exports = aiController;