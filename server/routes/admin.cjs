const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');

module.exports = function adminRoutes(prisma) {
  const router = express.Router();

  // 1. GET Settings (Address, Phone, GSTIN, etc.)
  // URL: /api/admin/
  router.get('/', authenticate, async (req, res) => {
    try {
      const settings = await prisma.settings.findMany();
      const settingsObj = {};
      settings.forEach(s => {
        try {
          settingsObj[s.key] = JSON.parse(s.value);
        } catch {
          settingsObj[s.key] = s.value;
        }
      });
      res.json(settingsObj);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. PUT Update Settings
  // URL: /api/admin/
  router.put('/', authenticate, async (req, res) => {
    console.log("Saving settings to database:", req.body);
    try {
      const settings = req.body;
      for (const [key, value] of Object.entries(settings)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        await prisma.settings.upsert({
          where: { key: key },
          create: { key: key, value: valueStr },
          update: { value: valueStr }
        });
      }
      res.json({ message: "Settings saved successfully" });
    } catch (err) {
      console.error("Save Error:", err);
      res.status(400).json({ error: "Failed to save: " + err.message });
    }
  });

  // 3. Reset Database (what the frontend calls)
  // URL: /api/admin/reset-db
  router.post('/reset-db', authenticate, async (req, res) => {
    try {
      if (req.user.username.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      // Delete all data in the correct order (respecting foreign keys)
      await prisma.billItem.deleteMany();
      await prisma.bill.deleteMany();
      await prisma.batch.deleteMany();
      await prisma.product.deleteMany();
      await prisma.customer.deleteMany();
      await prisma.clockEntry.deleteMany();
      await prisma.attendance.deleteMany();
      await prisma.settings.deleteMany();
      await prisma.user.deleteMany({ where: { username: { not: 'admin' } } });
      await prisma.role.deleteMany({ where: { name: { not: 'Admin' } } });

      res.json({ message: "Database reset successfully. Admin user preserved." });
    } catch (err) {
      console.error("Reset DB Error:", err);
      res.status(500).json({ error: "Reset failed: " + err.message });
    }
  });

  // 4. Restart Database
  // URL: /api/admin/restart-db
  router.post('/restart-db', authenticate, async (req, res) => {
    try {
      if (req.user.username.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      await prisma.$disconnect();
      await prisma.$connect();
      res.json({ message: "Database connection restarted successfully" });
    } catch (err) {
      res.status(500).json({ error: "Restart failed: " + err.message });
    }
  });

  // 4. Factory Reset
  // URL: /api/admin/factory-reset
  router.post('/factory-reset', authenticate, async (req, res) => {
    try {
      if (req.user.username.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      await prisma.$transaction([
        prisma.saleItem.deleteMany(),
        prisma.sale.deleteMany(),
        prisma.inventoryLog.deleteMany(),
        prisma.product.deleteMany(),
        prisma.category.deleteMany(),
        prisma.attendance.deleteMany(),
        prisma.user.deleteMany({ where: { NOT: { username: 'admin' } } }),
        prisma.role.deleteMany({ where: { NOT: { name: 'admin' } } }),
      ]);
      res.json({ message: "System factory reset successful" });
    } catch (err) {
      res.status(500).json({ error: "Factory reset failed: " + err.message });
    }
  });

  return router;
};