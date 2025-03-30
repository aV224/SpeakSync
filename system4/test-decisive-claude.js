/**
 * Test script for Claude's decisive action behavior
 * This tests if Claude will take direct action without asking follow-up questions
 */

const path = require('path');

// Import the module that contains the executeSpeechCommand function
const claudeExecutor = require('./backend/src/config/claude_direct_executor');

// The project directory to test with
const testProjectDir = path.join(__dirname, 'projects', 'brainClassify');

// Test voice commands - intentionally vague to test decisiveness
const testCommands = [
  'Add recursion and comments to the code',
  'Optimize the algorithm',
  'Add error handling',
  'Refactor the main function'
];

console.log('========== CLAUDE DECISIVE ACTION TEST ==========');
console.log(`Project directory: ${testProjectDir}`);
console.log('=================================================');

async function runTests() {
  try {
    for (const command of testCommands) {
      console.log(`\nTesting command: "${command}"`);
      console.log('-------------------------------------------------');
      
      console.log('Sending command to Claude via expect script...');
      const result = await claudeExecutor.executeSpeechCommand(command, testProjectDir);
      
      console.log('RESULT:');
      console.log(result);
      
      // Check if the result contains follow-up questions
      const hasFollowUp = /could you|can you specify|need more|please provide|tell me which|which file|what kind/i.test(result);
      
      if (hasFollowUp) {
        console.log('❌ FAILED: Claude asked for more information instead of taking action');
      } else {
        console.log('✅ PASSED: Claude took decisive action without asking follow-ups');
      }
      
      console.log('-------------------------------------------------');
    }
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('TEST FAILED:');
    console.error(error);
  }
}

// Run the tests
runTests(); 