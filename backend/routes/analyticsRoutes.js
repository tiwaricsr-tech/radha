const express = require('express');
const store = require('../services/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (_req, res) => {
  try {
    const [orders, products, coupons, reviews, customers] = await Promise.all([
      store.getOrders(null),
      store.getProducts(),
      store.getCoupons(),
      store.getReviews(),
      store.getCustomersWithStats()
    ]);

    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayOrders = validOrders.filter((o) => new Date(o.createdAt).getTime() >= startOfToday);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

    const liveStatuses = ['Pending', 'Accepted', 'Preparing', 'Out for Delivery'];
    const liveOrders = orders.filter((o) => liveStatuses.includes(o.status));
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered');
    const activeCoupons = coupons.filter((c) => c.isActive && new Date(c.validUntil) >= now);

    const avgRating =
      reviews.length > 0
        ? Number((reviews.reduce((s, r) => s + Number(r.rating || 5), 0) / reviews.length).toFixed(1))
        : 5.0;

    // 7-day daily chart
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySeries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;
      const dayOrders = validOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      });
      weeklySeries.push({
        label: dayNames[d.getDay()],
        date: d.toISOString().slice(0, 10),
        revenue: dayOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
        orders: dayOrders.length
      });
    }

    // Status distribution
    const statusBreakdown = {
      Pending: 0,
      Accepted: 0,
      Preparing: 0,
      'Out for Delivery': 0,
      Delivered: 0,
      Cancelled: 0
    };
    for (const o of orders) {
      if (statusBreakdown[o.status] !== undefined) {
        statusBreakdown[o.status] += 1;
      }
    }

    // Category revenue & Top products
    const prodCategoryLookup = {};
    for (const p of products) {
      prodCategoryLookup[String(p._id)] = p.category || 'Sweets';
      prodCategoryLookup[p.name] = p.category || 'Sweets';
    }

    const catMap = {};
    const prodMap = {};
    for (const order of validOrders) {
      for (const item of order.items || []) {
        if (!prodMap[item.name]) {
          prodMap[item.name] = { name: item.name, image: item.image, units: 0, revenue: 0 };
        }
        prodMap[item.name].units += Number(item.quantity || 1);
        prodMap[item.name].revenue += Number(item.lineTotal || 0);

        const cat = prodCategoryLookup[String(item.productId)] || prodCategoryLookup[item.name] || 'Sweets';
        if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, units: 0 };
        catMap[cat].revenue += Number(item.lineTotal || 0);
        catMap[cat].units += Number(item.quantity || 1);
      }
    }

    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

    res.json({
      kpis: {
        todayRevenue,
        todayOrderCount: todayOrders.length,
        totalRevenue,
        totalOrders: validOrders.length,
        avgOrderValue,
        liveOrderCount: liveOrders.length,
        deliveredOrderCount: deliveredOrders.length,
        activeCouponCount: activeCoupons.length,
        avgRating,
        reviewCount: reviews.length,
        productCount: products.length,
        customerCount: customers.length
      },
      weeklySeries,
      topProducts,
      statusBreakdown,
      categoryBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
