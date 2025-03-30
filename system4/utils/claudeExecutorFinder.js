/**
 * Claude Executor Finder
 * Utility to find the correct path to the Claude direct executor script
 */

const fs = require('fs');
const path = require('path');

/**
 * Find the Claude direct executor module by searching in multiple possible paths
 * @returns {Object|null} The Claude direct executor module if found, null otherwise
 */
function findClaudeDirectExecutor() {
  const possiblePaths = [
    // Root relative paths
    './backend/src/config/claude_direct_executor.js',
    './src/config/claude_direct_executor.js',
    './config/claude_direct_executor.js',
    
    // Up one directory
    '../backend/src/config/claude_direct_executor.js',
    '../src/config/claude_direct_executor.js',
    
    // Absolute paths based on __dirname
    path.join(__dirname, '../backend/src/config/claude_direct_executor.js'),
    path.join(__dirname, '../src/config/claude_direct_executor.js'),
    path.join(__dirname, '../config/claude_direct_executor.js'),
    
    // Special paths
    path.join(process.cwd(), 'backend/src/config/claude_direct_executor.js'),
    path.join(process.cwd(), 'src/config/claude_direct_executor.js')
  ];
  
  console.log('Looking for Claude direct executor in these paths:');
  
  for (const modulePath of possiblePaths) {
    try {
      // First check if the file exists
      if (fs.existsSync(modulePath)) {
        console.log(`Found Claude direct executor at: ${modulePath}`);
        return require(modulePath);
      }
    } catch (error) {
      // Ignore errors and continue searching
    }
  }
  
  console.log('Could not find Claude direct executor in any of the searched paths');
  return null;
}

module.exports = { findClaudeDirectExecutor }; 