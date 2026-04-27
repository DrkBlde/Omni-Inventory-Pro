const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

module.exports = function attendanceRoutes(prisma) {
  const router = express.Router();

  // 1. GET /api/attendance
  // Now includes server-side duration calculation to prevent "ghost timers"
  router.get('/', async (req, res) => {
    try {
      const allAttendance = await prisma.attendance.findMany({
        orderBy: { checkIn: 'desc' }
      });

      // Calculate the duration for each entry on the backend
      const enrichedAttendance = allAttendance.map(entry => {
        const start = new Date(entry.checkIn).getTime();
        
        // If checkOut exists, use it. Otherwise, use the current server time.
        const end = entry.checkOut 
          ? new Date(entry.checkOut).getTime() 
          : Date.now();

        return {
          ...entry,
          // Total elapsed time in seconds
          durationSeconds: Math.floor((end - start) / 1000)
        };
      });

      res.json(enrichedAttendance);
    } catch (err) {
      console.error("Fetch Error:", err);
      res.status(500).json({ error: "Could not fetch attendance" });
    }
  });

  // 2. POST /api/attendance/checkin
  router.post('/checkin', async (req, res) => {
    try {
      const { userId } = req.body;

      const existingActive = await prisma.attendance.findFirst({
        where: {
          userId: String(userId),
          checkOut: null
        }
      });

      if (existingActive) {
        return res.json(existingActive);
      }
      
      const entry = await prisma.attendance.create({
        data: {
          userId: String(userId),
          checkIn: new Date(),
        }
      });
      
      res.json(entry);
    } catch (err) {
      console.error("Check-in Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. POST /api/attendance/:id/checkout
  router.post('/:id/checkout', async (req, res) => {
    try {
      const { id } = req.params;
      const recordId = isNaN(Number(id)) ? id : Number(id);

      const entry = await prisma.attendance.update({
        where: { id: recordId },
        data: {
          checkOut: new Date(), 
        }
      });

      res.json(entry);
    } catch (err) {
      console.error("Check-out Error:", err);
      res.status(500).json({ error: "Could not record check-out" });
    }
  });

  return router;
};