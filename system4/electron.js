const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, systemPreferences } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const log = require('electron-log');
const { createMenu } = require('./menu');

// Initialize database connection handling
const database = require('./backend/src/database/connection');

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Initialize the settings store
const store = new Store({
  defaults: {
    firstLaunch: true,
    projects: [],
    defaultProject: null,
    enableRemoteControl: true,
    permissions: {
      desktopControl: false,
      fileAccess: false
    },
    authorizedPaths: [],
    serverPort: 3000,
    appearance: {
      darkMode: null // null = system default
    },
    mongodb: {
      migrationCompleted: false
    }
  }
});

// Keep references to prevent garbage collection
let mainWindow;
let serverProcess;
let appTray;
let isQuitting = false;

// Define paths
const appPath = app.getAppPath();
const serverPath = path.join(appPath, 'server.js');
const indexPath = path.join(appPath, 'public', 'index.html');

// Get port from .env file or use default
let serverPort = 3000;
try {
  const envPath = path.join(appPath, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const portMatch = envContent.match(/PORT=(\d+)/);
    if (portMatch && portMatch[1]) {
      serverPort = parseInt(portMatch[1], 10);
    }
  }
} catch (error) {
  log.error('Error reading .env file:', error);
}

// Function to start the server process
function startServer() {
  log.info('Starting server process...');
  
  if (serverProcess) {
    log.info('Server already running, skipping start');
    return;
  }
  
  try {
    serverProcess = spawn('node', [serverPath], {
      env: Object.assign({}, process.env, { NODE_ENV: 'production', ELECTRON: 'true' }),
      stdio: 'pipe'
    });
    
    serverProcess.stdout.on('data', (data) => {
      log.info(`Server stdout: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      log.error(`Server stderr: ${data}`);
    });
    
    serverProcess.on('close', (code) => {
      log.info(`Server process exited with code ${code}`);
      serverProcess = null;
    });
    
    serverProcess.on('error', (error) => {
      log.error('Failed to start server process:', error);
      serverProcess = null;
    });
    
    log.info(`Server started on port ${serverPort}`);
  } catch (error) {
    log.error('Error starting server:', error);
  }
}

// Function to initialize MongoDB database (optional)
async function initDatabase() {
  try {
    // Check if MONGODB_URI is set, if not, skip connection
    if (!process.env.MONGODB_URI) {
      log.info('MONGODB_URI not set, skipping database initialization.');
      store.set('mongodb.migrationCompleted', true); // Assume no migration needed if no DB
      return false;
    }

    log.info('Initializing MongoDB database connection...');
    const success = await database.init();
    if (success) {
      log.info('MongoDB database initialized successfully');
      
      // Check if this is the first launch with MongoDB
      const migrationCompleted = store.get('mongodb.migrationCompleted');
      const isFirstLaunch = store.get('firstLaunch');
      
      if (!migrationCompleted) {
        // Run migration if this is the first time with MongoDB
        await runDataMigration();
        
        // Update settings
        store.set('mongodb.migrationCompleted', true);
        if (isFirstLaunch) {
          store.set('firstLaunch', false);
        }
      }
      
      return true;
    } else {
      log.error('MongoDB database initialization failed');
      return false;
    }
  } catch (error) {
    log.error('Error initializing database:', error);
    return false;
  }
}

// Run data migration from Electron Store to MongoDB
async function runDataMigration() {
  log.info('Running data migration to MongoDB...');
  
  try {
    // Import migration module
    const migration = require('./backend/src/utils/dbMigrationScript');
    
    // Run migration
    await migration.runMigration();
    log.info('Data migration completed successfully');
    return true;
  } catch (error) {
    log.error('Error during data migration:', error);
    return false;
  }
}

// Function to create the main window
function createWindow() {
  log.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(appPath, 'preload.js')
    },
    icon: path.join(appPath, 'build', 'icon.png')
  });
  
  // Apply the saved dark mode setting
  const darkModeSetting = store.get('appearance.darkMode');
  if (darkModeSetting !== null) {
    mainWindow.webContents.executeJavaScript(`
      document.documentElement.classList.${darkModeSetting ? 'add' : 'remove'}('dark-mode');
      localStorage.setItem('darkMode', ${darkModeSetting ? '"enabled"' : '"disabled"'});
    `).catch(err => log.error('Error applying dark mode:', err));
  }
  
  // Set application menu
  createMenu(mainWindow);
  
  mainWindow.loadURL(`http://localhost:${serverPort}`);
  
  // Handle events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });
  
  // Create tray icon if it doesn't exist
  if (!appTray) {
    createTray();
  }
  
  log.info('Main window created successfully');
}

// Function to create system tray
function createTray() {
  const iconPath = path.join(appPath, 'build', process.platform === 'win32' ? 'icon.ico' : 'tray.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  appTray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Gaana AI Assistant', click: () => { if (mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Toggle Dark Mode', click: () => {
      const currentMode = store.get('appearance.darkMode');
      const newMode = currentMode === null ? 
        !app.nativeTheme.shouldUseDarkColors : 
        !currentMode;
      
      store.set('appearance.darkMode', newMode);
      
      if (mainWindow) {
        mainWindow.webContents.send('toggle-dark-mode');
      }
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => {
      isQuitting = true;
      app.quit();
    }}
  ]);
  
  appTray.setToolTip('Gaana AI Assistant');
  appTray.setContextMenu(contextMenu);
  
  appTray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// IPC events for DB operations
ipcMain.handle('db-status', () => {
  return {
    connected: database ? database.isConnected() : false
  };
});

// IPC Events
ipcMain.handle('request-permissions', async (event, permissions) => {
  try {
    if (permissions.includes('desktop-control')) {
      // Here we would check if desktop control permissions are allowed
      // For macOS, we might need to check accessibility permissions
      store.set('permissions.desktopControl', true);
    }
    
    if (permissions.includes('file-access')) {
      // Request directory access
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections'],
        title: 'Select Project Directories',
        message: 'Select directories where your projects are located'
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        store.set('authorizedPaths', result.filePaths);
        store.set('permissions.fileAccess', true);
      } else {
        return { success: false, message: 'File access permissions not granted' };
      }
    }
    
    return { 
      success: true, 
      permissions: {
        desktopControl: store.get('permissions.desktopControl'),
        fileAccess: store.get('permissions.fileAccess')
      },
      authorizedPaths: store.get('authorizedPaths') 
    };
  } catch (error) {
    log.error('Error during permission request:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('load-projects', async () => {
  return {
    projects: store.get('projects'),
    defaultProject: store.get('defaultProject'),
    authorizedPaths: store.get('authorizedPaths')
  };
});

ipcMain.handle('add-project', async (event, project) => {
  try {
    const projects = store.get('projects') || [];
    const newProject = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    projects.push(newProject);
    store.set('projects', projects);
    
    // Set as default if first project
    if (projects.length === 1) {
      store.set('defaultProject', newProject.id);
    }
    
    return { success: true, project: newProject };
  } catch (error) {
    log.error('Error adding project:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('set-default-project', async (event, projectId) => {
  try {
    store.set('defaultProject', projectId);
    return { success: true };
  } catch (error) {
    log.error('Error setting default project:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-project', async (event, projectId) => {
  try {
    const projects = store.get('projects') || [];
    const filteredProjects = projects.filter(p => p.id !== projectId);
    store.set('projects', filteredProjects);
    
    // Update default project if needed
    if (store.get('defaultProject') === projectId) {
      store.set('defaultProject', filteredProjects.length > 0 ? filteredProjects[0].id : null);
    }
    
    return { success: true };
  } catch (error) {
    log.error('Error deleting project:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('open-url', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// App event handlers
app.on('ready', async () => {
  log.info('App ready, initializing services...');
  
  // Initialize database (optional)
  await initDatabase();
  
  // Then start server process
  startServer();
  
  // Wait for server to start before creating window
  setTimeout(() => {
    createWindow();
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  
  // Close database connection if connected
  if (database && database.isConnected()) {
    await database.close();
  }
  
  // Kill server process
  if (serverProcess) {
    log.info('Terminating server process...');
    serverProcess.kill();
  }
});

// Handle squirrel events for Windows
if (process.platform === 'win32') {
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
} 

// Listen for dark mode toggle from renderer
ipcMain.handle('get-theme-settings', () => {
  const darkModeSetting = store.get('appearance.darkMode');
  const shouldUseDarkMode = darkModeSetting === null 
    ? app.nativeTheme.shouldUseDarkColors
    : darkModeSetting;
  
  return { 
    darkMode: shouldUseDarkMode,
    systemPreference: app.nativeTheme.shouldUseDarkColors
  };
});

ipcMain.handle('save-theme-setting', (event, isDarkMode) => {
  store.set('appearance.darkMode', isDarkMode);
  return { success: true };
});

// Listen for navigation from menu
ipcMain.on('navigate-to', (event, view) => {
  if (mainWindow) {
    mainWindow.webContents.send('navigate-to', view);
  }
});

// Handle updates to app theme
if (app.nativeTheme) {
  app.nativeTheme.on('updated', () => {
    const darkModeSetting = store.get('appearance.darkMode');
    
    // Only update if following system theme
    if (darkModeSetting === null && mainWindow) {
      mainWindow.webContents.send('system-theme-changed', app.nativeTheme.shouldUseDarkColors);
    }
  });
} 