const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth.cjs');

module.exports = function userRoutes(prisma) {
  const router = express.Router();

  // GET all users (Hides 'admin' from the list)
  router.get('/', authenticate, async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          NOT: {
            username: 'admin' // This ensures System Admin never shows in the table
          }
        },
        orderBy: { createdAt: 'desc' },
        include: { roleRelation: true } // Including role data for the UI
      });

      const safeUsers = users.map(({ passwordHash, ...u }) => ({ 
        ...u, 
        isActive: u.isActive ?? true 
      }));
      res.json(safeUsers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single user
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { roleRelation: true }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const { passwordHash, ...safeUser } = user;
      res.json({ ...safeUser, isActive: safeUser.isActive ?? true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create user
  router.post('/', authenticate, authorize('users.manage'), async (req, res) => {
    try {
      const { username, password, fullName, roleId, role } = req.body;
      const finalRoleId = roleId || role;

      if (!username || !password || !finalRoleId) {
        return res.status(400).json({ error: "Missing required fields: Username, Password, and Role are required." });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          fullName,
          isActive: true,
          roleRelation: {
            connect: { id: finalRoleId }
          }
        },
        include: {
          roleRelation: true 
        }
      });

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // PUT update user
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { fullName, roleId, role, isActive } = req.body;
      const finalRoleId = roleId || role;

      const user = await prisma.user.update({
        where: { id },
        data: { 
          fullName, 
          isActive: isActive !== undefined ? isActive : true,
          ...(finalRoleId && {
            roleRelation: {
              connect: { id: finalRoleId }
            }
          })
        },
        include: { roleRelation: true }
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

      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id },
        data: { passwordHash }
      });

      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE user (soft delete)
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