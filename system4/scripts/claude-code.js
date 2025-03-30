#!/usr/bin/env node
/**
 * Claude Code for Gaana - Node.js interface
 * 
 * This script provides a convenient way to invoke Claude with elevated
 * permissions to read and modify the entire Gaana codebase.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

// Define paths
const projectRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(__dirname, 'claude-code.sh');
const tempDir = path.join(projectRoot, 'temp');

// Create temp directory if it doesn't exist
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Parse command line arguments
const args = process.argv.slice(2);
let prompt = '';
let promptFile = '';
let debug = false;
let interactive = false;

// Process arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prompt' && i + 1 < args.length) {
    prompt = args[i + 1];
    i++;
  } else if (args[i] === '--prompt-file' && i + 1 < args.length) {
    promptFile = args[i + 1];
    i++;
  } else if (args[i] === '--debug') {
    debug = true;
  } else if (args[i] === '--interactive' || args[i] === '-i') {
    interactive = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    showHelp();
    process.exit(0);
  }
}

// Show help information
function showHelp() {
  console.log(`
Claude Code for Gaana - Node.js Interface

Usage:
  node claude-code.js [options]

Options:
  --prompt <text>       Provide a prompt directly
  --prompt-file <path>  Path to a file containing the prompt
  --interactive, -i     Enter interactive mode to type a prompt
  --debug               Include additional debug information
  --help, -h            Show this help message

Examples:
  node claude-code.js --prompt "Analyze the project structure"
  node claude-code.js --prompt-file my-prompt.txt
  node claude-code.js --interactive
  `);
}

// Function to execute claude-code.sh
function executeClaudeCode(promptText, isFile = false) {
  const claudeArgs = [];
  
  if (isFile) {
    claudeArgs.push('--prompt-file', promptText);
  } else {
    // Save prompt to a temporary file
    const tempPromptFile = path.join(tempDir, `prompt-${Date.now()}.txt`);
    fs.writeFileSync(tempPromptFile, promptText);
    claudeArgs.push('--prompt-file', tempPromptFile);
  }
  
  if (debug) {
    claudeArgs.push('--debug');
  }
  
  // Spawn the script
  const claudeProcess = spawn(scriptPath, claudeArgs, {
    stdio: 'inherit'
  });
  
  // Handle process completion
  claudeProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Claude Code exited with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle process error
  claudeProcess.on('error', (error) => {
    console.error(`Failed to execute Claude Code: ${error.message}`);
    process.exit(1);
  });
}

// Handle interactive mode
if (interactive) {
  console.log('Claude Code for Gaana - Interactive Mode');
  console.log('Enter your prompt below (type ":q" on a new line to submit):');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let interactivePrompt = '';
  let lineCount = 0;
  
  rl.on('line', (line) => {
    if (line.trim() === ':q') {
      rl.close();
      executeClaudeCode(interactivePrompt);
    } else {
      interactivePrompt += (lineCount > 0 ? '\n' : '') + line;
      lineCount++;
    }
  });
} else if (promptFile) {
  // Check if prompt file exists
  if (!fs.existsSync(promptFile)) {
    console.error(`Error: Prompt file not found: ${promptFile}`);
    process.exit(1);
  }
  
  executeClaudeCode(path.resolve(promptFile), true);
} else if (prompt) {
  executeClaudeCode(prompt);
} else {
  console.error('Error: No prompt provided. Use --prompt, --prompt-file, or --interactive.');
  showHelp();
  process.exit(1);
}