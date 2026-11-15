const express = require('express');
const store = require('../services/store');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reviews = await store.getReviews(req.query.productId || null);
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { productId, productName, orderNumber, userName, userEmail, rating, comment } = req.body;
    if (!productId || !comment || !rating) {
      return res.status(400).json({ error: 'Product, star rating, and review comment are required.' });
    }

    const review = await store.createReview({
      productId,
      productName: productName || 'Radha Swami Special',
      orderNumber: orderNumber || '',
      userName: userName || req.user?.name || 'Verified Customer',
      userEmail: userEmail || req.user?.email || 'customer@shreemithai.in',
      userAvatar: req.user?.avatar || '',
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment
    });

    const [reviews, products] = await Promise.all([store.getReviews(), store.getProducts()]);
    const broadcast = req.app.get('broadcast');
    broadcast('reviews:updated', { review, reviews });
    broadcast('products:updated', { action: 'rating_updated', products });
    broadcast('analytics:updated', { reason: 'new_review' });

    res.status(201).json({ review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/reply', requireAdmin, async (req, res) => {
  try {
    const updated = await store.replyToReview(req.params.id, req.body.adminReply || '');
    if (!updated) return res.status(404).json({ error: 'Review not found.' });

    const reviews = await store.getReviews();
    req.app.get('broadcast')('reviews:updated', { review: updated, reviews });
    res.json({ review: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
