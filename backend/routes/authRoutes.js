const fs = require('fs');
const path = require('path');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const store = require('../services/store');
const { signToken, requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const ENV_PATH = path.join(__dirname, '..', '.env');

router.get('/config', (_req, res) => {
  res.json({
    googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim()
  });
});

router.post('/config', (req, res) => {
  try {
    const clientId = String(req.body?.googleClientId || '').trim();
    if (!clientId || !clientId.includes('.apps.googleusercontent.com')) {
      return res.status(400).json({
        error: 'Please enter a valid Google OAuth Client ID ending in .apps.googleusercontent.com'
      });
    }
    process.env.GOOGLE_CLIENT_ID = clientId;
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    if (/^GOOGLE_CLIENT_ID=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^GOOGLE_CLIENT_ID=.*$/m, `GOOGLE_CLIENT_ID=${clientId}`);
    } else {
      envContent = `${envContent.trim()}\nGOOGLE_CLIENT_ID=${clientId}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    res.json({ success: true, googleClientId: clientId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save Google Client ID: ' + err.message });
  }
});

// Unified Email + Password Sign Up (Customer & Admin auto-detected by role)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const user = await store.registerEmailUser({ name, email, phone, password });
    const token = signToken(user);
    req.app.get('broadcast')?.('analytics:updated', { reason: 'user_signup' });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unified Email or Mobile + Password Sign In
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const user = await store.loginEmailUser({
      identifier: identifier || email || phone,
      password
    });
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Optional Google OAuth 2.0 Sign In
router.post('/google', async (req, res) => {
  try {
    const { accessToken, credential, portal } = req.body;
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'Google OAuth Client ID is not configured.' });
    }

    let profile = null;
    if (accessToken) {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!googleRes.ok) {
        return res.status(401).json({ error: 'Invalid or expired Google OAuth token.' });
      }
      const payload = await googleRes.json();
      profile = {
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        email: payload.email,
        avatar: payload.picture || '',
        googleId: payload.sub,
        requestedRole: portal === 'admin' ? 'admin' : 'customer'
      };
    } else if (credential) {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      const payload = ticket.getPayload();
      profile = {
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        avatar: payload.picture || '',
        googleId: payload.sub,
        requestedRole: portal === 'admin' ? 'admin' : 'customer'
      };
    } else {
      return res.status(400).json({ error: 'Google OAuth token is required.' });
    }

    const user = await store.findOrCreateGoogleUser(profile);
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(401).json({ error: 'Google Sign-In failed: ' + err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Admin Customer Directory with Order Stats
router.get('/customers', requireAdmin, async (_req, res) => {
  try {
    const customers = await store.getCustomersWithStats();
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
