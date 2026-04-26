/**
 * Windows Service Wrapper for Omni Inventory Server
 * This allows the server to run in the background as a Windows Service
 *
 * Install: node server/windows-service.js install
 * Start:   node server/windows-service.js start
 * Stop:    node server/windows-service.js stop
 * Remove:  node server/windows-service.js remove
 */

const path = require('path');
const fs = require('fs');

// Check if running as Windows Service
const Service = (function() {
  try {
    return require('node-windows').Service;
  } catch (e) {
    return null;
  }
})();

const serviceName = 'Omni Inventory Server';
const serviceDescription = 'Backend server for Omni Inventory Pro - runs in background for multi-device sync';
const serverScript = path.join(__dirname, 'index.cjs');

function installService() {
  if (!Service) {
    console.error('node-windows not installed. Run: npm install node-windows');
    return;
  }

  // Create a new service service
  const svc = new Service({
    name: serviceName,
    description: serviceDescription,
    script: serverScript,
    env: {
      name: 'NODE_ENV',
      value: 'production'
    },
    wait: 2,
    grow: 0.5,
    maxRestarts: 5,
    stopGracePeriod: 30,
    logOnAs: {
      account: 'LocalSystem',
      password: null
    }
  });

  svc.on('install', function() {
    console.log('Service installed successfully!');
    console.log('The server will now run in the background.');
    console.log('To start: node server/windows-service.js start');
    console.log('Or: Open Services (services.msc) and start "Omni Inventory Server"');
  });

  svc.on('alreadyinstalled', function() {
    console.log('Service is already installed.');
  });

  svc.on('invalidinstallation', function() {
    console.log('Invalid installation. Make sure you are running as Administrator.');
  });

  svc.install();
}

function startService() {
  if (!Service) {
    console.error('node-windows not installed. Run: npm install node-windows');
    return;
  }

  const svc = new Service({ name: serviceName });

  svc.on('start', function() {
    console.log('Service started successfully!');
    console.log('Server is now running on http://localhost:3001');
  });

  svc.on('error', function(err) {
    console.error('Failed to start service:', err);
  });

  svc.start();
}

function stopService() {
  if (!Service) {
    console.error('node-windows not installed. Run: npm install node-windows');
    return;
  }

  const svc = new Service({ name: serviceName });

  svc.on('stop', function() {
    console.log('Service stopped.');
  });

  svc.stop();
}

function removeService() {
  if (!Service) {
    console.error('node-windows not installed. Run: npm install node-windows');
    return;
  }

  const svc = new Service({ name: serviceName });

  svc.on('uninstall', function() {
    console.log('Service removed successfully!');
  });

  svc.uninstall();
}

function checkStatus() {
  const { execSync } = require('child_process');
  try {
    const output = execSync('sc query "Omni Inventory Server"', { encoding: 'utf-8' });
    console.log('Service Status:');
    console.log(output);
  } catch (e) {
    console.log('Service is not installed or not running.');
  }
}

// CLI commands
const command = process.argv[2];

switch (command) {
  case 'install':
    installService();
    break;
  case 'start':
    startService();
    break;
  case 'stop':
    stopService();
    break;
  case 'remove':
    removeService();
    break;
  case 'status':
    checkStatus();
    break;
  default:
    console.log(`
Omni Inventory Server - Windows Service Manager

Usage:
  node server/windows-service.js install   - Install as Windows Service
  node server/windows-service.js start     - Start the service
  node server/windows-service.js stop      - Stop the service
  node server/windows-service.js remove    - Remove the service
  node server/windows-service.js status    - Check service status

Notes:
  - Run as Administrator for install/remove operations
  - Once installed as a service, the server runs continuously
  - The service starts automatically when Windows boots
  - All devices on the network can connect to http://<this-pc-ip>:3001
`);
}
