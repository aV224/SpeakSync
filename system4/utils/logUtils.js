const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Utility for logging directory information
 */
const logUtils = {
  /**
   * Log detailed information about a directory and its structure
   * @param {string} dirPath - Path to the directory
   * @param {number} maxDepth - Maximum depth to traverse (default: 2)
   * @param {string} label - Optional label for the log
   * @returns {Promise<void>}
   */
  logDirectoryInfo: async (dirPath, maxDepth = 2, label = 'Directory Info') => {
    try {
      if (!fs.existsSync(dirPath)) {
        log.warn(`[${label}] Directory does not exist: ${dirPath}`);
        return;
      }

      if (!fs.statSync(dirPath).isDirectory()) {
        log.warn(`[${label}] Path is not a directory: ${dirPath}`);
        return;
      }

      log.info(`[${label}] Examining directory: ${dirPath}`);

      // List key files in the directory
      const recursiveListDir = (currentPath, depth = 0, maxDepth = 2) => {
        if (depth > maxDepth) return;

        const indent = '  '.repeat(depth);
        const files = fs.readdirSync(currentPath);
        
        for (const file of files) {
          // Skip node_modules and other large directories
          if (['node_modules', '.git', 'dist', 'build'].includes(file)) {
            log.info(`${indent}${file}/ (skipped)`);
            continue;
          }

          const fullPath = path.join(currentPath, file);
          
          try {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
              log.info(`${indent}${file}/`);
              recursiveListDir(fullPath, depth + 1, maxDepth);
            } else if (depth === 0 || ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json'].includes(path.extname(file))) {
              // Only show common code files at deeper levels
              log.info(`${indent}${file} (${stats.size} bytes)`);
            }
          } catch (error) {
            log.warn(`${indent}${file} (error: ${error.message})`);
          }
        }
      };

      recursiveListDir(dirPath, 0, maxDepth);
      
      // Also log environment information
      log.info(`[${label}] Current working directory: ${process.cwd()}`);
      log.info(`[${label}] NODE_ENV: ${process.env.NODE_ENV}`);
      
      // Check if we can write to this directory
      try {
        const testFile = path.join(dirPath, '.write_test_' + Date.now());
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        log.info(`[${label}] Directory is writable: YES`);
      } catch (error) {
        log.warn(`[${label}] Directory is writable: NO (${error.message})`);
      }
    } catch (error) {
      log.error(`[${label}] Error logging directory info:`, error);
    }
  }
};

module.exports = logUtils; 