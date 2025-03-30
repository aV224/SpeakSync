const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const projectController = require('../controllers/projectController');
const { upload, handleMulterError } = require('../middleware/upload');
const log = require('electron-log');

// Get projects data file path
const projectsFilePath = path.join(__dirname, '../data/projects.json');

// Project Configuration
const PROJECTS_CONFIG_JSON = path.join(__dirname, '..', 'projects', 'projects_config.json');
const ACTIVE_PROJECT_JSON = path.join(__dirname, '..', 'data', 'active_project.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize projects file if it doesn't exist
if (!fs.existsSync(projectsFilePath)) {
  fs.writeFileSync(projectsFilePath, JSON.stringify({
    projects: [],
    defaultProject: null
  }, null, 2));
}

// Initialize active_project.json if it doesn't exist
if (!fs.existsSync(ACTIVE_PROJECT_JSON)) {
    fs.writeFileSync(ACTIVE_PROJECT_JSON, JSON.stringify({}));
}

// Initialize projects_config.json if it doesn't exist
if (!fs.existsSync(PROJECTS_CONFIG_JSON)) {
    fs.writeFileSync(PROJECTS_CONFIG_JSON, JSON.stringify({
        projects: {},
        projectsByNumber: {}
    }, null, 2));
}

// Helper function to check if a directory exists
const directoryExists = (dirPath) => {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
        return false;
    }
};

// Helper function to read projects from JSON
const readProjectsFromJson = () => {
    try {
        if (fs.existsSync(projectsFilePath)) {
            const data = fs.readFileSync(projectsFilePath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error reading projects.json:', error);
        return [];
    }
};

// Helper function to save projects to JSON
const saveProjectsToJson = (projects) => {
    try {
        fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving projects.json:', error);
        return false;
    }
};

// Helper function to read project numbers from projects_config.json
const readProjectNumbers = () => {
    try {
        if (fs.existsSync(PROJECTS_CONFIG_JSON)) {
            const data = fs.readFileSync(PROJECTS_CONFIG_JSON, 'utf8');
            const config = JSON.parse(data);
            
            // Extract project numbers from the config
            const projectNumbers = {};
            if (config.projects) {
                Object.keys(config.projects).forEach(projectName => {
                    if (config.projects[projectName].number) {
                        projectNumbers[projectName] = config.projects[projectName].number;
                    }
                });
            }
            
            return {
                projects: config.projects || {},
                projectsByNumber: config.projectsByNumber || {},
                projectNumbers
            };
        }
        return {
            projects: {},
            projectsByNumber: {},
            projectNumbers: {}
        };
    } catch (error) {
        console.error('Error reading projects_config.json:', error);
        return {
            projects: {},
            projectsByNumber: {},
            projectNumbers: {}
        };
    }
};

// Helper function to save project numbers to projects_config.json
const saveProjectNumbers = (config) => {
    try {
        // Ensure directory exists
        const projectsDir = path.join(__dirname, '..', 'projects');
        if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
        }
        
        fs.writeFileSync(PROJECTS_CONFIG_JSON, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving projects_config.json:', error);
        return false;
    }
};

// Helper function to ensure all projects have numbers
const ensureProjectNumbers = () => {
    try {
        // Read existing projects
        const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
        const { projects, projectsByNumber } = readProjectNumbers();
        
        let configUpdated = false;
        let nextNumber = 1;
        
        // Find the highest existing number
        Object.values(projects).forEach(proj => {
            if (proj.number && parseInt(proj.number) >= nextNumber) {
                nextNumber = parseInt(proj.number) + 1;
            }
        });
        
        // Ensure each project has a unique number
        projectsData.projects.forEach(project => {
            // Skip if project already has a number in the config
            if (projects[project.name] && projects[project.name].number) {
                return;
            }
            
            // Assign a number to this project
            if (!projects[project.name]) {
                projects[project.name] = { path: project.path };
            }
            
            projects[project.name].number = nextNumber.toString();
            projectsByNumber[nextNumber.toString()] = project.name;
            
            nextNumber++;
            configUpdated = true;
        });
        
        // Save updated config if changes were made
        if (configUpdated) {
            saveProjectNumbers({ projects, projectsByNumber });
        }
        
        return { projects, projectsByNumber };
    } catch (error) {
        console.error('Error ensuring project numbers:', error);
        return { projects: {}, projectsByNumber: {} };
    }
};

// Get all projects
router.get('/', (req, res) => {
  try {
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    // Ensure all projects have numbers
    const { projects: projectsConfig } = ensureProjectNumbers();
    
    // Return projects with default flag and project numbers
    const projects = projectsData.projects.map(project => {
      const projectNumber = projectsConfig[project.name]?.number || '';
      
      return {
        ...project,
        isDefault: projectsData.defaultProject === project.id,
        projectNumber
      };
    });
    
    res.json(projects);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get project numbers
router.get('/numbers', (req, res) => {
    try {
        // Ensure all projects have numbers
        const { projects, projectsByNumber } = ensureProjectNumbers();
        
        res.json({
            success: true,
            projects,
            projectsByNumber
        });
    } catch (error) {
        console.error('Error retrieving project numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add a new project
router.post('/', (req, res) => {
  try {
    const { name, path: projectPath, type } = req.body;
    
    if (!name || !projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Project name and path are required'
      });
    }
    
    // Validate that the path exists
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({
        success: false,
        error: 'Project path does not exist'
      });
    }
    
    // Read existing projects
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    // Check if project with same path already exists
    const existingProject = projectsData.projects.find(p => p.path === projectPath);
    if (existingProject) {
      return res.status(400).json({
        success: false,
        error: 'A project with this path already exists'
      });
    }
    
    // Create new project
    const newProject = {
      id: uuidv4(),
      name,
      path: projectPath,
      type: type || 'other',
      createdAt: new Date().toISOString()
    };
    
    // Add to projects
    projectsData.projects.push(newProject);
    
    // If this is the first project, set it as default
    if (projectsData.projects.length === 1) {
      projectsData.defaultProject = newProject.id;
    }
    
    // Save projects
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    
    res.json({
      success: true,
      project: newProject
    });
  } catch (error) {
    console.error('Error adding project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a specific project
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Read existing projects
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    // Find project by ID
    const project = projectsData.projects.find(p => p.id === id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    res.json({
      ...project,
      isDefault: projectsData.defaultProject === project.id
    });
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a project
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Read existing projects
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    // Find project index
    const projectIndex = projectsData.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Remove project
    projectsData.projects.splice(projectIndex, 1);
    
    // If this was the default project, update default
    if (projectsData.defaultProject === id) {
      projectsData.defaultProject = projectsData.projects.length > 0 ? 
        projectsData.projects[0].id : null;
    }
    
    // Save projects
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    
    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set a project as default
router.post('/:id/default', (req, res) => {
  try {
    const { id } = req.params;
    
    // Read existing projects
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    // Find project by ID
    const project = projectsData.projects.find(p => p.id === id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Set as default
    projectsData.defaultProject = id;
    
    // Save projects
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    
    res.json({
      success: true,
      message: 'Default project updated successfully'
    });
  } catch (error) {
    console.error('Error setting default project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get the currently active (default) project
router.get('/default/active', (req, res) => {
  try {
    // Read existing projects
    const projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    
    if (!projectsData.defaultProject) {
      return res.status(404).json({
        success: false,
        error: 'No default project set'
      });
    }
    
    // Find default project
    const defaultProject = projectsData.projects.find(p => p.id === projectsData.defaultProject);
    
    if (!defaultProject) {
      return res.status(404).json({
        success: false,
        error: 'Default project not found'
      });
    }
    
    res.json({
      success: true,
      project: defaultProject
    });
  } catch (error) {
    console.error('Error retrieving default project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import a project from a ZIP file
router.post('/import-zip', upload.single('zipFile'), async (req, res) => {
  try {
    log.info('Processing ZIP import request');
    
    // Check if a file was uploaded
    if (!req.file) {
      log.warn('No ZIP file uploaded in the request');
      return res.status(400).json({
        success: false,
        error: 'No ZIP file uploaded'
      });
    }
    
    // Log uploaded file details
    log.info(`Received ZIP file: ${req.file.originalname}, Size: ${req.file.size} bytes, Path: ${req.file.path}`);
    
    // Extract the project name from the ZIP filename if not provided in the request
    let projectName = req.body.name;
    if (!projectName) {
      projectName = path.basename(req.file.originalname, path.extname(req.file.originalname));
      log.info(`No project name provided, using filename: ${projectName}`);
    }
    
    log.info(`Importing ZIP project with name: ${projectName}`);
    
    // Call the controller to handle the import
    const result = await projectController.importZipProject(req.file.path, projectName);
    
    if (!result.success) {
      log.error(`ZIP import failed: ${result.error}`);
      
      // Clean up the temporary file
      try {
        await fs.unlink(req.file.path);
        log.info(`Cleaned up temporary file: ${req.file.path}`);
      } catch (cleanupErr) {
        log.warn(`Failed to clean up temporary file: ${cleanupErr.message}`);
      }
      
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    log.info(`ZIP import successful: ${result.projectPath}`);
    
    // Clean up the temporary file
    try {
      await fs.unlink(req.file.path);
      log.info(`Cleaned up temporary file: ${req.file.path}`);
    } catch (cleanupErr) {
      log.warn(`Failed to clean up temporary file: ${cleanupErr.message}`);
    }
    
    // Get all projects after the import
    const projects = await projectController.getAllProjects();
    
    // Set the newly imported project as active
    await projectController.setActiveProject(result.projectPath, result.projectName);
    log.info(`Set ${result.projectName} as the active project`);
    
    // Return success response with project details
    res.json({
      success: true,
      message: `Project ${result.projectName} imported successfully`,
      project: result.project || { name: result.projectName, path: result.projectPath },
      projects: projects
    });
  } catch (error) {
    log.error(`Error processing ZIP import: ${error.message}`, error);
    
    // Clean up the temporary file if it exists
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
        log.info(`Cleaned up temporary file after error: ${req.file.path}`);
      } catch (cleanupErr) {
        log.warn(`Failed to clean up temporary file: ${cleanupErr.message}`);
      }
    }
    
    res.status(500).json({
      success: false,
      error: `Failed to import project: ${error.message}`
    });
  }
});

// GET /api/projects - Get all projects
router.get('/projects', (req, res) => {
    try {
        const projects = readProjectsFromJson();
        
        res.json({
            success: true,
            projects
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/projects/numbers - Get project numbers
router.get('/projects/numbers', (req, res) => {
    try {
        const projectNumbers = readProjectNumbers();
        
        res.json({
            success: true,
            projectNumbers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/projects/:id - Get a specific project by ID
router.get('/projects/:id', (req, res) => {
    try {
        const projects = readProjectsFromJson();
        const project = projects.find(p => p.id === req.params.id);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        res.json({
            success: true,
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/projects - Create a new project
router.post('/projects', (req, res) => {
    try {
        const { name, path: projectPath, type } = req.body;
        
        if (!name || !projectPath) {
            return res.status(400).json({
                success: false,
                error: 'Name and path are required'
            });
        }
        
        // Check if directory exists
        if (!directoryExists(projectPath)) {
            return res.status(400).json({
                success: false,
                error: 'Directory does not exist'
            });
        }
        
        const projects = readProjectsFromJson();
        
        // Check for duplicates
        if (projects.some(p => p.path === projectPath)) {
            return res.status(400).json({
                success: false,
                error: 'A project with this path already exists'
            });
        }
        
        const newProject = {
            id: uuidv4(),
            name,
            path: projectPath,
            type: type || 'unknown',
            createdAt: new Date().toISOString()
        };
        
        projects.push(newProject);
        saveProjectsToJson(projects);
        
        res.json({
            success: true,
            project: newProject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PUT /api/projects/:id - Update a project
router.put('/projects/:id', (req, res) => {
    try {
        const { name, path: projectPath, type } = req.body;
        const projects = readProjectsFromJson();
        const index = projects.findIndex(p => p.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        // Update the project
        if (name) projects[index].name = name;
        if (projectPath) {
            // Check if directory exists
            if (!directoryExists(projectPath)) {
                return res.status(400).json({
                    success: false,
                    error: 'Directory does not exist'
                });
            }
            projects[index].path = projectPath;
        }
        if (type) projects[index].type = type;
        
        saveProjectsToJson(projects);
        
        res.json({
            success: true,
            project: projects[index]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/projects/:id', (req, res) => {
    try {
        const projects = readProjectsFromJson();
        const newProjects = projects.filter(p => p.id !== req.params.id);
        
        if (projects.length === newProjects.length) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        saveProjectsToJson(newProjects);
        
        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/active-project - Get the active project
router.get('/active-project', (req, res) => {
    try {
        if (fs.existsSync(ACTIVE_PROJECT_JSON)) {
            const data = fs.readFileSync(ACTIVE_PROJECT_JSON, 'utf8');
            const activeProject = JSON.parse(data);
            
            res.json({
                success: true,
                activeProject
            });
        } else {
            res.json({
                success: true,
                activeProject: null
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/active-project - Set the active project
router.post('/active-project', (req, res) => {
    try {
        const { id } = req.body;
        const projects = readProjectsFromJson();
        const project = projects.find(p => p.id === id);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        const activeProject = {
            name: project.name,
            path: project.path,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(ACTIVE_PROJECT_JSON, JSON.stringify(activeProject, null, 2));
        
        res.json({
            success: true,
            activeProject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 