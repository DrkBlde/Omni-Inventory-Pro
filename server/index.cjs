BigInt.prototype.toJSON = function() { return this.toString() };

const path = require('path');
const dotenv = require('dotenv');

// 1. Load env vars FIRST, before any other require that might need them.
// In production (packaged exe), there is no .env file — env vars come from
// Electron's spawn env instead. dotenv.config() will silently no-op, which is fine.
dotenv.config({ path: path.join(process.cwd(), '.env') });

// 2. Ensure PRISMA_QUERY_ENGINE_LIBRARY is set before PrismaClient is required.
// Electron sets this in the spawn env, but we also derive it here as a fallback
// so the server works if started standalone.
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client',
    'query_engine-windows.dll.node'
  );
}

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');


const app = express();
const prisma = new PrismaClient();

// ============================================================
// 2. THE "ABSOLUTE TOP" LOGGER
// This is now ABOVE everything else. If the request hits the server, 
// you WILL see it in the terminal now.
// ============================================================
app.use((req, res, next) => {
  console.log(`\n--- NEW REQUEST DETECTED ---`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Origin: ${req.get('origin') || 'No Origin'}`);
  next();
});

// 3. Middleware to share prisma instance
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// 4. SIMPLIFIED CORS (Diagnostic Mode)
// We are making this extremely permissive to rule out the CORS crash.
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 5. Body parsing middleware with high limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 6. Import all route modules
const authRoutes = require('./routes/auth.cjs');
const productRoutes = require('./routes/products.cjs');
const customerRoutes = require('./routes/customers.cjs');
const billRoutes = require('./routes/bills.cjs');
const userRoutes = require('./routes/users.cjs');
const settingsRoutes = require('./routes/settings.cjs');
const adminRoutes = require('./routes/admin.cjs'); 
const attendanceRoutes = require('./routes/attendance.cjs');
const roleRoutes = require('./routes/roleRoutes.cjs');

app.post('/api/auth/test', (req, res) => {
  console.log("!!! THE TEST ROUTE WAS REACHED !!!");
  res.json({ message: "The server is receiving POST requests perfectly." });
});

// 7. Register API routes
app.use('/api/auth', authRoutes(prisma));
app.use('/api/products', productRoutes(prisma));
app.use('/api/bills', billRoutes(prisma));
app.use('/api/users', userRoutes(prisma));
app.use('/api/settings', settingsRoutes(prisma)); 
app.use('/api/admin', adminRoutes(prisma));    
app.use('/api/customers', customerRoutes(prisma));
app.use('/api/attendance', attendanceRoutes(prisma));
app.use('/api/roles', roleRoutes(prisma));

// 8. Basic health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 9. Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Omni Inventory Server',
    version: '2.2.0',
    status: 'running'
  });
});

// ============================================================
// 10. THE GLOBAL ERROR HANDLER
// If anything fails in the routes, this will catch it.
// ============================================================
app.use((err, req, res, next) => {
  console.error("\n🚨 SERVER ERROR LOGGED:");
  console.error("Path:", req.url);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("------------------------\n");
  
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

const PORT = process.env.PORT || 3001;

// 11. Database/Admin synchronization
const ensureEmergencyAdmin = async () => {
  try {
    const bcrypt = require('bcryptjs');

    // Ensure Admin role exists
    const adminRole = await prisma.role.upsert({
      where: { name: 'Admin' },
      update: {},
      create: {
        name: 'Admin',
        permissions: JSON.stringify([
          "dashboard.view", "dashboard.customize",
          "inventory.view", "inventory.add", "inventory.edit", "inventory.delete", "inventory.manage",
          "pos.access", "roles.view", "roles.manage", "roles.create", "roles.delete",
          "can_create_bill", "attendance.view", "attendance.manage",
          "settings.manage", "users.view", "users.manage"
        ])
      }
    });

    // Only create admin if they don't exist — never overwrite (preserves password changes made in-app)
    const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });

    if (!existingAdmin) {
      // Fresh install or DB reset — create admin from scratch
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash,
          fullName: 'System Administrator',
          roleId: adminRole.id,
          isActive: true,
          isSystem: true
        }
      });
      console.log("✅ Admin user created with default password.");
    } else if (existingAdmin.passwordHash === 'admin' || !existingAdmin.passwordHash.startsWith('$2')) {
      // Migrate old plain-text or invalid hash to proper bcrypt — runs once, never again
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.update({
        where: { username: 'admin' },
        data: { passwordHash, isActive: true, roleId: adminRole.id }
      });
      console.log("✅ Admin password migrated to secure hash.");
    } else {
      console.log("✅ Database verification complete. Admin user exists.");
    }

  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
  }
};

// 12. Start the server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n==============================================`);
  console.log(`  OMNI INVENTORY PRO - BACKEND SERVER v2.2.0`);
  console.log(`  Listening on: http://0.0.0.0:${PORT}`);
  console.log(`==============================================\n`);
  
  await ensureEmergencyAdmin();
});

// 13. Safe exit
process.on('SIGINT', async () => {
  console.log('\nShutting down server safely...');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { app, prisma };