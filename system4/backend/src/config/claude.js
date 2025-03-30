/**
 * Claude Drop-in Replacement
 * 
 * This file is a direct drop-in replacement for the claude.js file in the parent project.
 * It exports a function that has the same signature as the original executeSpeechCommand
 * but uses our reliable direct executor to ensure that Claude CLI commands work correctly.
 * 
 * To use this:
 * 1. Copy this file to /Users/kousthubhveturi/Desktop/gaana/backend/src/config/claude.js
 * 2. Or require this file in the original claude.js and replace the executeSpeechCommand function
 */

const path = require('path');
const fs = require('fs');
const { executeSpeechCommand: directExecutor } = require(path.join(__dirname, 'claude_direct_executor'));
const log = require('electron-log');

// Conversation state storage
const conversationState = {};

// Function to get current project configuration
async function getCurrentProjects() {
  try {
    const configPath = path.join('/Users/kousthubhveturi/Desktop/gaana/projects', 'projects_config.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } else {
      // If config doesn't exist, try to reach the project server API
      try {
        const response = await fetch('http://localhost:5001/api/projects');
        const data = await response.json();
        if (data.success) {
          return {
            projects: data.projects.reduce((acc, project) => {
              acc[project.name] = {
                ...project,
                number: project.number || 0
              };
              return acc;
            }, {}),
            projectsByNumber: data.projects.reduce((acc, project) => {
              const number = project.number || 0;
              if (number > 0) {
                acc[number.toString()] = project.name;
              }
              return acc;
            }, {})
          };
        }
      } catch (error) {
        log.error(`[claude_dropin] Error fetching projects: ${error.message}`);
      }
      
      // Fallback to a minimal config with just brainClassify
      return {
        projects: {
          'brainClassify': {
            name: 'brainClassify',
            path: '/Users/kousthubhveturi/Desktop/gaana/projects/brainClassify',
            number: 1
          }
        },
        projectsByNumber: {
          '1': 'brainClassify'
        }
      };
    }
  } catch (error) {
    log.error(`[claude_dropin] Error loading projects: ${error.message}`);
    return null;
  }
}

/**
 * Determine if a command should be executed in non-interactive mode
 * @param {string} command - The command text
 * @returns {boolean} - True if non-interactive is appropriate
 */
function shouldUseNonInteractive(command) {
  const nonInteractiveKeywords = [
    'implement',
    'create',
    'write',
    'modify',
    'fix',
    'update',
    'add',
    'non-interactive',
    'make',
    'build',
    'transform',
    'convert',
    'change',
    'improve',
    'refactor'
  ];
  
  const commandLower = command.toLowerCase();
  
  // Check for keyword matches
  return nonInteractiveKeywords.some(keyword => 
    commandLower.includes(keyword) &&
    // Exclude simple information queries
    !commandLower.includes('how do i') &&
    !commandLower.includes('what is') &&
    !commandLower.includes('explain')
  );
}

/**
 * Extract project context from a command if it includes one
 * @param {string} command - The command text
 * @param {object} projectsConfig - The projects configuration
 * @returns {object|null} - Project context or null if not found
 */
function extractProjectContext(command, projectsConfig) {
  // Check for project number format: "project 1" or "for project 1" or "number 1"
  const projectNumberMatch = command.match(/(?:for\s+)?project\s+(\d+)/i) || 
                            command.match(/(?:for\s+)?number\s+(\d+)/i) ||
                            command.match(/project\s+number\s+(\d+)/i);
  
  if (projectNumberMatch) {
    const projectNumber = projectNumberMatch[1];
    const projectName = projectsConfig.projectsByNumber[projectNumber];
    
    if (projectName) {
      return projectsConfig.projects[projectName];
    }
  }
  
  // Check for project name format: "project name" or "for project name"
  const projectNameMatch = command.match(/for\s+project\s+["']?([a-zA-Z0-9_\-]+)["']?/i) || 
                          command.match(/project\s+["']?([a-zA-Z0-9_\-]+)["']?/i);
  
  if (projectNameMatch) {
    const projectIdentifier = projectNameMatch[1];
    
    // Check if it's a project name
    if (projectsConfig.projects[projectIdentifier]) {
      return projectsConfig.projects[projectIdentifier];
    }
    
    // Check for partial match in project names
    const projectNames = Object.keys(projectsConfig.projects);
    for (const name of projectNames) {
      if (name.toLowerCase().includes(projectIdentifier.toLowerCase())) {
        return projectsConfig.projects[name];
      }
    }
  }
  
  return null;
}

// This function has the same signature as the original executeSpeechCommand
// and can be used as a direct replacement
async function executeSpeechCommand(command, workingDir, options = {}) {
  try {
    // Get the user ID from options or use a default (phone number for voice calls)
    const userId = options.userId || options.phone || 'default';
    
    // Log the incoming command
    log.info(`[claude_dropin] Executing command for user ${userId}: "${command}"`);
    
    // Load project configuration
    const projectsConfig = await getCurrentProjects();
    if (!projectsConfig) {
      throw new Error('Failed to load project configuration');
    }
    
    // Handle explicit project selection commands (e.g., "project 1" or "number 2")
    if (command.toLowerCase().match(/^(project|number)\s+\d+$/i)) {
      // This is a project selection command
      const projectMatch = command.match(/(?:project|number)\s+(\d+)/i);
      if (projectMatch) {
        const projectNumber = projectMatch[1];
        const projectName = projectsConfig.projectsByNumber[projectNumber];
        
        if (!projectName) {
          return `Project ${projectNumber} not found. Available projects: ${Object.keys(projectsConfig.projectsByNumber).map(num => `${num} (${projectsConfig.projectsByNumber[num]})`).join(', ')}`;
        }
        
        const project = projectsConfig.projects[projectName];
        
        // Store the selected project in the conversation state
        conversationState[userId] = {
          projectNumber: projectNumber,
          projectName: projectName,
          projectPath: project.path,
          awaitingCommand: true,
          lastCommandTime: Date.now()
        };
        
        log.info(`[claude_dropin] Selected project ${projectNumber}: ${projectName} at ${project.path}`);
        
        return `Project ${projectNumber} (${projectName}) selected. What would you like Claude to do?`;
      }
    }
    
    // Try to extract project context from the command
    const projectContext = extractProjectContext(command, projectsConfig);
    
    // Check if we're in a project context from previous commands
    let selectedWorkingDir = workingDir;
    if (conversationState[userId] && conversationState[userId].awaitingCommand) {
      const { projectNumber, projectName, projectPath } = conversationState[userId];
      
      // Clear the awaiting flag so next command isn't automatically in this context
      conversationState[userId].awaitingCommand = false;
      
      // Check if the project directory exists
      if (fs.existsSync(projectPath)) {
        selectedWorkingDir = projectPath;
        log.info(`[claude_dropin] Using project directory from state: ${selectedWorkingDir}`);
      } else {
        log.warn(`[claude_dropin] Project path not found: ${projectPath}, falling back to default`);
        
        // Try using link in projects directory
        const projectLink = path.join('/Users/kousthubhveturi/Desktop/gaana/projects', `project${projectNumber}`);
        
        if (fs.existsSync(projectLink)) {
          selectedWorkingDir = projectLink;
          log.info(`[claude_dropin] Using project link: ${selectedWorkingDir}`);
        } else {
          // Fallback to brainClassify
          const brainClassifyPath = '/Users/kousthubhveturi/Desktop/gaana/projects/brainClassify';
          if (fs.existsSync(brainClassifyPath)) {
            selectedWorkingDir = brainClassifyPath;
            log.info(`[claude_dropin] Falling back to brainClassify: ${selectedWorkingDir}`);
          }
        }
      }
    } else if (projectContext) {
      // Use the project path from the command
      const projectPath = projectContext.path;
      
      if (fs.existsSync(projectPath)) {
        selectedWorkingDir = projectPath;
        log.info(`[claude_dropin] Using project path from command: ${selectedWorkingDir}`);
        
        // Update conversation state
        conversationState[userId] = {
          projectNumber: projectContext.number,
          projectName: projectContext.name,
          projectPath: projectPath,
          awaitingCommand: false,
          lastCommandTime: Date.now()
        };
      }
    }
    
    // Determine if this should be non-interactive mode
    const useNonInteractive = shouldUseNonInteractive(command);
    if (useNonInteractive) {
      log.info(`[claude_dropin] Using non-interactive mode for command: "${command}"`);
      options.nonInteractive = true;
    }
    
    // Execute the command using our reliable executor
    log.info(`[claude_dropin] Executing command using directExecutor with directory: ${selectedWorkingDir}`);
    const result = await directExecutor(command, selectedWorkingDir, options);
    return result;
  } catch (error) {
    log.error(`[claude_dropin] Error: ${error.message}`);
    throw error;
  }
}

// Export the function
module.exports = {
  executeSpeechCommand
};

// If this file is executed directly, show usage info
if (require.main === module) {
  console.log('This is a drop-in replacement for claude.js');
  console.log('To use this, either:');
  console.log('1. Copy this file to /Users/kousthubhveturi/Desktop/gaana/backend/src/config/claude.js');
  console.log('2. Or require this file in the original claude.js and replace the executeSpeechCommand function');
}