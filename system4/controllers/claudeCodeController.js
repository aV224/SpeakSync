/**
 * Claude Code Controller
 * 
 * This controller handles requests for the Claude Code integration,
 * allowing full codebase access and modification.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ClaudeCodeIntegration = require('../utils/claudeCodeIntegration');
const log = require('electron-log');

// Initialize the Claude Code integration
const claudeCode = new ClaudeCodeIntegration({
  rootDir: process.cwd(),
  dangerousPermissions: true
});

/**
 * Execute Claude Code with codebase access
 */
exports.executeClaudeCode = async (req, res) => {
  try {
    const { prompt, context = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'No prompt provided'
      });
    }
    
    log.info('Executing Claude Code with prompt:', prompt.substring(0, 100) + '...');
    
    // Use the integration to execute Claude with codebase context
    const result = await claudeCode.executeClaudeWithCodebase(prompt, context);
    
    res.json({
      success: result.success,
      message: result.message,
      error: result.error
    });
  } catch (error) {
    log.error('Claude Code execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Execute a shell command with elevated permissions
 */
exports.executeCommand = async (req, res) => {
  try {
    const { command, workingDir } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'No command provided'
      });
    }
    
    log.info('Executing command with elevated permissions:', command);
    
    // Execute the command with the integration
    const result = await claudeCode.executeCommand(command, workingDir);
    
    res.json({
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error
    });
  } catch (error) {
    log.error('Command execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Read a file with elevated permissions
 */
exports.readFile = async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'No file path provided'
      });
    }
    
    log.info('Reading file with elevated permissions:', filePath);
    
    // Read the file with the integration
    const content = await claudeCode.readFile(filePath);
    
    res.json({
      success: true,
      content
    });
  } catch (error) {
    log.error('File read error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Write a file with elevated permissions
 */
exports.writeFile = async (req, res) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'No file path provided'
      });
    }
    
    if (content === undefined) {
      return res.status(400).json({
        success: false,
        error: 'No content provided'
      });
    }
    
    log.info('Writing file with elevated permissions:', filePath);
    
    // Write the file with the integration
    await claudeCode.writeFile(filePath, content);
    
    res.json({
      success: true,
      message: `File ${filePath} written successfully`
    });
  } catch (error) {
    log.error('File write error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Index the codebase and return structure information
 */
exports.indexCodebase = async (req, res) => {
  try {
    log.info('Indexing codebase');
    
    // Index the codebase using the integration
    const index = await claudeCode.indexCodebase();
    
    res.json({
      success: true,
      index
    });
  } catch (error) {
    log.error('Codebase indexing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};