import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import billRoutes from './routes/bills.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes(prisma));
app.use('/api/products', productRoutes(prisma));
app.use('/api/bills', billRoutes(prisma));
app.use('/api/users', userRoutes(prisma));
app.use('/api/settings', settingsRoutes(prisma));
app.use('/api/customers', customerRoutes(prisma));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export { prisma };
