/**
 * Test script for Claude API integration
 * This makes a direct API call to test the fixed Claude integration
 */

const axios = require('axios');

// Define test parameters
const API_URL = 'http://localhost:5001/ai/process';
const testData = {
  speech: 'Create a simple React frontend interface for the BrainClassify project that displays neural network training progress and includes a speed graph visualization.',
  caller: '+14086234845',  // Test caller ID
  projectPath: '/Users/kousthubhveturi/Desktop/gaana/projects/brainClassify'
};

console.log('Starting Claude API test...');
console.log(`Speech input: "${testData.speech}"`);
console.log(`Caller: "${testData.caller}"`);
console.log(`Project path: "${testData.projectPath}"`);

// Make the API call
axios.post(API_URL, testData)
  .then(response => {
    console.log('-----------------------------');
    console.log('SUCCESS: API responded successfully');
    console.log('-----------------------------');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  })
  .catch(error => {
    console.error('ERROR: API call failed');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Is the server running?');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
  }); 