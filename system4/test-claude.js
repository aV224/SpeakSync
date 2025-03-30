/**
 * Test script for Claude integration
 * 
 * This simulates a call to the AI process endpoint with a speech command
 * and helps debug Claude voice command processing
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
let testCommand, projectPath;

// Check if command is provided as an argument
if (args.length > 0) {
  testCommand = args.join(' ');
} else {
  // Default test command
  testCommand = 'improve the code in model_vit.py to be more efficient';
}

// Check if --project flag is provided
const projectFlag = args.findIndex(arg => arg === '--project' || arg === '-p');
if (projectFlag !== -1 && args.length > projectFlag + 1) {
  const projectName = args[projectFlag + 1];
  // Look up project path from name
  projectPath = path.join(__dirname, 'projects', projectName);
  
  // Validate project path
  if (!fs.existsSync(projectPath)) {
    console.warn(`Project "${projectName}" not found at ${projectPath}`);
    console.warn('Using default project path');
    projectPath = undefined;
  }
} else {
  // Default to brainClassify project for testing
  projectPath = path.join(__dirname, 'projects', 'brainClassify');
  
  // Fallback if project doesn't exist
  if (!fs.existsSync(projectPath)) {
    console.warn(`Default project not found at ${projectPath}`);
    console.warn('Using current directory');
    projectPath = process.cwd();
  }
}

// Configuration
const PORT = process.env.PORT || 4000; // Use the alternate port 
const SERVER_URL = `http://localhost:${PORT}`;
const ENDPOINT = '/ai/process';

// Add non-interactive flag if not already present
if (!testCommand.toLowerCase().includes('non-interactive')) {
  testCommand = `non-interactive ${testCommand}`;
}

// Phone number for context (use from env or default)
const CALLER_NUMBER = process.env.DEFAULT_PHONE_NUMBER || '+14086234845';

// Get project name from path
const projectName = path.basename(projectPath);

// Execute the test
async function runTest() {
  console.log(`\n===== Claude Integration Test =====`);
  console.log(`Sending command: "${testCommand}"`);
  console.log(`Project: ${projectName} (${projectPath})`);
  console.log(`To endpoint: ${SERVER_URL}${ENDPOINT}`);
  console.log(`With caller: ${CALLER_NUMBER}`);
  console.log(`\nWaiting for response...\n`);
  
  try {
    const startTime = Date.now();
    
    // Send request to the AI endpoint
    const response = await axios.post(`${SERVER_URL}${ENDPOINT}`, {
      speech: testCommand,
      callerNumber: CALLER_NUMBER,
      projectName: projectName,
      projectPath: projectPath,
      // Add additional flags for testing
      directTerminal: false,
      lowConfidence: false,
      isSmsCommand: false
    });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log(`Response received in ${elapsedTime.toFixed(2)} seconds:`);
    console.log(`Status: ${response.status}`);
    
    // Format the response
    if (response.data && typeof response.data === 'object') {
      // If there are tool call results, display them nicely
      if (response.data.result && response.data.result.actions) {
        console.log('\n----- AI Actions -----');
        console.log(response.data.result.message || '');
        
        response.data.result.actions.forEach((action, index) => {
          console.log(`\n[Action ${index + 1}]: ${action.tool}`);
          console.log(`Input:`, action.input);
          
          // Truncate large results for readability
          const truncateOutput = (obj, maxLength = 500) => {
            if (!obj) return obj;
            
            const result = {};
            
            for (const [key, value] of Object.entries(obj)) {
              if (typeof value === 'string' && value.length > maxLength) {
                result[key] = value.substring(0, maxLength) + '... [truncated]';
              } else if (typeof value === 'object' && value !== null) {
                result[key] = truncateOutput(value, maxLength);
              } else {
                result[key] = value;
              }
            }
            
            return result;
          };
          
          console.log(`Result:`, truncateOutput(action.result));
          
          // Show stdout if present (truncated for large outputs)
          if (action.result && action.result.stdout) {
            const stdout = action.result.stdout;
            console.log('\nOutput:');
            console.log('-------------------------------------------');
            if (stdout.length > 1000) {
              console.log(stdout.substring(0, 500));
              console.log('\n... [output truncated] ...\n');
              console.log(stdout.substring(stdout.length - 500));
            } else {
              console.log(stdout);
            }
            console.log('-------------------------------------------');
          }
        });
      } else {
        // Simple response
        console.log('\n----- AI Response -----');
        console.log(JSON.stringify(response.data, null, 2));
      }
    } else {
      console.log('\n----- Raw Response -----');
      console.log(response.data);
    }
  } catch (error) {
    console.error('\n----- Error -----');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
  
  console.log('\n===== Test Complete =====');
}

// Run the test
runTest(); 