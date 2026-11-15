const express = require('express');
const {
  isConfigured,
  normalizeIndianPhone
} = require('../services/whatsappNotifications');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ enabled: isConfigured() });
});

router.get('/validate-phone', (req, res) => {
  res.json({ valid: Boolean(normalizeIndianPhone(req.query.phone)) });
});

module.exports = router;
