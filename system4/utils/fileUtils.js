const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Utility for file operations
 */
const fileUtils = {
  /**
   * Check if a directory is writable
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<boolean>} Whether the directory is writable
   */
  isDirectoryWritable: async (dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) {
        log.warn(`Directory does not exist: ${dirPath}`);
        return false;
      }

      if (!fs.statSync(dirPath).isDirectory()) {
        log.warn(`Path is not a directory: ${dirPath}`);
        return false;
      }

      // Try to create a test file
      const testFile = path.join(dirPath, `.write_test_${Date.now()}`);
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.unlink(testFile);
      
      return true;
    } catch (error) {
      log.error(`Error checking if directory is writable: ${dirPath}`, error);
      return false;
    }
  },
  
  /**
   * Create a directory if it doesn't exist
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<boolean>} Whether the directory exists or was created
   */
  ensureDirectoryExists: async (dirPath) => {
    try {
      if (fs.existsSync(dirPath)) {
        if (fs.statSync(dirPath).isDirectory()) {
          return true;
        }
        log.warn(`Path exists but is not a directory: ${dirPath}`);
        return false;
      }
      
      await fs.promises.mkdir(dirPath, { recursive: true });
      log.info(`Created directory: ${dirPath}`);
      return true;
    } catch (error) {
      log.error(`Error ensuring directory exists: ${dirPath}`, error);
      return false;
    }
  },
  
  /**
   * Check if a path is restricted based on the RESTRICTED_PROJECTS env var
   * @param {string} filePath - Path to check
   * @returns {boolean} Whether the path is restricted
   */
  isPathRestricted: (filePath) => {
    try {
      if (!filePath) return true; // If no path is provided, treat as restricted
      
      // If the path is within the projects directory, it's explicitly allowed
      const projectsDir = process.env.PROJECTS_DIRECTORY || path.join(process.cwd(), 'projects');
      if (filePath.startsWith(projectsDir)) {
        return false;
      }
      
      const restrictedProjects = (process.env.RESTRICTED_PROJECTS || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      
      // No restrictions defined
      if (restrictedProjects.length === 0) {
        return false;
      }
      
      // Check if the path contains any of the restricted project paths
      return restrictedProjects.some(restrictedProject => 
        filePath.includes(restrictedProject)
      );
    } catch (error) {
      log.error('Error checking if path is restricted:', error);
      return true; // In case of error, treat as restricted for safety
    }
  },
  
  /**
   * Get project structure as a nested object
   * @param {string} projectPath - Path to the project
   * @param {number} maxDepth - Maximum depth to traverse
   * @param {Array} excludeDirs - Directories to exclude (optional)
   * @param {Array} excludeFiles - File patterns to exclude (optional)
   * @returns {Promise<Object>} Nested object representing the project structure
   */
  getProjectStructure: async (projectPath, maxDepth = 3, excludeDirs = ['node_modules', '.git'], excludeFiles = ['.DS_Store']) => {
    const result = {};
    
    // Default maxDepth if invalid
    if (!maxDepth || maxDepth < 1) maxDepth = 3;
    
    async function traverseDir(currentPath, depth, currentResult) {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(projectPath, entryPath);
          
          // Skip excluded directories and files
          if ((entry.isDirectory() && excludeDirs.includes(entry.name)) || 
              (entry.isFile() && excludeFiles.some(pattern => entry.name.match(pattern)))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            currentResult[entry.name] = {};
            // Recursively traverse subdirectories
            await traverseDir(entryPath, depth + 1, currentResult[entry.name]);
            
            // If directory is empty after filtering, add a placeholder
            if (Object.keys(currentResult[entry.name]).length === 0) {
              currentResult[entry.name] = { "__empty__": true };
            }
          } else {
            // For files, store the relative path
            currentResult[entry.name] = relativePath;
          }
        }
      } catch (error) {
        log.error(`Error traversing directory ${currentPath}:`, error);
      }
    }
    
    await traverseDir(projectPath, 1, result);
    return result;
  },
  
  /**
   * Import a new project by copying it to the projects directory
   * @param {string} sourcePath - Source path of the project
   * @param {string} projectName - Name to give the project
   * @returns {Promise<object>} Result with success or error
   */
  importProject: async (sourcePath, projectName) => {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'Source path does not exist' };
      }
      
      if (!fs.statSync(sourcePath).isDirectory()) {
        return { success: false, error: 'Source path is not a directory' };
      }
      
      // Get the projects directory
      const projectsDir = process.env.PROJECTS_DIRECTORY || path.join(process.cwd(), 'projects');
      await fileUtils.ensureDirectoryExists(projectsDir);
      
      // Create sanitized project name
      const sanitizedName = projectName
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_');
      
      // Create project directory
      const projectDir = path.join(projectsDir, sanitizedName);
      
      // Check if already exists
      if (fs.existsSync(projectDir)) {
        return { success: false, error: 'Project with this name already exists' };
      }
      
      // Create the directory
      await fileUtils.ensureDirectoryExists(projectDir);
      
      // Copy files (recursive function)
      const copyFiles = async (src, dest) => {
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          // Skip node_modules, .git, etc.
          if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            await fileUtils.ensureDirectoryExists(destPath);
            await copyFiles(srcPath, destPath);
          } else {
            await fs.promises.copyFile(srcPath, destPath);
          }
        }
      };
      
      // Copy the files
      await copyFiles(sourcePath, projectDir);
      
      return {
        success: true,
        projectPath: projectDir,
        projectName: sanitizedName
      };
    } catch (error) {
      log.error(`Error importing project: ${error.message}`);
      return { success: false, error: `Failed to import project: ${error.message}` };
    }
  },

  /**
   * Import a project from a ZIP file
   * @param {string} zipFilePath - Path to the ZIP file
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Result object
   */
  importZipProject: async (zipFilePath, projectName) => {
    try {
      const log = require('electron-log');
      log.info(`Importing ZIP project from ${zipFilePath}`);
      
      // Check if ZIP file exists
      if (!fs.existsSync(zipFilePath)) {
        log.error(`ZIP file does not exist: ${zipFilePath}`);
        return { success: false, error: 'ZIP file does not exist' };
      }
      
      // Get file stats
      const zipStats = fs.statSync(zipFilePath);
      log.info(`Zip file size: ${zipStats.size} bytes`);
      
      // Ensure extract-zip is available
      let extract;
      try {
        extract = require('extract-zip');
      } catch (err) {
        log.error('extract-zip module not found:', err);
        return { success: false, error: 'extract-zip module not found. Please run npm install extract-zip' };
      }
      
      // Determine project name from ZIP filename if not provided
      let finalProjectName = projectName;
      if (!finalProjectName) {
        const zipBasename = path.basename(zipFilePath, path.extname(zipFilePath));
        finalProjectName = zipBasename.replace(/[^a-zA-Z0-9-_]/g, '_');
        log.info(`Project name not provided, using ZIP filename: ${finalProjectName}`);
      } else {
        // Sanitize provided name
        finalProjectName = finalProjectName.replace(/[^a-zA-Z0-9-_]/g, '_');
        log.info(`Using provided project name: ${finalProjectName}`);
      }
      
      // Determine the projects directory
      const projectsDir = process.env.PROJECTS_DIRECTORY || path.join(__dirname, '..', 'projects');
      log.info(`Projects directory: ${projectsDir}`);
      
      // Create projects directory if it doesn't exist
      await fileUtils.ensureDirectoryExists(projectsDir);
      
      // Determine target directory for the project
      const targetDir = path.join(projectsDir, finalProjectName);
      log.info(`Target project directory: ${targetDir}`);
      
      // Check if target directory already exists
      if (fs.existsSync(targetDir)) {
        // Create a backup of the existing directory
        const backupDir = `${targetDir}_backup_${Date.now()}`;
        log.info(`Project directory already exists, creating backup at ${backupDir}`);
        await fs.rename(targetDir, backupDir);
      }
      
      // Create the target directory
      await fileUtils.ensureDirectoryExists(targetDir);
      
      // Extract the ZIP file
      log.info(`Extracting ZIP file to ${targetDir}`);
      try {
        await extract(zipFilePath, { dir: targetDir });
        log.info('ZIP file extracted successfully');
      } catch (extractError) {
        log.error('Error extracting ZIP file:', extractError);
        return { success: false, error: `Failed to extract ZIP file: ${extractError.message}` };
      }
      
      // Check if the ZIP has a single root directory
      const entries = await fs.promises.readdir(targetDir);
      log.info(`Found ${entries.length} entries in extracted directory`);
      
      if (entries.length === 1) {
        const singleEntryPath = path.join(targetDir, entries[0]);
        const singleEntryStat = await fs.promises.stat(singleEntryPath);
        
        if (singleEntryStat.isDirectory()) {
          log.info(`ZIP contains a single root directory: ${entries[0]}`);
          
          // Move the contents up one level
          const tempDir = `${targetDir}_temp_${Date.now()}`;
          await fs.promises.rename(targetDir, tempDir);
          await fileUtils.ensureDirectoryExists(targetDir);
          
          // Move the contents from the temp directory's inner directory to the target
          const innerDir = path.join(tempDir, entries[0]);
          const innerEntries = await fs.promises.readdir(innerDir);
          
          log.info(`Moving ${innerEntries.length} entries from ${innerDir} to ${targetDir}`);
          
          for (const entry of innerEntries) {
            const sourcePath = path.join(innerDir, entry);
            const destPath = path.join(targetDir, entry);
            await fs.promises.rename(sourcePath, destPath);
          }
          
          // Clean up the temp directory
          const rimraf = require('rimraf');
          await new Promise((resolve, reject) => {
            rimraf(tempDir, (err) => {
              if (err) {
                log.warn(`Error removing temp directory: ${err.message}`);
                reject(err);
              } else {
                resolve();
              }
            });
          });
          
          log.info('Successfully moved contents up one level');
        }
      }
      
      return {
        success: true,
        projectPath: targetDir,
        projectName: finalProjectName
      };
    } catch (error) {
      const log = require('electron-log');
      log.error('Error importing ZIP project:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = fileUtils; 