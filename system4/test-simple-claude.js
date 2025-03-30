/**
 * Simple test for Claude's decisiveness
 */

const path = require('path');
const claudeExecutor = require('./backend/src/config/claude_direct_executor');

// The project directory to test with
const testProjectDir = path.join(__dirname, 'projects', 'brainClassify');

// A simple, intentionally vague command
const testCommand = 'Add error handling';

console.log(`Testing command: "${testCommand}"`);
console.log(`Project directory: ${testProjectDir}`);
console.log('---------------------------------------------');

async function runTest() {
  try {
    console.log('Sending command to Claude...');
    const result = await claudeExecutor.executeSpeechCommand(testCommand, testProjectDir);
    
    console.log('\nRESULT:');
    console.log(result);
    
    // Check if the result contains follow-up questions
    const hasFollowUp = /could you|can you specify|need more|please provide|tell me which|which file|what kind/i.test(result);
    
    if (hasFollowUp) {
      console.log('\n❌ FAILED: Claude asked for more information');
    } else {
      console.log('\n✅ PASSED: Claude took decisive action');
    }
  } catch (error) {
    console.error('TEST FAILED:');
    console.error(error);
  }
}

// Run the test
runTest(); 