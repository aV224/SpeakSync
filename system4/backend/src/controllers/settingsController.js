const path = require('path');
const fs = require('fs').promises;
const log = require('electron-log');
const dotenv = require('dotenv');

class SettingsController {
  constructor() {
    this.initialized = false;
    log.info('SettingsController initialized');
  }

  /**
   * Initialize settings controller
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Check if .env file exists, create if not
      try {
        await fs.access('.env');
      } catch (error) {
        // Create empty .env file
        await fs.writeFile('.env', '# Gaana Assistant Environment Variables\n', 'utf-8');
      }
      
      this.initialized = true;
    } catch (error) {
      log.error('Failed to initialize SettingsController:', error);
      throw error;
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    await this.initialize();
    
    try {
      // Read .env file
      const envContent = await fs.readFile('.env', 'utf-8');
      
      // Parse environment variables
      const envVariables = dotenv.parse(envContent);
      
      // Filter out sensitive information
      const settings = {};
      
      // API keys (masked)
      if (process.env.CLAUDE_API_KEY) {
        settings.CLAUDE_API_KEY = this.maskApiKey(process.env.CLAUDE_API_KEY);
      }
      
      if (process.env.PERPLEXITY_API_KEY) {
        settings.PERPLEXITY_API_KEY = this.maskApiKey(process.env.PERPLEXITY_API_KEY);
      }
      
      // Project paths
      if (process.env.GAANA_PROJECT_PATH) {
        settings.GAANA_PROJECT_PATH = process.env.GAANA_PROJECT_PATH;
      }
      
      if (process.env.GAME_PROJECT_PATH) {
        settings.GAME_PROJECT_PATH = process.env.GAME_PROJECT_PATH;
      }
      
      return settings;
    } catch (error) {
      log.error('Error getting settings:', error);
      throw error;
    }
  }

  /**
   * Get API status
   */
  async getAPIStatus() {
    await this.initialize();
    
    try {
      const status = {
        providers: {
          claude: {
            enabled: !!process.env.CLAUDE_API_KEY,
            keyMasked: this.maskApiKey(process.env.CLAUDE_API_KEY || ''),
            model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229'
          },
          perplexity: {
            enabled: !!process.env.PERPLEXITY_API_KEY,
            keyMasked: this.maskApiKey(process.env.PERPLEXITY_API_KEY || ''),
            model: process.env.PERPLEXITY_MODEL || 'sonar-small-online'
          }
        }
      };
      
      return status;
    } catch (error) {
      log.error('Error getting API status:', error);
      throw error;
    }
  }

  /**
   * Update API keys
   */
  async updateAPIKeys(apiKeys) {
    await this.initialize();
    
    try {
      if (!apiKeys) {
        throw new Error('No API keys provided');
      }
      
      // Read .env file
      let envContent = await fs.readFile('.env', 'utf-8');
      
      // Update API keys
      if (apiKeys.CLAUDE_API_KEY) {
        // Remove existing key if present
        envContent = envContent.replace(/^CLAUDE_API_KEY=.*/m, '');
        // Add new key
        envContent += `\nCLAUDE_API_KEY=${apiKeys.CLAUDE_API_KEY}`;
        
        // Update environment variable
        process.env.CLAUDE_API_KEY = apiKeys.CLAUDE_API_KEY;
      }
      
      if (apiKeys.PERPLEXITY_API_KEY) {
        // Remove existing key if present
        envContent = envContent.replace(/^PERPLEXITY_API_KEY=.*/m, '');
        // Add new key
        envContent += `\nPERPLEXITY_API_KEY=${apiKeys.PERPLEXITY_API_KEY}`;
        
        // Update environment variable
        process.env.PERPLEXITY_API_KEY = apiKeys.PERPLEXITY_API_KEY;
      }
      
      // Save .env file
      await fs.writeFile('.env', envContent, 'utf-8');
      
      log.info('API keys updated successfully');
      return { success: true };
    } catch (error) {
      log.error('Error updating API keys:', error);
      throw error;
    }
  }

  /**
   * Mask API key for display
   */
  maskApiKey(apiKey) {
    if (!apiKey) return '';
    
    // Different patterns for different API keys
    if (apiKey.startsWith('sk-ant')) {
      // Claude API key format: sk-ant-api03-...
      const parts = apiKey.split('-');
      if (parts.length >= 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}-****`;
      }
    } else if (apiKey.startsWith('pplx')) {
      // Perplexity API key format: pplx-...
      return 'pplx-****';
    }
    
    // Generic masking for other formats
    if (apiKey.length <= 8) {
      return '****';
    }
    
    return apiKey.substring(0, 4) + '****';
  }

  /**
   * Update project paths
   */
  async updateProjectPaths(projectPaths) {
    await this.initialize();
    
    try {
      if (!projectPaths) {
        throw new Error('No project paths provided');
      }
      
      // Read .env file
      let envContent = await fs.readFile('.env', 'utf-8');
      
      // Update project paths
      if (projectPaths.GAANA_PROJECT_PATH) {
        // Remove existing path if present
        envContent = envContent.replace(/^GAANA_PROJECT_PATH=.*/m, '');
        // Add new path
        envContent += `\nGAANA_PROJECT_PATH=${projectPaths.GAANA_PROJECT_PATH}`;
        
        // Update environment variable
        process.env.GAANA_PROJECT_PATH = projectPaths.GAANA_PROJECT_PATH;
      }
      
      if (projectPaths.GAME_PROJECT_PATH) {
        // Remove existing path if present
        envContent = envContent.replace(/^GAME_PROJECT_PATH=.*/m, '');
        // Add new path
        envContent += `\nGAME_PROJECT_PATH=${projectPaths.GAME_PROJECT_PATH}`;
        
        // Update environment variable
        process.env.GAME_PROJECT_PATH = projectPaths.GAME_PROJECT_PATH;
      }
      
      // Save .env file
      await fs.writeFile('.env', envContent, 'utf-8');
      
      log.info('Project paths updated successfully');
      return { success: true };
    } catch (error) {
      log.error('Error updating project paths:', error);
      throw error;
    }
  }
}

module.exports = new SettingsController(); 