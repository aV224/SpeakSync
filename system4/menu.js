const { app, Menu, shell } = require('electron');
const log = require('electron-log');

function createMenu(mainWindow) {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App Menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('navigate-to', 'settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('navigate-to', 'projects')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    
    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow.webContents.send('toggle-dark-mode')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    
    // Features Menu
    {
      label: 'Features',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('navigate-to', 'dashboard')
        },
        {
          label: 'Phone Calls',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('navigate-to', 'calls')
        },
        {
          label: 'Remote Control',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow.webContents.send('navigate-to', 'remote')
        },
        {
          label: 'Voice Commands',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow.webContents.send('navigate-to', 'voice')
        },
        {
          label: 'Projects',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow.webContents.send('navigate-to', 'projects')
        }
      ]
    },

    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/gaana-desktop/wiki');
          }
        },
        {
          label: 'Report an Issue',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/gaana-desktop/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            log.info('User initiated update check');
            mainWindow.webContents.send('check-for-updates');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createMenu }; 