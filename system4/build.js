/**
 * Gaana AI Assistant - Build Script
 * 
 * This script automates the packaging process for the desktop application.
 * It handles building for macOS and Windows platforms.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const packageJson = require('./package.json');

// Configuration
const APP_NAME = packageJson.name;
const APP_VERSION = packageJson.version;
const BUILD_DIR = path.join(__dirname, 'dist');

// Make sure the build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Log helper
function log(message) {
  console.log(`\x1b[36m[BUILD]\x1b[0m ${message}`);
}

function error(message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  process.exit(1);
}

// Build for a specific platform
function buildForPlatform(platform) {
  log(`Building ${APP_NAME} v${APP_VERSION} for ${platform}...`);
  
  try {
    execSync(`electron-builder build --${platform}`, { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    log(`${platform} build complete!`);
    return true;
  } catch (err) {
    error(`Failed to build for ${platform}: ${err.message}`);
    return false;
  }
}

// Main build process
async function main() {
  const args = process.argv.slice(2);
  const buildMac = args.includes('--mac') || args.length === 0;
  const buildWin = args.includes('--win') || args.length === 0;
  
  log(`Starting build process for ${APP_NAME} v${APP_VERSION}`);
  
  // Install dependencies if node_modules doesn't exist
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  }
  
  // Check and install electron-builder if needed
  try {
    require('electron-builder');
  } catch (err) {
    log('Installing electron-builder...');
    execSync('npm install -D electron-builder', { stdio: 'inherit' });
  }
  
  // Build for platforms
  let success = true;
  
  if (buildMac) {
    success = buildForPlatform('mac') && success;
  }
  
  if (buildWin) {
    success = buildForPlatform('win') && success;
  }
  
  if (success) {
    log(`Build process completed successfully! Artifacts available in: ${BUILD_DIR}`);
  } else {
    error('Build process completed with errors');
  }
}

// Run the build process
main().catch(err => {
  error(`Unhandled error: ${err.message}`);
}); 