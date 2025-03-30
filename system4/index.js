/**
 * Gaana AI Assistant - Main Entry Point
 * This file determines whether to run as a desktop app or web server
 */

const { existsSync } = require('fs');
const path = require('path');
const log = require('electron-log');

// Setup logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Determine if this is being run by Electron
const isElectron = process.argv.includes('--electron') || 
                  process.env.ELECTRON_RUN_AS_NODE ||
                  process.versions.electron;

if (isElectron) {
  log.info('Starting in Electron mode');
  
  // If being run by Electron, we don't need to do anything
  // The electron.js file will take care of starting the server and UI
  
} else {
  log.info('Starting in web server mode');
  
  // If running as a regular Node.js process, start the server
  try {
    const server = require('./server');
    server.start();
  } catch (error) {
    log.error('Failed to start server:', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

module.exports = { isElectron }; 