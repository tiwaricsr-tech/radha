import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Bell,
  Package,
  TicketPercent,
  BarChart3,
  MessageSquare,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Search,
  LogOut,
  Check,
  Truck,
  ChefHat,
  CheckCircle2,
  RefreshCw,
  Star,
  Send,
  Users,
  Receipt,
  XCircle,
  LayoutGrid,
  List,
  Power,
  X,
  Printer,
  TrendingUp,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import {
  apiRequest,
  subscribeRealtime,
  getSavedAdminUser,
  clearAdminSession,
  navigateToStorefront
} from './api';
import AdminLogin from './components/AdminLogin';
import ProductModal from './components/ProductModal';
import RevenueChart from './components/RevenueChart';
import ChatRequests from './components/ChatRequests';

function timeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const diffMins = Math.max(1, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (!Number.isFinite(diffMins) || diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const hrs = Math.round(diffMins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function App() {
  const [user, setUser] = useState(() => getSavedAdminUser());

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('All');
  const [productViewMode, setProductViewMode] = useState('table'); // 'table' | 'grid'

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveryConfig, setDeliveryConfig] = useState({
    shopName: 'Radha Swami',
    shopAddress: 'Station Road, Civil Lines, Main Market',
    isStoreOpen: true,
    cashOnDeliveryEnabled: true,
    baseDistanceKm: 2,
    baseFee: 25,
    perKmFee: 8,
    freeDeliveryEnabled: true,
    freeDeliveryMinOrder: 999,
    maxDeliveryDistanceKm: 20,
    packagingCharge: 0
  });
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentKeyId, setPaymentKeyId] = useState('');
  const [paymentKeySecret, setPaymentKeySecret] = useState('');
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 300,
    maxDiscount: 200,
    description: '',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  });

  const [replyDrafts, setReplyDrafts] = useState({});
  const [deliveryAgentDrafts, setDeliveryAgentDrafts] = useState({});
  const [orderFilter, setOrderFilter] = useState('all');

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleLogout = useCallback(() => {
    clearAdminSession();
    setUser(null);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiRequest('/api/products'),
        apiRequest('/api/orders'),
        apiRequest('/api/coupons'),
        apiRequest('/api/reviews'),
        apiRequest('/api/delivery'),
        apiRequest('/api/analytics'),
        apiRequest('/api/auth/customers')
      ]);

      if (results[0].status === 'fulfilled') setProducts(results[0].value.products || []);
      if (results[1].status === 'fulfilled') setOrders(results[1].value.orders || []);
      if (results[2].status === 'fulfilled') setCoupons(results[2].value.coupons || []);
      if (results[3].status === 'fulfilled') setReviews(results[3].value.reviews || []);
      if (results[4].status === 'fulfilled' && results[4].value.config) {
        setDeliveryConfig(results[4].value.config);
      }
      if (results[5].status === 'fulfilled') {
        setAnalytics(results[5].value || null);
      } else if (
        results[5].reason?.status === 401 ||
        results[5].reason?.status === 403 ||
        String(results[5].reason?.message || '').toLowerCase().includes('sign in')
      ) {
        handleLogout();
      }
      if (results[6].status === 'fulfilled') {
        setCustomers(results[6].value.customers || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast, handleLogout]);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user, loadAllData]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return undefined;
    let active = true;
    apiRequest('/api/payments/config')
      .then((config) => {
        if (!active) return;
        setPaymentConfig(config);
        setPaymentKeyId(config.keyId || '');
      })
      .catch((err) => {
        if (active) showToast(err.message, 'error');
      });
    return () => {
      active = false;
    };
  }, [user, showToast]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeRealtime((event) => {
      if (event === 'orders:created') {
        showToast('🔔 New Live Order Received!', 'live');
      }
      loadAllData();
    });
    return unsubscribe;
  }, [user, loadAllData, showToast]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigateToStorefront(null, false);
    }
  }, [user]);

  if (!user) {
    return <AdminLogin onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  if (user.role !== 'admin') {
    return null;
  }

  const handleQuickStoreToggle = async () => {
    try {
      const nextOpen = !deliveryConfig.isStoreOpen;
      const updated = { ...deliveryConfig, isStoreOpen: nextOpen };
      setDeliveryConfig(updated);
      await apiRequest('/api/delivery', {
        method: 'PUT',
        body: JSON.stringify(updated)
      });
      showToast(
        nextOpen
          ? '🟢 Store is now OPEN & accepting online orders!'
          : '🔴 Store paused — online checkout temporarily closed.'
      );
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveProduct = async (payload) => {
    if (editingProduct) {
      await apiRequest(`/api/products/${editingProduct._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast(`Updated "${payload.name}" — Live on Storefront!`);
    } else {
      await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Added "${payload.name}" — Live on Storefront!`);
    }
    loadAllData();
  };

  const handleDeleteProduct = async (prod) => {
    if (confirmDeleteId !== prod._id) {
      setConfirmDeleteId(prod._id);
      showToast(`Click "Sure?" on "${prod.name}" to confirm deletion.`);
      setTimeout(() => setConfirmDeleteId((id) => (id === prod._id ? null : id)), 4000);
      return;
    }
    try {
      await apiRequest(`/api/products/${prod._id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      showToast(`Deleted "${prod.name}" from live menu.`);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleStock = async (prod) => {
    try {
      await apiRequest(`/api/products/${prod._id}`, {
        method: 'PUT',
        body: JSON.stringify({ inStock: !prod.inStock })
      });
      showToast(`${prod.name} marked ${!prod.inStock ? 'In Stock' : 'Sold Out'}.`);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOrderStatus = async (orderId, status) => {
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      showToast(`Order marked "${status}" — Customer tracker updated live!`);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAssignDeliveryAgent = async (order) => {
    const phone = deliveryAgentDrafts[order._id] ?? order.deliveryAgentPhone ?? '';
    try {
      const result = await apiRequest(`/api/orders/${order._id}/delivery-agent`, {
        method: 'PATCH',
        body: JSON.stringify({ phone })
      });
      setOrders((current) =>
        current.map((entry) => (entry._id === order._id ? result.order : entry))
      );
      setDeliveryAgentDrafts((current) => ({
        ...current,
        [order._id]: result.order.deliveryAgentPhone || ''
      }));
      showToast(
        result.whatsappNotification?.status === 'sent'
          ? 'Agent assigned. Order confirmation and agent contact sent on WhatsApp.'
          : result.whatsappNotification?.status === 'failed' ||
              result.whatsappNotification?.status === 'not_configured'
            ? 'Agent assigned, but WhatsApp could not be sent. Check the WhatsApp setup and retry.'
            : result.order.whatsappOptIn
              ? 'Agent assigned. WhatsApp confirmation is being processed.'
              : 'Delivery agent assigned.',
        result.whatsappNotification?.status === 'failed' ||
          result.whatsappNotification?.status === 'not_configured'
          ? 'error'
          : 'info'
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/coupons', {
        method: 'POST',
        body: JSON.stringify(couponForm)
      });
      setCouponForm({
        code: '',
        discountType: 'percentage',
        discountValue: 15,
        minOrderAmount: 300,
        maxDiscount: 200,
        description: '',
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      });
      showToast('Promo coupon published instantly to storefront!');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleCoupon = async (coupon) => {
    try {
      await apiRequest(`/api/coupons/${coupon._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      showToast(`Coupon ${coupon.code} ${!coupon.isActive ? 'activated' : 'paused'}.`);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    try {
      await apiRequest(`/api/coupons/${coupon._id}`, { method: 'DELETE' });
      showToast(`Coupon ${coupon.code} removed.`);
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReplyReview = async (reviewId) => {
    const text = replyDrafts[reviewId];
    if (!text?.trim()) return;
    try {
      await apiRequest(`/api/reviews/${reviewId}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({ adminReply: text })
      });
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      showToast('Reply published to product reviews!');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveDelivery = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/delivery', {
        method: 'PUT',
        body: JSON.stringify(deliveryConfig)
      });
      showToast('Delivery and payment settings saved & synced live to Customer Checkout!');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSavePaymentConfig = async (e) => {
    e.preventDefault();
    setSavingPaymentConfig(true);
    try {
      const config = await apiRequest('/api/payments/config', {
        method: 'PUT',
        body: JSON.stringify({
          keyId: paymentKeyId,
          keySecret: paymentKeySecret
        })
      });
      setPaymentConfig(config);
      setPaymentKeyId(config.keyId || '');
      setPaymentKeySecret('');
      showToast('Razorpay gateway settings saved.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const liveOrders = orders.filter((o) =>
    ['Pending', 'Accepted', 'Preparing', 'Out for Delivery'].includes(o.status)
  );

  const productCategories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = productCatFilter === 'All' || p.category === productCatFilter;
    return matchesSearch && matchesCat;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderFilter === 'all' || o.status === orderFilter;
    const q = (orderSearch || searchQuery).trim().toLowerCase();
    if (!q) return matchesStatus;
    const matchesText =
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.user?.email || '').toLowerCase().includes(q) ||
      (o.deliveryAddress?.street || '').toLowerCase().includes(q) ||
      (o.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
    return matchesStatus && matchesText;
  });

  const kpis = analytics?.kpis || {
    todayRevenue: 0,
    todayOrderCount: 0,
    totalRevenue: 0,
    totalOrders: orders.length,
    avgOrderValue: 0,
    liveOrderCount: liveOrders.length,
    deliveredOrderCount: 0,
    activeCouponCount: coupons.filter((c) => c.isActive).length,
    avgRating: 5.0,
    reviewCount: reviews.length,
    customerCount: customers.length
  };

  const renderOrderCard = (order) => {
    const badgeClass =
      order.status === 'Pending'
        ? 'status-pill new'
        : order.status === 'Out for Delivery'
        ? 'status-pill out'
        : order.status === 'Delivered'
        ? 'status-pill delivered'
        : order.status === 'Cancelled'
        ? 'status-pill cancelled'
        : 'status-pill preparing';

    const firstImg = order.items?.[0]?.image || '/uploads/images/kaju-katli.jpg';
    const summaryTitle =
      order.items?.length === 1
        ? `${order.items[0].name} (${order.items[0].variantLabel || order.items[0].variant})`
        : `${order.items?.[0]?.name || 'Order'} + ${Math.max(0, (order.items?.length || 1) - 1)} more items`;

    return (
      <div className="live-order-card" key={order._id}>
        <div className="order-card-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="order-id-chip">#{order.orderNumber}</span>
            <em className="time-tag">{timeAgo(order.createdAt)}</em>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="bill-mini-btn"
              onClick={() => setInvoiceOrder(order)}
              title="View / Print Bill"
            >
              <Receipt size={13} /> Bill
            </button>
            <span className={badgeClass}>
              {order.status === 'Pending' ? 'NEW ORDER' : (order.status || '').toUpperCase()}
            </span>
          </div>
        </div>

        <div className="order-card-body">
          <img src={firstImg} alt={summaryTitle} className="order-thumb" />
          <div className="order-info">
            <h4>{summaryTitle}</h4>
            <p className="order-sub">
              <strong>{order.user?.name || 'Customer'}</strong>
              {order.user?.phone ? ` (${order.user.phone})` : ''} •{' '}
              <strong style={{ color: '#FF5200' }}>₹{order.totalAmount}</strong> • {order.paymentMethod} ({order.paymentStatus})
            </p>
            {order.cookingInstructions && (
              <p className="order-note-pill">📝 Note: “{order.cookingInstructions}”</p>
            )}
            <div className="order-items-mini">
              {order.items?.map((it, i) => (
                <span key={i} className="mini-chip">
                  {it.quantity}× {it.name} ({it.variant})
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="order-card-footer">
          <div className="distance-meta">
            <MapPin size={14} color="#FF5200" />
            <span>
              [{order.deliveryAddress?.label || 'Home'}] {order.deliveryAddress?.street}, {order.deliveryAddress?.city} • {order.distanceKm} km (₹{order.deliveryCharge})
            </span>
          </div>

          <div className="delivery-agent-control">
            <label htmlFor={`delivery-agent-${order._id}`}>Delivery agent mobile</label>
            <div className="delivery-agent-input-row">
              <input
                id={`delivery-agent-${order._id}`}
                type="tel"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={deliveryAgentDrafts[order._id] ?? order.deliveryAgentPhone ?? ''}
                onChange={(event) =>
                  setDeliveryAgentDrafts((current) => ({
                    ...current,
                    [order._id]: event.target.value
                  }))
                }
              />
              <button
                type="button"
                className="act-btn accept"
                onClick={() => handleAssignDeliveryAgent(order)}
              >
                {order.whatsappOptIn ? 'Assign & Notify' : 'Save Agent'}
              </button>
            </div>
            {order.whatsappOptIn && (
              <small>
                WhatsApp: {order.whatsappNotificationStatus || 'waiting_for_agent'}
              </small>
            )}
          </div>

          <div className="order-actions">
            {order.status === 'Pending' && (
              <>
                <button className="act-btn accept" onClick={() => handleOrderStatus(order._id, 'Accepted')}>
                  <Check size={14} /> Accept
                </button>
                <button className="act-btn prepare" onClick={() => handleOrderStatus(order._id, 'Preparing')}>
                  <ChefHat size={14} /> Prepare
                </button>
                <button
                  className="act-btn cancel-outline"
                  onClick={() => handleOrderStatus(order._id, 'Cancelled')}
                  title="Cancel Order"
                >
                  <XCircle size={14} />
                </button>
              </>
            )}
            {order.status === 'Accepted' && (
              <button className="act-btn prepare" onClick={() => handleOrderStatus(order._id, 'Preparing')}>
                <ChefHat size={14} /> Start Preparing
              </button>
            )}
            {order.status === 'Preparing' && (
              <button className="act-btn dispatch" onClick={() => handleOrderStatus(order._id, 'Out for Delivery')}>
                <Truck size={14} /> Dispatch Rider
              </button>
            )}
            {order.status === 'Out for Delivery' && (
              <button className="act-btn accept" onClick={() => handleOrderStatus(order._id, 'Delivered')}>
                <CheckCircle2 size={14} /> Mark Delivered
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-shell">
      {toast && <div className={`floating-toast ${toast.type}`}>{toast.msg}</div>}

      {/* CRISP WHITE & ORANGE SIDEBAR */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img className="brand-circle-img" src="/radha-swami-logo.jpg" alt="" />
          <div>
            <h2>Radha Swami</h2>
            <span>PARTNER ADMIN CONSOLE</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Home size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Bell size={18} />
            <span>Live Orders</span>
            <span className="nav-badge">{liveOrders.length}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={18} />
            <span>Products &amp; Menu</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => setActiveTab('coupons')}
          >
            <TicketPercent size={18} />
            <span>Coupons &amp; Offers</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={18} />
            <span>Revenue Analytics</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={18} />
            <span>Customers</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <MessageSquare size={18} />
            <span>Customer Reviews</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            <MessageSquare size={18} />
            <span>Help Requests</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'cancellations' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancellations')}
          >
            <XCircle size={18} />
            <span>Cancellation Requests</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'delivery' ? 'active' : ''}`}
            onClick={() => setActiveTab('delivery')}
          >
            <CreditCard size={18} />
            <span>Delivery &amp; Payments</span>
          </button>
        </nav>

        <div className="admin-profile-box">
          <div className="admin-avatar-circle">
            {(user.name || 'A')[0].toUpperCase()}
          </div>
          <div className="g-meta">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <div className="signed-status">
              <span className="green-dot" /> Active Admin Session
            </div>
          </div>
          <button className="logout-icon-btn" title="Sign Out" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* MAIN ORANGE & WHITE WORKSPACE */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>
              {activeTab === 'overview' && 'Store Command Center'}
              {activeTab === 'orders' && 'Live Order Pipeline & Invoices'}
              {activeTab === 'products' && 'Menu Catalog & Multi-Variant Pricing'}
              {activeTab === 'coupons' && 'Promo Coupons & Discounts'}
              {activeTab === 'analytics' && 'Revenue, Category & Sales Analytics'}
              {activeTab === 'customers' && 'Registered Customers & Top Buyers'}
              {activeTab === 'reviews' && 'Customer Ratings & Public Replies'}
              {activeTab === 'delivery' && 'Delivery & Payment Setup'}
              {activeTab === 'help' && 'Help Chat & Customer Requests'}
              {activeTab === 'cancellations' && 'Customer Cancellation Requests'}
            </h1>
            <p className="subtitle-bar">
              <span className="sync-dot" /> Live 2-Way Sync Active • Signed in as <strong>{user.name}</strong>
            </p>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              onClick={() => navigateToStorefront(null, false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 13px',
                borderRadius: 11,
                border: '1.5px solid #fed7aa',
                background: '#fff7ed',
                color: '#FF5200',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              title="Open Customer Storefront using your active session (no login needed)"
            >
              🛍️ View Storefront
            </button>

            <button
              type="button"
              className={`store-live-toggle ${deliveryConfig.isStoreOpen ? 'open' : 'closed'}`}
              onClick={handleQuickStoreToggle}
              title="Click to toggle online ordering Open / Paused"
            >
              <Power size={14} />
              <span>{deliveryConfig.isStoreOpen ? 'Accepting Orders' : 'Store Paused'}</span>
            </button>

            <div className="search-pill">
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search items, orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button className="icon-circle-btn" onClick={loadAllData} title="Refresh Data">
              <RefreshCw size={16} />
            </button>

            <button
              className="btn-orange-primary"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <section className="kpi-grid">
              <div className="kpi-card highlight-orange">
                <div className="kpi-head">
                  <span className="kpi-icon orange">₹</span>
                  <span>Today&apos;s Revenue</span>
                </div>
                <h2>₹{Number(kpis.todayRevenue || 0).toLocaleString('en-IN')}</h2>
                <p className="kpi-foot">
                  <strong>{kpis.todayOrderCount || 0} orders</strong> placed today <span className="pill-up">LIVE</span>
                </p>
              </div>

              <div className="kpi-card" onClick={() => setActiveTab('analytics')} style={{ cursor: 'pointer' }}>
                <div className="kpi-head">
                  <span className="kpi-icon soft"><TrendingUp size={16} /></span>
                  <span>Total Gross Sales</span>
                </div>
                <h2>₹{Number(kpis.totalRevenue || 0).toLocaleString('en-IN')}</h2>
                <p className="kpi-foot">
                  Avg Order Value: <strong>₹{kpis.avgOrderValue || 0}</strong> ({kpis.totalOrders || 0} total)
                </p>
              </div>

              <div className="kpi-card" onClick={() => setActiveTab('orders')} style={{ cursor: 'pointer' }}>
                <div className="kpi-head">
                  <span className="kpi-icon orange"><Bell size={15} /></span>
                  <span>Active Kitchen Orders</span>
                </div>
                <h2>{liveOrders.length}</h2>
                <p className="kpi-foot">
                  <strong>{kpis.deliveredOrderCount || 0}</strong> delivered • Real-time queue
                </p>
              </div>

              <div className="kpi-card" onClick={() => setActiveTab('customers')} style={{ cursor: 'pointer' }}>
                <div className="kpi-head">
                  <span className="kpi-icon soft"><Users size={16} /></span>
                  <span>Customers &amp; Rating</span>
                </div>
                <h2>{kpis.customerCount || customers.length}</h2>
                <p className="kpi-foot">
                  Store Rating: <strong>★ {kpis.avgRating}</strong> ({kpis.reviewCount} reviews)
                </p>
              </div>
            </section>

            <section className="overview-columns">
              <div className="col-left">
                <div className="panel-card">
                  <div className="panel-head">
                    <div>
                      <h3>Live Kitchen Queue</h3>
                      <span className="realtime-tag">{liveOrders.length} active orders</span>
                    </div>
                    <button className="link-btn" onClick={() => setActiveTab('orders')}>
                      All Orders ({orders.length}) →
                    </button>
                  </div>

                  <div className="orders-stack">
                    {liveOrders.length === 0 ? (
                      <div className="empty-box">
                        No pending kitchen orders right now. New customer orders appear here automatically!
                      </div>
                    ) : (
                      liveOrders.slice(0, 5).map(renderOrderCard)
                    )}
                  </div>
                </div>

                <div className="panel-card">
                  <div className="panel-head">
                    <h3>Active Storefront Coupons</h3>
                    <button className="link-btn" onClick={() => setActiveTab('coupons')}>Manage →</button>
                  </div>
                  <div className="coupon-mini-grid">
                    {coupons.filter((c) => c.isActive).slice(0, 4).map((c) => (
                      <div className="dashed-coupon-card" key={c._id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{c.code}</strong>
                          <span className="discount-tag">
                            {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                          </span>
                        </div>
                        <p>Min order ₹{c.minOrderAmount} • Used {c.usageCount || 0}×</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-right">
                <div className="panel-card">
                  <div className="panel-head">
                    <h3>7-Day Revenue Trend</h3>
                    <span className="subtle-pill">Orange Live Analytics</span>
                  </div>
                  <RevenueChart series={analytics?.weeklySeries || []} />
                </div>

                <div className="panel-card">
                  <div className="panel-head">
                    <h3>Quick Menu &amp; Price Matrix</h3>
                    <button className="link-btn" onClick={() => setActiveTab('products')}>
                      Full Catalog ({products.length}) →
                    </button>
                  </div>

                  <div className="table-scroll">
                    <table className="prod-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>1 Pc</th>
                          <th>Half</th>
                          <th>Full</th>
                          <th>250g</th>
                          <th>500g</th>
                          <th>1kg</th>
                          <th>Status</th>
                          <th>Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.slice(0, 6).map((p) => (
                          <tr key={p._id} className={!p.inStock ? 'row-muted' : ''}>
                            <td>
                              <div className="prod-cell">
                                <img src={p.image} alt={p.name} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <span>{p.category}</span>
                                </div>
                              </div>
                            </td>
                            <td>{p.prices?.piece ? `₹${p.prices.piece}` : '—'}</td>
                            <td>{p.prices?.half ? `₹${p.prices.half}` : '—'}</td>
                            <td>{p.prices?.full ? `₹${p.prices.full}` : '—'}</td>
                            <td>{p.prices?.['250g'] ? `₹${p.prices['250g']}` : '—'}</td>
                            <td>{p.prices?.['500g'] ? `₹${p.prices['500g']}` : '—'}</td>
                            <td>{p.prices?.['1kg'] ? `₹${p.prices['1kg']}` : '—'}</td>
                            <td>
                              <button
                                className={`stock-pill ${p.inStock ? 'in' : 'out'}`}
                                onClick={() => handleToggleStock(p)}
                              >
                                {p.inStock ? 'In Stock' : 'Sold Out'}
                              </button>
                            </td>
                            <td>
                              <button
                                className="icon-btn"
                                title="Edit Product"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setModalOpen(true);
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* LIVE ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="panel-card">
            <div className="orders-toolbar">
              <div className="filter-pills-row" style={{ marginBottom: 0 }}>
                {['all', 'Pending', 'Accepted', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'].map((st) => {
                  const count = st === 'all' ? orders.length : orders.filter((o) => o.status === st).length;
                  return (
                    <button
                      key={st}
                      className={`filter-pill ${orderFilter === st ? 'active' : ''}`}
                      onClick={() => setOrderFilter(st)}
                    >
                      {st === 'all' ? 'All' : st} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="search-pill" style={{ minWidth: 250 }}>
                <Search size={15} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Filter by Order ID, Customer, Item..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="empty-box" style={{ marginTop: 18 }}>
                No orders match this status or search query.
              </div>
            ) : (
              <div className="orders-grid-2" style={{ marginTop: 18 }}>
                {filteredOrders.map(renderOrderCard)}
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS & MENU TAB */}
        {activeTab === 'products' && (
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <h3>Complete Menu Catalog ({filteredProducts.length})</h3>
                <p className="muted-note">
                  Supports 1 Piece, Half Plate, Full Plate, 250g, 500g &amp; 1kg pricing — changes sync live to shoppers.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="view-toggle-group">
                  <button
                    type="button"
                    className={productViewMode === 'table' ? 'active' : ''}
                    onClick={() => setProductViewMode('table')}
                    title="Table View"
                  >
                    <List size={16} />
                  </button>
                  <button
                    type="button"
                    className={productViewMode === 'grid' ? 'active' : ''}
                    onClick={() => setProductViewMode('grid')}
                    title="Card Grid View"
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
                <button
                  className="btn-orange-primary"
                  onClick={() => {
                    setEditingProduct(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus size={16} /> Add New Item
                </button>
              </div>
            </div>

            <div className="filter-pills-row">
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  className={`filter-pill ${productCatFilter === cat ? 'active' : ''}`}
                  onClick={() => setProductCatFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {productViewMode === 'grid' ? (
              <div className="admin-prod-cards-grid">
                {filteredProducts.map((p) => (
                  <div className="admin-prod-card" key={p._id}>
                    <div className="apc-img-wrap">
                      <img src={p.image} alt={p.name} />
                      {p.badge && <span className="apc-badge">{p.badge}</span>}
                    </div>
                    <div className="apc-body">
                      <span className="apc-cat">{p.category}</span>
                      <h4>{p.name}</h4>
                      <div className="apc-prices">
                        {p.prices?.piece && <span>1 Pc: ₹{p.prices.piece}</span>}
                        {p.prices?.half && <span>Half: ₹{p.prices.half}</span>}
                        {p.prices?.full && <span>Full: ₹{p.prices.full}</span>}
                        {p.prices?.['250g'] && <span>250g: ₹{p.prices['250g']}</span>}
                        {p.prices?.['500g'] && <span>500g: ₹{p.prices['500g']}</span>}
                        {p.prices?.['1kg'] && <span>1kg: ₹{p.prices['1kg']}</span>}
                      </div>
                      <div className="apc-foot">
                        <button
                          className={`stock-pill ${p.inStock ? 'in' : 'out'}`}
                          onClick={() => handleToggleStock(p)}
                        >
                          {p.inStock ? 'In Stock' : 'Sold Out'}
                        </button>
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setEditingProduct(p);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className={`icon-btn danger ${confirmDeleteId === p._id ? 'confirming' : ''}`}
                            onClick={() => handleDeleteProduct(p)}
                          >
                            {confirmDeleteId === p._id ? 'Sure?' : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="prod-table full">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>1 Pc</th>
                      <th>Half</th>
                      <th>Full</th>
                      <th>250g</th>
                      <th>500g</th>
                      <th>1kg</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p._id}>
                        <td>
                          <div className="prod-cell">
                            <img src={p.image} alt={p.name} />
                            <div>
                              <strong>{p.name}</strong>
                              <span>{p.badge || 'Fresh'} • {p.prepTimeMins || 12} mins</span>
                            </div>
                          </div>
                        </td>
                        <td>{p.category}</td>
                        <td>
                          <button
                            className={`stock-pill ${p.inStock ? 'in' : 'out'}`}
                            onClick={() => handleToggleStock(p)}
                          >
                            {p.inStock ? 'In Stock' : 'Sold Out'}
                          </button>
                        </td>
                        <td>{p.prices?.piece ? `₹${p.prices.piece}` : '—'}</td>
                        <td>{p.prices?.half ? `₹${p.prices.half}` : '—'}</td>
                        <td>{p.prices?.full ? `₹${p.prices.full}` : '—'}</td>
                        <td>{p.prices?.['250g'] ? `₹${p.prices['250g']}` : '—'}</td>
                        <td>{p.prices?.['500g'] ? `₹${p.prices['500g']}` : '—'}</td>
                        <td>{p.prices?.['1kg'] ? `₹${p.prices['1kg']}` : '—'}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              onClick={() => {
                                setEditingProduct(p);
                                setModalOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className={`icon-btn danger ${confirmDeleteId === p._id ? 'confirming' : ''}`}
                              onClick={() => handleDeleteProduct(p)}
                            >
                              {confirmDeleteId === p._id ? 'Sure?' : <Trash2 size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* COUPONS TAB */}
        {activeTab === 'coupons' && (
          <div className="overview-columns">
            <div className="panel-card">
              <h3>Create New Promo Coupon</h3>
              <form onSubmit={handleCreateCoupon} className="stack-form" style={{ marginTop: 14 }}>
                <div className="form-grid-2">
                  <div className="field">
                    <label>Coupon Code *</label>
                    <input
                      type="text"
                      placeholder="WELCOME50"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Discount Type</label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Rupees (₹)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="field">
                    <label>Discount Value *</label>
                    <input
                      type="number"
                      min="1"
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Min Order (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={couponForm.minOrderAmount}
                      onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Max Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={couponForm.maxDiscount}
                      onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label>Valid Until</label>
                    <input
                      type="date"
                      value={couponForm.validUntil}
                      onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Offer Headline</label>
                    <input
                      type="text"
                      placeholder="Festive sweet box offer"
                      value={couponForm.description}
                      onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <button type="submit" className="btn-orange-primary">Publish Coupon Instantly</button>
              </form>
            </div>

            <div className="panel-card">
              <h3>All Storefront Coupons ({coupons.length})</h3>
              <div className="orders-stack" style={{ marginTop: 14 }}>
                {coupons.map((c) => (
                  <div className="coupon-manage-row" key={c._id}>
                    <div>
                      <div className="coupon-code-line">
                        <strong>{c.code}</strong>
                        <span className="discount-tag">
                          {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                        </span>
                      </div>
                      <p>{c.description || `Min Order ₹${c.minOrderAmount}`}</p>
                      <small>Min spend ₹{c.minOrderAmount} • Redeemed {c.usageCount || 0} times</small>
                    </div>
                    <div className="row-actions">
                      <button
                        className={`stock-pill ${c.isActive ? 'in' : 'out'}`}
                        onClick={() => handleToggleCoupon(c)}
                      >
                        {c.isActive ? 'Active' : 'Paused'}
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDeleteCoupon(c)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="overview-columns">
            <div className="col-left">
              <div className="panel-card">
                <h3>7-Day Revenue Performance</h3>
                <RevenueChart series={analytics?.weeklySeries || []} />

                <div className="daily-breakdown-table" style={{ marginTop: 14 }}>
                  <table className="prod-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Date</th>
                        <th>Orders</th>
                        <th>Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.weeklySeries || []).map((d) => (
                        <tr key={d.date}>
                          <td><strong>{d.label}</strong></td>
                          <td>{d.date}</td>
                          <td>{d.orders} orders</td>
                          <td><strong style={{ color: '#FF5200' }}>₹{Number(d.revenue || 0).toLocaleString('en-IN')}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-right">
              <div className="panel-card">
                <h3>Category Revenue Split</h3>
                {(analytics?.categoryBreakdown || []).length === 0 ? (
                  <div className="empty-box" style={{ marginTop: 12 }}>No completed sales yet.</div>
                ) : (
                  <div className="cat-bars-stack" style={{ marginTop: 14 }}>
                    {(analytics?.categoryBreakdown || []).map((cb) => {
                      const maxCat = Math.max(...analytics.categoryBreakdown.map((x) => x.revenue), 1);
                      const pct = Math.round((cb.revenue / maxCat) * 100);
                      return (
                        <div className="cat-bar-item" key={cb.category}>
                          <div className="cat-bar-label">
                            <strong>{cb.category}</strong>
                            <span>{cb.units} units • ₹{cb.revenue.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="cat-bar-track">
                            <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="panel-card">
                <h3>Top Selling Sweets &amp; Snacks</h3>
                {(analytics?.topProducts || []).length === 0 ? (
                  <div className="empty-box" style={{ marginTop: 12 }}>Place an order to see top items!</div>
                ) : (
                  <div className="orders-stack" style={{ marginTop: 14 }}>
                    {(analytics?.topProducts || []).map((tp, idx) => (
                      <div className="top-prod-row" key={tp.name}>
                        <span className="rank-num">#{idx + 1}</span>
                        <img src={tp.image || '/uploads/images/kaju-katli.jpg'} alt={tp.name} />
                        <div style={{ flex: 1 }}>
                          <strong>{tp.name}</strong>
                          <p>{tp.units} packs/plates sold</p>
                        </div>
                        <strong className="rev-amt">₹{Number(tp.revenue || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMERS DIRECTORY TAB */}
        {activeTab === 'customers' && (
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <h3>Registered Customers &amp; Buyers ({customers.length})</h3>
                <p className="muted-note">Real customer accounts &amp; lifetime order totals.</p>
              </div>
            </div>

            {customers.length === 0 ? (
              <div className="empty-box">No customers registered yet.</div>
            ) : (
              <div className="table-scroll">
                <table className="prod-table full">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Total Orders</th>
                      <th>Lifetime Spend</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <div className="prod-cell">
                            <div className="cust-init-badge">{(c.name || 'C')[0].toUpperCase()}</div>
                            <strong>{c.name}</strong>
                          </div>
                        </td>
                        <td>{c.email}</td>
                        <td>{c.phone || '—'}</td>
                        <td>
                          <span className={`role-tag ${c.role === 'admin' ? 'admin' : 'cust'}`}>
                            {c.role}
                          </span>
                        </td>
                        <td><strong>{c.totalOrders}</strong></td>
                        <td><strong style={{ color: '#FF5200' }}>₹{Number(c.totalSpent || 0).toLocaleString('en-IN')}</strong></td>
                        <td>{timeAgo(c.lastOrderAt || c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="panel-card">
            <h3>Customer Reviews &amp; Store Responses ({reviews.length})</h3>
            {reviews.length === 0 ? (
              <div className="empty-box" style={{ marginTop: 14 }}>
                No customer reviews submitted yet. Verified reviews from customers appear here in real time.
              </div>
            ) : (
              <div className="orders-stack" style={{ marginTop: 14 }}>
                {reviews.map((rev) => (
                  <div className="review-full-card" key={rev._id}>
                    <div className="rev-header">
                      <div className="rev-avatar">{rev.userName?.[0] || 'C'}</div>
                      <div style={{ flex: 1 }}>
                        <strong>{rev.userName}</strong> <span>reviewed <em>{rev.productName}</em></span>
                        <div className="stars-row">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              size={14}
                              fill={idx < rev.rating ? '#FF5200' : 'none'}
                              stroke="#FF5200"
                            />
                          ))}
                          <span>• {timeAgo(rev.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="rev-body-text">“{rev.comment}”</p>

                    {rev.adminReply ? (
                      <div className="admin-reply-box">
                        <strong>Radha Swami Owner Reply:</strong> {rev.adminReply}
                      </div>
                    ) : (
                      <div className="reply-input-row">
                        <input
                          type="text"
                          placeholder="Write a public reply to this customer..."
                          value={replyDrafts[rev._id] || ''}
                          onChange={(e) => setReplyDrafts({ ...replyDrafts, [rev._id]: e.target.value })}
                        />
                        <button className="btn-orange-primary sm" onClick={() => handleReplyReview(rev._id)}>
                          <Send size={14} /> Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DELIVERY AND PAYMENT SETUP */}
        {activeTab === 'delivery' && deliveryConfig && (
          <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
            <div className="panel-card">
              <h3>Delivery &amp; Payment Setup</h3>
              <p className="muted-note">
                Configure your store&apos;s delivery charges below. Customer delivery fees are calculated automatically from their GPS / saved delivery address distance.
              </p>

              <form onSubmit={handleSaveDelivery} className="stack-form" style={{ marginTop: 16 }}>
                <div className="field checkbox-field">
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={deliveryConfig.isStoreOpen}
                      onChange={(e) => setDeliveryConfig({ ...deliveryConfig, isStoreOpen: e.target.checked })}
                    />
                    <strong>Accepting Live Online Orders</strong>
                  </label>
                </div>

                <div className="field checkbox-field">
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={deliveryConfig.cashOnDeliveryEnabled !== false}
                      onChange={(e) =>
                        setDeliveryConfig({ ...deliveryConfig, cashOnDeliveryEnabled: e.target.checked })
                      }
                    />
                    <strong>Accept Cash on Delivery</strong>
                  </label>
                  <span className="muted-note">
                    Turn this off to remove COD from checkout and require online payment for new orders.
                  </span>
                </div>

                <div className="form-grid-3">
                  <div className="field">
                    <label>Base Delivery Charge (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={deliveryConfig.baseFee}
                      onChange={(e) => setDeliveryConfig({ ...deliveryConfig, baseFee: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Base Distance Covered (km)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={deliveryConfig.baseDistanceKm}
                      onChange={(e) => setDeliveryConfig({ ...deliveryConfig, baseDistanceKm: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Extra Charge per Km (₹/km)</label>
                    <input
                      type="number"
                      min="0"
                      value={deliveryConfig.perKmFee}
                      onChange={(e) => setDeliveryConfig({ ...deliveryConfig, perKmFee: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="field">
                    <label>Packaging / Platform Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={deliveryConfig.packagingCharge ?? 0}
                      onChange={(e) =>
                        setDeliveryConfig({ ...deliveryConfig, packagingCharge: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Free Delivery Above (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={deliveryConfig.freeDeliveryMinOrder}
                      onChange={(e) =>
                        setDeliveryConfig({ ...deliveryConfig, freeDeliveryMinOrder: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Max Delivery Zone Radius (km)</label>
                    <input
                      type="number"
                      min="1"
                      value={deliveryConfig.maxDeliveryDistanceKm}
                      onChange={(e) =>
                        setDeliveryConfig({ ...deliveryConfig, maxDeliveryDistanceKm: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="field checkbox-field">
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={deliveryConfig.freeDeliveryEnabled !== false}
                      onChange={(e) =>
                        setDeliveryConfig({ ...deliveryConfig, freeDeliveryEnabled: e.target.checked })
                      }
                    />
                    <span>Enable Free Delivery on orders above ₹{deliveryConfig.freeDeliveryMinOrder}</span>
                  </label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button type="submit" className="btn-orange-primary">Save Delivery Settings</button>
                </div>
              </form>
            </div>

            <div className="panel-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={20} /> Razorpay Payment Gateway
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                <ShieldCheck size={18} color={paymentConfig?.configured ? '#15803d' : '#b45309'} />
                <strong>
                  {paymentConfig?.configured
                    ? `Configured · ${paymentConfig.testMode ? 'Test mode' : 'Live mode'}`
                    : 'Not configured'}
                </strong>
              </div>
              <p className="muted-note">
                Add your Razorpay Key ID and Key Secret to enable online checkout. The secret is saved on the backend and is never shown again.
              </p>
              {paymentConfig?.configured && !paymentConfig.testMode && (
                <p className="muted-note" style={{ color: '#b45309', marginTop: 8 }}>
                  Live mode can charge real money. Use Razorpay test keys while validating checkout.
                </p>
              )}

              <form onSubmit={handleSavePaymentConfig} className="stack-form" style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="razorpay-key-id">Razorpay Key ID</label>
                  <input
                    id="razorpay-key-id"
                    type="text"
                    autoComplete="off"
                    value={paymentKeyId}
                    onChange={(e) => setPaymentKeyId(e.target.value)}
                    placeholder="rzp_test_... or rzp_live_..."
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="razorpay-key-secret">Razorpay Key Secret</label>
                  <input
                    id="razorpay-key-secret"
                    type="password"
                    autoComplete="new-password"
                    value={paymentKeySecret}
                    onChange={(e) => setPaymentKeySecret(e.target.value)}
                    placeholder={paymentConfig?.configured ? 'Leave blank to keep current secret' : 'Enter Key Secret'}
                    required={!paymentConfig?.configured || paymentKeyId !== paymentConfig?.keyId}
                  />
                </div>
                <div>
                  <button type="submit" className="btn-orange-primary" disabled={savingPaymentConfig}>
                    {savingPaymentConfig ? 'Saving…' : 'Save Razorpay Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {activeTab === 'help' && <ChatRequests showCancellations={false} />}
        {activeTab === 'cancellations' && <ChatRequests showEnquiries={false} />}
      </main>

      {/* PRODUCT MODAL */}
      {modalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveProduct}
        />
      )}

      {/* ORDER INVOICE / BILL RECEIPT MODAL */}
      {invoiceOrder && (
        <div className="modal-backdrop" onClick={() => setInvoiceOrder(null)}>
          <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-head">
              <div>
                <span className="inv-tag">TAX INVOICE / KITCHEN KOT</span>
                <h3>Radha Swami</h3>
                <p>Order #{invoiceOrder.orderNumber} • {new Date(invoiceOrder.createdAt).toLocaleString()}</p>
              </div>
              <button className="icon-btn" onClick={() => setInvoiceOrder(null)}><X size={18} /></button>
            </div>

            <div className="invoice-body">
              <div className="inv-cust-box">
                <div>
                  <small>CUSTOMER</small>
                  <strong>{invoiceOrder.user?.name}</strong>
                  <span>{invoiceOrder.user?.email} {invoiceOrder.user?.phone ? `• ${invoiceOrder.user.phone}` : ''}</span>
                </div>
                <div>
                  <small>DELIVERY ADDRESS ({invoiceOrder.distanceKm} km)</small>
                  <strong>[{invoiceOrder.deliveryAddress?.label || 'Home'}] {invoiceOrder.deliveryAddress?.street}</strong>
                  <span>{invoiceOrder.deliveryAddress?.city} - {invoiceOrder.deliveryAddress?.pincode}</span>
                </div>
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceOrder.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.name} ({it.variantLabel || it.variant})</td>
                      <td>{it.quantity}</td>
                      <td>₹{it.unitPrice}</td>
                      <td>₹{it.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="inv-totals">
                <div><span>Subtotal</span><span>₹{invoiceOrder.subtotal}</span></div>
                {invoiceOrder.discountAmount > 0 && (
                  <div style={{ color: '#16A34A' }}>
                    <span>Discount ({invoiceOrder.couponCode})</span>
                    <span>− ₹{invoiceOrder.discountAmount}</span>
                  </div>
                )}
                <div><span>Delivery Charge</span><span>₹{invoiceOrder.deliveryCharge}</span></div>
                {invoiceOrder.packagingCharge > 0 && (
                  <div><span>Packaging Fee</span><span>₹{invoiceOrder.packagingCharge}</span></div>
                )}
                <div className="inv-grand">
                  <strong>Grand Total ({invoiceOrder.paymentMethod} • {invoiceOrder.paymentStatus})</strong>
                  <strong>₹{invoiceOrder.totalAmount}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={() => setInvoiceOrder(null)}>Close</button>
              <button type="button" className="btn-orange-primary" onClick={() => window.print()}>
                <Printer size={15} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
