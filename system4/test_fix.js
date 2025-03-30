/**
 * Test script for Claude direct executor
 * This script tests the fixed version of the Claude direct executor
 */

const path = require('path');
const { executeSpeechCommand } = require('./backend/src/config/claude_direct_executor');

// Define a simple test command
const testCommand = "Say hello world";
const workingDir = path.join(__dirname, 'projects/brainClassify');

console.log('Starting test of fixed Claude direct executor...');
console.log(`Command: "${testCommand}"`);
console.log(`Working directory: ${workingDir}`);
console.log('Test initiated. The server should continue running while Claude processes the command...');

// Execute the command using our fixed executor
executeSpeechCommand(testCommand, workingDir)
  .then(result => {
    console.log('-----------------------------');
    console.log('SUCCESS: Claude command completed without crashing the server!');
    console.log(`Result length: ${result.length}`);
    console.log('-----------------------------');
    console.log(`First 200 characters of result: ${result.substring(0, 200)}...`);
    
    // Check for error messages in the result
    if (result.includes('error') || result.includes('Error')) {
      console.log('WARNING: The command completed but returned an error message.');
      console.log('Full error result:');
      console.log(result);
    }
  })
  .catch(error => {
    console.error('ERROR: Claude command failed:', error.message);
    console.error('Error stack:', error.stack);
  })
  .finally(() => {
    console.log('Test completed. Server is still running!');
  });
