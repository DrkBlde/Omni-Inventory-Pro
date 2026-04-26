const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth.cjs');

module.exports = function userRoutes(prisma) {
  const router = express.Router();

  // GET all users
  router.get('/', authenticate, async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const safeUsers = users.map(({ passwordHash, ...u }) => ({ ...u, isActive: u.isActive ?? true }));
      res.json(safeUsers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single user
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { passwordHash, ...safeUser } = user;
      res.json({ ...safeUser, isActive: safeUser.isActive ?? true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create user
  router.post('/', authenticate, async (req, res) => {
    try {
      const { username, password, fullName, role } = req.body;

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) return res.status(400).json({ error: 'Username already exists' });

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: { username, passwordHash, fullName, role }
      });

      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT update user
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { fullName, role, isActive } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: { fullName, role, isActive }
      });

      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT reset password
  router.put('/:id/reset-password', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id },
        data: { passwordHash }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE user (soft delete - deactivate)
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
