/**
 * Auto-Start Server as Background Process
 * This script starts the server silently in the background
 *
 * Usage:
 *   node server/auto-start.js install  - Add to Windows Startup
 *   node server/auto-start.js remove   - Remove from Startup
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const appName = 'Omni Inventory Server';
const serverScript = path.join(__dirname, 'index.cjs');
const nodePath = process.execPath;

function getStartupPath() {
  return path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );
}

function getShortcutCommand() {
  // For production EXE, we need to find the installed server path
  // This is a simplified version - in production the path would be different
  return `"${nodePath}" "${serverScript}"`;
}

function install() {
  try {
    const startupPath = getStartupPath();
    const shortcutPath = path.join(startupPath, `${appName}.vbs`);

    // Create VBScript to run silently
    const vbsContent = `
Set objShell = CreateObject("WScript.Shell")
objShell.Run """${nodePath}"" ""${serverScript}""", 0, False
`;

    fs.writeFileSync(shortcutPath, vbsContent);

    console.log('✓ Auto-start installed successfully!');
    console.log(`  The server will start automatically when Windows boots.`);
    console.log(`  Location: ${shortcutPath}`);
    console.log('');
    console.log('To remove, run: node server/auto-start.js remove');
  } catch (err) {
    console.error('✗ Failed to install auto-start:', err.message);
    console.error('Make sure you have write access to the Startup folder.');
  }
}

function remove() {
  try {
    const startupPath = getStartupPath();
    const shortcutPath = path.join(startupPath, `${appName}.vbs`);

    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
      console.log('✓ Auto-start removed successfully!');
    } else {
      console.log('Auto-start was not installed.');
    }
  } catch (err) {
    console.error('✗ Failed to remove auto-start:', err.message);
  }
}

function status() {
  const startupPath = getStartupPath();
  const shortcutPath = path.join(startupPath, `${appName}.vbs`);

  if (fs.existsSync(shortcutPath)) {
    console.log('✓ Auto-start is INSTALLED');
    console.log(`  Location: ${shortcutPath}`);
  } else {
    console.log('✗ Auto-start is NOT installed');
  }
}

const command = process.argv[2];

switch (command) {
  case 'install':
    install();
    break;
  case 'remove':
    remove();
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`
Omni Inventory Server - Auto-Start Manager

Usage:
  node server/auto-start.js install   - Add to Windows Startup
  node server/auto-start.js remove    - Remove from Startup
  node server/auto-start.js status    - Check auto-start status

Notes:
  - Runs server in background when Windows starts
  - No admin privileges required
  - Server runs silently (no window)
  - Access web app at: http://<this-pc-ip>:5173
`);
}
