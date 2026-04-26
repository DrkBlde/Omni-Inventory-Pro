const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const bcrypt = require('bcryptjs');

module.exports = function adminRoutes(prisma) {
  const router = express.Router();

  // POST reset database - Admin only
  router.post('/reset-db', authenticate, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Delete all data in correct order (respecting foreign keys)
      await prisma.billItem.deleteMany();
      await prisma.bill.deleteMany();
      await prisma.batch.deleteMany();
      await prisma.product.deleteMany();
      await prisma.customer.deleteMany();
      await prisma.clockEntry.deleteMany();
      await prisma.settings.deleteMany();

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

      res.json({ success: true, message: 'Database reset complete' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
