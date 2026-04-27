import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.cjs'; // Updated to .cjs based on your file structure
import productRoutes from './routes/products.cjs';
import customerRoutes from './routes/customers.cjs';
import billRoutes from './routes/bills.cjs';
import userRoutes from './routes/users.cjs';
import settingsRoutes from './routes/settings.cjs';
import attendanceRoutes from './routes/attendance.cjs';
import roleRoutes from './routes/roleRoutes.cjs';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isLocal = origin.startsWith('http://localhost') || 
                    origin.startsWith('http://127.0.0.1') || 
                    origin.startsWith('http://192.168.1.');

    if (isLocal) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes(prisma));
app.use('/api/products', productRoutes(prisma));
app.use('/api/bills', billRoutes(prisma));
app.use('/api/users', userRoutes(prisma));
app.use('/api/settings', settingsRoutes(prisma));
app.use('/api/customers', customerRoutes(prisma));
app.use('/api/attendance', attendanceRoutes(prisma));
app.use('/api/roles', roleRoutes(prisma));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { prisma };