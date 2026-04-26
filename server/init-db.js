// Database initialization script
// Creates default admin user if not exists

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Check if admin user exists
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!admin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash,
          fullName: 'Administrator',
          role: 'Admin'
        }
      });
      console.log('✓ Created default admin user (username: admin, password: admin123)');
    } else {
      console.log('✓ Admin user already exists');
    }

    // Create default roles if not exist
    const roles = [
      { name: 'Admin', permissions: JSON.stringify([
        'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete',
        'pos.access', 'pos.cancel_bill', 'reports.view', 'reports.export',
        'users.view', 'users.manage', 'users.reactivate', 'roles.manage', 'settings.manage',
        'bills.reinstate', 'settings.expiry_alerts', 'dashboard.view',
        'dashboard.customize', 'inventory.delete_batch'
      ])},
      { name: 'Manager', permissions: JSON.stringify([
        'inventory.view', 'inventory.add', 'inventory.edit',
        'pos.access', 'reports.view', 'users.view', 'settings.expiry_alerts',
        'dashboard.view', 'inventory.delete_batch'
      ])},
      { name: 'Cashier', permissions: JSON.stringify(['inventory.view', 'pos.access']) }
    ];

    for (const roleData of roles) {
      const existing = await prisma.role.findUnique({ where: { name: roleData.name } });
      if (!existing) {
        await prisma.role.create({ data: roleData });
        console.log(`✓ Created role: ${roleData.name}`);
      }
    }

    // Create default settings
    const defaultSettings = {
      storeName: 'Omni Inventory Pro',
      storeAddress: '',
      storePhone: '',
      currency: '₹',
      gstNumber: '',
      gstPercentage: '0',
      defaultBillType: 'Normal',
      enableExpiryBlocking: 'true',
      dashboardWidgets: JSON.stringify(['stats', 'charts', 'alerts'])
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await prisma.settings.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) }
      });
    }
    console.log('✓ Default settings initialized');

    console.log('\n✓ Database initialization complete!');
    console.log('\nYou can now start the server with: npm run server (or node server/index.cjs)');
    console.log('Login with: admin / admin123\n');

  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
