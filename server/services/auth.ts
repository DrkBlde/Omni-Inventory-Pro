import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const authService = (prisma: PrismaClient) => ({
  async login(username, password) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } };
  },

  async register(userData, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.user.create({
      data: { ...userData, passwordHash }
    });
  }
});
