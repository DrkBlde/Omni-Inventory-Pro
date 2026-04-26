const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');

module.exports = function billRoutes(prisma) {
  const router = express.Router();

  router.post('/', authenticate, async (req, res) => {
    try {
      const { items, payments, customerId, gstPercentage, gstNumber, storeName, storeAddress, storePhone, billType } = req.body;
      const user = req.user;

      const result = await prisma.$transaction(async (tx) => {
        let subtotal = 0;
        const billItemsData = [];

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Product ${item.productId} not found`);

          subtotal += item.price * item.quantity;

          let remainingToDeduct = item.quantity;
          const batches = await tx.batch.findMany({
            where: { productId: item.productId },
            orderBy: { expiryDate: 'asc' }
          });

          for (const batch of batches) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(batch.quantity, remainingToDeduct);
            await tx.batch.update({
              where: { id: batch.id },
              data: { quantity: batch.quantity - deduct }
            });
            remainingToDeduct -= deduct;
          }

          if (remainingToDeduct > 0) {
            throw new Error(`Insufficient stock for product ${product.name}`);
          }

          billItemsData.push({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            batchNo: item.batchNo
          });
        }

        const taxableAmount = gstPercentage > 0 ? Number((subtotal / (1 + (gstPercentage / 100))).toFixed(2)) : subtotal;
        const totalGst = subtotal - taxableAmount;

        const bill = await tx.bill.create({
          data: {
            total: subtotal,
            taxableAmount,
            totalGst,
            gstPercentage,
            gstNumber,
            storeName,
            storeAddress,
            storePhone,
            customerId,
            createdBy: user.id,
            billType,
            payments: JSON.stringify(payments || []),
            items: { create: billItemsData }
          },
          include: { items: true, customer: true }
        });

        return {
          ...bill,
          payments: JSON.parse(bill.payments)
        };
      });

      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/cancel', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      await prisma.$transaction(async (tx) => {
        const bill = await tx.bill.findUnique({
          where: { id },
          include: { items: true }
        });

        if (!bill) throw new Error('Bill not found');
        if (bill.isCancelled) throw new Error('Bill already cancelled');

        for (const item of bill.items) {
          const batch = await tx.batch.findFirst({
            where: { productId: item.productId, batchNo: item.batchNo }
          });

          if (batch) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { quantity: batch.quantity + item.quantity }
            });
          }
        }

        await tx.bill.update({
          where: { id },
          data: {
            isCancelled: true,
            cancelledBy: user.id,
            cancelledAt: new Date()
          }
        });
      });

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/', authenticate, async (req, res) => {
    try {
      const bills = await prisma.bill.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          customer: true,
          creator: { select: { id: true, fullName: true, username: true } }
        }
      });
      // Parse payments JSON for each bill and add createdByName
      const billsWithPayments = bills.map(bill => ({
        ...bill,
        payments: JSON.parse(bill.payments || '[]'),
        createdByName: bill.creator?.fullName || bill.creator?.username || 'Unknown'
      }));
      res.json(billsWithPayments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', authenticate, async (req, res) => {
    try {
      const bill = await prisma.bill.findUnique({
        where: { id: req.params.id },
        include: {
          items: true,
          customer: true,
          creator: { select: { id: true, fullName: true, username: true } }
        }
      });
      if (!bill) return res.status(404).json({ error: 'Bill not found' });
      res.json({
        ...bill,
        payments: JSON.parse(bill.payments || '[]'),
        createdByName: bill.creator?.fullName || bill.creator?.username || 'Unknown'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reinstate', authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.$transaction(async (tx) => {
        const bill = await tx.bill.findUnique({
          where: { id },
          include: { items: true }
        });

        if (!bill) throw new Error('Bill not found');
        if (!bill.isCancelled) throw new Error('Bill is not cancelled');

        for (const item of bill.items) {
          const batch = await tx.batch.findFirst({
            where: { productId: item.productId, batchNo: item.batchNo }
          });

          if (batch) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { quantity: Math.max(0, batch.quantity - item.quantity) }
            });
          }
        }

        await tx.bill.update({
          where: { id },
          data: {
            isCancelled: false,
            cancelledBy: null,
            cancelledAt: null
          }
        });
      });

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
