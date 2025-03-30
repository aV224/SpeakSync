/**
 * Claude Code Integration for Gaana
 * 
 * This module provides integration for Claude Code-like functionality
 * in the Gaana project, enabling AI to:
 * 1. Read and index the entire codebase
 * 2. Make changes to files directly
 * 3. Execute Bash commands with expanded permissions
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fileUtils = require('./fileUtils');
const log = require('electron-log');

class ClaudeCodeIntegration {
  /**
   * Initialize the Claude Code integration
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.config = {
      rootDir: options.rootDir || process.cwd(),
      allowedPaths: options.allowedPaths || ['projects', 'backend', 'frontend', 'utils', 'routes', 'services', 'controllers', 'models'],
      excludeDirs: options.excludeDirs || ['node_modules', '.git', 'dist', 'build', 'temp'],
      claudeCliPath: options.claudeCliPath || '/opt/homebrew/bin/claude',
      dangerousPermissions: options.dangerousPermissions || false,
      ...options
    };

    log.info('Claude Code Integration initialized with config:', this.config);
  }

  /**
   * Index the entire codebase recursively
   * @param {string} startPath - Starting directory path
   * @returns {Promise<Object>} - Index of the codebase
   */
  async indexCodebase(startPath = this.config.rootDir) {
    log.info(`Indexing codebase from ${startPath}`);
    const index = {
      files: [],
      directories: [],
      stats: {
        totalFiles: 0,
        totalDirs: 0,
        totalSize: 0,
        fileTypes: {}
      }
    };

    // Build directory structure
    const traverseDir = async (dirPath, relativePath = '') => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        
        // Skip excluded directories
        if (entry.isDirectory() && this.config.excludeDirs.includes(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          index.directories.push(entryRelativePath);
          index.stats.totalDirs++;
          await traverseDir(entryPath, entryRelativePath);
        } else {
          // Get file stats
          const stats = await fs.promises.stat(entryPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          // Update file type stats
          if (!index.stats.fileTypes[ext]) {
            index.stats.fileTypes[ext] = { count: 0, size: 0 };
          }
          index.stats.fileTypes[ext].count++;
          index.stats.fileTypes[ext].size += stats.size;
          
          index.files.push({
            path: entryRelativePath,
            size: stats.size,
            type: ext,
            modified: stats.mtime
          });
          
          index.stats.totalFiles++;
          index.stats.totalSize += stats.size;
        }
      }
    };
    
    await traverseDir(startPath);
    log.info(`Indexed ${index.stats.totalFiles} files in ${index.stats.totalDirs} directories`);
    
    return index;
  }

  /**
   * Check if a file path is allowed for read/write access
   * @param {string} filePath - Path to check
   * @returns {boolean} - Whether the path is allowed
   */
  isFilePathAllowed(filePath) {
    // If dangerous permissions are enabled, all paths are allowed
    if (this.config.dangerousPermissions) {
      return true;
    }

    // Convert to relative path if absolute
    let relativePath = filePath;
    if (path.isAbsolute(filePath)) {
      relativePath = path.relative(this.config.rootDir, filePath);
    }

    // Check if path starts with any allowed path
    return this.config.allowedPaths.some(allowedPath => 
      relativePath === allowedPath || 
      relativePath.startsWith(`${allowedPath}/`)
    );
  }

  /**
   * Read a file with extended permissions
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} - File content
   */
  async readFile(filePath) {
    // Resolve absolute path
    const absPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.config.rootDir, filePath);
    
    // Check if path is allowed
    if (!this.isFilePathAllowed(absPath)) {
      throw new Error(`Access denied: Cannot read file outside allowed paths: ${filePath}`);
    }
    
    try {
      const content = await fs.promises.readFile(absPath, 'utf8');
      return content;
    } catch (error) {
      log.error(`Error reading file ${filePath}:`, error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write a file with extended permissions
   * @param {string} filePath - Path to the file
   * @param {string} content - Content to write
   * @returns {Promise<boolean>} - Success status
   */
  async writeFile(filePath, content) {
    // Resolve absolute path
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.config.rootDir, filePath);
    
    // Check if path is allowed
    if (!this.isFilePathAllowed(absPath)) {
      throw new Error(`Access denied: Cannot write file outside allowed paths: ${filePath}`);
    }
    
    try {
      // Ensure parent directory exists
      const dirPath = path.dirname(absPath);
      await fileUtils.ensureDirectoryExists(dirPath);
      
      // Write the file
      await fs.promises.writeFile(absPath, content);
      return true;
    } catch (error) {
      log.error(`Error writing file ${filePath}:`, error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Execute a command with extended permissions
   * @param {string} command - Command to execute
   * @param {string} workingDir - Working directory
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(command, workingDir = this.config.rootDir) {
    log.info(`Executing command: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 30000,
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer
      });
      
      return {
        success: true,
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        exitCode: 0
      };
    } catch (error) {
      log.error(`Error executing command:`, error);
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Execute Claude with a prompt and code context
   * @param {string} prompt - The prompt for Claude
   * @param {Object} context - Context information
   * @returns {Promise<Object>} - Claude's response
   */
  async executeClaudeWithCodebase(prompt, context = {}) {
    log.info(`Executing Claude with codebase context`);
    
    try {
      // Create a temporary prompt file with codebase context
      const tempDir = path.join(this.config.rootDir, 'temp');
      await fileUtils.ensureDirectoryExists(tempDir);
      
      const tempFile = path.join(tempDir, `claude_prompt_${Date.now()}.txt`);
      
      // Format prompt with codebase context
      const formattedPrompt = this._formatPromptWithCodebaseContext(prompt, context);
      
      // Write to temp file
      await fs.promises.writeFile(tempFile, formattedPrompt);
      
      // Execute Claude with dangerous permissions flag
      const claudeProcess = spawn(this.config.claudeCliPath, [
        '--print',
        `--prompt-file=${tempFile}`,
        `--cwd=${this.config.rootDir}`,
        '--dangerously-skip-permissions'
      ]);
      
      let stdout = '';
      let stderr = '';
      
      // Collect stdout
      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      const result = await new Promise((resolve, reject) => {
        claudeProcess.on('close', (code) => {
          // Clean up temp file
          fs.promises.unlink(tempFile).catch(() => {});
          
          if (code === 0) {
            resolve({
              success: true,
              message: stdout
            });
          } else {
            resolve({
              success: false,
              error: stderr,
              message: stdout || 'Claude execution failed'
            });
          }
        });
        
        claudeProcess.on('error', (error) => {
          // Clean up temp file
          fs.promises.unlink(tempFile).catch(() => {});
          reject(error);
        });
      });
      
      return result;
    } catch (error) {
      log.error('Error executing Claude with codebase:', error);
      return {
        success: false,
        error: error.message,
        message: "Failed to execute Claude with codebase context."
      };
    }
  }

  /**
   * Format a prompt with codebase context
   * @param {string} prompt - Original prompt
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   * @private
   */
  _formatPromptWithCodebaseContext(prompt, context) {
    const projectName = context.projectName || path.basename(this.config.rootDir);
    
    return `
# Claude Code for Gaana Project

## Project Context
- Project Name: ${projectName}
- Working Directory: ${this.config.rootDir}
- Environment: ${process.env.NODE_ENV || 'development'}

## Task
${prompt}

## Important Instructions
1. You have FULL ACCESS to read and write files in the project
2. You can execute shell commands with elevated permissions
3. Follow software engineering best practices
4. Maintain code style and conventions of the existing codebase
5. Make changes safely, preserving existing functionality

## Available Tools
- File operations: read, write, create, delete files
- Directory operations: list, create directories
- Command execution: run shell commands with elevated permissions
- Code analysis: analyze the codebase structure and patterns

## Response Guidelines
- Describe your changes clearly
- Explain your reasoning for implementation choices
- If you make file changes, list the modified files
- Return any command outputs that are relevant
`;
  }
}

module.exports = ClaudeCodeIntegration;