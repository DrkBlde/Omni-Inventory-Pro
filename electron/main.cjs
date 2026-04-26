const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');

const isDev = !app.isPackaged;
let mainWindow;
let serverProcess;
let tray = null;
let serviceInstalled = false;

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _cwd) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        ips.push(config.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

function getServerPath() {
  if (isDev) {
    return path.join(__dirname, '../server/index.cjs');
  }
  return path.join(process.resourcesPath, 'server', 'index.cjs');
}

function checkServiceInstalled() {
  return new Promise((resolve) => {
    exec('sc query "Omni Inventory Server"', (error) => {
      resolve(!error);
    });
  });
}

async function installServiceSilently() {
  if (isDev) return;

  const servicePath = path.join(process.resourcesPath, 'server', 'windows-service.js');
  if (!fs.existsSync(servicePath)) {
    console.log('Service script not found at:', servicePath);
    return;
  }

  exec(`"${process.execPath}" "${servicePath}" install`, (error) => {
    if (error) {
      console.log('Service install failed (may need admin):', error.message);
      return;
    }
    exec(`"${process.execPath}" "${servicePath}" start`, (err) => {
      if (err) console.log('Service start failed:', err.message);
    });
  });
}

function startServer() {
  const serverPath = getServerPath();

  if (!fs.existsSync(serverPath)) {
    console.error('Server file not found at:', serverPath);
    return;
  }

  // In production: resources folder is where extraResources land
  const workingDir = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath;

  const dbPath = isDev
    ? path.join(__dirname, '..', 'prisma', 'dev.db')
    : path.join(process.resourcesPath, 'prisma', 'dev.db');

  // Prisma needs the native query engine .node file explicitly in production
  const enginePath = isDev
    ? path.join(__dirname, '..', 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node')
    : path.join(process.resourcesPath, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');

  // Log file for debugging production issues
  const logPath = path.join(app.getPath('userData'), 'server.log');
  fs.writeFileSync(logPath, `=== Omni Server Log ${new Date().toISOString()} ===\n`);
  fs.appendFileSync(logPath, `serverPath: ${serverPath}\n`);
  fs.appendFileSync(logPath, `workingDir: ${workingDir}\n`);
  fs.appendFileSync(logPath, `dbPath: ${dbPath}\n`);
  fs.appendFileSync(logPath, `enginePath: ${enginePath}\n`);
  fs.appendFileSync(logPath, `engineExists: ${fs.existsSync(enginePath)}\n`);
  fs.appendFileSync(logPath, `dbExists: ${fs.existsSync(dbPath)}\n`);

  console.log('Starting server from:', serverPath);
  console.log('DB path:', dbPath);
  console.log('Engine exists:', fs.existsSync(enginePath));

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: workingDir,
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: isDev ? 'development' : 'production',
      DATABASE_URL: `file:${dbPath}`,
      PRISMA_QUERY_ENGINE_LIBRARY: enginePath,
      NODE_PATH: path.join(workingDir, 'node_modules'),
      ELECTRON_RUN_AS_NODE: '1',
    },
    detached: false,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log('[Server]', msg);
    fs.appendFileSync(logPath, `[OUT] ${msg}\n`);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error('[Server Error]', msg);
    fs.appendFileSync(logPath, `[ERR] ${msg}\n`);
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    fs.appendFileSync(logPath, `[SPAWN ERR] ${err.message}\n`);
  });

  serverProcess.on('exit', (code) => {
    console.log('Server process exited with code:', code);
    fs.appendFileSync(logPath, `[EXIT] code: ${code}\n`);
    serverProcess = null;
  });

  console.log('Server process started with PID:', serverProcess.pid);
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping server process...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Omni Inventory Pro',
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  Menu.setApplicationMenu(null);

  const startURL = isDev
    ? 'http://localhost:5173'
    : path.join(__dirname, '../dist', 'index.html');

  if (isDev) {
    mainWindow.loadURL(startURL).catch(() => {
      console.log('Vite not ready, retrying...');
      setTimeout(() => mainWindow.loadURL(startURL), 2000);
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(startURL);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon);
  tray.setToolTip('Omni Inventory Pro - Server Running');

  const ips = getLocalIPs();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Omni Inventory',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { label: `Server IP: ${ips[0]}`, enabled: true },
    { label: `Web Access: http://${ips[0]}:5173`, enabled: false },
    { type: 'separator' },
    { label: 'Server Status: Running', enabled: false },
    {
      label: 'Exit',
      click: () => {
        stopServer();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

ipcMain.handle('get-local-ips', () => getLocalIPs());

ipcMain.handle('check-service-status', async () => {
  const installed = await checkServiceInstalled();
  serviceInstalled = installed;
  return installed;
});

ipcMain.handle('install-service', () => {
  installServiceSilently();
});

// App lifecycle – only runs when this instance owns the lock
app.whenReady().then(async () => {
  if (!gotTheLock) return;
  console.log('App ready...');

  const installed = await checkServiceInstalled();
  serviceInstalled = installed;

  if (!installed && !isDev) {
    installServiceSilently();
  }

  startServer();

  setTimeout(() => {
    createWindow();
    createTray();
  }, 1500);
});

app.on('window-all-closed', () => {
  // Keep running in background (tray)
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('App quitting, stopping server...');
  stopServer();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
