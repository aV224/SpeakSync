/**
 * Setup Claude Environment
 * 
 * This script sets up the environment for Claude Code CLI usage
 * Creates necessary directories and validates configurations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Configuration
const config = {
  // Where to store temporary files for Claude tasks
  tempDir: process.env.TEMP_DIR || path.join(os.tmpdir(), 'claude-tasks'),
  
  // Where to store logs
  logsDir: process.env.CLAUDE_LOGS_DIR || path.join(__dirname, '..', 'logs'),
  
  // Claude CLI path
  claudePath: process.env.CLAUDE_CLI_PATH || '/opt/homebrew/bin/claude',
  
  // Projects directory
  projectsDir: process.env.GAANA_PROJECTS_DIR || path.join(__dirname, '..', 'projects')
};

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Path to directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
}

/**
 * Check if Claude CLI is installed
 */
function checkClaudeCLI() {
  try {
    const output = execSync(`"${config.claudePath}" --version`).toString().trim();
    console.log(`Claude CLI found: ${output}`);
    return true;
  } catch (error) {
    console.error(`Claude CLI not found at path: ${config.claudePath}`);
    console.error('Please install Claude CLI or set CLAUDE_CLI_PATH environment variable');
    return false;
  }
}

/**
 * Ensure all projects directories exist
 */
function checkProjectsDirectories() {
  if (!fs.existsSync(config.projectsDir)) {
    console.warn(`Projects directory not found: ${config.projectsDir}`);
    console.warn('Creating projects directory structure');
    
    ensureDirectoryExists(config.projectsDir);
    
    // Create sample project directory
    const sampleProjectDir = path.join(config.projectsDir, 'sample');
    ensureDirectoryExists(sampleProjectDir);
    
    // Create a README file in the sample project
    fs.writeFileSync(
      path.join(sampleProjectDir, 'README.md'),
      '# Sample Project\n\nThis is a sample project for Gaana voice commands.'
    );
  } else {
    console.log(`Projects directory exists: ${config.projectsDir}`);
    
    // List existing projects
    const projects = fs.readdirSync(config.projectsDir)
      .filter(item => fs.statSync(path.join(config.projectsDir, item)).isDirectory());
    
    console.log('Available projects:');
    projects.forEach(project => {
      console.log(`- ${project}`);
    });
  }
}

/**
 * Setup environment variables if not already set
 */
function setupEnvironmentVariables() {
  // Create a .env.local file if it doesn't exist
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  
  if (!fs.existsSync(envLocalPath)) {
    console.log(`Creating .env.local file: ${envLocalPath}`);
    
    const envContent = `
# Claude Environment Variables - Created by setup-claude-env.js
TEMP_DIR="${config.tempDir}"
CLAUDE_LOGS_DIR="${config.logsDir}"
CLAUDE_CLI_PATH="${config.claudePath}"
GAANA_PROJECTS_DIR="${config.projectsDir}"
USE_CLAUDE_CLI=true
CLAUDE_ALLOWED_COMMANDS=ls,git status,git log,npm test,node,find,grep
`;
    
    fs.writeFileSync(envLocalPath, envContent);
    console.log('Created .env.local file with default settings');
  } else {
    console.log('.env.local file already exists');
  }
}

/**
 * Main function to setup Claude environment
 */
function setupClaudeEnvironment() {
  console.log('Setting up Claude environment...');
  
  // Ensure directories exist
  ensureDirectoryExists(config.tempDir);
  ensureDirectoryExists(config.logsDir);
  
  // Check Claude CLI
  const claudeInstalled = checkClaudeCLI();
  
  // Check projects directories
  checkProjectsDirectories();
  
  // Setup environment variables
  setupEnvironmentVariables();
  
  console.log('\nClaude environment setup complete!');
  
  if (!claudeInstalled) {
    console.warn('\nWARNING: Claude CLI not found. Please install Claude CLI to use voice commands.');
    console.warn('You can get the Claude CLI from: https://github.com/anthropics/claude-cli');
  }
}

// Run setup
setupClaudeEnvironment();