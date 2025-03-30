/**
 * Script to send commands to Claude Terminal
 * Usage: node scripts/claude-terminal.js "your command here"
 * 
 * This script will format the command for Claude and copy it to clipboard
 * or execute it directly depending on configuration
 */

const { execSync } = require('child_process');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Get command from arguments
const args = process.argv.slice(2);
const command = args.join(' ');

if (!command) {
  console.error('Error: No command provided');
  console.log('Usage: node scripts/claude-terminal.js "your command here"');
  process.exit(1);
}

// Configuration
const config = {
  // Mode: 'clipboard' or 'direct'
  mode: process.env.CLAUDE_TERMINAL_MODE || 'clipboard',
  // Log file for commands
  logFile: path.join(__dirname, '..', 'logs', 'claude-commands.log'),
  // Whether to prepend 'claude' to the command
  prependClaude: true
};

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Check if this is a non-interactive command
// Now accepts both 'non-interactive' text and FORCE_NON_INTERACTIVE env var
const isNonInteractive = command.toLowerCase().includes('non-interactive') || 
                         process.env.FORCE_NON_INTERACTIVE === 'true';

// Remove the non-interactive flag from the command text if present
const cleanCommand = command.replace(/\bnon-interactive\b/i, '').trim();

// Format command for Claude
let formattedCommand;
if (isNonInteractive) {
  // Extract project path for non-interactive mode if specified
  let projectPath = '';
  
  // Check for --cwd parameter in original command
  const cwdMatch = command.match(/--cwd\s+([^\s"]+)/);
  if (cwdMatch && cwdMatch[1]) {
    projectPath = ` --cwd ${cwdMatch[1]}`;
  }
  
  // Use auto-detected project directory if available
  const projectDir = process.env.CURRENT_PROJECT_DIR || '';
  if (!projectPath && projectDir) {
    projectPath = ` --cwd ${projectDir}`;
  }
  
  // Format for non-interactive execution with the cleaned command
  formattedCommand = `claude --print "${cleanCommand.replace(/"/g, '\\"')}"${projectPath}`;
  
  console.log(`Using non-interactive mode with command: ${cleanCommand}`);
  console.log(`Working directory: ${projectPath || 'current directory'}`);
} else {
  // Standard interactive command
  formattedCommand = config.prependClaude 
    ? `claude "${command.replace(/"/g, '\\"')}"`
    : command;
}

// Log command
const timestamp = new Date().toISOString();
const logEntry = `[${timestamp}] ${formattedCommand}\n`;
fs.appendFileSync(config.logFile, logEntry);

try {
  if (config.mode === 'clipboard') {
    // Copy to clipboard
    if (process.platform === 'darwin') {
      // macOS
      execSync(`echo '${formattedCommand.replace(/'/g, "\\'")}' | pbcopy`);
      console.log('Command copied to clipboard');
    } else if (process.platform === 'win32') {
      // Windows
      execSync(`echo ${formattedCommand} | clip`);
      console.log('Command copied to clipboard');
    } else if (process.platform === 'linux') {
      // Linux
      execSync(`echo '${formattedCommand.replace(/'/g, "\\'")}' | xclip -selection clipboard`);
      console.log('Command copied to clipboard');
    } else {
      console.error(`Unsupported platform: ${process.platform}`);
    }
  } else if (config.mode === 'direct') {
    // Directly execute command (requires configured terminal)
    // This is platform-specific and would need customization
    console.log('Direct execution not yet implemented');
    console.log(`Would execute: ${formattedCommand}`);
  }
  
  console.log('Claude command successfully processed');
} catch (error) {
  console.error('Error processing Claude command:', error.message);
  process.exit(1);
} 