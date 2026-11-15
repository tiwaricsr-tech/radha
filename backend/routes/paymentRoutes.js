const express = require('express');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPublicConfig,
  configureCredentials
} = require('../services/razorpayCheckout');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json(getPublicConfig());
});

router.put('/config', requireAdmin, (req, res) => {
  try {
    const config = configureCredentials({
      keyId: req.body?.keyId,
      keySecret: req.body?.keySecret
    });
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const order = await createRazorpayOrder(req.body);
    res.json(order);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const result = await verifyRazorpayPayment({
      orderId: req.body.razorpay_order_id,
      paymentId: req.body.razorpay_payment_id,
      signature: req.body.razorpay_signature
    });
    res.json({ verified: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
