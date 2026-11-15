const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initDataStore, getStorageMode } = require('./services/store');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const couponRoutes = require('./routes/couponRoutes');
const { router: deliveryRoutes } = require('./routes/deliveryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token', 'X-Admin-Token']
  })
);
app.use(express.json({ limit: '5mb' }));

// Static food photography served to both Customer Website & Admin Dashboard
app.use('/uploads', express.static(path.join(__dirname, 'public')));

// Monotonic sync counter for real-time 2-way storefront <-> admin updates
let syncVersion = 1;
let lastSyncEvent = { event: 'init', timestamp: Date.now() };

function broadcast(event, _payload = {}) {
  syncVersion += 1;
  lastSyncEvent = { event, version: syncVersion, timestamp: Date.now() };
}

app.set('broadcast', broadcast);

app.get('/api/sync', (_req, res) => {
  res.json({ version: syncVersion, lastEvent: lastSyncEvent });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Radha Swami API',
    storageMode: getStorageMode(),
    syncVersion,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
chatRoutes.setBroadcast(broadcast);
app.use('/api/chat', chatRoutes);

// Serve Admin Dashboard build at /admin-app (and /admin convenience redirect)
const adminDistPath = path.join(__dirname, '..', 'admin-dashboard', 'dist');
app.get('/admin', (_req, res) => res.redirect('/admin-app/'));
app.use('/admin-app', express.static(adminDistPath));
app.get('/admin-app/*', (_req, res) => {
  const adminIndex = path.join(adminDistPath, 'index.html');
  if (fs.existsSync(adminIndex)) {
    return res.sendFile(adminIndex);
  }
  res.status(404).send('Admin Dashboard bundle not found.');
});

// Serve Customer Website build at / on port 5000 so port 5000 preview renders the full app
const customerDistPath = path.join(__dirname, '..', 'customer-frontend', 'dist');
app.use(express.static(customerDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  const customerIndex = path.join(customerDistPath, 'index.html');
  if (fs.existsSync(customerIndex)) {
    return res.sendFile(customerIndex);
  }
  res.status(200).send('Radha Swami Server Running');
});

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

initDataStore().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Radha Swami Full-Stack App & API Server running on http://${HOST}:${PORT}`);
  });
});
