#!/usr/bin/env node
/**
 * Claude Code CLI 
 * 
 * Command-line tool to interact with Claude with full codebase access
 * using the dangerous permissions flag.
 * 
 * Usage: 
 *   node claude-code-cli.js [options]
 * 
 * Options:
 *   -i, --interactive     Enter interactive mode for prompt input
 *   -p, --prompt <text>   Direct prompt text
 *   -f, --file <path>     Path to prompt file
 *   -d, --debug           Enable debug mode
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
let promptText = '';
let promptFile = '';
let interactive = false;
let debug = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '-i' || arg === '--interactive') {
    interactive = true;
  } else if ((arg === '-p' || arg === '--prompt') && i + 1 < args.length) {
    promptText = args[i + 1];
    i++;
  } else if ((arg === '-f' || arg === '--file') && i + 1 < args.length) {
    promptFile = args[i + 1];
    i++;
  } else if (arg === '-d' || arg === '--debug') {
    debug = true;
  } else if (arg === '-h' || arg === '--help') {
    showHelp();
    process.exit(0);
  }
}

// Show help information
function showHelp() {
  console.log(`
Claude Code CLI - Interact with Claude with full codebase access

Usage:
  node claude-code-cli.js [options]

Options:
  -i, --interactive       Enter interactive mode for prompt input
  -p, --prompt <text>     Direct prompt text
  -f, --file <path>       Path to prompt file
  -d, --debug             Enable debug mode
  -h, --help              Show this help message

Examples:
  node claude-code-cli.js -i
  node claude-code-cli.js -p "Explain the project structure"
  node claude-code-cli.js -f my-prompt.txt
  `);
}

// Get the script path
const scriptPath = path.join(__dirname, 'scripts', 'claude-code.sh');

// Execute Claude Code
function executeClaudeCode(prompt, isFile = false) {
  // Build arguments
  const args = [];
  if (isFile) {
    args.push('--prompt-file', prompt);
  } else {
    args.push('--prompt', prompt);
  }
  
  if (debug) {
    args.push('--debug');
  }
  
  // Execute the script
  const claudeProcess = spawn(scriptPath, args, {
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

// Main execution logic
async function main() {
  // Check if script path exists
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Could not find the Claude Code script at ${scriptPath}`);
    process.exit(1);
  }
  
  // Handle different input methods
  if (interactive) {
    console.log('Claude Code Interactive Mode');
    console.log('Enter your prompt below. Type ":q" on a new line to submit.');
    console.log('----------------------------------------------');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    let interactivePrompt = '';
    let lineCount = 0;
    
    rl.prompt();
    
    rl.on('line', (line) => {
      if (line.trim() === ':q') {
        rl.close();
        executeClaudeCode(interactivePrompt);
      } else {
        interactivePrompt += (lineCount > 0 ? '\n' : '') + line;
        lineCount++;
        rl.prompt();
      }
    });
  } else if (promptFile) {
    if (!fs.existsSync(promptFile)) {
      console.error(`Error: Prompt file not found: ${promptFile}`);
      process.exit(1);
    }
    
    const resolvedPath = path.resolve(promptFile);
    executeClaudeCode(resolvedPath, true);
  } else if (promptText) {
    executeClaudeCode(promptText);
  } else {
    console.error('Error: No prompt provided. Use --prompt, --file, or --interactive.');
    showHelp();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});