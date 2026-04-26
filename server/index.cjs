const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth.cjs');
const productRoutes = require('./routes/products.cjs');
const customerRoutes = require('./routes/customers.cjs');
const billRoutes = require('./routes/bills.cjs');
const userRoutes = require('./routes/users.cjs');
const settingsRoutes = require('./routes/settings.cjs');
const adminRoutes = require('./routes/admin.cjs');

// Setup routes
app.use('/api/auth', authRoutes(prisma));
app.use('/api/products', productRoutes(prisma));
app.use('/api/bills', billRoutes(prisma));
app.use('/api/users', userRoutes(prisma));
app.use('/api/settings', settingsRoutes(prisma));
app.use('/api/customers', customerRoutes(prisma));
app.use('/api/admin', adminRoutes(prisma));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Omni Inventory Server',
    version: '2.1.0',
    status: 'running',
    endpoints: [
      '/api/auth',
      '/api/products',
      '/api/bills',
      '/api/users',
      '/api/settings',
      '/api/customers'
    ]
  });
});

// Auto-initialize database on first launch (seeds admin user, roles, and settings)
async function initializeIfNeeded() {
  const bcrypt = require('bcryptjs');

  // ── Admin user ────────────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullName: 'Administrator',
        role: 'Admin',
        isActive: true,
      },
    });
    console.log('✓ Default admin user created (username: admin, password: admin123)');
  }

  // ── Default roles ─────────────────────────────────────────────────────────
  const roles = [
    {
      name: 'Admin',
      permissions: JSON.stringify([
        'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete',
        'pos.access', 'pos.cancel_bill', 'reports.view', 'reports.export',
        'users.view', 'users.manage', 'users.reactivate', 'roles.manage', 'settings.manage',
        'bills.reinstate', 'settings.expiry_alerts', 'dashboard.view',
        'dashboard.customize', 'inventory.delete_batch',
      ]),
    },
    {
      name: 'Manager',
      permissions: JSON.stringify([
        'inventory.view', 'inventory.add', 'inventory.edit',
        'pos.access', 'reports.view', 'users.view', 'settings.expiry_alerts',
        'dashboard.view', 'inventory.delete_batch',
      ]),
    },
    {
      name: 'Cashier',
      permissions: JSON.stringify(['inventory.view', 'pos.access']),
    },
  ];

  for (const roleData of roles) {
    const existing = await prisma.role.findUnique({ where: { name: roleData.name } });
    if (!existing) {
      await prisma.role.create({ data: roleData });
      console.log(`✓ Created role: ${roleData.name}`);
    }
  }

  // ── Default settings ──────────────────────────────────────────────────────
  const defaultSettings = {
    storeName: 'Omni Inventory Pro',
    storeAddress: '',
    storePhone: '',
    currency: '₹',
    gstNumber: '',
    gstPercentage: '0',
    defaultBillType: 'Normal',
    enableExpiryBlocking: 'true',
    dashboardWidgets: JSON.stringify(['stats', 'charts', 'alerts']),
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.settings.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: {},  // never overwrite settings the user has already changed
    });
  }

  console.log('✓ Database initialization complete');
}

const PORT = process.env.PORT || 3001;

initializeIfNeeded()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n========================================`);
      console.log(`  Omni Inventory Server v2.1.0`);
      console.log(`  Running on: http://0.0.0.0:${PORT}`);
      console.log(`  Database: ${process.env.DATABASE_URL || 'SQLite'}`);
      console.log(`  Access from LAN: http://<YOUR_IP>:${PORT}`);
      console.log(`========================================\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nServer terminated.');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { app, prisma };
