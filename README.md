<p align="center">
  <img src="app_icon.png" alt="Omni Inventory Pro" width="350"/>
</p>

<h1 align="center">Omni Inventory Pro</h1>

<p align="center">A full-featured, offline-first desktop inventory management system built for small businesses.</p>


![Omni Inventory Pro Banner](screenshots/banner.png)

---

## About the Project

Omni Inventory Pro V2.2.0 builds on V2.1.0 with a focus on usability and reliability improvements. This version introduces customer management in the POS, an inactivity auto-logout system, dashboard customisation, an admin rescue tool, single instance locking to prevent the app from crashing due to multiple instances running simultaneously, and a web access URL on the dashboard so other devices on the same network can access the app from a browser.


![Dashboard](screenshots/dashboard.png)

---

## Features

- **Login & JWT Authentication** — Secure token-based login with hashed passwords and role-based access control
- **Dashboard** — Live overview of today's revenue, orders, stock alerts, expiry warnings, 7-day sales chart, server status, and web access URL
- **Web Access URL** — Dashboard shows your local network IP and a copyable URL so other devices on the same network can access the app from a browser
- **Inventory Management** — Add, edit, and delete products with SKU, barcode, category, batch tracking, expiry dates, and stock thresholds
- **Point of Sale (POS)** — Full billing screen with product search, customer selection, new customer creation, multi-payment support (cash, UPI, card), GST calculation, and bill printing
- **Customer Management** — Add and select customers directly from the POS screen; customer name and phone are saved with each bill
- **GST Billing** — Normal and GST bills with configurable GST percentage, taxable amount breakdown, and GST number on the receipt
- **Encrypted QR Codes on Bills** — Each bill generates an AES-256 encrypted QR code for secure bill cancellation verification
- **Bill History** — View, search, print receipts, and cancel bills with QR code verification
- **Reports** — Revenue trend charts, pie chart sales breakdown, and a filterable recent bills table
- **User & Role Management** — Create users, define custom roles, assign granular permissions, and deactivate accounts
- **Staff Attendance** — Clock-in and clock-out tracking for staff members
- **Dashboard Widget Customisation** — Choose which widgets appear on your dashboard via settings
- **Inactivity Auto-Logout** — Configurable inactivity timeout that automatically logs out the user after a set period of inactivity
- **Expiry Blocking** — Configurable setting to block the sale of expired products at the POS
- **Admin Rescue Tool** — A built-in recovery script to restore the admin account if it becomes inaccessible
- **Single Instance Lock** — Prevents multiple instances of the app from running simultaneously, avoiding crashes and database conflicts
- **Server Status Indicator** — Shows whether the local backend server is online or offline
- **App Settings** — Configure store name, address, phone, currency, GST settings, logo, stock thresholds, dashboard widgets, and inactivity timeout
- **Offline & Local** — No internet required; all data is stored in a local SQLite database managed by Prisma
- **MSI Installer** — Clean one-click Windows installation


![Point of Sale](screenshots/pos.png)


![Inventory](screenshots/inventory.png)


![Reports](screenshots/reports.png)


![Attendance](screenshots/attendance.png)

---

## Libraries & Technologies Used

| Library / Technology | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop app shell |
| [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Frontend UI framework |
| [Vite](https://vitejs.dev/) | Frontend build tool and dev server |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) | UI components |
| [Zustand](https://github.com/pmndrs/zustand) | Global state management |
| [Express](https://expressjs.com/) | Local backend server |
| [Prisma ORM](https://www.prisma.io/) | Schema-managed database layer |
| [SQLite3](https://github.com/TryGhost/node-sqlite3) | Local database engine |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Password hashing |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | JWT session authentication |
| [crypto-js](https://github.com/brix/crypto-js) | AES-256 encryption for QR codes |
| [qrcode](https://github.com/soldair/node-qrcode) | QR code generation on bills |
| [jsqr](https://github.com/cozmo/jsQR) | QR code scanning for bill cancellation |
| [axios](https://axios-http.com/) | HTTP client for API calls |
| [Recharts](https://recharts.org/) | Charts for dashboard and reports |
| [React Router](https://reactrouter.com/) | Client-side routing |
| [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Form handling and validation |
| [TanStack Query](https://tanstack.com/query) | Server state and data fetching |
| [electron-builder](https://www.electron.build/) | Packages the app into a Windows `.msi` installer |
| [date-fns](https://date-fns.org/) | Date formatting |
| [Lucide React](https://lucide.dev/) | Icon library |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable configuration |

---

## Software Overview

Omni Inventory Pro V2.2.0 continues the Electron + React + TypeScript architecture from V2.1.0. The major additions in this version are focused on usability: customers can now be created and assigned to bills directly from the POS screen, the dashboard now shows a copyable web access URL so the app can be used from other devices on the same network, and a settings store has been separated into its own Zustand slice for cleaner state management.

A single instance lock using Electron's `app.requestSingleInstanceLock()` has been added to prevent multiple app instances from running at the same time, which previously caused database conflicts and could crash the PC. An admin rescue script (`server/rescue.cjs`) is also included to recover the admin account if it becomes locked out.

---

## How to Use

### Running the Installed App

If you downloaded the `.msi` installer, run it and follow the on-screen steps. A desktop shortcut will be created automatically.

### Default Login Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> **Important:** Change the admin password immediately after your first login via the Users & Roles page.

### Web Access (Other Devices)

Once the app is running, the dashboard shows a **Web Access URL** (e.g. `http://192.168.1.14:5173`). Open this URL on any device connected to the same network — phones, tablets, or other PCs — to access the app from a browser without installing anything.

### Admin Rescue

If the admin account becomes inaccessible, run the rescue script from the server folder:

```bash
node server/rescue.cjs
```

This will reset the admin password back to `admin123`.

### Running from Source

1. Make sure you have **Node.js 18+** installed — download from [nodejs.org](https://nodejs.org/)
2. Clone or download this repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:init
   ```
5. Run the app in development mode:
   ```bash
   npm run electron:dev
   ```

### Compiling the App

```bash
npm run dist
```

Output will be in the `dist_msi/` folder.

### Database Commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Generates the Prisma client from the schema |
| `npm run db:push` | Pushes the schema to the database |
| `npm run db:migrate` | Runs a full Prisma migration |
| `npm run db:init` | Seeds the database with default data |
| `npm run db:reset` | Wipes and re-initialises the database |
| `npm run db:studio` | Opens Prisma Studio (visual database browser) |

---

## What Changed from V2.1.0

| | V2.1.0 | V2.2.0 |
|---|---|---|
| Customer Management | ❌ | ✅ Add and select customers in POS |
| Web Access URL | ❌ | ✅ Dashboard shows copyable network URL |
| Inactivity Auto-Logout | ❌ | ✅ Configurable timeout in settings |
| Dashboard Customisation | ❌ | ✅ Choose which widgets to show |
| Expiry Blocking at POS | ❌ | ✅ Configurable in settings |
| Admin Rescue Tool | ❌ | ✅ `server/rescue.cjs` |
| Single Instance Lock | ❌ | ✅ Prevents multiple instances crashing |
| Settings State | Mixed in main store | Separate `settingsStore` |

---

## Migrating Data from V1

If you were using V1 (the Python version), use the included `migrate_v1_to_v2.bat` tool to import your products, bills, and settings. See the README in the V2.0.0 release for full migration instructions.

---

## License

Copyright (c) 2026 **DrkBlde**

This project is licensed under the **GNU General Public License v3.0**. See the [`LICENSE`](LICENSE) file for the full license text.

**In short:**

- ✅ You are free to use, modify, and distribute this software
- ✅ You must credit **DrkBlde** as the original author in any modified or redistributed version
- ✅ Any modified version you release must also be open source under GPL-3
- ❌ You may not use this software or any derivative of it for commercial purposes without first getting permission
- ❌ You may not claim this software as your own or release it under a different name without crediting the original author

> **For commercial use or any use beyond personal projects**, please open an issue before proceeding — see below.

---

## Issues, Bugs & Permission Requests

Found a bug, have a suggestion, or want to request permission for commercial use? Open an issue on the GitHub Issues page:

**[→ Open an Issue](../../issues)**

When reporting a bug, please include:
- What you were doing when the issue occurred
- Any error messages you saw
- Your Node.js version and operating system

When requesting commercial use permission, describe your intended use clearly and wait for a response before proceeding.
