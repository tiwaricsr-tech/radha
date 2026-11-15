const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const Review = require('../models/Review');
const DeliveryConfig = require('../models/DeliveryConfig');
const { normalizeIndianPhone } = require('./whatsappNotifications');
const { createSeedData, makeId } = require('../data/seedData');

const DB_FILE = path.join(__dirname, '..', 'data', 'database.json');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let useMongo = false;
let memoryDb = null;

function phoneLookupPattern(phone) {
  const digitsPattern = phone.split('').join('\\D*');
  return new RegExp(`^(?:\\+?91\\D*)?0?${digitsPattern}\\D*$`);
}

function findMemoryUserByEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  return memoryDb.users.find(
    (user) => String(user.email || '').trim().toLowerCase() === cleanEmail
  ) || null;
}

function findMemoryUserByPhone(phone) {
  if (!phone) return null;
  return memoryDb.users.find(
    (user) => normalizeIndianPhone(user.phone) === phone
  ) || null;
}

function customerIdentityKey(email, phone, fallbackId) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail && !['customer@shreemithai.in', 'guest@customer.in'].includes(cleanEmail)) {
    return `email:${cleanEmail}`;
  }
  const cleanPhone = normalizeIndianPhone(phone);
  if (cleanPhone) return `phone:${cleanPhone}`;
  return `email:${cleanEmail || fallbackId || 'unknown'}`;
}

async function ensureUserEmailIndex() {
  let indexes = [];
  try {
    indexes = await User.collection.indexes();
  } catch (err) {
    if (err.code !== 26 && err.codeName !== 'NamespaceNotFound') throw err;
  }

  const emailIndex = indexes.find((index) => index.key?.email === 1);
  if (emailIndex?.unique && emailIndex.sparse) return;
  if (emailIndex) await User.collection.dropIndex(emailIndex.name);
  await User.collection.createIndex(
    { email: 1 },
    { unique: true, sparse: true, name: 'email_1' }
  );
}

function saveLocalDb() {
  if (!memoryDb) return;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
}

function loadLocalDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Upgrade schema v1 -> v2 (adds per-piece pricing & expanded gourmet catalog)
      if (parsed && parsed.schemaVersion >= 2) {
        memoryDb = parsed;
        return;
      }
    } catch (err) {
      console.warn('Re-initializing database.json...', err.message);
    }
  }
  memoryDb = createSeedData();
  saveLocalDb();
}

async function initDataStore() {
  const uri = process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/shree_mithai_shop');
  if (!uri) {
    throw new Error('MONGO_URI must be configured in production. Refusing to start with temporary local-file storage.');
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    await ensureUserEmailIndex();
    useMongo = true;
    console.log('✅ Connected to MongoDB:', uri);

    const count = await Product.countDocuments();
    if (count === 0) {
      const seed = createSeedData();
      await Product.insertMany(seed.products.map(({ _id, ...rest }) => rest));
      await Coupon.insertMany(seed.coupons.map(({ _id, ...rest }) => rest));
      await DeliveryConfig.create((({ _id, ...rest }) => rest)(seed.deliveryConfig));
      await User.insertMany(seed.users.map(({ _id, ...rest }) => rest));
      await Order.insertMany(seed.orders.map(({ _id, ...rest }) => rest));
      await Review.insertMany(seed.reviews.map(({ _id, ...rest }) => rest));
      console.log('🌱 Seeded MongoDB with initial Radha Swami catalog.');
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`MongoDB connection is required in production: ${err.message}`);
    }
    useMongo = false;
    loadLocalDb();
    console.log(
      '📦 External MongoDB not running at MONGO_URI — using persistent JSON document database (backend/data/database.json). Set MONGO_URI to connect to MongoDB Atlas/local mongod anytime.'
    );
  }
}

function getStorageMode() {
  return useMongo ? 'mongodb' : 'persistent-json-db';
}

function normalizePrices(prices = {}) {
  return {
    piece: prices.piece ? Number(prices.piece) : null,
    full: prices.full ? Number(prices.full) : null,
    half: prices.half ? Number(prices.half) : null,
    '250g': prices['250g'] ? Number(prices['250g']) : null,
    '500g': prices['500g'] ? Number(prices['500g']) : null,
    '1kg': prices['1kg'] ? Number(prices['1kg']) : null
  };
}

// ---------- PRODUCTS ----------
async function getProducts() {
  if (useMongo) {
    return Product.find().sort({ createdAt: -1 }).lean();
  }
  return [...memoryDb.products];
}

async function getProductById(id) {
  if (useMongo) return Product.findById(id).lean();
  return memoryDb.products.find((p) => String(p._id) === String(id)) || null;
}

async function createProduct(data) {
  if (useMongo) {
    const doc = await Product.create(data);
    return doc.toObject();
  }
  const now = new Date().toISOString();
  const product = {
    _id: makeId(),
    name: data.name,
    category: data.category || 'Sweets',
    description: data.description || '',
    image: data.image || '/uploads/images/kaju-katli.jpg',
    badge: data.badge || '',
    inStock: data.inStock !== undefined ? Boolean(data.inStock) : true,
    isVeg: true,
    prepTimeMins: Number(data.prepTimeMins) || 15,
    prices: normalizePrices(data.prices),
    portionNotes: {
      piece: data.portionNotes?.piece || '1 Piece (Single Pc)',
      full: data.portionNotes?.full || 'Full Plate',
      half: data.portionNotes?.half || 'Half Plate'
    },
    rating: 5.0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now
  };
  memoryDb.products.unshift(product);
  saveLocalDb();
  return product;
}

async function updateProduct(id, updates) {
  if (useMongo) {
    return Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
  }
  const idx = memoryDb.products.findIndex((p) => String(p._id) === String(id));
  if (idx === -1) return null;
  const existing = memoryDb.products[idx];
  const updated = {
    ...existing,
    ...updates,
    prices: updates.prices ? normalizePrices(updates.prices) : existing.prices,
    portionNotes: updates.portionNotes
      ? { ...existing.portionNotes, ...updates.portionNotes }
      : existing.portionNotes,
    updatedAt: new Date().toISOString()
  };
  memoryDb.products[idx] = updated;
  saveLocalDb();
  return updated;
}

async function deleteProduct(id) {
  if (useMongo) {
    const res = await Product.findByIdAndDelete(id).lean();
    return Boolean(res);
  }
  const before = memoryDb.products.length;
  memoryDb.products = memoryDb.products.filter((p) => String(p._id) !== String(id));
  if (memoryDb.products.length !== before) {
    saveLocalDb();
    return true;
  }
  return false;
}

// ---------- COUPONS ----------
async function getCoupons() {
  if (useMongo) return Coupon.find().sort({ createdAt: -1 }).lean();
  return [...memoryDb.coupons];
}

async function findCouponByCode(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  if (useMongo) return Coupon.findOne({ code: clean }).lean();
  return memoryDb.coupons.find((c) => c.code.toUpperCase() === clean) || null;
}

async function createCoupon(data) {
  const cleanCode = String(data.code).trim().toUpperCase();
  if (useMongo) {
    const doc = await Coupon.create({ ...data, code: cleanCode });
    return doc.toObject();
  }
  if (memoryDb.coupons.some((c) => c.code === cleanCode)) {
    throw new Error(`Coupon code ${cleanCode} already exists`);
  }
  const now = new Date().toISOString();
  const coupon = {
    _id: makeId(),
    code: cleanCode,
    discountType: data.discountType === 'flat' ? 'flat' : 'percentage',
    discountValue: Number(data.discountValue),
    minOrderAmount: Number(data.minOrderAmount) || 0,
    maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
    description: data.description || '',
    validUntil: data.validUntil || new Date(Date.now() + 30 * 86400000).toISOString(),
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    usageCount: 0,
    createdAt: now,
    updatedAt: now
  };
  memoryDb.coupons.unshift(coupon);
  saveLocalDb();
  return coupon;
}

async function updateCoupon(id, updates) {
  if (useMongo) {
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase();
    return Coupon.findByIdAndUpdate(id, updates, { new: true }).lean();
  }
  const idx = memoryDb.coupons.findIndex((c) => String(c._id) === String(id));
  if (idx === -1) return null;
  const updated = {
    ...memoryDb.coupons[idx],
    ...updates,
    code: updates.code ? String(updates.code).trim().toUpperCase() : memoryDb.coupons[idx].code,
    updatedAt: new Date().toISOString()
  };
  memoryDb.coupons[idx] = updated;
  saveLocalDb();
  return updated;
}

async function deleteCoupon(id) {
  if (useMongo) {
    const res = await Coupon.findByIdAndDelete(id).lean();
    return Boolean(res);
  }
  const before = memoryDb.coupons.length;
  memoryDb.coupons = memoryDb.coupons.filter((c) => String(c._id) !== String(id));
  if (memoryDb.coupons.length !== before) {
    saveLocalDb();
    return true;
  }
  return false;
}

async function incrementCouponUsage(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  if (useMongo) {
    await Coupon.updateOne({ code: clean }, { $inc: { usageCount: 1 } });
    return;
  }
  const c = memoryDb.coupons.find((item) => item.code === clean);
  if (c) {
    c.usageCount = (c.usageCount || 0) + 1;
    saveLocalDb();
  }
}

// ---------- DELIVERY CONFIG ----------
async function getDeliveryConfig() {
  if (useMongo) {
    let cfg = await DeliveryConfig.findOne().lean();
    if (!cfg) {
      const created = await DeliveryConfig.create({});
      cfg = created.toObject();
    }
    return cfg;
  }
  return { ...memoryDb.deliveryConfig };
}

async function updateDeliveryConfig(updates) {
  if (useMongo) {
    let cfg = await DeliveryConfig.findOne();
    if (!cfg) {
      cfg = await DeliveryConfig.create(updates);
      return cfg.toObject();
    }
    Object.assign(cfg, updates);
    await cfg.save();
    return cfg.toObject();
  }
  memoryDb.deliveryConfig = {
    ...memoryDb.deliveryConfig,
    ...updates,
    baseDistanceKm:
      updates.baseDistanceKm !== undefined ? Number(updates.baseDistanceKm) : memoryDb.deliveryConfig.baseDistanceKm,
    baseFee: updates.baseFee !== undefined ? Number(updates.baseFee) : memoryDb.deliveryConfig.baseFee,
    perKmFee: updates.perKmFee !== undefined ? Number(updates.perKmFee) : memoryDb.deliveryConfig.perKmFee,
    freeDeliveryMinOrder:
      updates.freeDeliveryMinOrder !== undefined
        ? Number(updates.freeDeliveryMinOrder)
        : memoryDb.deliveryConfig.freeDeliveryMinOrder,
    maxDeliveryDistanceKm:
      updates.maxDeliveryDistanceKm !== undefined
        ? Number(updates.maxDeliveryDistanceKm)
        : memoryDb.deliveryConfig.maxDeliveryDistanceKm,
    cashOnDeliveryEnabled:
      updates.cashOnDeliveryEnabled !== undefined
        ? Boolean(updates.cashOnDeliveryEnabled)
        : memoryDb.deliveryConfig.cashOnDeliveryEnabled !== false,
    packagingCharge:
      updates.packagingCharge !== undefined ? Number(updates.packagingCharge) : memoryDb.deliveryConfig.packagingCharge,
    updatedAt: new Date().toISOString()
  };
  saveLocalDb();
  return { ...memoryDb.deliveryConfig };
}

function calculateDeliveryFee(distanceKm, subtotal, cfg) {
  const dist = Math.max(0, Number(distanceKm) || 0);
  if (cfg.freeDeliveryEnabled && subtotal >= Number(cfg.freeDeliveryMinOrder || 999)) {
    return Number(cfg.packagingCharge || 0);
  }
  const baseDist = Number(cfg.baseDistanceKm || 2);
  const baseFee = Number(cfg.baseFee || 25);
  const perKm = Number(cfg.perKmFee || 8);
  const extraKm = Math.max(0, dist - baseDist);
  const fee = Math.round(baseFee + extraKm * perKm + Number(cfg.packagingCharge || 0));
  return fee;
}

// ---------- ORDERS ----------
async function getOrders(filterEmail = null, filterPhone = null) {
  const cleanEmail = String(filterEmail || '').trim().toLowerCase();
  const cleanPhone = normalizeIndianPhone(filterPhone);
  const hasFilter = Boolean(String(filterEmail || '').trim() || String(filterPhone || '').trim());
  if (hasFilter && !cleanEmail && !cleanPhone) return [];
  if (useMongo) {
    const filters = [];
    if (cleanEmail) filters.push({ 'user.email': cleanEmail });
    if (cleanPhone) {
      filters.push({ 'user.phone': { $regex: phoneLookupPattern(cleanPhone) } });
    }
    const query = filters.length > 1 ? { $or: filters } : filters[0] || {};
    return Order.find(query).sort({ createdAt: -1 }).lean();
  }
  let list = [...memoryDb.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (cleanEmail || cleanPhone) {
    list = list.filter((order) => {
      const emailMatch =
        cleanEmail && String(order.user?.email || '').trim().toLowerCase() === cleanEmail;
      const phoneMatch =
        cleanPhone && normalizeIndianPhone(order.user?.phone) === cleanPhone;
      return emailMatch || phoneMatch;
    });
  }
  return list;
}

async function getOrderByIdOrNumber(identifier) {
  if (useMongo) {
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      const byId = await Order.findById(identifier).lean();
      if (byId) return byId;
    }
    return Order.findOne({ orderNumber: String(identifier).toUpperCase() }).lean();
  }
  return (
    memoryDb.orders.find(
      (o) => String(o._id) === String(identifier) || o.orderNumber.toUpperCase() === String(identifier).toUpperCase()
    ) || null
  );
}

async function createOrder(orderPayload) {
  let nextNum;
  if (useMongo) {
    const count = await Order.countDocuments();
    nextNum = `ORD-${10025 + count + 1}`;
    const doc = await Order.create({ ...orderPayload, orderNumber: nextNum });
    return doc.toObject();
  }
  memoryDb.lastOrderSeq = (memoryDb.lastOrderSeq || 10029) + 1;
  nextNum = `ORD-${memoryDb.lastOrderSeq}`;
  const now = new Date().toISOString();
  const order = {
    _id: makeId(),
    orderNumber: nextNum,
    ...orderPayload,
    createdAt: now,
    updatedAt: now
  };
  memoryDb.orders.unshift(order);
  saveLocalDb();
  return order;
}

async function updateOrderStatus(id, status, note = '') {
  const entry = { status, timestamp: new Date().toISOString(), note: note || `Order marked as ${status}` };
  if (useMongo) {
    const doc = await Order.findById(id);
    if (!doc) return null;
    doc.status = status;
    if (status === 'Delivered') {
      doc.paymentStatus = 'Paid';
      doc.estimatedMinutes = 0;
    }
    doc.statusHistory.push(entry);
    await doc.save();
    return doc.toObject();
  }
  const idx = memoryDb.orders.findIndex((o) => String(o._id) === String(id) || o.orderNumber === id);
  if (idx === -1) return null;
  const order = memoryDb.orders[idx];
  order.status = status;
  if (status === 'Delivered') {
    order.paymentStatus = 'Paid';
    order.estimatedMinutes = 0;
  }
  order.statusHistory = [...(order.statusHistory || []), entry];
  order.updatedAt = new Date().toISOString();
  saveLocalDb();
  return { ...order };
}

async function updateOrderDeliveryAgent(id, phone) {
  if (useMongo) {
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { orderNumber: String(id).toUpperCase() };
    const current = await Order.findOne(query).lean();
    if (!current) return null;
    const updates = { deliveryAgentPhone: phone };
    if (
      current.whatsappNotificationStatus === 'sending' &&
      current.deliveryAgentPhone !== phone
    ) {
      updates.whatsappNotificationStatus = 'waiting_for_agent';
    }
    return Order.findOneAndUpdate(query, { $set: updates }, { new: true }).lean();
  }
  const order = memoryDb.orders.find(
    (entry) => String(entry._id) === String(id) || entry.orderNumber === String(id).toUpperCase()
  );
  if (!order) return null;
  order.deliveryAgentPhone = phone;
  if (order.whatsappNotificationStatus === 'sending') {
    order.whatsappNotificationStatus = 'waiting_for_agent';
  }
  order.updatedAt = new Date().toISOString();
  saveLocalDb();
  return { ...order };
}

async function claimOrderWhatsAppNotification(id, agentPhone) {
  if (useMongo) {
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { orderNumber: String(id).toUpperCase() };
    return Order.findOneAndUpdate(
      {
        ...query,
        deliveryAgentPhone: agentPhone,
        whatsappOptIn: true,
        whatsappNotificationStatus: { $ne: 'sending' },
        $or: [
          { whatsappNotificationSentFor: { $ne: agentPhone } },
          { whatsappNotificationStatus: 'failed' }
        ]
      },
      { $set: { whatsappNotificationStatus: 'sending' } },
      { new: true }
    ).lean();
  }
  const order = memoryDb.orders.find(
    (entry) => String(entry._id) === String(id) || entry.orderNumber === String(id).toUpperCase()
  );
  if (
    !order ||
    order.deliveryAgentPhone !== agentPhone ||
    !order.whatsappOptIn ||
    order.whatsappNotificationStatus === 'sending' ||
    (order.whatsappNotificationSentFor === agentPhone && order.whatsappNotificationStatus !== 'failed')
  ) {
    return null;
  }
  order.whatsappNotificationStatus = 'sending';
  order.updatedAt = new Date().toISOString();
  saveLocalDb();
  return { ...order };
}

async function updateOrderWhatsAppNotification(id, status, agentPhone) {
  const values = {
    whatsappNotificationStatus: status,
    ...(status === 'sent' ? { whatsappNotificationSentFor: agentPhone } : {})
  };
  if (useMongo) {
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { orderNumber: String(id).toUpperCase() };
    return Order.findOneAndUpdate(
      {
        ...query,
        whatsappNotificationStatus: 'sending',
        deliveryAgentPhone: agentPhone
      },
      { $set: values },
      { new: true }
    ).lean();
  }
  const order = memoryDb.orders.find(
    (entry) => String(entry._id) === String(id) || entry.orderNumber === String(id).toUpperCase()
  );
  if (
    !order ||
    order.deliveryAgentPhone !== agentPhone ||
    order.whatsappNotificationStatus !== 'sending'
  ) {
    return null;
  }
  Object.assign(order, values, { updatedAt: new Date().toISOString() });
  saveLocalDb();
  return { ...order };
}

// ---------- REVIEWS ----------
async function getReviews(productId = null) {
  if (useMongo) {
    const q = productId ? { productId } : {};
    return Review.find(q).sort({ createdAt: -1 }).lean();
  }
  let list = [...memoryDb.reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (productId) {
    list = list.filter((r) => String(r.productId) === String(productId));
  }
  return list;
}

async function createReview(data) {
  let created;
  if (useMongo) {
    const doc = await Review.create(data);
    created = doc.toObject();
    const allForProd = await Review.find({ productId: data.productId }).lean();
    if (allForProd.length > 0 && mongoose.Types.ObjectId.isValid(data.productId)) {
      const avg = Number((allForProd.reduce((s, r) => s + r.rating, 0) / allForProd.length).toFixed(1));
      await Product.findByIdAndUpdate(data.productId, { rating: avg, reviewCount: allForProd.length });
    }
    return created;
  }

  const now = new Date().toISOString();
  created = {
    _id: makeId(),
    productId: data.productId,
    productName: data.productName,
    orderNumber: data.orderNumber || '',
    userName: data.userName,
    userEmail: data.userEmail,
    userAvatar: data.userAvatar || '',
    rating: Number(data.rating),
    comment: data.comment,
    adminReply: '',
    createdAt: now,
    updatedAt: now
  };
  memoryDb.reviews.unshift(created);

  const prod = memoryDb.products.find((p) => String(p._id) === String(data.productId));
  if (prod) {
    const baseWeight = Math.max(prod.reviewCount || 10, 1);
    const newCount = baseWeight + 1;
    prod.rating = Number((((prod.rating || 4.8) * baseWeight + Number(data.rating)) / newCount).toFixed(1));
    prod.reviewCount = newCount;
  }
  saveLocalDb();
  return created;
}

async function replyToReview(reviewId, adminReply) {
  if (useMongo) {
    return Review.findByIdAndUpdate(reviewId, { adminReply }, { new: true }).lean();
  }
  const idx = memoryDb.reviews.findIndex((r) => String(r._id) === String(reviewId));
  if (idx === -1) return null;
  memoryDb.reviews[idx].adminReply = adminReply;
  memoryDb.reviews[idx].updatedAt = new Date().toISOString();
  saveLocalDb();
  return { ...memoryDb.reviews[idx] };
}

// ---------- USERS & PASSWORD AUTH ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { passwordHash: hash, passwordSalt: salt };
}

function verifyPassword(password, passwordHash, passwordSalt) {
  if (!passwordHash || !passwordSalt) return false;
  const derived = crypto.scryptSync(String(password), passwordSalt, 64);
  const stored = Buffer.from(passwordHash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, __v, ...safe } = user;
  return safe;
}

function isConfiguredAdminEmail(cleanEmail) {
  const defaultAdmins = ['admin@shreemithai.com', 'tiwaricsr@gmail.com'];
  const rawAdminEnv = (process.env.ADMIN_EMAILS || '').trim();
  const envAdmins = rawAdminEnv
    ? rawAdminEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];
  return defaultAdmins.includes(cleanEmail) || envAdmins.includes(cleanEmail);
}

function resolveRequestedRole(cleanEmail) {
  return isConfiguredAdminEmail(cleanEmail) ? 'admin' : 'customer';
}

async function registerEmailUser({ name, email, phone, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const rawPhone = String(phone || '').trim();
  const cleanPhone = normalizeIndianPhone(rawPhone);
  if (!cleanName || (!cleanEmail && !rawPhone) || !password) {
    throw new Error('Full name, email or mobile number, and password are required.');
  }
  if (cleanEmail && !EMAIL_PATTERN.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }
  if (rawPhone && !cleanPhone) {
    throw new Error('Enter a valid Indian mobile number.');
  }
  if (String(password).length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const role = resolveRequestedRole(cleanEmail);

  if (useMongo) {
    const existing = cleanEmail ? await User.findOne({ email: cleanEmail }) : null;
    const existingByPhone = cleanPhone
      ? await User.findOne({ phone: { $regex: phoneLookupPattern(cleanPhone) } })
      : null;
    if (
      existingByPhone &&
      (!existing || String(existingByPhone._id) !== String(existing._id))
    ) {
      throw new Error('An account with this mobile number already exists. Please Sign In instead.');
    }
    if (existing && existing.passwordHash) {
      throw new Error('An account with this email already exists. Please Sign In instead.');
    }
    const { passwordHash, passwordSalt } = hashPassword(password);
    if (existing) {
      existing.name = cleanName;
      existing.phone = cleanPhone || existing.phone || '';
      existing.passwordHash = passwordHash;
      existing.passwordSalt = passwordSalt;
      if (role === 'admin' || existing.role === 'admin') existing.role = 'admin';
      await existing.save();
      return sanitizeUser(existing.toObject());
    }
    const created = await User.create({
      name: cleanName,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      phone: cleanPhone || '',
      passwordHash,
      passwordSalt,
      role
    });
    return sanitizeUser(created.toObject());
  }

  let user = findMemoryUserByEmail(cleanEmail);
  const existingByPhone = findMemoryUserByPhone(cleanPhone);
  if (existingByPhone && existingByPhone !== user) {
    throw new Error('An account with this mobile number already exists. Please Sign In instead.');
  }
  if (user && user.passwordHash) {
    throw new Error('An account with this email already exists. Please Sign In instead.');
  }
  const { passwordHash, passwordSalt } = hashPassword(password);
  const now = new Date().toISOString();
  if (user) {
    user.name = cleanName;
    user.phone = cleanPhone || user.phone || '';
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
    if (role === 'admin' || user.role === 'admin') user.role = 'admin';
    user.updatedAt = now;
  } else {
    user = {
      _id: makeId(),
      name: cleanName,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      passwordHash,
      passwordSalt,
      avatar: '',
      googleId: '',
      role,
      phone: cleanPhone || '',
      savedAddress: { street: '', landmark: '', city: 'Rewa', pincode: '486001', distanceKm: 3.5 },
      createdAt: now,
      updatedAt: now
    };
    memoryDb.users.push(user);
  }
  saveLocalDb();
  return sanitizeUser(user);
}

async function loginEmailUser({ identifier, email, phone, password }) {
  const loginIdentifier = String(identifier || email || phone || '').trim();
  const cleanEmail = loginIdentifier.includes('@') ? loginIdentifier.toLowerCase() : '';
  const cleanPhone = cleanEmail ? null : normalizeIndianPhone(loginIdentifier);
  if (!loginIdentifier || !password) {
    throw new Error('Email or mobile number and password are required.');
  }
  if (
    (cleanEmail && !EMAIL_PATTERN.test(cleanEmail)) ||
    (!cleanEmail && !cleanPhone)
  ) {
    throw new Error('Enter a valid email address or Indian mobile number.');
  }

  if (useMongo) {
    const user = cleanEmail
      ? await User.findOne({ email: cleanEmail })
      : await User.findOne({ phone: { $regex: phoneLookupPattern(cleanPhone) } });
    if (!user || !user.passwordHash) {
      throw new Error('No password account found. Please Create an Account first.');
    }
    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      throw new Error('Incorrect password. Please try again.');
    }
    if (isConfiguredAdminEmail(String(user.email || '').toLowerCase()) && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    return sanitizeUser(user.toObject());
  }

  const user = cleanEmail
    ? findMemoryUserByEmail(cleanEmail)
    : findMemoryUserByPhone(cleanPhone);
  if (!user || !user.passwordHash) {
    throw new Error('No account found. Please Create an Account first.');
  }
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new Error('Incorrect password. Please try again.');
  }
  if (isConfiguredAdminEmail(String(user.email || '').toLowerCase()) && user.role !== 'admin') {
    user.role = 'admin';
    user.updatedAt = new Date().toISOString();
    saveLocalDb();
  }
  return sanitizeUser(user);
}

async function findOrCreateGoogleUser({ name, email, avatar, googleId }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const role = resolveRequestedRole(cleanEmail);

  if (useMongo) {
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({ name, email: cleanEmail, avatar: avatar || '', googleId: googleId || '', role });
    } else {
      user.name = name || user.name;
      if (avatar) user.avatar = avatar;
      if (role === 'admin') user.role = 'admin';
      await user.save();
    }
    return sanitizeUser(user.toObject());
  }

  let user = findMemoryUserByEmail(cleanEmail);
  if (!user) {
    const now = new Date().toISOString();
    user = {
      _id: makeId(),
      name,
      email: cleanEmail,
      passwordHash: '',
      passwordSalt: '',
      avatar: avatar || '',
      googleId: googleId || `google-${makeId()}`,
      role,
      phone: '',
      savedAddress: { street: '', landmark: '', city: 'Rewa', pincode: '486001', distanceKm: 3.5 },
      createdAt: now,
      updatedAt: now
    };
    memoryDb.users.push(user);
  } else {
    user.name = name || user.name;
    if (avatar) user.avatar = avatar;
    if (role === 'admin') user.role = 'admin';
    user.updatedAt = new Date().toISOString();
  }
  saveLocalDb();
  return sanitizeUser(user);
}

async function getCustomersWithStats() {
  const [users, orders] = await Promise.all([
    useMongo ? User.find().sort({ createdAt: -1 }).lean() : Promise.resolve([...memoryDb.users]),
    getOrders(null)
  ]);

  const map = new Map();
  for (const u of users) {
    const key = customerIdentityKey(u.email, u.phone, u._id);
    map.set(key, {
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
      createdAt: u.createdAt
    });
  }

  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const key = customerIdentityKey(o.user?.email, o.user?.phone, o.user?.id);
    if (!map.has(key)) {
      map.set(key, {
        _id: o.user?.id || key,
        name: o.user?.name || 'Customer',
        email: ['customer@shreemithai.in', 'guest@customer.in'].includes(
          String(o.user?.email || '').trim().toLowerCase()
        ) ? '' : o.user?.email || '',
        phone: o.user?.phone || '',
        role: 'customer',
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: o.createdAt,
        createdAt: o.createdAt
      });
    }
    const entry = map.get(key);
    entry.totalOrders += 1;
    entry.totalSpent += Number(o.totalAmount || 0);
    if (!entry.phone && o.user?.phone) entry.phone = o.user.phone;
    if (!entry.lastOrderAt || new Date(o.createdAt) > new Date(entry.lastOrderAt)) {
      entry.lastOrderAt = o.createdAt;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

module.exports = {
  initDataStore,
  getStorageMode,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCoupons,
  findCouponByCode,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  incrementCouponUsage,
  getDeliveryConfig,
  updateDeliveryConfig,
  calculateDeliveryFee,
  getOrders,
  getOrderByIdOrNumber,
  createOrder,
  updateOrderStatus,
  updateOrderDeliveryAgent,
  claimOrderWhatsAppNotification,
  updateOrderWhatsAppNotification,
  getReviews,
  createReview,
  replyToReview,
  registerEmailUser,
  loginEmailUser,
  findOrCreateGoogleUser,
  getCustomersWithStats
};
