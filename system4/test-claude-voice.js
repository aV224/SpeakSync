/**
 * Test script for Claude voice integration with expect
 * This simulates a voice command going through the integration pipeline
 */

const path = require('path');

// Import the module that contains the executeSpeechCommand function
const claudeExecutor = require('./backend/src/config/claude_direct_executor');

// The project directory to test with
const testProjectDir = path.join(__dirname, 'projects', 'brainClassify');

// Test voice command - using a simpler command that works reliably
const testVoiceCommand = 'Hello, Claude';

console.log('========== CLAUDE VOICE INTEGRATION TEST ==========');
console.log(`Testing voice command: "${testVoiceCommand}"`);
console.log(`Project directory: ${testProjectDir}`);
console.log('===================================================');

async function runTest() {
  try {
    console.log('Sending command to Claude via expect script...');
    const result = await claudeExecutor.executeSpeechCommand(testVoiceCommand, testProjectDir);
    
    console.log('===================================================');
    console.log('RESULT:');
    console.log(result);
    console.log('===================================================');
    console.log('Test completed successfully!');
    
    // Also test the direct test function
    console.log('\nTesting direct executeSimple function...');
    const simpleResult = await claudeExecutor.executeSimple('What is 2+2?');
    console.log('Simple result:', simpleResult);
  } catch (error) {
    console.error('TEST FAILED:');
    console.error(error);
  }
}

// Run the test
runTest(); 