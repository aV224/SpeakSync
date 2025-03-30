const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const log = require('electron-log'); // Use electron-log instead of custom logger
const fileUtils = require('../utils/fileUtils'); // Import fileUtils
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const util = require('util'); // For promisify

// Placeholder for the Mongoose Project model
// If you have a models/Project.js file, uncomment the next line:
// const Project = require('../models/Project'); 

const PROJECTS_JSON_PATH = path.join(__dirname, '..', 'data', 'projects.json');
const ACTIVE_PROJECT_PATH = path.join(__dirname, '..', 'data', 'active_project.json');

// Default projects directory from environment variable
const PROJECTS_DIRECTORY = process.env.PROJECTS_DIRECTORY || path.join(__dirname, '..', 'projects');

// Ensure data directory exists
(async () => {
  try {
    const dataDir = path.dirname(ACTIVE_PROJECT_PATH);
    await fileUtils.ensureDirectoryExists(dataDir);
    
    // Also ensure the projects directory exists
    await fileUtils.ensureDirectoryExists(PROJECTS_DIRECTORY);
    log.info(`Projects directory: ${PROJECTS_DIRECTORY}`);
  } catch (err) {
    log.error('Error ensuring directories exist:', err);
  }
})();

/**
 * Reads projects from the JSON file.
 * Creates the file with an empty array if it doesn't exist.
 * @returns {Promise<Array>} An array of project objects.
 */
const readProjectsFromJson = async () => {
  try {
    await fs.access(PROJECTS_JSON_PATH);
  } catch (error) {
    // File doesn't exist, create it with an empty array
    log.warn(`Projects JSON file not found at ${PROJECTS_JSON_PATH}. Creating it.`);
    await fileUtils.ensureDirectoryExists(path.dirname(PROJECTS_JSON_PATH));
    await fs.writeFile(PROJECTS_JSON_PATH, JSON.stringify([]), 'utf8');
  }

  try {
    const data = await fs.readFile(PROJECTS_JSON_PATH, 'utf8');
    return JSON.parse(data || '[]'); // Handle empty file
  } catch (error) {
    log.error('Error reading or parsing projects.json:', error);
    throw new Error('Could not load projects from JSON file.');
  }
};

/**
 * Save projects to the JSON file
 * @param {Array} projects - Array of project objects
 * @returns {Promise<boolean>} Success indicator
 */
const saveProjectsToJson = async (projects) => {
  try {
    await fileUtils.ensureDirectoryExists(path.dirname(PROJECTS_JSON_PATH));
    await fs.writeFile(
      PROJECTS_JSON_PATH,
      JSON.stringify(projects, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    log.error('Error saving projects to JSON:', error);
    return false;
  }
};

/**
 * Scans the projects directory for projects that might not be in the JSON file.
 * @returns {Promise<Array>} Array of project objects
 */
const scanProjectsDirectory = async () => {
  try {
    log.info(`Scanning projects directory: ${PROJECTS_DIRECTORY}`);
    
    // Read existing projects from JSON
    const existingProjects = await readProjectsFromJson();
    log.info(`Found ${existingProjects.length} projects in projects.json`);
    
    // Create a set of existing paths for quick lookup
    const existingPaths = new Set(existingProjects.map(p => p.path));
    const existingNames = new Set(existingProjects.map(p => p.name));
    
    // Scan the projects directory
    const entries = await fs.readdir(PROJECTS_DIRECTORY, { withFileTypes: true });
    log.info(`Found ${entries.length} entries in projects directory`);
    
    let newProjectsAdded = false;
    
    // Process each directory entry
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git" && !entry.name.startsWith(".")) {
        const projectPath = path.join(PROJECTS_DIRECTORY, entry.name);
        log.info(`Found directory: ${projectPath}`);
        
        // Skip if this path is already in the projects list
        if (existingPaths.has(projectPath)) {
          log.info(`Project already exists in JSON: ${entry.name}`);
          continue;
        }
        
        // Check if a project with this name already exists at a different path
        if (existingNames.has(entry.name)) {
          log.info(`Project with name ${entry.name} exists but path has changed. Updating path.`);
          // Find and update the project with this name
          const projectToUpdate = existingProjects.find(p => p.name === entry.name);
          if (projectToUpdate) {
            projectToUpdate.path = projectPath;
            projectToUpdate.updatedAt = new Date().toISOString();
            newProjectsAdded = true;
            continue;
          }
        }
        
        log.info(`Adding new project from directory scan: ${entry.name}`);
        
        // Create a new project entry
        existingProjects.push({
          id: uuidv4(),
          name: entry.name,
          path: projectPath,
          type: 'imported',
          createdAt: new Date().toISOString()
        });
        
        newProjectsAdded = true;
        log.info(`Added project from directory scan: ${entry.name} at ${projectPath}`);
      }
    }
    
    // Save if new projects were found or updated
    if (newProjectsAdded) {
      log.info(`Saving updated projects list with new directories`);
      await saveProjectsToJson(existingProjects);
    }
    
    return existingProjects;
  } catch (error) {
    log.error('Error scanning projects directory:', error);
    // Return existing projects on error, but still filter
    const projects = await readProjectsFromJson();
    return projects;
  }
};

module.exports = {
  /**
   * Gets project details by name.
   * Checks DB connection status and uses MongoDB or projects.json accordingly.
   * @param {string} projectName - The name of the project to find.
   * @returns {Promise<object|null>} Project object { name, path } or null if not found.
   */
  getProjectByName: async (projectName) => {
    log.info(`Getting project '${projectName}'`);

    try {
      // Scan projects directory to ensure all projects are in the list
      const projects = await scanProjectsDirectory();
      const project = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());

      if (project) {
        log.info(`Project '${projectName}' found.`);
        return project; 
      } else {
        log.warn(`Project '${projectName}' not found.`);
        return null;
      }
    } catch (error) {
      log.error(`Error getting project by name '${projectName}':`, error);
      throw error;
    }
  },

  /**
   * Gets project details by ID.
   * @param {string} projectId - The ID of the project to find.
   * @returns {Promise<object|null>} Project object or null if not found.
   */
  getProjectById: async (projectId) => {
    log.info(`Getting project by ID '${projectId}'`);

    try {
      // Get all projects
      const projects = await scanProjectsDirectory();
      const project = projects.find(p => p.id === projectId);
      
      if (project) {
        log.info(`Project with ID '${projectId}' found: ${project.name}`);
        return project;
      } else {
        log.warn(`Project with ID '${projectId}' not found`);
        return null;
      }
    } catch (error) {
      log.error(`Error getting project by ID '${projectId}':`, error);
      throw error;
    }
  },

  /**
   * Gets the active project from active_project.json
   * @returns {Promise<object|null>} Active project object or null if none set
   */
  getActiveProject: async () => {
    try {
      // Check if the active project file exists
      if (!fsSync.existsSync(ACTIVE_PROJECT_PATH)) {
        log.info('No active project file found');
        return null;
      }

      // Read the active project file
      const data = await fs.readFile(ACTIVE_PROJECT_PATH, 'utf8');
      let activeProject;
      
      try {
        activeProject = JSON.parse(data || '{}');
      } catch (err) {
        log.error('Error parsing active project JSON:', err);
        return null;
      }
      
      if (!activeProject.name || !activeProject.path) {
        log.warn('Active project file exists but is missing name or path');
        return null;
      }
      
      // Verify the path exists
      if (!fsSync.existsSync(activeProject.path)) {
        log.warn(`Active project path does not exist: ${activeProject.path}`);
        return null;
      }
      
      if (!fsSync.statSync(activeProject.path).isDirectory()) {
        log.warn(`Active project path exists but is not a directory: ${activeProject.path}`);
        return null;
      }
      
      // Check if this is a restricted project
      if (fileUtils.isPathRestricted(activeProject.path)) {
        log.warn(`Active project path is in restricted list: ${activeProject.path}`);
        return null;
      }
      
      log.info(`Active project: ${activeProject.name} at ${activeProject.path}`);
      return activeProject;
    } catch (error) {
      log.error('Error reading active project:', error);
      return null;
    }
  },
  
  /**
   * Sets the active project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} Success indicator
   */
  setActiveProjectById: async (projectId) => {
    try {
      const project = await module.exports.getProjectById(projectId);
      
      if (!project) {
        log.warn(`Cannot set active project: project with ID ${projectId} not found`);
        return false;
      }
      
      return await module.exports.setActiveProject(project.path, project.name);
    } catch (error) {
      log.error('Error setting active project by ID:', error);
      return false;
    }
  },

  /**
   * Sets the active project
   * @param {string} projectPath - Project path
   * @param {string} name - Project name
   * @returns {Promise<boolean>} Success indicator
   */
  setActiveProject: async (projectPath, name) => {
    try {
      // Ensure we're using the full path and not just the name
      if (!projectPath.startsWith('/')) {
        // If a name was passed instead of a path, try to find the project
        const projects = await readProjectsFromJson();
        const project = projects.find(p => p.name === projectPath || p.path.includes(projectPath));
        
        if (project) {
          projectPath = project.path;
          name = name || project.name;
        } else {
          // If no project found, try using the projects directory
          projectPath = path.join(PROJECTS_DIRECTORY, projectPath);
        }
      }
      
      // Verify the path exists and is a directory
      if (!fsSync.existsSync(projectPath)) {
        log.warn(`Cannot set active project: path does not exist: ${projectPath}`);
        return false;
      }
      
      if (!fsSync.statSync(projectPath).isDirectory()) {
        log.warn(`Cannot set active project: path exists but is not a directory: ${projectPath}`);
        return false;
      }
      
      // Check if the path is restricted
      if (fileUtils.isPathRestricted(projectPath)) {
        log.warn(`Cannot set active project: path is in restricted list: ${projectPath}`);
        return false;
      }
      
      // Check if the directory is writable
      const isWritable = await fileUtils.isDirectoryWritable(projectPath);
      if (!isWritable) {
        log.warn(`Cannot set active project: path is not writable: ${projectPath}`);
        return false;
      }
      
      // Ensure the data directory exists
      const dataDir = path.dirname(ACTIVE_PROJECT_PATH);
      await fileUtils.ensureDirectoryExists(dataDir);
      
      // Write the active project file
      await fs.writeFile(
        ACTIVE_PROJECT_PATH, 
        JSON.stringify({ 
          name: name || path.basename(projectPath), 
          path: projectPath, 
          timestamp: new Date().toISOString()
        }, null, 2), 
        'utf8'
      );
      
      log.info(`Set active project: ${name || path.basename(projectPath)} at ${projectPath}`);
      return true;
    } catch (error) {
      log.error('Error setting active project:', error);
      return false;
    }
  },

  /**
   * Gets all projects
   * @returns {Promise<Array>} Array of project objects
   */
  getAllProjects: async () => {
    try {
      // First, try to read from the JSON file
      const projects = await readProjectsFromJson();
      
      // Get the projects directory from environment or use default
      const projectsDir = process.env.PROJECTS_DIRECTORY || path.join(__dirname, '..', 'projects');
      
      // Only return projects that are actually in the projects directory and not the gaana app itself
      const filteredProjects = projects.filter(project => {
        // Make sure the path starts with the projects directory
        const isInProjectsDir = project.path.startsWith(projectsDir);
        
        // Also make sure it's not the gaana project itself (which might be added incorrectly)
        const isNotGaanaApp = project.name.toLowerCase() !== 'gaana' || 
                            !project.path.includes('/Desktop/gaana') || 
                            project.path.includes('/Desktop/gaana/projects/');
        
        return isInProjectsDir && isNotGaanaApp;
      });
      
      // Add number to each project (1-based indexing)
      return filteredProjects.map((project, index) => ({
        ...project,
        number: index + 1
      }));
      
    } catch (error) {
      log.error('Error getting all projects:', error);
      return [];
    }
  },
  
  /**
   * Creates a new project in the projects directory
   * @param {string} name - Project name
   * @param {string} type - Project type (optional)
   * @param {string} template - Template to use (optional)
   * @returns {Promise<object>} Project object or error
   */
  createProject: async (name, type = 'default', template = null) => {
    try {
      // Sanitize name for filesystem
      const sanitizedName = name
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_');
      
      // Create project path
      const projectPath = path.join(PROJECTS_DIRECTORY, sanitizedName);
      
      // Check if project directory already exists
      if (fsSync.existsSync(projectPath)) {
        log.warn(`Project directory already exists: ${projectPath}`);
        return { success: false, error: 'Project directory already exists' };
      }
      
      // Create project directory
      await fileUtils.ensureDirectoryExists(projectPath);
      
      // Create a basic README.md file in the project
      await fs.writeFile(
        path.join(projectPath, 'README.md'),
        `# ${name}\n\nProject created on ${new Date().toLocaleString()}\n\n## Description\n\nAdd your project description here.\n`,
        'utf8'
      );
      
      // TODO: If template is provided, copy template files
      
      // Get current projects and add new one
      const projects = await readProjectsFromJson();
      
      const newProject = {
        id: uuidv4(),
        name,
        path: projectPath,
        type,
        createdAt: new Date().toISOString()
      };
      
      projects.push(newProject);
      
      // Save projects
      await saveProjectsToJson(projects);
      
      log.info(`Created new project: ${name} at ${projectPath}`);
      return { success: true, project: newProject };
    } catch (error) {
      log.error(`Error creating project "${name}":`, error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Import an existing project into the projects directory
   * @param {string} sourcePath - Source path to import from
   * @param {string} name - Project name
   * @returns {Promise<object>} Result with success or error
   */
  importProject: async (sourcePath, name) => {
    try {
      // Use fileUtils to import the project
      const result = await fileUtils.importProject(sourcePath, name);
      
      if (!result.success) {
        return result;
      }
      
      // Add to projects.json
      const projects = await readProjectsFromJson();
      
      const newProject = {
        id: uuidv4(),
        name: result.projectName,
        path: result.projectPath,
        type: 'imported',
        createdAt: new Date().toISOString()
      };
      
      projects.push(newProject);
      
      // Save projects
      await saveProjectsToJson(projects);
      
      return { success: true, project: newProject };
    } catch (error) {
      log.error(`Error importing project from ${sourcePath}:`, error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Import a project from a zip file
   * @param {string} zipFilePath - Path to the zip file
   * @param {string} name - Optional project name (defaults to zip filename)
   * @returns {Promise<object>} Result with success or error
   */
  importZipProject: async (zipFilePath, name) => {
    try {
      log.info(`Starting zip project import from ${zipFilePath} with name "${name || 'not provided'}"`);
      
      if (!fs.existsSync(zipFilePath)) {
        log.error(`Zip file does not exist: ${zipFilePath}`);
        return { success: false, error: 'Zip file does not exist' };
      }

      log.info(`Zip file exists: ${zipFilePath}, size: ${fs.statSync(zipFilePath).size} bytes`);

      // Make sure we have the extract-zip module
      try {
        require('extract-zip');
        log.info('extract-zip module found');
      } catch (err) {
        log.error('extract-zip module not found, attempting to install...');
        // This is a fallback if extract-zip is not installed
        await new Promise((resolve, reject) => {
          const { exec } = require('child_process');
          exec('npm install extract-zip', (error) => {
            if (error) {
              log.error('Failed to install extract-zip module:', error);
              reject(new Error('Failed to install extract-zip module'));
            } else {
              log.info('Successfully installed extract-zip module');
              resolve();
            }
          });
        });
      }

      // Use fileUtils to import the zip project
      log.info(`Calling fileUtils.importZipProject with zipFilePath=${zipFilePath}, name=${name}`);
      const result = await fileUtils.importZipProject(zipFilePath, name);
      
      if (!result.success) {
        log.error(`fileUtils.importZipProject failed: ${result.error}`);
        return result;
      }
      
      log.info(`Zip extracted successfully to ${result.projectPath}`);
      
      // Add to projects.json
      log.info('Reading existing projects from JSON');
      const projects = await readProjectsFromJson();
      
      const newProject = {
        id: uuidv4(),
        name: result.projectName,
        path: result.projectPath,
        type: 'imported',
        createdAt: new Date().toISOString()
      };
      
      log.info(`Created new project entry: ${JSON.stringify(newProject)}`);
      
      projects.push(newProject);
      
      // Save projects
      log.info('Saving updated projects list to JSON');
      await saveProjectsToJson(projects);
      
      // Set as active project
      log.info(`Setting ${result.projectPath} as active project`);
      await module.exports.setActiveProject(result.projectPath, result.projectName);
      
      log.info('Project import completed successfully');
      return { success: true, project: newProject };
    } catch (error) {
      log.error(`Error importing zip project from ${zipFilePath}:`, error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Delete a project
   * @param {string} projectId - Project ID to delete
   * @param {boolean} deleteFiles - Whether to delete project files
   * @returns {Promise<object>} Result with success or error
   */
  deleteProject: async (projectId, deleteFiles = false) => {
    try {
      // Get projects
      const projects = await readProjectsFromJson();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { success: false, error: 'Project not found' };
      }
      
      const projectToDelete = projects[projectIndex];
      
      // Remove from projects array
      projects.splice(projectIndex, 1);
      await saveProjectsToJson(projects);
      
      // Delete files if requested
      if (deleteFiles) {
        // Only delete files if they're in the projects directory
        if (projectToDelete.path.startsWith(PROJECTS_DIRECTORY)) {
          // Recursively delete directory
          const rimraf = util.promisify(require('rimraf'));
          await rimraf(projectToDelete.path);
          log.info(`Deleted project files at ${projectToDelete.path}`);
        } else {
          log.warn(`Not deleting files - project is outside projects directory: ${projectToDelete.path}`);
        }
      }
      
      // Check if it's the active project
      const activeProject = await this.getActiveProject();
      if (activeProject && activeProject.id === projectId) {
        // Clear active project
        await fs.unlink(ACTIVE_PROJECT_PATH).catch(() => {});
      }
      
      return { success: true, deleted: projectToDelete };
    } catch (error) {
      log.error(`Error deleting project ${projectId}:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Helper function to read projects directly from JSON.
   */
  getProjectsFromJson: readProjectsFromJson,
  
  /**
   * Get the projects directory path
   * @returns {string} Projects directory path
   */
  getProjectsDirectory: () => PROJECTS_DIRECTORY
}; 