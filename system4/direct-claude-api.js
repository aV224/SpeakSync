/**
 * Direct Claude API test using Axios
 * This bypasses the Claude CLI completely for better reliability
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Claude API settings
const API_KEY = process.env.CLAUDE_API_KEY || "sk-ant-api03-eHM6xV4jrx-cwRh-2FqaA_x9jvnBGmh0uxPZLAA6BBk8OURpGxlvgRR0YX1CKpZrvJ3F5s0wgZ3D_P4C17Z9MA-YqSQQgAA";
const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Call Claude API directly 
 * @param {string} command - The command to process
 * @param {string} projectPath - The path to the project directory
 * @returns {Promise<object>} - Claude's response
 */
async function callClaudeAPI(command, projectPath) {
  // Format a decisive prompt with project context
  const projectName = path.basename(projectPath);
  
  const system = `You are a decisive AI coding assistant working on the "${projectName}" project located at "${projectPath}". 
You always take immediate action without asking follow-up questions. When given vague commands, make reasonable assumptions and proceed.
Never respond with requests for clarification - instead, choose the most appropriate file to modify and take action.
Be direct and avoid explanations unless specifically requested.`;

  try {
    console.log(`Calling Claude API with command: "${command}"`);
    
    const response = await axios.post(
      API_URL,
      {
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        system,
        messages: [
          {
            role: "user",
            content: `DIRECTIVE: Take immediate action based on this command: ${command}`
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01"
        }
      }
    );
    
    // Extract the response text
    const result = response.data.content[0].text;
    
    // Write to output file for comparison
    fs.writeFileSync(
      path.join(projectPath, 'claude_api_output.txt'),
      result,
      'utf8'
    );
    
    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

/**
 * Test function to compare CLI vs direct API
 */
async function runTest() {
  const projectPath = path.join(__dirname, 'projects', 'brainClassify');
  const testCommand = 'Add error handling';
  
  try {
    console.log(`Testing command: "${testCommand}"`);
    console.log(`Project directory: ${projectPath}`);
    console.log('-------------------------------------------------');
    
    const apiResult = await callClaudeAPI(testCommand, projectPath);
    
    console.log('\nAPI RESULT:');
    console.log(apiResult);
    
    // Check if the result contains follow-up questions
    const hasFollowUp = /could you|can you specify|need more|please provide|tell me which|which file|what kind/i.test(apiResult);
    
    if (hasFollowUp) {
      console.log('\n❌ FAILED: Claude asked for more information instead of taking action');
    } else {
      console.log('\n✅ PASSED: Claude took decisive action without asking follow-ups');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest();

 