const express = require('express');
const store = require('../services/store');
const { optionalAuth, requireAdmin } = require('../middleware/auth');
const { computeRoadDistanceKm } = require('./deliveryRoutes');
const {
  claimVerifiedCheckout,
  releaseCheckoutClaim,
  markCheckoutConsumed
} = require('../services/razorpayCheckout');
const {
  normalizeIndianPhone,
  sendOrderConfirmation
} = require('../services/whatsappNotifications');

const router = express.Router();

function getWhatsAppOrderStatus(order) {
  if (!order.whatsappOptIn) return { status: 'not_requested' };
  return { status: 'waiting_for_agent' };
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const emailFilter = isAdmin
      ? req.query.email || null
      : req.user
        ? req.user.email || null
        : req.query.email || null;
    const phoneFilter = isAdmin
      ? req.query.phone || null
      : req.user?.phone || null;
    const allMode = isAdmin && !req.query.email && !req.query.phone;
    const orders = await store.getOrders(
      allMode ? null : emailFilter,
      allMode ? null : phoneFilter
    );
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await store.getOrderByIdOrNumber(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please check your Order ID (e.g. ORD-10029).' });
    }
    const trackableOrder = { ...order };
    delete trackableOrder.deliveryAgentPhone;
    delete trackableOrder.whatsappNotificationSentFor;
    res.json({ order: trackableOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      user,
      items,
      couponCode,
      distanceKm,
      deliveryAddress,
      paymentMethod,
      paymentId,
      gatewayOrderId,
      cookingInstructions,
      noContactDelivery,
      whatsappOptIn
    } = req.body;

    const isCod = paymentMethod === 'Cash on Delivery';
    if (!isCod) {
      if (!gatewayOrderId || !paymentId) {
        return res.status(402).json({ error: 'A verified Razorpay payment is required for online orders.' });
      }

      const checkout = claimVerifiedCheckout(gatewayOrderId, paymentId);
      if (!checkout) {
        return res.status(402).json({ error: 'Payment is not verified. Please complete checkout again.' });
      }
      if (checkout.createdOrder) {
        return res.json({ order: checkout.createdOrder });
      }

      let created;
      try {
        created = await store.createOrder({
          ...checkout.order,
          paymentMethod: checkout.method,
          paymentStatus: 'Paid',
          paymentId: checkout.paymentId,
          gatewayOrderId,
          status: 'Pending',
          statusHistory: [
            {
              status: 'Pending',
              timestamp: new Date().toISOString(),
              note: `Order placed & paid via Razorpay (${checkout.paymentId})`
            }
          ]
        });
        markCheckoutConsumed(gatewayOrderId, created);
      } catch (err) {
        releaseCheckoutClaim(gatewayOrderId);
        throw err;
      }
      if (checkout.order.couponCode) await store.incrementCouponUsage(checkout.order.couponCode);

      const broadcast = req.app.get('broadcast');
      broadcast('orders:created', { order: created });
      broadcast('analytics:updated', { reason: 'order_created' });
      const whatsappNotification = getWhatsAppOrderStatus(created);
      return res.status(201).json({ order: created, whatsappNotification });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.pincode) {
      return res.status(400).json({ error: 'Please select or add a complete delivery address.' });
    }

    const deliveryConfig = await store.getDeliveryConfig();
    if (!deliveryConfig.isStoreOpen) {
      return res.status(400).json({ error: 'Sorry, the shop is temporarily paused for new online orders.' });
    }
    if (isCod && deliveryConfig.cashOnDeliveryEnabled === false) {
      return res.status(403).json({ error: 'Cash on Delivery is currently unavailable. Please pay online.' });
    }

    let dist = Number(distanceKm) || 2.5;
    if (deliveryAddress.lat && deliveryAddress.lng) {
      dist = computeRoadDistanceKm(
        Number(deliveryConfig.shopLat || 24.5362),
        Number(deliveryConfig.shopLng || 81.3037),
        Number(deliveryAddress.lat),
        Number(deliveryAddress.lng)
      );
    }

    const normalizedItems = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unitPrice) || 0;
      return {
        productId: String(item.productId),
        name: item.name,
        image: item.image || '',
        variant: item.variant,
        variantLabel: item.variantLabel || item.variant,
        unitPrice,
        quantity: qty,
        lineTotal: unitPrice * qty
      };
    });

    const subtotal = normalizedItems.reduce((sum, i) => sum + i.lineTotal, 0);

    let discountAmount = 0;
    let appliedCoupon = '';
    if (couponCode) {
      const coupon = await store.findCouponByCode(couponCode);
      if (coupon && coupon.isActive && new Date(coupon.validUntil) >= new Date() && subtotal >= coupon.minOrderAmount) {
        appliedCoupon = coupon.code;
        if (coupon.discountType === 'percentage') {
          discountAmount = Math.round((subtotal * Number(coupon.discountValue)) / 100);
          if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
        } else {
          discountAmount = Math.min(Number(coupon.discountValue), subtotal);
        }
        await store.incrementCouponUsage(coupon.code);
      }
    }

    const qualifiedFree =
      deliveryConfig.freeDeliveryEnabled && subtotal >= Number(deliveryConfig.freeDeliveryMinOrder || 999);
    const packagingCharge = Number(deliveryConfig.packagingCharge || 0);
    const deliveryCharge = qualifiedFree
      ? 0
      : Math.round(
          Number(deliveryConfig.baseFee || 25) +
            Math.max(0, dist - Number(deliveryConfig.baseDistanceKm || 2)) *
              Number(deliveryConfig.perKmFee || 8)
        );

    const totalAmount = Math.max(0, subtotal - discountAmount + deliveryCharge + packagingCharge);
    const optedInForWhatsApp = Boolean(whatsappOptIn);
    const whatsappNumber = optedInForWhatsApp
      ? normalizeIndianPhone(user?.phone || req.user?.phone)
      : null;
    if (optedInForWhatsApp && !whatsappNumber) {
      return res.status(400).json({
        error: 'Enter a valid Indian mobile number to receive WhatsApp order updates.'
      });
    }

    const customerInfo = {
      id: req.user?.id || user?.id || 'guest',
      name: user?.name || req.user?.name || 'Guest Customer',
      email: (user?.email || req.user?.email || 'guest@customer.in').toLowerCase(),
      avatar: user?.avatar || req.user?.avatar || '',
      phone: whatsappNumber ? `+91${whatsappNumber}` : user?.phone || req.user?.phone || ''
    };

    const estimatedMinutes = Math.round(16 + dist * 2.4);

    const created = await store.createOrder({
      user: customerInfo,
      items: normalizedItems,
      subtotal,
      couponCode: appliedCoupon,
      discountAmount,
      distanceKm: dist,
      deliveryCharge,
      packagingCharge,
      totalAmount,
      cookingInstructions: cookingInstructions || '',
      noContactDelivery: Boolean(noContactDelivery),
      whatsappOptIn: optedInForWhatsApp,
      whatsappNotificationStatus: optedInForWhatsApp ? 'waiting_for_agent' : 'not_requested',
      deliveryAddress: {
        label: deliveryAddress.label || 'Home',
        street: deliveryAddress.street,
        landmark: deliveryAddress.landmark || '',
        city: deliveryAddress.city,
        pincode: deliveryAddress.pincode,
        lat: Number(deliveryAddress.lat || 24.5485),
        lng: Number(deliveryAddress.lng || 81.3182)
      },
      paymentMethod: paymentMethod || 'UPI',
      paymentStatus: isCod ? 'COD Pending' : 'Paid',
      paymentId: paymentId || (isCod ? '' : `pay_auto_${Date.now()}`),
      gatewayOrderId: gatewayOrderId || '',
      status: 'Pending',
      statusHistory: [
        {
          status: 'Pending',
          timestamp: new Date().toISOString(),
          note: isCod
            ? 'Order placed (Cash on Delivery)'
            : `Order placed & Paid via ${paymentMethod} (${paymentId || 'Verified'})`
        }
      ],
      estimatedMinutes
    });

    const broadcast = req.app.get('broadcast');
    broadcast('orders:created', { order: created });
    broadcast('analytics:updated', { reason: 'order_created' });

    const whatsappNotification = getWhatsAppOrderStatus(created);
    res.status(201).json({ order: created, whatsappNotification });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ['Pending', 'Accepted', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const updated = await store.updateOrderStatus(req.params.id, status, note);
    if (!updated) return res.status(404).json({ error: 'Order not found.' });

    const broadcast = req.app.get('broadcast');
    broadcast('orders:updated', { order: updated });
    broadcast('analytics:updated', { reason: 'order_status_updated' });

    res.json({ order: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/delivery-agent', requireAdmin, async (req, res) => {
  try {
    const agentDigits = normalizeIndianPhone(req.body.phone);
    if (!agentDigits) {
      return res.status(400).json({ error: 'Enter a valid Indian delivery agent mobile number.' });
    }
    const agentPhone = `+91${agentDigits}`;
    const assigned = await store.updateOrderDeliveryAgent(req.params.id, agentPhone);
    if (!assigned) return res.status(404).json({ error: 'Order not found.' });

    let whatsappNotification = { status: 'not_requested' };
    if (assigned.whatsappOptIn) {
      const claimed = await store.claimOrderWhatsAppNotification(req.params.id, agentPhone);
      if (claimed) {
        try {
          whatsappNotification = await sendOrderConfirmation(claimed);
          await store.updateOrderWhatsAppNotification(
            req.params.id,
            whatsappNotification.status === 'sent' ? 'sent' : 'failed',
            agentPhone
          );
        } catch (err) {
          console.warn(`WhatsApp confirmation for ${assigned.orderNumber} failed: ${err.message}`);
          whatsappNotification = { status: 'failed' };
          await store.updateOrderWhatsAppNotification(req.params.id, 'failed', agentPhone);
        }
      } else {
        whatsappNotification = { status: assigned.whatsappNotificationStatus || 'sending' };
      }
    }

    const updated = await store.getOrderByIdOrNumber(req.params.id);
    req.app.get('broadcast')('orders:updated', { order: updated });
    res.json({ order: updated, whatsappNotification });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
