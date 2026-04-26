import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

export default function authRoutes(prisma) {
  const router = Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const bcrypt = await import('bcryptjs');

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.default.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const jwt = await import('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
      const token = jwt.default.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        token,
        user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isActive: user.isActive }
      });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // GET current user info
  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
