const Directory = require('../models/Directory');
const path = require('path');
const fs = require('fs').promises;
const logger = require('electron-log');
const mongoose = require('mongoose');
const { isValidPath } = require('../utils/fileUtils');

/**
 * Directory Controller
 * Manages directory permissions for Claude AI
 */
const directoryController = {
  /**
   * Initialize directory controller and ensure connection
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1) {
        logger.warn('MongoDB not connected, attempting to connect');
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('MongoDB connected successfully');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize DirectoryController:', error);
      throw error;
    }
  },

  /**
   * Get all directories
   */
  async getAllDirectories() {
    await this.initialize();
    
    try {
      const directories = await Directory.find({}).sort({ createdAt: -1 });
      return directories;
    } catch (error) {
      logger.error('Error getting all directories:', error);
      throw error;
    }
  },

  /**
   * Get active directories
   */
  async getActiveDirectories() {
    await this.initialize();
    
    try {
      const directories = await Directory.find({ status: 'active' }).sort({ createdAt: -1 });
      return directories;
    } catch (error) {
      logger.error('Error getting active directories:', error);
      throw error;
    }
  },

  /**
   * Get directory by ID
   */
  async getDirectoryById(directoryId) {
    await this.initialize();
    
    try {
      const directory = await Directory.findById(directoryId);
      if (!directory) {
        throw new Error('Directory not found');
      }
      return directory;
    } catch (error) {
      logger.error(`Error getting directory by ID ${directoryId}:`, error);
      throw error;
    }
  },

  /**
   * Add a new directory
   */
  async addDirectory(directoryData) {
    await this.initialize();
    
    try {
      // Validate directory path
      if (!directoryData.path) {
        throw new Error('Directory path is required');
      }

      // Check if directory exists on disk
      try {
        const stats = await fs.stat(directoryData.path);
        if (!stats.isDirectory()) {
          throw new Error('Path exists but is not a directory');
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          throw new Error('Directory does not exist on disk');
        }
        throw err;
      }

      // Check if directory already exists in database
      const existingDirectory = await Directory.findOne({ path: directoryData.path });
      if (existingDirectory) {
        throw new Error('Directory already exists in database');
      }

      // Set default name from path if not provided
      if (!directoryData.name) {
        directoryData.name = path.basename(directoryData.path);
      }

      // Create directory
      const directory = new Directory(directoryData);
      await directory.save();
      
      logger.info(`Added new directory: ${directoryData.path}`);
      return directory;
    } catch (error) {
      logger.error('Error adding directory:', error);
      throw error;
    }
  },

  /**
   * Update a directory
   */
  async updateDirectory(directoryId, directoryData) {
    await this.initialize();
    
    try {
      const directory = await Directory.findById(directoryId);
      if (!directory) {
        throw new Error('Directory not found');
      }

      // Check if path changed and validate
      if (directoryData.path && directoryData.path !== directory.path) {
        try {
          const stats = await fs.stat(directoryData.path);
          if (!stats.isDirectory()) {
            throw new Error('Path exists but is not a directory');
          }
        } catch (err) {
          if (err.code === 'ENOENT') {
            throw new Error('Directory does not exist on disk');
          }
          throw err;
        }

        // Check if new path already exists in database
        const existingDirectory = await Directory.findOne({ 
          path: directoryData.path,
          _id: { $ne: directoryId }
        });
        
        if (existingDirectory) {
          throw new Error('Directory with this path already exists in database');
        }
      }

      // Update directory
      const updatedDirectory = await Directory.findByIdAndUpdate(
        directoryId,
        { $set: directoryData },
        { new: true }
      );
      
      logger.info(`Updated directory ${directoryId}`);
      return updatedDirectory;
    } catch (error) {
      logger.error(`Error updating directory ${directoryId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a directory
   */
  async deleteDirectory(directoryId) {
    await this.initialize();
    
    try {
      const directory = await Directory.findById(directoryId);
      if (!directory) {
        throw new Error('Directory not found');
      }

      await Directory.findByIdAndDelete(directoryId);
      logger.info(`Deleted directory ${directoryId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting directory ${directoryId}:`, error);
      throw error;
    }
  },

  /**
   * Initialize default directories from environment
   */
  async initializeDefaultDirectories() {
    await this.initialize();
    
    try {
      const defaultDirectories = [];
      const gaanaProjectPath = process.env.GAANA_PROJECT_PATH;
      const gameProjectPath = process.env.GAME_PROJECT_PATH;
      
      let count = 0;
      
      if (gaanaProjectPath && await fs.access(gaanaProjectPath)) {
        const gaanaExists = await Directory.findOne({ path: gaanaProjectPath });
        if (!gaanaExists) {
          const gaanaDir = new Directory({
            name: 'Gaana Project',
            path: gaanaProjectPath,
            description: 'Main Gaana project directory with Claude integration',
            allowModification: true,
            allowExecution: true,
            allowedFileTypes: ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md'],
            allowedCommands: ['npm', 'node', 'ls', 'pwd', 'cd', 'cat', 'git'],
            status: 'active'
          });
          
          await gaanaDir.save();
          defaultDirectories.push(gaanaDir);
          count++;
        }
      }
      
      if (gameProjectPath && await fs.access(gameProjectPath)) {
        const gameExists = await Directory.findOne({ path: gameProjectPath });
        if (!gameExists) {
          const gameDir = new Directory({
            name: 'Game Project',
            path: gameProjectPath,
            description: 'Game development project with Unity integration',
            allowModification: true,
            allowExecution: true,
            allowedFileTypes: ['cs', 'js', 'json', 'txt', 'md'],
            allowedCommands: ['npm', 'node', 'ls', 'pwd', 'cd', 'cat'],
            status: 'active'
          });
          
          await gameDir.save();
          defaultDirectories.push(gameDir);
          count++;
        }
      }
      
      logger.info(`Initialized ${count} default directories`);
      return { count, directories: defaultDirectories };
    } catch (error) {
      logger.error('Error initializing default directories:', error);
      throw error;
    }
  },

  /**
   * Check if a path is allowed for specific operation
   */
  async checkPathPermission(pathToCheck, operation = 'read') {
    await this.initialize();
    
    try {
      if (!pathToCheck) {
        return { allowed: false, reason: 'No path provided' };
      }
      
      // Normalize path
      const normalizedPath = path.normalize(pathToCheck);
      
      // Get all active directories
      const activeDirectories = await this.getActiveDirectories();
      
      // Check if path is within any allowed directory
      for (const directory of activeDirectories) {
        const dirPath = path.normalize(directory.path);
        
        if (normalizedPath === dirPath || normalizedPath.startsWith(dirPath + path.sep)) {
          // Check specific permissions based on operation
          if (operation === 'write' && !directory.allowModification) {
            return { 
              allowed: false, 
              reason: 'Modification not allowed in this directory',
              directory
            };
          }
          
          if (operation === 'execute' && !directory.allowExecution) {
            return { 
              allowed: false, 
              reason: 'Command execution not allowed in this directory',
              directory
            };
          }
          
          return { allowed: true, directory };
        }
      }
      
      return { 
        allowed: false, 
        reason: 'Path is not within any allowed directory'
      };
    } catch (error) {
      logger.error('Error checking path permission:', error);
      return { allowed: false, reason: error.message };
    }
  },

  /**
   * Check if a command is allowed in a specific path
   */
  async checkCommandPermission(command, pathToRun) {
    await this.initialize();
    
    try {
      if (!command) {
        return { allowed: false, reason: 'No command provided' };
      }
      
      if (!pathToRun) {
        return { allowed: false, reason: 'No path provided' };
      }
      
      // First check if the path is allowed for execution
      const pathCheck = await this.checkPathPermission(pathToRun, 'execute');
      if (!pathCheck.allowed) {
        return pathCheck;
      }
      
      const directory = pathCheck.directory;
      
      // Extract the base command (first word before any spaces)
      const baseCommand = command.split(' ')[0];
      
      // Check if the command is in the allowed list
      if (directory.allowedCommands.includes(baseCommand)) {
        return { allowed: true, directory };
      }
      
      // Special case for allowing package managers and their commands
      if (directory.allowedCommands.includes('npm') && 
          (baseCommand === 'npx' || baseCommand === 'yarn')) {
        return { allowed: true, directory };
      }
      
      return { 
        allowed: false, 
        reason: `Command '${baseCommand}' is not allowed in this directory`,
        directory
      };
    } catch (error) {
      logger.error('Error checking command permission:', error);
      return { allowed: false, reason: error.message };
    }
  },

  /**
   * Build a security context for Claude based on a path
   */
  async buildClaudeSecurityContext(projectPath) {
    await this.initialize();
    
    try {
      if (!projectPath) {
        return { allowed: false, context: { restrictionLevel: 'high' } };
      }
      
      // Check path permissions
      const pathCheck = await this.checkPathPermission(projectPath);
      if (!pathCheck.allowed) {
        return { 
          allowed: false, 
          context: { 
            restrictionLevel: 'high',
            reason: pathCheck.reason
          }
        };
      }
      
      const directory = pathCheck.directory;
      
      // Build Claude security context
      const securityContext = {
        restrictionLevel: 'low',
        allowedDirectories: [directory.path],
        allowedFileTypes: directory.allowedFileTypes,
        allowModification: directory.allowModification,
        allowExecution: directory.allowExecution,
        allowedCommands: directory.allowExecution ? directory.allowedCommands : []
      };
      
      return { allowed: true, context: securityContext };
    } catch (error) {
      logger.error('Error building Claude security context:', error);
      return { 
        allowed: false, 
        context: { 
          restrictionLevel: 'high',
          reason: error.message
        }
      };
    }
  },

  /**
   * Get directories by project
   * @param {string} projectId Project ID
   * @returns {Promise<Array>} List of directories
   */
  async getDirectoriesByProject(projectId) {
    try {
      return await Directory.findByProject(projectId);
    } catch (error) {
      logger.error(`Error fetching directories for project ${projectId}:`, error);
      throw error;
    }
  }
};

module.exports = directoryController; 