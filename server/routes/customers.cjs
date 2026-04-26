const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');

module.exports = function customerRoutes(prisma) {
  const router = express.Router();

  // GET all customers
  router.get('/', authenticate, async (req, res) => {
    try {
      const customers = await prisma.customer.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(customers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single customer
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id }
      });
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json(customer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create customer
  router.post('/', authenticate, async (req, res) => {
    try {
      const { name, phone } = req.body;
      const customer = await prisma.customer.create({ data: { name, phone } });
      res.status(201).json(customer);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT update customer
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      const customer = await prisma.customer.update({
        where: { id },
        data: { name, phone }
      });
      res.json(customer);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE customer
  router.delete('/:id', authenticate, async (req, res) => {
    try {
      await prisma.customer.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
