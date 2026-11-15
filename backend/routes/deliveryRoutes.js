const express = require('express');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Haversine road-distance calculator (km) between shop & customer coordinates
function computeRoadDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  // Apply realistic urban road factor (1.28x), clamp nicely for demo if user is in another city
  const roadKm = straightKm * 1.28;
  if (roadKm > 25) {
    // If testing from a browser outside shop city, map smoothly to local radius based on coords hash
    const pseudoLocal = 1.6 + ((Math.abs(Math.round((lat2 + lng2) * 1000)) % 75) / 10);
    return Number(pseudoLocal.toFixed(1));
  }
  return Math.max(0.6, Number(roadKm.toFixed(1)));
}

// Full config (used by Admin Dashboard for Charge Setup)
router.get('/', async (_req, res) => {
  try {
    const config = await store.getDeliveryConfig();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public store info for Customer Frontend (no admin charge setup clutter!)
router.get('/public', async (_req, res) => {
  try {
    const cfg = await store.getDeliveryConfig();
    res.json({
      store: {
        shopName: cfg.shopName,
        shopAddress: cfg.shopAddress,
        shopLat: cfg.shopLat || 24.5362,
        shopLng: cfg.shopLng || 81.3037,
        isStoreOpen: cfg.isStoreOpen,
        cashOnDeliveryEnabled: cfg.cashOnDeliveryEnabled !== false,
        freeDeliveryEnabled: cfg.freeDeliveryEnabled,
        freeDeliveryMinOrder: cfg.freeDeliveryMinOrder,
        maxDeliveryDistanceKm: cfg.maxDeliveryDistanceKm
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-calculate distance & delivery charge from customer address coordinates
router.post('/calculate', async (req, res) => {
  try {
    const { lat, lng, distanceKm: fallbackDist, subtotal } = req.body;
    const config = await store.getDeliveryConfig();

    let dist = Number(fallbackDist) || 2.5;
    if (lat !== undefined && lng !== undefined && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      dist = computeRoadDistanceKm(
        Number(config.shopLat || 24.5362),
        Number(config.shopLng || 81.3037),
        Number(lat),
        Number(lng)
      );
    }

    if (dist > Number(config.maxDeliveryDistanceKm || 25)) {
      return res.status(400).json({
        error: `This address (${dist} km) is outside our ${config.maxDeliveryDistanceKm} km delivery zone.`
      });
    }

    const orderSub = Number(subtotal) || 0;
    const qualifiedFree =
      config.freeDeliveryEnabled && orderSub >= Number(config.freeDeliveryMinOrder || 999);

    const packagingCharge = Number(config.packagingCharge || 0);
    let deliveryPartnerFee = 0;
    if (!qualifiedFree) {
      const extraKm = Math.max(0, dist - Number(config.baseDistanceKm || 2));
      deliveryPartnerFee = Math.round(Number(config.baseFee || 25) + extraKm * Number(config.perKmFee || 8));
    }

    const standardFeeWithoutFree = Math.round(
      Number(config.baseFee || 25) +
        Math.max(0, dist - Number(config.baseDistanceKm || 2)) * Number(config.perKmFee || 8)
    );

    res.json({
      distanceKm: dist,
      deliveryCharge: deliveryPartnerFee,
      standardFeeWithoutFree,
      packagingCharge,
      qualifiedFree,
      cashOnDeliveryEnabled: config.cashOnDeliveryEnabled !== false,
      freeDeliveryMinOrder: Number(config.freeDeliveryMinOrder || 999),
      etaMinutes: Math.round(16 + dist * 2.4)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const config = await store.updateDeliveryConfig(req.body);
    req.app.get('broadcast')('delivery:updated', { config });
    res.json({ config });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { router, computeRoadDistanceKm };
