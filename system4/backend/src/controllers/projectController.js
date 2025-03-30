const ProjectService = require('../services/projectService');
const logger = require('electron-log');
const fs = require('fs');
const path = require('path');

/**
 * Project Controller
 * Handles HTTP requests for project data
 */
class ProjectController {
  /**
   * Create a new project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createProject(req, res) {
    try {
      const projectData = req.body;
      
      // Basic validation
      if (!projectData.name || !projectData.path) {
        return res.status(400).json({
          success: false,
          message: 'Project name and path are required'
        });
      }
      
      // Validate project path
      const pathValidation = ProjectService.validateProjectPath(projectData.path);
      if (!pathValidation.valid && projectData.createDirectory !== true) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project path',
          validation: pathValidation
        });
      }
      
      const project = await ProjectService.createProject(projectData);
      
      return res.status(201).json({
        success: true,
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      logger.error(`Error creating project: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error creating project',
        error: error.message
      });
    }
  }
  
  /**
   * Get all projects
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllProjects(req, res) {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const projects = await ProjectService.getAllProjects(activeOnly);
      
      return res.status(200).json({
        success: true,
        count: projects.length,
        projects
      });
    } catch (error) {
      logger.error(`Error retrieving projects: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving projects',
        error: error.message
      });
    }
  }
  
  /**
   * Get project by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProjectById(req, res) {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const project = await ProjectService.getProjectById(projectId);
      
      // Track project access
      await ProjectService.trackProjectAccess(projectId);
      
      return res.status(200).json({
        success: true,
        project
      });
    } catch (error) {
      logger.error(`Error retrieving project: ${error.message}`);
      
      // Handle 404 errors specifically
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error retrieving project',
        error: error.message
      });
    }
  }
  
  /**
   * Get default project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDefaultProject(req, res) {
    try {
      const project = await ProjectService.getDefaultProject();
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'No default project found'
        });
      }
      
      // Track project access
      await ProjectService.trackProjectAccess(project.projectId);
      
      return res.status(200).json({
        success: true,
        project
      });
    } catch (error) {
      logger.error(`Error retrieving default project: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving default project',
        error: error.message
      });
    }
  }
  
  /**
   * Update project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProject(req, res) {
    try {
      const { projectId } = req.params;
      const updateData = req.body;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      // Validate path if it's being updated
      if (updateData.path) {
        const pathValidation = ProjectService.validateProjectPath(updateData.path);
        if (!pathValidation.valid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid project path',
            validation: pathValidation
          });
        }
      }
      
      const project = await ProjectService.updateProject(projectId, updateData);
      
      return res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        project
      });
    } catch (error) {
      logger.error(`Error updating project: ${error.message}`);
      
      // Handle 404 errors specifically
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error updating project',
        error: error.message
      });
    }
  }
  
  /**
   * Set default project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async setDefaultProject(req, res) {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const project = await ProjectService.setDefaultProject(projectId);
      
      return res.status(200).json({
        success: true,
        message: 'Default project set successfully',
        project
      });
    } catch (error) {
      logger.error(`Error setting default project: ${error.message}`);
      
      // Handle 404 errors specifically
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error setting default project',
        error: error.message
      });
    }
  }
  
  /**
   * Archive project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async archiveProject(req, res) {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const project = await ProjectService.archiveProject(projectId);
      
      return res.status(200).json({
        success: true,
        message: 'Project archived successfully',
        project
      });
    } catch (error) {
      logger.error(`Error archiving project: ${error.message}`);
      
      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('Cannot archive default project')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error archiving project',
        error: error.message
      });
    }
  }
  
  /**
   * Delete project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteProject(req, res) {
    try {
      const { projectId } = req.params;
      const { deleteFiles } = req.query;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      await ProjectService.deleteProject(projectId, deleteFiles === 'true');
      
      return res.status(200).json({
        success: true,
        message: `Project ${projectId} deleted successfully`
      });
    } catch (error) {
      logger.error(`Error deleting project: ${error.message}`);
      
      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error.message.includes('Cannot delete default project')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error deleting project',
        error: error.message
      });
    }
  }
  
  /**
   * Validate project path
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static validatePath(req, res) {
    try {
      const { path: projectPath } = req.body;
      
      if (!projectPath) {
        return res.status(400).json({
          success: false,
          message: 'Project path is required'
        });
      }
      
      const validation = ProjectService.validateProjectPath(projectPath);
      
      return res.status(200).json({
        success: true,
        validation
      });
    } catch (error) {
      logger.error(`Error validating project path: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error validating project path',
        error: error.message
      });
    }
  }
  
  /**
   * Get project files
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProjectFiles(req, res) {
    try {
      const { projectId } = req.params;
      const { subPath = '' } = req.query;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      // Get project to check path
      const project = await ProjectService.getProjectById(projectId);
      
      // Resolve full path (prevent path traversal with normalize)
      const fullPath = path.normalize(path.join(project.path, subPath));
      
      // Security check - ensure path is within project directory
      if (!fullPath.startsWith(project.path)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Path is outside project directory'
        });
      }
      
      // Check if path exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: 'Path not found'
        });
      }
      
      // Get directory contents
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(fullPath)
          .map(file => {
            const filePath = path.join(fullPath, file);
            const fileStat = fs.statSync(filePath);
            return {
              name: file,
              path: path.relative(project.path, filePath),
              type: fileStat.isDirectory() ? 'directory' : 'file',
              size: fileStat.size,
              modified: fileStat.mtime
            };
          })
          .sort((a, b) => {
            // Sort directories first, then by name
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          });
        
        return res.status(200).json({
          success: true,
          path: path.relative(project.path, fullPath),
          files
        });
      } else {
        // For files, just return metadata
        return res.status(200).json({
          success: true,
          file: {
            name: path.basename(fullPath),
            path: path.relative(project.path, fullPath),
            type: 'file',
            size: stats.size,
            modified: stats.mtime
          }
        });
      }
    } catch (error) {
      logger.error(`Error retrieving project files: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error retrieving project files',
        error: error.message
      });
    }
  }
}

module.exports = ProjectController; 