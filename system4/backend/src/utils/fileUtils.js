const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Check if a path is valid and exists
 * @param {string} targetPath - Path to check
 * @returns {boolean} - Whether the path is valid and exists
 */
function isValidPath(targetPath) {
  try {
    if (!targetPath) return false;
    
    // Check if path exists
    const stats = fs.statSync(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a path is a directory
 * @param {string} targetPath - Path to check
 * @returns {boolean} - Whether the path is a directory
 */
function isDirectory(targetPath) {
  try {
    if (!targetPath) return false;
    
    // Check if path exists and is a directory
    const stats = fs.statSync(targetPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a path is a file
 * @param {string} targetPath - Path to check
 * @returns {boolean} - Whether the path is a file
 */
function isFile(targetPath) {
  try {
    if (!targetPath) return false;
    
    // Check if path exists and is a file
    const stats = fs.statSync(targetPath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Get file extension
 * @param {string} targetPath - Path to check
 * @returns {string} - File extension without the dot
 */
function getFileExtension(targetPath) {
  if (!targetPath) return '';
  
  return path.extname(targetPath).toLowerCase().replace('.', '');
}

/**
 * Check if a path is within another path
 * @param {string} targetPath - Path to check
 * @param {string} basePath - Base path
 * @returns {boolean} - Whether targetPath is within basePath
 */
function isWithinPath(targetPath, basePath) {
  if (!targetPath || !basePath) return false;
  
  const normalizedTarget = path.normalize(targetPath);
  const normalizedBase = path.normalize(basePath);
  
  return normalizedTarget === normalizedBase || 
         normalizedTarget.startsWith(normalizedBase + path.sep);
}

/**
 * Create a directory if it doesn't exist
 * @param {string} dirPath - Directory path
 * @returns {Promise<boolean>} - Whether the directory was created or already exists
 */
async function ensureDirectoryExists(dirPath) {
  try {
    if (!dirPath) return false;
    
    // Check if directory exists
    if (isDirectory(dirPath)) return true;
    
    // Create directory recursively
    await fs.promises.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    log.error(`Error creating directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * List files in a directory
 * @param {string} dirPath - Directory path
 * @param {Object} options - Options
 * @param {boolean} options.recursive - Whether to list files recursively
 * @param {string[]} options.extensions - File extensions to filter by
 * @param {boolean} options.includeDirectories - Whether to include directories
 * @returns {Promise<string[]>} - List of file paths
 */
async function listFiles(dirPath, options = {}) {
  const defaultOptions = {
    recursive: false,
    extensions: [],
    includeDirectories: false
  };
  
  const opts = { ...defaultOptions, ...options };
  
  try {
    if (!dirPath || !isDirectory(dirPath)) return [];
    
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let results = [];
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (opts.includeDirectories) {
          results.push(entryPath);
        }
        
        if (opts.recursive) {
          const subResults = await listFiles(entryPath, opts);
          results = results.concat(subResults);
        }
      } else if (entry.isFile()) {
        // Filter by extension if specified
        if (opts.extensions.length > 0) {
          const ext = getFileExtension(entry.name);
          if (opts.extensions.includes(ext)) {
            results.push(entryPath);
          }
        } else {
          results.push(entryPath);
        }
      }
    }
    
    return results;
  } catch (error) {
    log.error(`Error listing files in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Read file content
 * @param {string} filePath - File path
 * @returns {Promise<string|null>} - File content or null
 */
async function readFileContent(filePath) {
  try {
    if (!filePath || !isFile(filePath)) return null;
    
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    log.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write content to a file
 * @param {string} filePath - File path
 * @param {string} content - Content to write
 * @returns {Promise<boolean>} - Whether the file was written successfully
 */
async function writeFileContent(filePath, content) {
  try {
    if (!filePath) return false;
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    await ensureDirectoryExists(dirPath);
    
    // Write file
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    log.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

module.exports = {
  isValidPath,
  isDirectory,
  isFile,
  getFileExtension,
  isWithinPath,
  ensureDirectoryExists,
  listFiles,
  readFileContent,
  writeFileContent
}; 