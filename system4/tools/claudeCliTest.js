/**
 * Claude CLI Test Utility
 * This script tests the Claude CLI integration by sending a command directly.
 */
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Create a temporary expect script
function createExpectScript(command) {
  const scriptPath = path.join(__dirname, 'claude-test-script.exp');
  
  // Escape quotes properly for expect
  const escapedCommand = command.replace(/"/g, '\\\\"').replace(/\$/g, '\\$');
  
  // Create an expect script
  const scriptContent = `#!/usr/bin/expect -f
set timeout 30
spawn claude "${escapedCommand}"
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

// Function to run a command with Claude CLI
async function testClaudeCli(command = "Explain what you do") {
  console.log('========== CLAUDE CLI TEST ==========');
  console.log(`Testing command: "${command}"`);
  console.log('=======================================');
  
  try {
    // Create expect script
    const scriptPath = createExpectScript(command);
    console.log(`Created expect script at: ${scriptPath}`);
    
    // Run the expect script
    const { stdout, stderr } = await execAsync(scriptPath);
    
    // Log the result
    console.log('RESULT:');
    console.log(stdout);
    
    // Clean up
    fs.unlinkSync(scriptPath);
    
    console.log('=======================================');
    console.log('Test completed successfully!');
    return stdout;
  } catch (error) {
    console.error('Error testing Claude CLI:', error);
    return null;
  }
}

// Main function if this script is run directly
async function main() {
  const command = process.argv[2] || "Explain what you can do in 2-3 sentences";
  await testClaudeCli(command);
}

// Run if this script is called directly
if (require.main === module) {
  main();
} else {
  // Export for use as a module
  module.exports = { testClaudeCli };
} 