const crypto = require('crypto');
const express = require('express');
const store = require('../services/chatStore');
const orders = require('../services/chatOrderAdapter');
const { createChatAgent, CANCELLABLE } = require('../services/chatAgent');
const { optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const agent = createChatAgent({
  orders,
  store,
  notifyAdmin: (event, payload) => {
    const broadcast = router.broadcast;
    if (typeof broadcast === 'function') broadcast(event, payload);
  }
});

// server.js: chatRoutes.setBroadcast(app.get('broadcast'))
router.setBroadcast = (fn) => {
  router.broadcast = fn;
};

// Light per-IP rate limit for the public chat endpoint
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  if (hits.size > 1000) {
    for (const [ip, timestamps] of hits) {
      if (!timestamps.some((timestamp) => now - timestamp < 60000)) hits.delete(ip);
    }
  }
  const recent = (hits.get(key) || []).filter((t) => now - t < 60000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Too many messages, please slow down.' });
  recent.push(now);
  hits.set(key, recent);
  next();
}

// ---- Customer chat ----
// Called when the widget opens: greets and (if logged in) lists recent orders to pick from.
router.post('/start', rateLimit, optionalAuth, async (req, res) => {
  try {
    let { sessionId } = req.body || {};
    if (typeof sessionId !== 'string' || !/^[\w-]{8,64}$/.test(sessionId)) sessionId = crypto.randomUUID();
    const user = req.user ? { email: req.user.email, name: req.user.name } : null;
    const result = await agent.start({ sessionId, user });
    res.json({ sessionId, ...result });
  } catch (err) {
    console.error('chat start error:', err.message);
    res.status(500).json({ error: 'Could not start the help chat.' });
  }
});

router.post('/message', rateLimit, optionalAuth, async (req, res) => {
  try {
    let { sessionId, message } = req.body || {};
    if (typeof sessionId !== 'string' || !/^[\w-]{8,64}$/.test(sessionId)) sessionId = crypto.randomUUID();
    if (typeof message !== 'string' || message.length > 1000) {
      return res.status(400).json({ error: 'Message must be a string of at most 1000 characters.' });
    }
    const user = req.user ? { email: req.user.email, name: req.user.name } : null;
    const result = await agent.handle({ sessionId, message, user });
    res.json({ sessionId, ...result });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ reply: 'Sorry, something went wrong. Please try again.', quickReplies: [] });
  }
});

// ---- Admin ----
router.get('/admin/cancellations', requireAdmin, (req, res) => {
  try {
    res.json(store.listCancellations(req.query.status));
  } catch (err) {
    console.error('chat cancellation list error:', err.message);
    res.status(500).json({ error: 'Could not load cancellation requests.' });
  }
});

router.get('/admin/enquiries', requireAdmin, (req, res) => {
  try {
    res.json(store.listEnquiries(req.query.status));
  } catch (err) {
    console.error('chat enquiry list error:', err.message);
    res.status(500).json({ error: 'Could not load support requests.' });
  }
});

// Full order + person details for the admin
router.get('/admin/order/:number', requireAdmin, async (req, res) => {
  try {
    const order = await orders.findByNumber(req.params.number);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('chat order lookup error:', err.message);
    res.status(500).json({ error: 'Could not load the order.' });
  }
});

router.post('/admin/cancellations/:id/approve', requireAdmin, async (req, res) => {
  try {
    const reqItem = store.getCancellation(req.params.id);
    if (!reqItem) return res.status(404).json({ error: 'Request not found' });
    if (reqItem.status !== 'pending') return res.status(409).json({ error: `Already ${reqItem.status}` });

    const order = await orders.findByNumber(reqItem.orderNumber);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!CANCELLABLE.includes(order.status)) {
      return res.status(409).json({ error: `Order is already ${order.status} and cannot be cancelled by request.` });
    }

    const note = (req.body?.note || '').toString().slice(0, 300);
    const cancelledOrder = await orders.markCancelled(
      order,
      `Cancelled by admin after customer request ${reqItem.id}${note ? `: ${note}` : ''}`
    );
    const updated = store.updateCancellation(reqItem.id, {
      status: 'approved',
      adminNote: note,
      decidedBy: req.user.email || 'admin'
    });
    if (router.broadcast) router.broadcast('order:cancelled', { orderNumber: order.orderNumber });
    res.json({
      request: updated,
      orderStatus: cancelledOrder.status,
      cancellableStatuses: CANCELLABLE
    });
  } catch (err) {
    console.error('chat cancellation approval error:', err.message);
    res.status(500).json({ error: 'Could not approve the cancellation request.' });
  }
});

router.post('/admin/cancellations/:id/reject', requireAdmin, (req, res) => {
  try {
    const reqItem = store.getCancellation(req.params.id);
    if (!reqItem) return res.status(404).json({ error: 'Request not found' });
    if (reqItem.status !== 'pending') return res.status(409).json({ error: `Already ${reqItem.status}` });
    const note = (req.body?.note || '').toString().slice(0, 300);
    res.json(store.updateCancellation(reqItem.id, {
      status: 'rejected',
      adminNote: note,
      decidedBy: req.user.email || 'admin'
    }));
  } catch (err) {
    console.error('chat cancellation rejection error:', err.message);
    res.status(500).json({ error: 'Could not reject the cancellation request.' });
  }
});

router.patch('/admin/enquiries/:id/resolve', requireAdmin, (req, res) => {
  try {
    const item = store.updateEnquiry(req.params.id, { status: 'resolved' });
    if (!item) return res.status(404).json({ error: 'Enquiry not found' });
    res.json(item);
  } catch (err) {
    console.error('chat enquiry resolution error:', err.message);
    res.status(500).json({ error: 'Could not resolve the support request.' });
  }
});

module.exports = router;
