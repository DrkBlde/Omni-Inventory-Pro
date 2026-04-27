# Omni Inventory Pro - Sync & Server Setup

## Features Implemented

### 1. Real-Time Sync Across All Devices
- Bills created on any device appear on all connected devices within 5 seconds
- Auto-sync every 5 seconds when app is open
- Central SQLite database on server machine

### 2. Desktop App Shows Server IP
- **Desktop app only**: Shows the machine's IP address on Dashboard
- One-click copy to clipboard
- Makes it easy to access web version from other devices
- Web version does NOT show this (as requested)

### 3. Server Auto-Start Options

#### Option A: Windows Startup (No Admin Required)
```bash
node server/auto-start.js install
```
- Server starts silently when Windows boots
- Runs in background (no window)
- To remove: `node server/auto-start.js remove`

#### Option B: Windows Service (Requires Admin)
```bash
npm install node-windows
npm run service:install
```
- Runs as a proper Windows Service
- Starts before user login
- To remove: `npm run service:remove`

---

## Quick Setup Guide

### Step 1: Initial Setup (Run Once)
```bash
npm install
npm run db:generate
npm run db:push
npm run db:init
```

### Step 2: Setup Auto-Start (Choose One)

**Option A - Startup Folder (Easier, No Admin):**
```bash
node server/auto-start.js install
```

**Option B - Windows Service (Advanced, Needs Admin):**
```bash
npm install node-windows
npm run service:install
```

### Step 3: Start Server (First Time Only)
```bash
npm run server
```

After auto-start is configured, the server starts automatically on boot.

---

## Accessing From Other Devices

### From Desktop App:
1. Open the app
2. Go to **Dashboard** page
3. See "Server IP" and "Web Access" URL displayed
4. Click copy button to copy the URL

### From Web Browser (Other Devices):
1. Open browser on any device on the same network
2. Go to the URL shown in desktop app (e.g., `http://192.168.1.100:5173`)
3. Login with same credentials
4. Data syncs automatically!

---

## Testing Real-Time Sync

1. **Device 1 (Desktop App):**
   - Create a bill in POS
   - Note the bill number

2. **Device 2 (Web Browser):**
   - Open Bill History
   - The new bill appears within 5 seconds!

3. **Any Device:**
   - Add a product on one device
   - It appears on all devices after next sync

---

## Default Credentials

- **Username:** `admin`
- **Password:** `admin123`

**Change this after first login!**

---

## Troubleshooting

### Server Not Starting on Boot
- Check Startup folder: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- Or check Services: `services.msc` → Look for "Omni Inventory Server"

### Can't Access from Web
- Ensure firewall allows port 3001 and 5173
- Verify IP address in desktop app matches your network
- All devices must be on same network

### Data Not Syncing
- Check "Online" indicator shows green on all devices
- Wait up to 5 seconds for auto-sync
- Ensure all devices connect to same server IP

### "Server Unavailable" Error
- Start server manually: `npm run server`
- Check auto-start is installed: `node server/auto-start.js status`

---

## Build EXE for Distribution

```bash
# Set the server IP in .env before building
VITE_API_URL=http://YOUR_IP:3001/api

npm run build
npm run dist
```

The EXE will:
- Start server automatically when opened
- Show server IP on Dashboard for web access
- Install auto-start on first run

---

## Commands Reference

```bash
# Database
npm run db:init        # Initialize with admin user
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database

# Server
npm run server         # Start server manually

# Auto-start (No Admin)
node server/auto-start.js install
node server/auto-start.js remove
node server/auto-start.js status

# Windows Service (Needs Admin)
npm run service:install
npm run service:remove

# Build
npm run build          # Build frontend
npm run dist           # Create EXE installer
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Server Machine (Runs Database + Server)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Auto-Start  │→ │ Node Server  │→ │ SQLite Database │   │
│  │  (Service)  │  │  (Port 3001) │  │   (prisma/dev.db)│   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
│         ↑                  ↑                                      │
│         └──────────────────┘                                     │
│               Server runs continuously                           │
└─────────────────────────────────────────────────────────────┘
                         ↑
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐ ┌────▼─────┐ ┌──────▼──────┐
│  Desktop App    │ │  Web     │ │   Another   │
│  (Shows IP)     │ │ Browser  │ │   Device    │
│  192.168.1.100  │ │ Same URL │ │   Same URL  │
└─────────────────┘ └──────────┘ └─────────────┘
```

All devices share the **same database** via the server!
