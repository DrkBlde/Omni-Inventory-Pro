const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth.cjs');

const JWT_SECRET = process.env.JWT_SECRET || 'omni-secret-key-12345';

module.exports = function authRoutes(prisma) {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { username: username.trim().toLowerCase() },
        include: { roleRelation: true }
      });

      // Also try exact match if lowercase didn't find it
      const userExact = user || await prisma.user.findUnique({
        where: { username: username.trim() },
        include: { roleRelation: true }
      });

      const foundUser = userExact;

      if (!foundUser) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (!foundUser.isActive) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      const passwordMatch = await bcrypt.compare(password, foundUser.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { id: foundUser.id, username: foundUser.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { passwordHash, roleRelation, ...safeUser } = foundUser;

      res.json({
        token,
        user: {
          ...safeUser,
          role: roleRelation  // frontend expects 'role', Prisma returns 'roleRelation'
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { roleRelation: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { passwordHash, roleRelation, ...safeUser } = user;
      res.json({ ...safeUser, role: roleRelation });
    } catch (err) {
      console.error('Me error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
