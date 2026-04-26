// Database reset script - clears all data and reinitializes
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('Resetting database...');

    // Delete all data in correct order (respecting foreign keys)
    await prisma.billItem.deleteMany();
    console.log('✓ Cleared bill items');

    await prisma.bill.deleteMany();
    console.log('✓ Cleared bills');

    await prisma.batch.deleteMany();
    console.log('✓ Cleared batches');

    await prisma.product.deleteMany();
    console.log('✓ Cleared products');

    await prisma.customer.deleteMany();
    console.log('✓ Cleared customers');

    await prisma.clockEntry.deleteMany();
    console.log('✓ Cleared clock entries');

    await prisma.settings.deleteMany();
    console.log('✓ Cleared settings');

    // Keep roles but reset to defaults
    await prisma.role.deleteMany();
    console.log('✓ Cleared roles');

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
    console.log('The admin user remains unchanged.');

  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
