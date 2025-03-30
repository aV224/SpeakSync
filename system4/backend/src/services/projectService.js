const Project = require('../models/Project');
const logger = require('electron-log');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

/**
 * Project Service
 * Handles database operations for project data
 */
class ProjectService {
  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  static async createProject(projectData) {
    try {
      // Generate a project ID if one wasn't provided
      if (!projectData.projectId) {
        projectData.projectId = `proj_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      }

      // Check if project with same path already exists
      const existingProject = await Project.findOne({ path: projectData.path });
      if (existingProject) {
        throw new Error(`Project already exists at path: ${projectData.path}`);
      }

      // Create new project instance
      const project = new Project({
        projectId: projectData.projectId,
        name: projectData.name,
        path: projectData.path,
        type: projectData.type || 'default',
        isDefault: projectData.isDefault || false,
        description: projectData.description || '',
        config: projectData.config || {},
        status: 'active'
      });

      // If this is marked as default, unset any existing default
      if (project.isDefault) {
        await Project.updateMany(
          { isDefault: true },
          { $set: { isDefault: false } }
        );
      }

      // Save project to database
      await project.save();
      logger.info(`Project created: ${project.name} (${project.projectId})`);
      
      // Create project directory if it doesn't exist
      if (projectData.createDirectory && !fs.existsSync(project.path)) {
        fs.mkdirSync(project.path, { recursive: true });
        logger.info(`Created project directory: ${project.path}`);
      }
      
      return project;
    } catch (error) {
      logger.error(`Error creating project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all projects
   * @param {boolean} activeOnly - Filter to active projects only
   * @returns {Promise<Array>} Array of projects
   */
  static async getAllProjects(activeOnly = true) {
    try {
      const query = activeOnly ? { status: 'active' } : {};
      const projects = await Project.find(query).sort({ isDefault: -1, name: 1 });
      return projects;
    } catch (error) {
      logger.error(`Error getting all projects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project
   */
  static async getProjectById(projectId) {
    try {
      const project = await Project.findOne({ projectId });
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }
      return project;
    } catch (error) {
      logger.error(`Error getting project by ID: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get default project
   * @returns {Promise<Object>} Default project
   */
  static async getDefaultProject() {
    try {
      const project = await Project.findOne({ isDefault: true });
      if (!project) {
        // If no default project exists, get the first active project
        const firstProject = await Project.findOne({ status: 'active' });
        return firstProject;
      }
      return project;
    } catch (error) {
      logger.error(`Error getting default project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update project
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated project
   */
  static async updateProject(projectId, updateData) {
    try {
      const project = await Project.findOne({ projectId });
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Handle updating fields
      if (updateData.name) project.name = updateData.name;
      if (updateData.description) project.description = updateData.description;
      if (updateData.path) project.path = updateData.path;
      if (updateData.type) project.type = updateData.type;
      if (updateData.config) project.config = { ...project.config, ...updateData.config };
      if (updateData.status) project.status = updateData.status;
      
      // If making this project default, unset any other defaults
      if (updateData.isDefault && updateData.isDefault !== project.isDefault) {
        await Project.updateMany(
          { isDefault: true },
          { $set: { isDefault: false } }
        );
        project.isDefault = true;
      } else if (updateData.isDefault === false) {
        project.isDefault = false;
      }

      await project.save();
      logger.info(`Project updated: ${project.name} (${project.projectId})`);
      return project;
    } catch (error) {
      logger.error(`Error updating project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Archived project
   */
  static async archiveProject(projectId) {
    try {
      const project = await Project.findOne({ projectId });
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Can't archive default project
      if (project.isDefault) {
        throw new Error('Cannot archive default project. Set another project as default first.');
      }

      // Archive project
      project.status = 'archived';
      project.dateArchived = new Date();
      
      await project.save();
      logger.info(`Project archived: ${project.name} (${project.projectId})`);
      return project;
    } catch (error) {
      logger.error(`Error archiving project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete project
   * @param {string} projectId - Project ID
   * @param {boolean} deleteFiles - Whether to delete project files
   * @returns {Promise<boolean>} Success
   */
  static async deleteProject(projectId, deleteFiles = false) {
    try {
      const project = await Project.findOne({ projectId });
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Can't delete default project
      if (project.isDefault) {
        throw new Error('Cannot delete default project. Set another project as default first.');
      }

      // Delete project files if requested
      if (deleteFiles && project.path && fs.existsSync(project.path)) {
        try {
          // Using recursive rm to delete directory and contents
          fs.rmSync(project.path, { recursive: true, force: true });
          logger.info(`Deleted project directory: ${project.path}`);
        } catch (fsError) {
          logger.error(`Error deleting project directory: ${fsError.message}`);
          // Continue with project deletion even if files couldn't be deleted
        }
      }

      // Delete project from database
      await Project.deleteOne({ projectId });
      logger.info(`Project deleted: ${project.name} (${project.projectId})`);
      return true;
    } catch (error) {
      logger.error(`Error deleting project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set default project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Default project
   */
  static async setDefaultProject(projectId) {
    try {
      // Clear existing default
      await Project.updateMany(
        { isDefault: true },
        { $set: { isDefault: false } }
      );

      // Set new default
      const project = await Project.findOneAndUpdate(
        { projectId },
        { $set: { isDefault: true } },
        { new: true }
      );

      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      logger.info(`Set default project: ${project.name} (${project.projectId})`);
      return project;
    } catch (error) {
      logger.error(`Error setting default project: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track project access
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Updated project
   */
  static async trackProjectAccess(projectId) {
    try {
      const project = await Project.findOne({ projectId });
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Update access timestamp and count
      project.stats.lastAccessed = new Date();
      project.stats.accessCount += 1;
      
      await project.save();
      return project;
    } catch (error) {
      logger.error(`Error tracking project access: ${error.message}`);
      // Don't throw error for tracking failures
      return null;
    }
  }

  /**
   * Validate project path
   * @param {string} projectPath - Path to validate
   * @returns {Object} Validation result
   */
  static validateProjectPath(projectPath) {
    try {
      if (!projectPath) {
        return { valid: false, error: 'Project path is required' };
      }

      // Check if path exists
      const exists = fs.existsSync(projectPath);
      
      // Check if path is a directory
      const isDirectory = exists ? fs.statSync(projectPath).isDirectory() : false;
      
      // Check if path is writable
      let isWritable = false;
      if (exists) {
        try {
          // Try to write a temporary file to test write permissions
          const testFile = path.join(projectPath, `.test_${Date.now()}`);
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          isWritable = true;
        } catch (e) {
          isWritable = false;
        }
      }

      return {
        valid: isDirectory && isWritable,
        exists,
        isDirectory,
        isWritable,
        error: !isDirectory ? 'Path is not a directory' : 
               !isWritable ? 'Path is not writable' : null
      };
    } catch (error) {
      logger.error(`Error validating project path: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = ProjectService; 