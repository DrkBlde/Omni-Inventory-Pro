const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const bcrypt = require('bcryptjs');

module.exports = function settingsRoutes(prisma) {
  const router = express.Router();

  // GET SETTINGS
  router.get('/', authenticate, async (req, res) => {
    try {
      const settings = await prisma.settings.findMany();
      const settingsObj = {};
      settings.forEach(s => {
        try { settingsObj[s.key] = JSON.parse(s.value); } 
        catch { settingsObj[s.key] = s.value; }
      });
      res.json(settingsObj);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT SETTINGS (Save)
  router.put('/', authenticate, async (req, res) => {
    try {
      for (const [key, value] of Object.entries(req.body)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await prisma.settings.upsert({
          where: { key },
          create: { key, value: valueStr },
          update: { value: valueStr }
        });
      }
      res.json({ message: "Settings saved" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // THE FIXED RESET ROUTE
  router.post('/reset-db', authenticate, async (req, res) => {
    try {
      if (req.user.username.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // 1. Disable constraints for SQLite/Prisma
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

      await prisma.$transaction(async (tx) => {
        // 2. Delete in order: Children (Items/Logs) -> Parents (Products/Sales/Users)
        const tables = [
          'saleItem', 'inventoryLog', 'attendance', 
          'product', 'sale', 'category', 'customer', 
          'user', 'role'
        ];
        
        for (const name of tables) {
          if (tx[name]) await tx[name].deleteMany();
        }

        // 3. Create the Admin Role with VALID JSON permissions
        // This fixes the '*' JSON parse error in the frontend
        const adminRole = await tx.role.create({
          data: { 
            name: 'admin', 
            permissions: JSON.stringify(["*"]) 
          }
        });

        // 4. Create the Admin User
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await tx.user.create({
          data: {
            username: 'admin',
            passwordHash: hashedPassword,
            fullName: 'System Admin',
            roleId: adminRole.id
          }
        });
      });

      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
      res.json({ message: "Factory reset complete. Please log in again." });
    } catch (err) {
      console.error("Reset Error:", err);
      res.status(500).json({ error: "Reset failed: " + err.message });
    }
  });

  return router;
};