const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const http = require('http');

const isDev = !app.isPackaged;
let mainWindow;
let serverProcess;
let tray = null;
let isQuitting = false;

// --- SINGLE INSTANCE LOCK ---
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
  if (isDev) return path.join(__dirname, '../server/index.cjs');
  return path.join(process.resourcesPath, 'server', 'index.cjs');
}

function startServer() {
  const serverPath = getServerPath();

  if (!fs.existsSync(serverPath)) {
    console.error('Server file not found at:', serverPath);
    return;
  }

  const workingDir = isDev ? path.join(__dirname, '..') : process.resourcesPath;
  const dbPath = path.join(workingDir, 'prisma', 'dev.db');
  const nodeBin = process.execPath;
  const logPath = path.join(app.getPath('userData'), 'server.log');

  fs.writeFileSync(logPath, '=== Omni Server Log ' + new Date().toISOString() + ' ===\n');
  fs.appendFileSync(logPath, 'serverPath: ' + serverPath + '\n');
  fs.appendFileSync(logPath, 'workingDir: ' + workingDir + '\n');
  fs.appendFileSync(logPath, 'dbPath: ' + dbPath + '\n');
  fs.appendFileSync(logPath, 'nodeBin: ' + nodeBin + '\n');

  const enginePath = path.join(workingDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
  fs.appendFileSync(logPath, 'enginePath: ' + enginePath + '\n');
  fs.appendFileSync(logPath, 'engineExists: ' + fs.existsSync(enginePath) + '\n');

  serverProcess = spawn(nodeBin, [serverPath], {
    cwd: workingDir,
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: 'production',
      DATABASE_URL: 'file:' + dbPath,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: path.join(workingDir, 'node_modules'),
      PRISMA_QUERY_ENGINE_LIBRARY: enginePath,
    },
    detached: false,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log('[Server]', msg);
    fs.appendFileSync(logPath, '[OUT] ' + msg + '\n');
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error('[Server Error]', msg);
    fs.appendFileSync(logPath, '[ERR] ' + msg + '\n');
  });

  serverProcess.on('exit', (code) => {
    console.log('[Server] exited with code', code);
    fs.appendFileSync(logPath, '[EXIT] code: ' + code + '\n');
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

function waitForServer(onReady, retries, interval) {
  retries = retries || 40;
  interval = interval || 1000;
  let attempts = 0;
  let done = false;

  const check = () => {
    if (done) return;
    attempts++;
    const req = http.get('http://127.0.0.1:3001/api/health', (res) => {
      if (done) return;
      if (res.statusCode === 200) {
        done = true;
        console.log('[Electron] Server ready after ' + attempts + ' attempt(s)');
        onReady();
      } else {
        retry();
      }
    });
    req.on('error', () => { if (!done) retry(); });
    req.setTimeout(800, () => { req.destroy(); if (!done) retry(); });
  };

  const retry = () => {
    if (done) return;
    if (attempts < retries) {
      setTimeout(check, interval);
    } else {
      done = true;
      console.error('[Electron] Server did not respond in time — opening window anyway');
      onReady();
    }
  };

  check();
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      setTimeout(() => mainWindow.loadURL('http://localhost:5173'), 2000);
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
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
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        else createWindow();
      }
    },
    { label: 'Server IP: ' + ips[0], enabled: true },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true;
        stopServer();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

ipcMain.handle('get-local-ips', () => getLocalIPs());

app.whenReady().then(() => {
  startServer();
  waitForServer(() => {
    createWindow();
    createTray();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
