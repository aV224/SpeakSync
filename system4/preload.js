const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', {
    // Permission and file system APIs
    requestPermissions: () => ipcRenderer.invoke('request-permissions'),
    
    // Project management APIs
    loadProjects: () => ipcRenderer.invoke('load-projects'),
    addProject: (project) => ipcRenderer.invoke('add-project', project),
    setDefaultProject: (projectId) => ipcRenderer.invoke('set-default-project', projectId),
    deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
    
    // Utility functions
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    
    // App version info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Remote Control
    toggleRemoteControl: (enabled) => ipcRenderer.invoke('toggle-remote-control', enabled),
    getRemoteControlStatus: () => ipcRenderer.invoke('get-remote-control-status'),
    
    // Theme management
    getThemeSettings: () => ipcRenderer.invoke('get-theme-settings'),
    saveThemeSetting: (isDarkMode) => ipcRenderer.invoke('save-theme-setting', isDarkMode),
    
    // Database
    getDatabaseStatus: () => ipcRenderer.invoke('db-status'),
    
    // Custom events from main process
    onNavigateTo: (callback) => {
      ipcRenderer.on('navigate-to', (_, view) => callback(view));
      return () => {
        ipcRenderer.removeAllListeners('navigate-to');
      };
    },
    onToggleDarkMode: (callback) => {
      ipcRenderer.on('toggle-dark-mode', () => callback());
      return () => {
        ipcRenderer.removeAllListeners('toggle-dark-mode');
      };
    },
    onSystemThemeChanged: (callback) => {
      ipcRenderer.on('system-theme-changed', (_, isDarkMode) => callback(isDarkMode));
      return () => {
        ipcRenderer.removeAllListeners('system-theme-changed');
      };
    },
    onShowAbout: (callback) => {
      ipcRenderer.on('show-about', () => callback());
      return () => {
        ipcRenderer.removeAllListeners('show-about');
      };
    },
    onCheckForUpdates: (callback) => {
      ipcRenderer.on('check-for-updates', () => callback());
      return () => {
        ipcRenderer.removeAllListeners('check-for-updates');
      };
    }
  }
); 