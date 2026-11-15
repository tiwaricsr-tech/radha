const store = require('./store');

function candidates(n) {
  const upper = String(n).toUpperCase();
  const digits = upper.replace(/\D/g, '');
  return [...new Set([upper, `ORD-${digits}`, `#ORD-${digits}`, digits].filter(Boolean))];
}

async function findByNumber(orderNumber) {
  for (const c of candidates(orderNumber)) {
    const order = await store.getOrderByIdOrNumber(c);
    if (order) return order;
  }
  return null;
}

async function listRecentByEmail(email, limit = 3) {
  const recentOrders = await store.getOrders(String(email || '').toLowerCase());
  return recentOrders.slice(0, Math.max(0, Number(limit) || 0));
}

async function markCancelled(order, note) {
  const updated = await store.updateOrderStatus(order._id || order.orderNumber, 'Cancelled', note);
  if (!updated) throw new Error(`Order ${order.orderNumber} could not be updated.`);
  return updated;
}

module.exports = { findByNumber, listRecentByEmail, markCancelled };
