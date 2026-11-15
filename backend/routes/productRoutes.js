const express = require('express');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const products = await store.getProducts();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, category, description, image, badge, inStock, prepTimeMins, prices, portionNotes } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'Product name and description are required.' });
    }
    const hasAnyPrice = Object.values(prices || {}).some((v) => v !== null && v !== '' && Number(v) > 0);
    if (!hasAnyPrice) {
      return res.status(400).json({
        error: 'Please set at least one price option (1 Piece, Full, Half, 250g, 500g, or 1kg).'
      });
    }

    const created = await store.createProduct({
      name,
      category,
      description,
      image,
      badge,
      inStock,
      prepTimeMins,
      prices,
      portionNotes
    });

    const allProducts = await store.getProducts();
    req.app.get('broadcast')('products:updated', { action: 'created', product: created, products: allProducts });
    res.status(201).json({ product: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await store.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });

    const allProducts = await store.getProducts();
    req.app.get('broadcast')('products:updated', { action: 'updated', product: updated, products: allProducts });
    res.json({ product: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Product not found' });

    const allProducts = await store.getProducts();
    req.app.get('broadcast')('products:updated', { action: 'deleted', productId: req.params.id, products: allProducts });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
