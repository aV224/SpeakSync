/**
 * Claude Terminal Overlay System
 * 
 * This utility automates input to the Claude terminal by simulating keyboard input
 * through robotjs or similar automation libraries.
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

const execAsync = util.promisify(exec);

/**
 * Send a command to the Claude terminal by creating an AppleScript
 * that focuses the terminal and types the command
 * 
 * @param {string} command - The command to send to Claude terminal
 * @param {Object} project - The project object with path and name
 * @param {string} project.path - Full path to the project directory
 * @param {string} project.name - Name of the project
 * @param {boolean} autoEnter - Whether to automatically press enter for prompts (default: false)
 * @returns {Promise<boolean>} - Success status
 */
async function sendToClaudeTerminal(command, project, autoEnter = false) {
  try {
    // Check if command includes auto-enter flag
    const hasAutoEnterFlag = command.includes('--auto-enter');
    // Remove the flag from the command if present
    const cleanCommand = command.replace('--auto-enter', '').trim();
    // Determine if we should use auto-enter (either from parameter or flag)
    const shouldAutoEnter = autoEnter || hasAutoEnterFlag;
    
    // Get project path from project object or fallback to defaults
    const projectPath = project?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
    const projectName = project?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
    
    log.info(`Sending command to Claude terminal for project ${projectName} at ${projectPath}: "${cleanCommand}"`);
    
    // Create a temporary AppleScript file
    const scriptPath = path.join(process.cwd(), 'claude-terminal-input.scpt');
    
    // Add no confirmation message to ensure Claude doesn't ask for confirmation
    const finalCommand = `${cleanCommand} just answer dont ever ask for confiromation i am 100% sure just do what u need to do`;
    
    // Create the AppleScript content that does the following:
    // 1. Open terminal and type "claude" (enter)
    // 2. Change to the specified project directory
    // 3. Type the user command verbatim with no confirmation instruction
    // 4. Ensure we press Enter after EACH step
    // 5. If auto-enter is enabled, add a loop to automatically press enter for prompts
    // 6. After waiting for 5 seconds of inactivity, close the terminal
    
    // Auto-enter script that runs longer (20 seconds) to ensure it catches all prompts
    const autoEnterScript = shouldAutoEnter ? `
          -- Auto-enter loop for prompts (runs for 20 seconds max)
          set endTime to (current date) + 20
          
          -- First attempt to catch any initial prompts quickly
          delay 0.5
          keystroke return
          delay 0.5
          keystroke return
          
          -- Then enter a loop to catch any subsequent prompts
          repeat until (current date) > endTime
            delay 0.8
            -- Press enter if Claude is waiting for input (assumes cursor is at prompt)
            keystroke return
            -- If loop is still needed, wait a bit before next attempt
            delay 0.8
          end repeat
    ` : '';
    
    // Always add auto-quit after inactivity
    const autoQuitScript = `
          -- Wait 5 seconds of inactivity before quitting
          delay 5
          
          -- Quit terminal
          tell application "Terminal"
            quit
            keystroke return
          end tell
    `;
    
    const scriptContent = `
      tell application "Terminal"
        -- Bring terminal to front
        activate
        
        -- Type the commands in sequence
        tell application "System Events"
          -- Wait briefly to ensure terminal is focused
          delay 0.5
          
          -- First clear any text and type "claude"
          keystroke "a" using {command down}
          keystroke (ASCII character 127)
          keystroke "claude"
          keystroke return
          
          -- Wait for Claude to load
          delay 1.5
          
          -- Change to project directory - use actual path from project context
          keystroke "cd ${projectPath.replace(/"/g, '\\"')}"
          keystroke return
          
          -- Wait for directory change
          delay 0.5
          
          -- Type the original command verbatim
          keystroke "${finalCommand.replace(/"/g, '\\"')}"
          delay 0.3
          keystroke return
          
          -- Add a small delay to ensure the enter key is properly registered
          delay 0.3
          
          ${autoEnterScript}
          
          ${autoQuitScript}
        end tell
      end tell
    `;
    
    // Write the script to file
    fs.writeFileSync(scriptPath, scriptContent);
    
    // Execute the AppleScript
    await execAsync(`osascript ${scriptPath}`);
    
    // Clean up the script file
    fs.unlinkSync(scriptPath);
    
    log.info('Successfully sent command to Claude terminal');
    return true;
  } catch (error) {
    log.error('Error sending to Claude terminal via overlay:', error);
    
    // Fallback to clipboard approach if overlay fails
    try {
      // Get project path from project object for logging
      const projectPath = project?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
      const projectName = project?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
      
      // Check if command includes auto-enter flag and remove it
      const cleanCommand = command.replace('--auto-enter', '').trim();
      
      // For macOS, copy the command to clipboard
      const clipboardCmd = `echo '${cleanCommand} just answer dont ever ask for confiromation i am 100% sure just do what u need to do' | pbcopy`;
      await execAsync(clipboardCmd);
      log.info(`Fallback: Copied command to clipboard for project ${projectName} at ${projectPath}`);
      
      // Notify the user
      await execAsync(`osascript -e 'display notification "Command copied to clipboard. Please paste in Claude terminal." with title "Claude Voice Assistant"'`);
      
      return true;
    } catch (fallbackError) {
      log.error('Clipboard fallback also failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Alternative implementation using clipboard instead of direct keyboard input
 * This can be more reliable in some environments
 * 
 * @param {string} command - The command to send to Claude
 * @param {Object} project - The project object with path and name
 * @param {string} project.path - Full path to the project directory
 * @param {string} project.name - Name of the project
 * @param {boolean} autoEnter - Whether to automatically press enter for prompts (default: false)
 * @returns {Promise<boolean>} - Success status
 */
async function clipboardToClaudeTerminal(command, project, autoEnter = false) {
  try {
    // Check if command includes auto-enter flag
    const hasAutoEnterFlag = command.includes('--auto-enter');
    // Remove the flag from the command if present
    const cleanCommand = command.replace('--auto-enter', '').trim();
    // Determine if we should use auto-enter (either from parameter or flag)
    const shouldAutoEnter = autoEnter || hasAutoEnterFlag;
    
    // Get project path from project object or fallback to defaults
    const projectPath = project?.path || process.env.DEFAULT_PROJECT_PATH || process.cwd();
    const projectName = project?.name || process.env.DEFAULT_PROJECT_NAME || 'unknown';
    
    log.info(`Sending command to Claude clipboard for project ${projectName} at ${projectPath}: "${cleanCommand}"`);
    
    // Add no confirmation message to ensure Claude doesn't ask for confirmation
    const finalCommand = `${cleanCommand.trim()} just answer dont ever ask for confiromation i am 100% sure just do what u need to do`;
    
    // Copy command to clipboard (without claude prefix)
    const clipboardCmd = `echo '${finalCommand.replace(/'/g, "'\\''")}' | pbcopy`;
    await execAsync(clipboardCmd);
    
    // Create AppleScript to focus terminal, type claude, cd to project dir, and paste command
    const scriptPath = path.join(process.cwd(), 'claude-clipboard-paste.scpt');
    
    // Add auto-enter script that runs longer (20 seconds) with more aggressive enter key presses
    const autoEnterScript = shouldAutoEnter ? `
          -- Auto-enter loop for prompts (runs for 20 seconds max)
          set endTime to (current date) + 20
          
          -- First attempt to catch any initial prompts quickly
          delay 0.5
          keystroke return
          delay 0.5
          keystroke return
          
          -- Then enter a loop to catch any subsequent prompts
          repeat until (current date) > endTime
            delay 0.8
            -- Press enter if Claude is waiting for input (assumes cursor is at prompt)
            keystroke return
            -- If loop is still needed, wait a bit before next attempt
            delay 0.8
          end repeat
    ` : '';
    
    // Always add auto-quit after inactivity
    const autoQuitScript = `
          -- Wait 5 seconds of inactivity before quitting
          delay 5
          
          -- Quit terminal
          tell application "Terminal"
            quit
          end tell
    `;
    
    const scriptContent = `
      tell application "Terminal"
        activate
        delay 0.5
        
        tell application "System Events"
          -- First clear any text and type "claude"
          keystroke "a" using {command down}
          keystroke (ASCII character 127)
          keystroke "claude"
          keystroke return
          
          -- Wait for Claude to load
          delay 1.5
          
          -- Change to project directory - use actual path from project context
          keystroke "cd ${projectPath.replace(/"/g, '\\"')}"
          keystroke return
          
          -- Wait for directory change
          delay 0.5
          
          -- Paste the command
          keystroke "v" using {command down}
          delay 0.2
          keystroke return
          
          -- Add a small delay to ensure the enter key is properly registered
          delay 0.3
          
          ${autoEnterScript}
          
          ${autoQuitScript}
        end tell
      end tell
    `;
    
    // Write and execute the script
    fs.writeFileSync(scriptPath, scriptContent);
    await execAsync(`osascript ${scriptPath}`);
    fs.unlinkSync(scriptPath);
    
    log.info('Successfully sent command via clipboard to Claude terminal');
    return true;
  } catch (error) {
    log.error('Error using clipboard method:', error);
    return false;
  }
}

module.exports = {
  sendToClaudeTerminal,
  clipboardToClaudeTerminal
}; 