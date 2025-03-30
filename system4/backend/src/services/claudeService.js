const claudeConfig = require('../config/claude');
const logger = require('electron-log');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const util = require('util');

// Promisify exec for async/await usage
const execAsync = util.promisify(exec);

/**
 * Claude Service
 * Handles interactions with Claude AI for code generation and modification
 * with enhanced support for Model Context Protocol
 */
class ClaudeService {
  /**
   * Process code modification request using Claude
   * @param {string} request - The user request
   * @param {Object} context - Context information about the project
   * @returns {Promise<Object>} - Result of the code operation
   */
  static async processCodeRequest(request, context) {
    try {
      logger.info('Processing code request with Claude:', request);
      
      // Validate context information
      if (!context.workingDir) {
        context.workingDir = process.env.GAANA_PROJECT_PATH || process.cwd();
        logger.info(`Using default working directory: ${context.workingDir}`);
      }
      
      // Check if this is from a voice command
      const isVoiceCommand = context.isVoiceCommand || request.includes('Original voice command:');
      
      // Build a detailed context object with file system information
      const enhancedContext = await this.buildCodeContext(context);
      
      // Apply security settings
      if (isVoiceCommand) {
        logger.info('Voice command detected - applying security measures');
        enhancedContext.isVoiceCommand = true;
      }
      
      // Execute the code task using Claude's API
      logger.info('Calling Claude API for code execution');
      const response = await claudeConfig.executeCodeTask(request, enhancedContext);
      
      // Process the response and execute any tool calls
      const result = await this.handleToolCalls(response, enhancedContext);
      
      return {
        success: true,
        result,
        message: result.message || 'Code operation completed successfully'
      };
    } catch (error) {
      logger.error('Error processing code request with Claude:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process code request with Claude'
      };
    }
  }
  
  /**
   * Build detailed code context for Claude
   * @param {Object} context - Base context information
   * @returns {Promise<Object>} - Enhanced context with filesystem information
   */
  static async buildCodeContext(context) {
    try {
      const workingDir = context.workingDir;
      
      // Get directory listing safely
      let fileList = [];
      try {
        const { stdout } = await execAsync(
          `find "${workingDir}" -type f -not -path "*/node_modules/*" -not -path "*/\\.*" | head -n 50`,
          { cwd: workingDir, timeout: 5000 }
        );
        fileList = stdout.split('\n').filter(f => f.trim());
      } catch (err) {
        logger.warn('Error getting file list:', err);
      }
      
      // Get directory structure
      let dirStructure = [];
      try {
        const { stdout } = await execAsync(
          `find "${workingDir}" -type d -not -path "*/node_modules/*" -not -path "*/\\.*" | head -n 20`,
          { cwd: workingDir, timeout: 5000 }
        );
        dirStructure = stdout.split('\n').filter(d => d.trim());
      } catch (err) {
        logger.warn('Error getting directory structure:', err);
      }
      
      // Check for package.json to identify project type
      let dependencies = {};
      let projectType = 'unknown';
      const packageJsonPath = path.join(workingDir, 'package.json');
      
      if (fsSync.existsSync(packageJsonPath)) {
        try {
          const packageData = await fs.readFile(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageData);
          dependencies = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
          };
          
          // Determine project type from dependencies
          if (dependencies.express) projectType = 'express';
          else if (dependencies.react) projectType = 'react';
          else if (dependencies.electron) projectType = 'electron';
          else if (dependencies.next) projectType = 'nextjs';
          else projectType = 'node';
        } catch (err) {
          logger.warn('Error parsing package.json:', err);
        }
      }
      
      // Return enhanced context
      return {
        projectName: context.projectName || path.basename(workingDir),
        projectPath: workingDir,
        workingDir,
        fileList,
        dirStructure,
        dependencies,
        projectType,
        allowedCommands: process.env.CLAUDE_ALLOWED_COMMANDS?.split(','),
        isVoiceCommand: context.isVoiceCommand || false,
        // Include caller info if available
        callerNumber: context.callerNumber
      };
    } catch (error) {
      logger.error('Error building code context:', error);
      // Return simplified context if enhancement fails
      return {
        projectName: context.projectName || 'Unknown Project',
        projectPath: context.workingDir || process.cwd(),
        workingDir: context.workingDir || process.cwd(),
        isVoiceCommand: context.isVoiceCommand || false,
        callerNumber: context.callerNumber
      };
    }
  }
  
  /**
   * Handle tool calls from Claude's response
   * @param {Object} response - Claude API response with tool calls
   * @param {Object} context - Enhanced context
   * @returns {Promise<Object>} - Results of executed tools
   */
  static async handleToolCalls(response, context) {
    if (!response || !response.success) {
      return { success: false, message: response?.error || 'Invalid Claude response' };
    }
    
    // Extract the message content
    const message = response.message || '';
    
    // Get tool calls
    const toolCalls = response.toolCalls || [];
    if (toolCalls.length === 0) {
      return { success: true, message, actions: [] };
    }
    
    logger.info(`Processing ${toolCalls.length} tool calls from Claude`);
    
    // Execute each tool call
    const results = [];
    for (const tool of toolCalls) {
      try {
        let result;
        switch (tool.name) {
          case 'execute_code':
            result = await this.executeCode(tool.input.language, tool.input.code, context.workingDir);
            break;
            
          case 'execute_shell':
            result = await this.executeShellCommand(tool.input.command, tool.input.cwd || context.workingDir);
            break;
            
          case 'modify_file':
            result = await this.handleFileOperation(tool.input, context.workingDir);
            break;
            
          default:
            result = { success: false, error: `Unknown tool: ${tool.name}` };
        }
        
        results.push({
          tool: tool.name,
          input: tool.input,
          result
        });
      } catch (error) {
        logger.error(`Error executing tool ${tool.name}:`, error);
        results.push({
          tool: tool.name,
          input: tool.input,
          result: { success: false, error: error.message }
        });
      }
    }
    
    return {
      success: true,
      message,
      actions: results
    };
  }
  
  /**
   * Execute code in the specified language
   * @param {string} language - Programming language
   * @param {string} code - Code to execute
   * @param {string} workingDir - Working directory
   * @returns {Promise<Object>} - Execution result
   */
  static async executeCode(language, code, workingDir) {
    logger.info(`Executing ${language} code`);
    
    // Define execution configurations for different languages
    const executors = {
      javascript: { 
        command: 'node',
        tempExt: '.js',
        interpreter: true
      },
      typescript: {
        command: 'npx ts-node',
        tempExt: '.ts',
        interpreter: true
      },
      python: {
        command: 'python',
        tempExt: '.py',
        interpreter: true
      },
      shell: {
        command: 'bash',
        tempExt: '.sh',
        interpreter: true
      },
      bash: {
        command: 'bash',
        tempExt: '.sh',
        interpreter: true
      },
      node: {
        command: 'node',
        tempExt: '.js',
        interpreter: true
      }
    };
    
    try {
      // Normalize language
      const lang = language.toLowerCase();
      
      // Check if language is supported
      if (!executors[lang]) {
        return { 
          success: false, 
          error: `Unsupported language: ${language}`,
          output: `The language "${language}" is not supported for execution.`
        };
      }
      
      // Create temporary file with the code
      const executor = executors[lang];
      const timestamp = Date.now();
      const tempDir = path.join(workingDir, 'temp');
      const tempFilename = `claude_exec_${timestamp}${executor.tempExt}`;
      const tempPath = path.join(tempDir, tempFilename);
      
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write code to temporary file
      await fs.writeFile(tempPath, code);
      
      // Build execution command
      let command;
      if (executor.interpreter) {
        command = `cd "${workingDir}" && ${executor.command} "${tempPath}"`;
      } else {
        command = `cd "${workingDir}" && ${executor.command}`;
      }
      
      // Execute the code with a timeout
      const { stdout, stderr } = await execAsync(command, { 
        timeout: parseInt(process.env.CLAUDE_CODE_TIMEOUT || '30000', 10),
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return {
        success: true,
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        exit_code: 0
      };
    } catch (error) {
      logger.error(`Error executing ${language} code:`, error);
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        exit_code: error.code || 1
      };
    }
  }
  
  /**
   * Execute a shell command
   * @param {string} command - Shell command to execute
   * @param {string} cwd - Working directory
   * @returns {Promise<Object>} - Execution result
   */
  static async executeShellCommand(command, cwd) {
    logger.info(`Executing shell command: ${command}`);
    
    // Validate command against allowed commands
    const allowedCommands = process.env.CLAUDE_ALLOWED_COMMANDS?.split(',') || [];
    if (allowedCommands.length > 0) {
      const allowed = allowedCommands.some(allowed => {
        // Check if command starts with an allowed command pattern
        const isAllowed = command.trim().startsWith(allowed) || 
                         // Check for command pattern with wildcard
                         (allowed.endsWith(':*') && command.trim().startsWith(allowed.slice(0, -2)));
        return isAllowed;
      });
      
      if (!allowed) {
        logger.warn(`Command not allowed: ${command}`);
        return {
          success: false,
          error: 'Command not allowed for security reasons',
          stdout: '',
          stderr: `The command "${command}" is not in the list of allowed commands.`,
          exit_code: 1
        };
      }
    }
    
    try {
      // Execute command with timeout
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: parseInt(process.env.CLAUDE_CODE_TIMEOUT || '30000', 10),
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return {
        success: true,
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        exit_code: 0
      };
    } catch (error) {
      logger.error(`Error executing shell command:`, error);
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        exit_code: error.code || 1
      };
    }
  }
  
  /**
   * Handle file operations (create, modify, delete, read)
   * @param {Object} input - File operation details
   * @param {string} workingDir - Working directory
   * @returns {Promise<Object>} - Operation result
   */
  static async handleFileOperation(input, workingDir) {
    const { path: filePath, operation, content } = input;
    const absolutePath = path.resolve(workingDir, filePath);
    
    // Security check: Ensure file is within working directory
    if (!absolutePath.startsWith(workingDir)) {
      return {
        success: false,
        error: 'Security violation: Cannot access files outside the working directory'
      };
    }
    
    logger.info(`File operation: ${operation} on ${filePath}`);
    
    try {
      switch (operation) {
        case 'read':
          try {
            const data = await fs.readFile(absolutePath, 'utf8');
            return {
              success: true,
              content: data
            };
          } catch (err) {
            return {
              success: false,
              error: `Failed to read file: ${err.message}`
            };
          }
          
        case 'create':
          // Ensure directory exists
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          // Write file
          await fs.writeFile(absolutePath, content || '');
          return {
            success: true,
            message: `File created: ${filePath}`
          };
          
        case 'modify':
          if (!content) {
            return {
              success: false,
              error: 'No content provided for file modification'
            };
          }
          
          // Check if file exists
          try {
            await fs.access(absolutePath);
          } catch (err) {
            return {
              success: false,
              error: `File does not exist: ${filePath}`
            };
          }
          
          // Modify file
          await fs.writeFile(absolutePath, content);
          return {
            success: true,
            message: `File modified: ${filePath}`
          };
          
        case 'delete':
          // Check if file exists
          try {
            await fs.access(absolutePath);
          } catch (err) {
            return {
              success: false,
              error: `File does not exist: ${filePath}`
            };
          }
          
          // Delete file
          await fs.unlink(absolutePath);
          return {
            success: true,
            message: `File deleted: ${filePath}`
          };
          
        default:
          return {
            success: false,
            error: `Unsupported file operation: ${operation}`
          };
      }
    } catch (error) {
      logger.error(`Error in file operation:`, error);
      return {
        success: false,
        error: `File operation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Process a speech command using Claude
   * @param {string} speechText - The speech command to process
   * @param {Object} options - Additional options for processing
   * @returns {Promise<Object>} - The result of processing
   */
  static async processSpeechCommand(speechText, options = {}) {
    try {
      const { projectPath, projectName, userContext = {}, mode = 'default', autoConfirm = false } = options;
      
      // Log full context for debugging
      logger.info(`Processing speech command with context:`, 
        JSON.stringify({
          projectPath,
          projectName,
          mode,
          autoConfirm
        })
      );
      
      // Get the current working directory
      const workingDir = projectPath || process.cwd();
      
      logger.info(`Processing speech command: "${speechText}" in directory: ${workingDir}`);
      
      // Determine if this is a code-related task from the speech content
      const isCodeTask = /implement|create|modify|update|add|fix|change|refactor|optimize|improve|code|file|directory/i.test(speechText);
      
      // Log the task type
      logger.info(`Task type determined as: ${isCodeTask ? 'code task' : 'general query'}`);
      
      // If using the Claude CLI, pass the command directly
      if (process.env.USE_CLAUDE_CLI === 'true') {
        // Always use the project path for the working directory
        const cliOptions = {
          projectName: projectName || path.basename(workingDir),
          autoConfirm,
          isCodeTask,
          mode
        };
        
        return await claudeConfig.executeSpeechCommand(speechText, workingDir, cliOptions);
      } else {
        // Otherwise use the API model
        const contextForTask = {
          projectName: projectName || path.basename(workingDir),
          workingDir,
          isVoiceCommand: true,
          autoConfirm,
          ...userContext
        };
        
        logger.info(`Using API model with context:`, JSON.stringify(contextForTask));
        const result = await claudeConfig.executeCodeTask(speechText, contextForTask);
        
        return result;
      }
    } catch (error) {
      logger.error('Error processing speech command:', error);
      return {
        success: false,
        error: error.message,
        message: "I couldn't process your voice command due to a technical issue. Please try again."
      };
    }
  }
  
  /**
   * Check if Claude is available
   * @returns {Promise<boolean>} - Whether Claude is available
   */
  static async isAvailable() {
    return await claudeConfig.isAvailable();
  }
}

// Log the path for easier imports
console.log('Loaded Claude service from:', __filename);

module.exports = ClaudeService;

// Add function to get project numbers from the config
async function getProjectNumbers() {
  try {
    const configPath = path.join(process.env.PROJECTS_DIRECTORY || path.join(__dirname, '..', '..', '..', 'projects'), 'projects_config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      return {
        projects: config.projects || {},
        projectsByNumber: config.projectsByNumber || {}
      };
    }
    
    return {
      projects: {},
      projectsByNumber: {}
    };
  } catch (error) {
    console.error(`Error getting project numbers: ${error.message}`);
    return {
      projects: {},
      projectsByNumber: {}
    };
  }
}

// Add a method to check for project selection commands
async function processProjectSelection(speech) {
  const projectSelectionMatch = speech.toLowerCase().match(/(?:project|number|use project|select project|work on project|use number)\s+(\d+)/i);
  
  if (projectSelectionMatch) {
    const projectNumber = projectSelectionMatch[1];
    const { projectsByNumber, projects } = await getProjectNumbers();
    
    const projectName = projectsByNumber[projectNumber];
    
    if (!projectName) {
      // Project number not found
      const availableProjects = Object.keys(projectsByNumber)
        .map(num => `${num}: ${projectsByNumber[num]}`)
        .join(', ');
      
      return {
        isProjectSelection: true,
        success: false,
        message: `Project ${projectNumber} not found. Available projects: ${availableProjects || 'none'}`
      };
    }
    
    const project = projects[projectName];
    
    if (!project || !project.path) {
      return {
        isProjectSelection: true,
        success: false,
        message: `Project ${projectNumber} (${projectName}) configuration is invalid or incomplete.`
      };
    }
    
    // Project is valid, return the information
    return {
      isProjectSelection: true,
      success: true,
      projectNumber,
      projectName,
      projectPath: project.path,
      message: `Project ${projectNumber} (${projectName}) selected. What would you like me to do?`
    };
  }
  
  return {
    isProjectSelection: false
  };
}

// Add a method to verify a project is selected or prompt for selection
async function ensureProjectSelected(context) {
  if (context && context.projectPath) {
    return {
      hasProject: true,
      projectPath: context.projectPath,
      projectName: context.projectName,
      projectNumber: context.projectNumber
    };
  }
  
  // No project selected, prompt user to select one
  const { projectsByNumber } = await getProjectNumbers();
  
  const availableProjects = Object.keys(projectsByNumber)
    .map(num => `${num}: ${projectsByNumber[num]}`)
    .join(', ');
  
  return {
    hasProject: false,
    message: `Please select a project first by saying "project NUMBER" or "use project NUMBER". Available projects: ${availableProjects || 'none'}`
  };
} 