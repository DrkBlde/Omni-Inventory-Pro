const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

module.exports = function authRoutes(prisma) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        token,
        user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isActive: user.isActive }
      });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // GET current user info
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No token' });

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
};
