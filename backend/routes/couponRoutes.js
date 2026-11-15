const express = require('express');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const coupons = await store.getCoupons();
    const activeOnly = req.query.active === 'true';
    const now = new Date();
    const filtered = activeOnly
      ? coupons.filter((c) => c.isActive && new Date(c.validUntil) >= now)
      : coupons;
    res.json({ coupons: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = await store.findCouponByCode(code);
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code.' });
    }
    if (!coupon.isActive) {
      return res.status(400).json({ error: 'This coupon is currently paused.' });
    }
    if (new Date(coupon.validUntil) < new Date()) {
      return res.status(400).json({ error: 'This coupon has expired.' });
    }
    const orderSubtotal = Number(subtotal) || 0;
    if (orderSubtotal < Number(coupon.minOrderAmount || 0)) {
      return res.status(400).json({
        error: `Minimum order of ₹${coupon.minOrderAmount} required for ${coupon.code}.`
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((orderSubtotal * Number(coupon.discountValue)) / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      }
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), orderSubtotal);
    }

    res.json({
      valid: true,
      coupon,
      discountAmount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const created = await store.createCoupon(req.body);
    const coupons = await store.getCoupons();
    req.app.get('broadcast')('coupons:updated', { coupons });
    res.status(201).json({ coupon: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await store.updateCoupon(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Coupon not found' });
    const coupons = await store.getCoupons();
    req.app.get('broadcast')('coupons:updated', { coupons });
    res.json({ coupon: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteCoupon(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Coupon not found' });
    const coupons = await store.getCoupons();
    req.app.get('broadcast')('coupons:updated', { coupons });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
