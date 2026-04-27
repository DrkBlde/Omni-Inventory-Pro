const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');

module.exports = function billRoutes(prisma) {
  const router = express.Router();

  // POST: Create a bill
  router.post('/', authenticate, authorize('pos.access'), async (req, res) => {
    try {
      const { 
        items, payments, customerId, customerName, 
        gstPercentage, gstNumber, storeName, storeAddress, 
        storePhone, billType 
      } = req.body;
      
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

          if (remainingToDeduct > 0) throw new Error(`Insufficient stock for ${product.name}`);

          billItemsData.push({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            batchNo: item.batchNo
          });
        }

        // --- UPDATED CALCULATION LOGIC START ---
        const isNormal = billType === 'Normal';
        
        // Force GST rate to 0 if it's a Normal bill, otherwise use the provided percentage
        const effectiveGstRate = isNormal ? 0 : (gstPercentage || 0);

        // Calculate taxable amount (Subtotal / 1.GST)
        const taxableAmount = effectiveGstRate > 0 
          ? Number((subtotal / (1 + (effectiveGstRate / 100))).toFixed(2)) 
          : subtotal;

        // Calculate total GST amount (forced to 0 for Normal bills)
        const totalGst = isNormal ? 0 : Number((subtotal - taxableAmount).toFixed(2));
        // --- UPDATED CALCULATION LOGIC END ---

        const lastBill = await tx.bill.findFirst({ orderBy: { billNumber: 'desc' } });
        const nextBillNumber = lastBill ? lastBill.billNumber + 1 : 1001;

        const bill = await tx.bill.create({
          data: {
            billNumber: nextBillNumber,
            total: subtotal,
            taxableAmount,
            totalGst,
            gstPercentage: effectiveGstRate,
            gstNumber: isNormal ? "" : (gstNumber || ""),
            storeName,
            storeAddress,
            storePhone,
            customerName: customerName || "Walk-in",
            creator: { connect: { id: user.id } },
            billType,
            payments: JSON.stringify(payments || []),
            items: { create: billItemsData },
            ...(customerId ? { customer: { connect: { id: customerId } } } : {})
          },
          include: { items: true, customer: true }
        });

        return { ...bill, payments: JSON.parse(bill.payments) };
      });

      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET: Fetch all bills
  router.get('/', authenticate, async (req, res) => {
  try {
    // DEBUG: See if ANY bills exist at all
    const count = await prisma.bill.count();
    console.log("Total bills in DB count:", count);

    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        customer: true,
        creator: { select: { id: true, fullName: true, username: true } }
      }
    });

    console.log("Bills found with relations:", bills.length);

      const safeBills = bills.map(bill => {
        let parsedPayments = [];
        try {
          parsedPayments = bill.payments ? JSON.parse(bill.payments) : [];
        } catch (e) {
          parsedPayments = [];
        }

        return {
          ...bill,
          payments: parsedPayments,
          createdByName: bill.creator?.fullName || bill.creator?.username || 'Unknown'
        };
      });

      res.json(safeBills || []);
    } catch (err) {
      console.error("Bills Route Error:", err);
      res.json([]);
    }
  });

  // POST: Cancel bill
  router.post('/:id/cancel', authenticate, authorize('pos.cancel_bill'), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      await prisma.$transaction(async (tx) => {
        const bill = await tx.bill.findUnique({ where: { id }, include: { items: true } });
        if (!bill || bill.isCancelled) throw new Error('Invalid bill state');

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
          data: { isCancelled: true, cancelledBy: user.id, cancelledAt: new Date() }
        });
      });

      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};