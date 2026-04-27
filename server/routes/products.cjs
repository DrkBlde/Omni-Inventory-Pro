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
          name, 
          sku, 
          barcode, 
          category, 
          price: parseFloat(price) || 0, 
          costPrice: parseFloat(costPrice) || 0, 
          unit, 
          lowStockThreshold: parseInt(lowStockThreshold) || 10, 
          veryLowStockThreshold: parseInt(veryLowStockThreshold) || 3,
          batches: {
            create: (batches || []).map(b => ({
              batchNo: b.batchNo,
              mfgDate: b.mfgDate,
              expiryDate: b.expiryDate,
              quantity: parseInt(b.quantity) || 0
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

  // Update product (FIXED LOGIC)
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sku, barcode, category, price, costPrice, unit, lowStockThreshold, veryLowStockThreshold, batches } = req.body;

      // We use a transaction to update product info and sync batches in one go
      const updated = await prisma.product.update({
        where: { id },
        data: { 
          name, 
          sku, 
          barcode, 
          category, 
          price: parseFloat(price) || 0, 
          costPrice: parseFloat(costPrice) || 0, 
          unit, 
          lowStockThreshold: parseInt(lowStockThreshold) || 10, 
          veryLowStockThreshold: parseInt(veryLowStockThreshold) || 3,
          batches: {
            // Step 1: Delete batches that aren't in the incoming request
            // If the frontend sends a batch with a real ID, we keep it. 
            // If it's missing, it gets deleted.
            deleteMany: {
              id: { notIn: (batches || []).filter(b => b.id && b.id.length > 15).map(b => b.id) }
            },
            // Step 2: Upsert (Update existing or Create new)
            upsert: (batches || []).map(b => ({
              where: { id: (b.id && b.id.length > 15) ? b.id : 'new-batch-placeholder' },
              update: {
                batchNo: b.batchNo,
                mfgDate: b.mfgDate,
                expiryDate: b.expiryDate,
                quantity: parseInt(b.quantity) || 0
              },
              create: {
                batchNo: b.batchNo,
                mfgDate: b.mfgDate,
                expiryDate: b.expiryDate,
                quantity: parseInt(b.quantity) || 0
              }
            }))
          }
        },
        include: { batches: true }
      });

      res.json(updated);
    } catch (err) {
      console.error("Update Error:", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // Delete product
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      // Prisma handles cascading deletes if set in schema, otherwise delete batches first
      await prisma.batch.deleteMany({ where: { productId: req.params.id } });
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