/**
 * Test Overlay Client
 * 
 * This script helps test the claude-overlay endpoints
 */

const http = require('http');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to make POST request to the server
function sendRequest(endpoint, speech, project = null, projectContext = null) {
  // Create request data
  const data = JSON.stringify({
    speech,
    ...(project ? { project } : {}),
    ...(projectContext ? { projectContext } : {})
  });
  
  // Request options
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  // Create and send request
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedResponse = JSON.parse(responseData);
          resolve(parsedResponse);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// Gaana overlay test function
async function testGaanaOverlay(speech) {
  try {
    // Define project context with full path
    const projectContext = {
      name: 'gaana',
      path: '/Users/kousthubhveturi/Desktop/gaana'
    };
    
    console.log(`Testing Gaana overlay with: "${speech}" at path: ${projectContext.path}`);
    const response = await sendRequest('/ai/claude-overlay', speech, null, projectContext);
    console.log('Response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Error testing Gaana overlay:', error.message || error);
    return null;
  }
}

// BrainClassify overlay test function
async function testBrainClassifyOverlay(speech) {
  try {
    // Define project context with full path
    const projectContext = {
      name: 'brainClassify',
      path: '/Users/kousthubhveturi/Desktop/brainClassify'
    };
    
    console.log(`Testing BrainClassify overlay with: "${speech}" at path: ${projectContext.path}`);
    const response = await sendRequest('/ai/claude-overlay', speech, null, projectContext);
    console.log('Response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Error testing BrainClassify overlay:', error.message || error);
    return null;
  }
}

// Interactive test function
async function interactiveTest() {
  console.log('===== Claude Terminal Overlay Test Client =====');
  console.log('1 - Test Gaana project');
  console.log('2 - Test BrainClassify project');
  console.log('q - Quit');
  
  rl.question('Choose an option: ', async (option) => {
    if (option === 'q') {
      rl.close();
      return;
    }
    
    const project = option === '2' ? 'brainClassify' : 'gaana';
    
    rl.question(`Enter command to send to ${project}: `, async (speech) => {
      try {
        if (option === '2') {
          await testBrainClassifyOverlay(speech);
        } else {
          await testGaanaOverlay(speech);
        }
      } catch (error) {
        console.error('Error:', error);
      }
      
      // Continue with another test
      setTimeout(interactiveTest, 1000);
    });
  });
}

// Main function to handle command line arguments
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  // Check if arguments are provided
  if (args.length < 2) {
    console.log('Usage: node testOverlay.js [gaana|brain] "your command here"');
    return;
  }
  
  // Get project and command
  const project = args[0].toLowerCase();
  const speech = args.slice(1).join(' ');
  
  // Run the appropriate test
  if (project === 'gaana') {
    await testGaanaOverlay(speech);
  } else if (project === 'brain' || project === 'brainclassify') {
    await testBrainClassifyOverlay(speech);
  } else {
    console.log('Invalid project. Use "gaana" or "brain".');
  }
}

// Run the main function
main().catch(error => {
  console.error('Error running test:', error.message || error);
}); 