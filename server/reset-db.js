// Database reset script - clears all data and reinitializes
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('Resetting database...');

    // 1. Clear Transaction Data
    await prisma.billItem.deleteMany();
    console.log('✓ Cleared bill items');

    await prisma.bill.deleteMany();
    console.log('✓ Cleared bills');

    // 2. Clear Inventory
    await prisma.batch.deleteMany();
    console.log('✓ Cleared batches');

    await prisma.product.deleteMany();
    console.log('✓ Cleared products');

    // 3. Clear Customer & Attendance Data
    await prisma.customer.deleteMany();
    console.log('✓ Cleared customers');

    await prisma.clockEntry.deleteMany();
    console.log('✓ Cleared clock entries');

    await prisma.attendance.deleteMany(); 
    console.log('✓ Cleared attendance records');

    // 4. CLEAR USERS (Crucial: Must delete users before roles)
    // We filter to keep the main 'admin' if you don't want to get locked out, 
    // but if you want a TOTAL wipe, use await prisma.user.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: { not: 'admin' } // Keeps the master admin account
      }
    });
    console.log('✓ Cleared all users except master admin');

    // 5. Clear Settings
    await prisma.settings.deleteMany();
    console.log('✓ Cleared settings');

    // 6. Clear Roles (Must happen after users are cleared)
    await prisma.role.deleteMany();
    console.log('✓ Cleared roles');

    // --- REINITIALIZATION ---

    // Recreate default roles
    const ALL_PERMISSIONS = [
      'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete',
      'pos.access', 'pos.cancel_bill', 'reports.view', 'reports.export',
      'users.view', 'users.manage', 'users.reactivate', 'roles.manage', 'settings.manage',
      'bills.reinstate', 'settings.expiry_alerts', 'dashboard.view',
      'dashboard.customize', 'inventory.delete_batch'
    ];

    const roles = [
      { name: 'Admin', permissions: JSON.stringify(ALL_PERMISSIONS) },
      { name: 'Manager', permissions: JSON.stringify(ALL_PERMISSIONS.filter(p => p !== 'roles.manage')) },
      { name: 'Cashier', permissions: JSON.stringify(['inventory.view', 'pos.access']) }
    ];

    for (const roleData of roles) {
      await prisma.role.create({ data: roleData });
      console.log(`✓ Created role: ${roleData.name}`);
    }

    // Recreate default settings
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

    console.log('\n✓ Database reset complete!');

  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();