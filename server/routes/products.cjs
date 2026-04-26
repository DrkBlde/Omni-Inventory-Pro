const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');

module.exports = function productRoutes(prisma) {
  const router = express.Router();

  // Get all products with their batches
  router.get('/', authenticate, async (req, res) => {
    try {
      const products = await prisma.product.findMany({
        include: { batches: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single product
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: { batches: true }
      });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add new product
  router.post('/', authenticate, async (req, res) => {
    try {
      const { name, sku, barcode, category, price, costPrice, unit, lowStockThreshold, veryLowStockThreshold, batches } = req.body;

      const product = await prisma.product.create({
        data: {
          name, sku, barcode, category, price, costPrice, unit, lowStockThreshold, veryLowStockThreshold,
          batches: {
            create: batches.map(b => ({
              batchNo: b.batchNo,
              mfgDate: b.mfgDate,
              expiryDate: b.expiryDate,
              quantity: b.quantity
            }))
          }
        },
        include: { batches: true }
      });
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update product
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sku, barcode, category, price, costPrice, unit, lowStockThreshold, veryLowStockThreshold, batches } = req.body;

      await prisma.product.update({
        where: { id },
        data: { name, sku, barcode, category, price, costPrice, unit, lowStockThreshold, veryLowStockThreshold }
      });

      if (batches && Array.isArray(batches)) {
        for (const batch of batches) {
          if (batch.id) {
            await prisma.batch.update({
              where: { id: batch.id },
              data: {
                batchNo: batch.batchNo,
                mfgDate: batch.mfgDate,
                expiryDate: batch.expiryDate,
                quantity: batch.quantity
              }
            });
          } else {
            await prisma.batch.create({
              data: {
                productId: id,
                batchNo: batch.batchNo,
                mfgDate: batch.mfgDate,
                expiryDate: batch.expiryDate,
                quantity: batch.quantity
              }
            });
          }
        }
      }

      const updated = await prisma.product.findUnique({
        where: { id },
        include: { batches: true }
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete product
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      await prisma.product.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete batch
  router.delete('/:productId/batches/:batchId', authenticate, async (req, res) => {
    try {
      await prisma.batch.delete({ where: { id: req.params.batchId } });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
