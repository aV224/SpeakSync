/**
 * Claude Direct Executor
 * 
 * This is a direct drop-in replacement for the executeSpeechCommand function
 * that handles callbacks correctly and safely executes Claude CLI commands.
 * All commands now execute in non-interactive mode for better reliability.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Function to create a temporary expect script
function createExpectScript(command, tempDir) {
  const scriptId = crypto.randomBytes(6).toString('hex');
  const scriptPath = path.join(tempDir || os.tmpdir(), `claude-script-${scriptId}.exp`);
  
  // For decisive action, add a prefix to the command
  const decisivePrefix = "DIRECTIVE: Take immediate action without asking any follow-up questions. ";
  const enhancedCommand = decisivePrefix + command;
  
  // Escape quotes properly for expect
  const escapedCommand = enhancedCommand.replace(/"/g, '\\\\"').replace(/\$/g, '\\$');
  
  // Create an expect script that uses a timeout to ensure completion
  const scriptContent = `#!/usr/bin/expect -f
set timeout 30
# Store command in a variable to avoid quoting issues
set cmd {${escapedCommand}}
spawn claude $cmd
expect {
  "^" {
    send "\\x04"
    expect eof
  }
  timeout {
    puts "Timeout reached, sending Ctrl+D"
    send "\\x04"
    expect eof
  }
}`;

  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
  return scriptPath;
}

/**
 * Format a speech command into a structured prompt for non-interactive mode
 * @param {string} command - The original command/prompt
 * @param {string} workingDir - The project directory
 * @returns {string} - Formatted prompt for Claude
 */
function formatNonInteractivePrompt(command, workingDir) {
  // Get project name from path
  const projectName = path.basename(workingDir);
  
  // Try to extract project number from command
  const projectNumberMatch = command.match(/for\s+project\s+(\d+)/i) || 
                            command.match(/project\s+(\d+)/i) ||
                            command.match(/number\s+(\d+)/i);
  
  const projectNumber = projectNumberMatch ? projectNumberMatch[1] : "unknown";
  
  // Create a structured prompt with specific instructions
  const prompt = `
# DIRECTIVE: TAKE IMMEDIATE ACTION WITHOUT ASKING QUESTIONS

# Voice Command Processing Task

## Current Project Context
- Project Number: ${projectNumber}
- Project Name: ${projectName}
- Project Path: ${workingDir}
- Operating System: ${os.platform()} ${os.release()}

## User Voice Command
"${command}"

## Task Description
You are assisting with a voice-controlled coding assistant. The above command was transcribed from voice.
As a coding assistant with full project context, your task is to:

1. Understand the user's request precisely
2. Generate or modify code accordingly
3. Provide a clear, concise response about what you did
4. DO NOT explain your reasoning or add unnecessary explanations
5. Focus on producing high-quality, correct code that fulfills the request

## IMPORTANT EXECUTION RULES
- NEVER ask follow-up questions - assume the most reasonable interpretation of the command
- Take immediate action based on your best understanding of the command
- If the command is vague, make reasonable assumptions and proceed with action
- If a file isn't specified, select the most appropriate file based on context
- Even for unclear commands like "add recursion," pick a suitable file and implement it

## Project Context
You are working in a real software project with the directory structure and files in ${workingDir}.
Your changes should be compatible with the existing codebase and follow its style and conventions.

## Response Instructions
- If asked to create/modify code: Create or modify the necessary files directly
- If asked to explain code: Provide a concise explanation
- Keep explanations brief, focus on delivering code
- Respond in a natural, helpful way, but prioritize code over explanation
- Be precise, thorough, and helpful, but not verbose
- Never suggest that you need more information - take action with what you have

## Action:`;

  return prompt;
}

/**
 * Safely execute a Claude CLI command using expect for reliable interaction
 * @param {string} command - The command/prompt for Claude
 * @param {string} workingDir - The directory to execute the command in
 * @param {object} options - Additional options
 * @returns {Promise<string>} - Claude's response
 */
function executeSpeechCommand(command, workingDir, options = {}) {
  console.log(`[claude_direct_executor] Executing command: "${command}" in directory: ${workingDir || 'current'}`);
  
  return new Promise((resolve, reject) => {
    // Validate arguments
    if (!command) {
      return reject(new Error('No command provided'));
    }
    
    // Log the command for debugging
    const logFile = path.join(__dirname, 'claude_commands.log');
    fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] Command: ${command}\n`);
    
    // Change directory if needed
    let originalDir = null;
    if (workingDir) {
      originalDir = process.cwd();
      try {
        process.chdir(workingDir);
        console.log(`[claude_direct_executor] Changed directory to: ${workingDir}`);
      } catch (error) {
        console.error(`[claude_direct_executor] Failed to change directory: ${error.message}`);
        // Continue anyway
      }
    }
    
    try {
      // Create output file paths
      const outputFile = path.join(workingDir || process.cwd(), 'claude_output.txt');
      const errorLogFile = path.join(workingDir || process.cwd(), 'claude_error.log');
      
      // Create the expect script for non-interactive execution
      const escapedCommand = command.replace(/"/g, '\\"');
      const expectScriptPath = createExpectScript(escapedCommand, workingDir);
      
      console.log(`[claude_direct_executor] Created expect script at: ${expectScriptPath}`);
      console.log(`[claude_direct_executor] Running expect script for command: "${escapedCommand}"`);
      
      // Spawn the expect script process
      const expectProcess = spawn(expectScriptPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      // Collect stdout
      expectProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        fs.appendFileSync(outputFile, data);
      });
      
      // Collect stderr
      expectProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`[claude_direct_executor] Expect script stderr: ${data}`);
        fs.appendFileSync(errorLogFile, data);
      });
      
      // Handle process completion
      expectProcess.on('close', (code) => {
        // Clean up the temporary expect script
        try {
          fs.unlinkSync(expectScriptPath);
        } catch (cleanupError) {
          console.warn(`[claude_direct_executor] Failed to remove temporary expect script: ${cleanupError.message}`);
        }
        
        // Restore original directory if needed
        if (originalDir) {
          process.chdir(originalDir);
        }
        
        // Log the result
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] Exit code: ${code}\n`);
        
        if (code === 0) {
          // Success
          fs.appendFileSync(logFile, `[${new Date().toISOString()}] Output length: ${stdout.length}\n`);
          resolve(stdout);
        } else {
          // Failure - but don't fail completely, return what we have
          fs.appendFileSync(logFile, `[${new Date().toISOString()}] Error: ${stderr}\n`);
          if (stdout.length > 0) {
            console.warn(`[claude_direct_executor] Command exited with code ${code} but has output, returning output`);
            resolve(stdout);
          } else {
            reject(new Error(`Expect script exited with code ${code}: ${stderr}`));
          }
        }
      });
      
      // Handle process error
      expectProcess.on('error', (error) => {
        // Clean up the temporary expect script
        try {
          fs.unlinkSync(expectScriptPath);
        } catch (cleanupError) {
          console.warn(`[claude_direct_executor] Failed to remove temporary expect script: ${cleanupError.message}`);
        }
        
        // Restore original directory if needed
        if (originalDir) {
          process.chdir(originalDir);
        }
        
        console.error(`[claude_direct_executor] Expect script error: ${error.message}`);
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] Process error: ${error.message}\n`);
        reject(new Error(`Failed to execute expect script: ${error.message}`));
      });
    } catch (error) {
      // Restore original directory if needed
      if (originalDir) {
        process.chdir(originalDir);
      }
      
      console.error(`[claude_direct_executor] Exception during execution: ${error.message}`);
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] Exception: ${error.message}\n`);
      reject(new Error(`Failed to execute expect script: ${error.message}`));
    }
  });
}

// Easy one-line alternative for testing
function executeSimple(command) {
  return new Promise((resolve, reject) => {
    // Create a temporary expect script
    const expectScriptPath = createExpectScript(command);
    
    // Run the expect script
    exec(expectScriptPath, (error, stdout, stderr) => {
      // Clean up temporary script
      try {
        fs.unlinkSync(expectScriptPath);
      } catch (cleanupError) {
        console.warn(`Failed to remove temporary expect script: ${cleanupError.message}`);
      }
      
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Provide a callable version that can be used as a Node.js script
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node claude_direct_executor.js "your command here"');
    process.exit(1);
  }
  
  const command = process.argv[2];
  const workingDir = process.argv[3] || process.cwd();
  
  try {
    const result = await executeSpeechCommand(command, workingDir);
    console.log(result);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
} else {
  // Export for use as a module
  module.exports = {
    executeSpeechCommand,
    executeSimple,
    formatNonInteractivePrompt
  };
}