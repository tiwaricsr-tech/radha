const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { computeRoadDistanceKm } = require('../routes/deliveryRoutes');
const { normalizeIndianPhone } = require('./whatsappNotifications');

const checkoutSessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000;
const ENV_PATH = path.join(__dirname, '..', '.env');

function getCredentials() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return keyId && keySecret ? { keyId, keySecret } : null;
}

function getPublicConfig() {
  const credentials = getCredentials();
  return {
    provider: 'Razorpay',
    configured: Boolean(credentials),
    keyId: credentials?.keyId || '',
    testMode: credentials?.keyId.startsWith('rzp_test_') || false
  };
}

function updateEnvValue(content, key, value) {
  const expression = new RegExp(`^(\\s*(?:export\\s+)?${key}\\s*=).*$`, 'gm');
  const replacement = (_match, prefix) => `${prefix}${JSON.stringify(value)}`;
  if (expression.test(content)) {
    expression.lastIndex = 0;
    return content.replace(expression, replacement);
  }
  const separator = content && !content.endsWith('\n') ? '\n' : '';
  return `${content}${separator}${key}=${JSON.stringify(value)}\n`;
}

function configureCredentials({ keyId, keySecret }) {
  const nextKeyId = typeof keyId === 'string' ? keyId.trim() : '';
  const nextKeySecret = typeof keySecret === 'string' ? keySecret.trim() : '';
  const current = getCredentials();

  if (!/^rzp_(live|test)_[A-Za-z0-9]+$/.test(nextKeyId)) {
    throw new Error('Enter a valid Razorpay Key ID starting with rzp_live_ or rzp_test_.');
  }
  if (/[\r\n]/.test(nextKeySecret) || nextKeySecret.length > 200) {
    throw new Error('Enter a valid Razorpay Key Secret.');
  }
  if (!nextKeySecret && (!current || current.keyId !== nextKeyId)) {
    throw new Error('Enter the Key Secret for this Razorpay Key ID.');
  }

  const secretToSave = nextKeySecret || current.keySecret;
  const existingContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const updatedContent = updateEnvValue(
    updateEnvValue(existingContent, 'RAZORPAY_KEY_ID', nextKeyId),
    'RAZORPAY_KEY_SECRET',
    secretToSave
  );
  const temporaryPath = `${ENV_PATH}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, updatedContent, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, ENV_PATH);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw new Error(`Could not save Razorpay settings: ${error.message}`);
  }

  process.env.RAZORPAY_KEY_ID = nextKeyId;
  process.env.RAZORPAY_KEY_SECRET = secretToSave;
  return getPublicConfig();
}

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [orderId, session] of checkoutSessions) {
    if (session.createdAt < cutoff) checkoutSessions.delete(orderId);
  }
}

function verifySignature(orderId, paymentId, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function normalizePaymentMethod(method) {
  switch (method) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'netbanking':
      return 'Netbanking';
    default:
      return 'Razorpay';
  }
}

async function razorpayRequest(path, credentials, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Razorpay request failed.');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function prepareOrder(checkout) {
  const { items, user, couponCode, deliveryAddress } = checkout || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Your cart is empty.');
  }
  if (!deliveryAddress?.street || !deliveryAddress?.city || !deliveryAddress?.pincode) {
    throw new Error('Please select a complete delivery address.');
  }

  const deliveryConfig = await store.getDeliveryConfig();
  if (!deliveryConfig.isStoreOpen) {
    throw new Error('The shop is temporarily paused for new online orders.');
  }

  const allowedVariants = new Set(['piece', 'full', 'half', '250g', '500g', '1kg']);
  const normalizedItems = await Promise.all(items.map(async (item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !allowedVariants.has(item.variant)) {
      throw new Error('One or more cart items are invalid.');
    }
    const product = await store.getProductById(String(item.productId));
    const unitPrice = Number(product?.prices?.[item.variant]);
    if (!product || !product.inStock || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error('A product in your cart is unavailable. Please refresh your cart.');
    }
    return {
      productId: String(product._id),
      name: product.name,
      image: product.image || '',
      variant: item.variant,
      variantLabel: product.portionNotes?.[item.variant] || item.variant,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity
    };
  }));

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  let discountAmount = 0;
  let appliedCoupon = '';
  if (couponCode) {
    const coupon = await store.findCouponByCode(couponCode);
    if (!coupon || !coupon.isActive || new Date(coupon.validUntil) < new Date()) {
      throw new Error('The applied coupon is no longer valid.');
    }
    if (subtotal < Number(coupon.minOrderAmount || 0)) {
      throw new Error(`Minimum order of ₹${coupon.minOrderAmount} required for ${coupon.code}.`);
    }
    appliedCoupon = coupon.code;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * Number(coupon.discountValue)) / 100);
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), subtotal);
    }
  }

  const latitude = Number(deliveryAddress.lat);
  const longitude = Number(deliveryAddress.lng);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
  const distanceKm = hasCoordinates
    ? computeRoadDistanceKm(
        Number(deliveryConfig.shopLat || 24.5362),
        Number(deliveryConfig.shopLng || 81.3037),
        latitude,
        longitude
      )
    : Number(checkout.distanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('Please select a valid delivery location.');
  }
  if (distanceKm > Number(deliveryConfig.maxDeliveryDistanceKm || 25)) {
    throw new Error(`This address is outside our ${deliveryConfig.maxDeliveryDistanceKm} km delivery zone.`);
  }

  const qualifiedFree =
    deliveryConfig.freeDeliveryEnabled && subtotal >= Number(deliveryConfig.freeDeliveryMinOrder || 999);
  const deliveryCharge = qualifiedFree
    ? 0
    : Math.round(
        Number(deliveryConfig.baseFee || 25) +
          Math.max(0, distanceKm - Number(deliveryConfig.baseDistanceKm || 2)) *
            Number(deliveryConfig.perKmFee || 8)
      );
  const packagingCharge = Number(deliveryConfig.packagingCharge || 0);
  const totalPaise = Math.round((subtotal - discountAmount + deliveryCharge + packagingCharge) * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) {
    throw new Error('The order total must be at least ₹1.');
  }

  const customer = user || {};
  const whatsappOptIn = Boolean(checkout.whatsappOptIn);
  const whatsappNumber = whatsappOptIn ? normalizeIndianPhone(customer.phone) : null;
  if (whatsappOptIn && !whatsappNumber) {
    throw new Error('Enter a valid Indian mobile number to receive WhatsApp order updates.');
  }

  return {
    order: {
      user: {
        id: String(customer.id || 'guest'),
        name: String(customer.name || 'Guest Customer'),
        email: String(customer.email || 'guest@customer.in').toLowerCase(),
        avatar: String(customer.avatar || ''),
        phone: whatsappNumber ? `+91${whatsappNumber}` : String(customer.phone || '')
      },
      items: normalizedItems,
      subtotal,
      couponCode: appliedCoupon,
      discountAmount,
      distanceKm,
      deliveryCharge,
      packagingCharge,
      totalAmount: totalPaise / 100,
      cookingInstructions: String(checkout.cookingInstructions || ''),
      noContactDelivery: Boolean(checkout.noContactDelivery),
      whatsappOptIn,
      whatsappNotificationStatus: whatsappOptIn ? 'waiting_for_agent' : 'not_requested',
      deliveryAddress: {
        label: String(deliveryAddress.label || 'Home'),
        street: String(deliveryAddress.street),
        landmark: String(deliveryAddress.landmark || ''),
        city: String(deliveryAddress.city),
        pincode: String(deliveryAddress.pincode),
        lat: hasCoordinates ? latitude : 24.5485,
        lng: hasCoordinates ? longitude : 81.3182
      },
      estimatedMinutes: Math.round(16 + distanceKm * 2.4)
    },
    totalPaise
  };
}

async function createRazorpayOrder(checkout) {
  const credentials = getCredentials();
  if (!credentials) {
    const error = new Error('Online payments are not configured. Add Razorpay API keys to backend/.env.');
    error.status = 503;
    throw error;
  }

  const { order, totalPaise } = await prepareOrder(checkout);
  const receipt = `rcpt_${crypto.randomBytes(10).toString('hex')}`;
  const razorpayOrder = await razorpayRequest('/orders', credentials, {
    amount: totalPaise,
    currency: 'INR',
    receipt
  });
  if (Number(razorpayOrder.amount) !== totalPaise || razorpayOrder.currency !== 'INR') {
    throw new Error('Razorpay returned an order with an unexpected amount or currency.');
  }

  pruneSessions();
  checkoutSessions.set(razorpayOrder.id, {
    status: 'created',
    createdAt: Date.now(),
    amountPaise: totalPaise,
    order,
    paymentId: '',
    paymentMethod: '',
    createdOrder: null
  });

  return {
    gatewayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: credentials.keyId
  };
}

async function verifyRazorpayPayment({ orderId, paymentId, signature }) {
  pruneSessions();
  const credentials = getCredentials();
  const session = checkoutSessions.get(orderId);
  if (!credentials || !session) {
    throw new Error('Payment session not found or expired. Please start checkout again.');
  }
  if (session.status === 'consumed' && session.paymentId === paymentId) {
    return { paymentId, gatewayOrderId: orderId, method: session.paymentMethod };
  }
  if (!verifySignature(orderId, paymentId, signature, credentials.keySecret)) {
    throw new Error('Payment signature verification failed.');
  }

  let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, credentials);
  if (payment.status === 'authorized' && payment.order_id === orderId) {
    payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, credentials, {
      amount: session.amountPaise,
      currency: 'INR'
    });
  }
  if (
    payment.order_id !== orderId ||
    Number(payment.amount) !== session.amountPaise ||
    payment.currency !== 'INR' ||
    payment.status !== 'captured'
  ) {
    throw new Error('Razorpay has not confirmed a captured payment for this order.');
  }

  session.status = 'verified';
  session.paymentId = paymentId;
  session.paymentMethod = normalizePaymentMethod(payment.method);
  return { paymentId, gatewayOrderId: orderId, method: session.paymentMethod };
}

function claimVerifiedCheckout(orderId, paymentId) {
  const session = checkoutSessions.get(orderId);
  if (!session || session.paymentId !== paymentId) return null;
  if (session.status === 'consumed') return { createdOrder: session.createdOrder };
  if (session.status !== 'verified') return null;
  session.status = 'processing';
  return {
    order: session.order,
    method: session.paymentMethod,
    paymentId: session.paymentId
  };
}

function releaseCheckoutClaim(orderId) {
  const session = checkoutSessions.get(orderId);
  if (session?.status === 'processing') session.status = 'verified';
}

function markCheckoutConsumed(orderId, createdOrder) {
  const session = checkoutSessions.get(orderId);
  if (!session || session.status !== 'processing') return;
  session.status = 'consumed';
  session.createdOrder = createdOrder;
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  claimVerifiedCheckout,
  releaseCheckoutClaim,
  markCheckoutConsumed,
  getCredentials,
  getPublicConfig,
  configureCredentials
};
