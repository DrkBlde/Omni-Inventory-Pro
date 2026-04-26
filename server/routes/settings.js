import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

export default function settingsRoutes(prisma) {
  const router = Router();

  // GET all settings
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

  // PUT update settings
  router.put('/', authenticate, async (req, res) => {
    try {
      const settings = req.body;

      const updates = Object.entries(settings).map(async ([key, value]) => {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        await prisma.settings.upsert({
          where: { key },
          create: { key, value: valueStr },
          update: { value: valueStr }
        });
      });

      await Promise.all(updates);

      const updatedSettings = await prisma.settings.findMany();
      const settingsObj = {};
      updatedSettings.forEach(s => {
        try {
          settingsObj[s.key] = JSON.parse(s.value);
        } catch {
          settingsObj[s.key] = s.value;
        }
      });

      res.json(settingsObj);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
