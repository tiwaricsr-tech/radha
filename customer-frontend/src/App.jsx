import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  MapPin,
  ChevronDown,
  Clock,
  Percent,
  Compass,
  Home as HomeIcon,
  LogOut,
  SlidersHorizontal,
  Star,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Award,
  ArrowRight,
  HelpCircle,
  Truck,
  Menu as MenuIcon
} from 'lucide-react';
import {
  apiRequest,
  subscribeRealtime,
  safeStorage,
  getSavedCustomerUser,
  clearCustomerSession,
  navigateToAdminDashboard,
  isExplicitStorefrontMode
} from './api';
import GoogleAuthModal, { GoogleIcon, CustomerLoginPage } from './components/GoogleAuthModal';
import ProductCard from './components/ProductCard';
import SwiggyCartView from './components/SwiggyCartView';
import SwiggyAddressModal, { DEFAULT_SAVED_ADDRESSES } from './components/SwiggyAddressModal';
import OrderTracker from './components/OrderTracker';
import ReviewsModal from './components/ReviewsModal';
import ChatWidget from './components/ChatWidget';

const MIND_CATEGORIES = [
  { id: 'All', label: 'All Menu', img: '/uploads/images/kaju-katli.jpg' },
  { id: 'Sweets', label: 'Pure Ghee Sweets', img: '/uploads/images/motichoor-ladoo.jpg' },
  { id: 'Hot Snacks', label: 'Hot Samosa & Chaat', img: '/uploads/images/punjabi-samosa.jpg' },
  { id: 'Bengali & Dairy Sweets', label: 'Rasmalai & Jamun', img: '/uploads/images/rasmalai.jpg' },
  { id: 'Namkeen & Savory', label: 'Crispy Namkeen', img: '/uploads/images/bikaneri-bhujia.jpg' },
  { id: 'Festive Gift Boxes', label: 'Gift Boxes', img: '/uploads/images/festive-gift-box.jpg' }
];

export default function App() {
  const [user, setUser] = useState(() => getSavedCustomerUser());
  const [adminFromLoginGate, setAdminFromLoginGate] = useState(false);

  // Saved Swiggy addresses + active delivery address
  const [addresses, setAddresses] = useState(() => {
    try {
      const saved = safeStorage.getItem('shree_saved_addresses');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((a) => a.id !== 'addr-home' && a.id !== 'addr-work')
        : [];
    } catch {
      return [];
    }
  });

  const [selectedAddress, setSelectedAddress] = useState(() => {
    try {
      const saved = safeStorage.getItem('shree_active_address');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed?.id === 'addr-home' || parsed?.id === 'addr-work') return null;
      return parsed;
    } catch {
      return null;
    }
  });

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [view, setView] = useState('menu'); // 'menu' | 'cart' | 'track'

  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [activeTrackedOrder, setActiveTrackedOrder] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pieceOnly, setPieceOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [search, setSearch] = useState('');
  const [preselectedCouponCode, setPreselectedCouponCode] = useState('');

  const [cart, setCart] = useState(() => {
    try {
      const saved = safeStorage.getItem('shree_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState(null);
  const [toast, setToast] = useState('');
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const menuRef = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const fetchStoreData = useCallback(async () => {
    try {
      const [prodRes, coupRes, storeRes, ordRes, revRes] = await Promise.all([
        apiRequest('/api/products'),
        apiRequest('/api/coupons?active=true'),
        apiRequest('/api/delivery/public'),
        user ? apiRequest('/api/orders') : Promise.resolve({ orders: [] }),
        apiRequest('/api/reviews')
      ]);
      setProducts(prodRes.products || []);
      setCoupons(coupRes.coupons || []);
      setStoreInfo(storeRes.store || null);
      setMyOrders(ordRes.orders || []);
      setReviews(revRes.reviews || []);

      if (prodRes.products) {
        setCart((prev) =>
          prev.map((item) => {
            const latest = prodRes.products.find((p) => String(p._id) === String(item.productId));
            if (!latest || !latest.inStock) return item;
            const updatedPrice = latest.prices?.[item.variant];
            if (updatedPrice && Number(updatedPrice) !== item.unitPrice) {
              return { ...item, unitPrice: Number(updatedPrice), name: latest.name, image: latest.image };
            }
            return item;
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  useEffect(() => {
    safeStorage.setItem('shree_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    safeStorage.setItem('shree_saved_addresses', JSON.stringify(addresses));
  }, [addresses]);

  useEffect(() => {
    if (selectedAddress) {
      safeStorage.setItem('shree_active_address', JSON.stringify(selectedAddress));
    }
  }, [selectedAddress]);

  useEffect(() => {
    if (!orderConfirmation) return undefined;
    const timer = setTimeout(() => setOrderConfirmation(null), 3200);
    return () => clearTimeout(timer);
  }, [orderConfirmation]);

  // Real-time Instant Sync from Admin Dashboard
  useEffect(() => {
    const unsub = subscribeRealtime((event, payload) => {
      if (event === 'products:updated') {
        fetchStoreData();
        notify('⚡ Menu & prices updated live!');
      } else if (event === 'coupons:updated') {
        fetchStoreData();
        notify('🎟️ Store promo coupons updated live!');
      } else if (event === 'delivery:updated') {
        fetchStoreData();
        notify('🛵 Delivery charges updated by store!');
      } else if (event === 'reviews:updated') {
        fetchStoreData();
      } else if (event === 'orders:updated') {
        fetchStoreData();
        if (activeTrackedOrder && payload.order?.orderNumber === activeTrackedOrder.orderNumber) {
          setActiveTrackedOrder(payload.order);
          notify(`📦 Order #${payload.order.orderNumber} is now "${payload.order.status}"!`);
        }
      }
    });
    return unsub;
  }, [fetchStoreData, activeTrackedOrder, notify]);

  const handleAddToCart = (product, variantObj, qtyToAdd = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.productId === product._id && i.variant === variantObj.key
      );
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qtyToAdd };
        return copy;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          image: product.image,
          variant: variantObj.key,
          variantLabel: variantObj.fullLabel,
          unitPrice: variantObj.price,
          quantity: qtyToAdd
        }
      ];
    });
    notify(`Added ${product.name} (${variantObj.shortLabel}) to Cart`);
  };

  const handleUpdateQty = (productId, variant, newQty) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => !(i.productId === productId && i.variant === variant)));
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId && i.variant === variant ? { ...i, quantity: newQty } : i
      )
    );
  };

  const getMinPrice = (p) => {
    const vals = Object.values(p.prices || {}).filter((v) => v !== null && Number(v) > 0);
    return vals.length ? Math.min(...vals.map(Number)) : 9999;
  };

  const filteredProducts = products
    .filter((p) => {
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesPiece = !pieceOnly || (p.prices?.piece && Number(p.prices.piece) > 0);
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesPiece && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return getMinPrice(a) - getMinPrice(b);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'fast') return (a.prepTimeMins || 15) - (b.prepTimeMins || 15);
      return 0;
    });

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const handleMenuNavigation = () => {
    setView('menu');
    window.requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  // Auto-route Admin sessions directly to Admin Console unless explicitly browsing Storefront
  useEffect(() => {
    if (user && user.role === 'admin' && !isExplicitStorefrontMode()) {
      navigateToAdminDashboard();
    }
  }, [user]);

  // UNIFIED SINGLE SIGN-IN / SIGN-UP GATE
  if (!user) {
    return (
      <>
        <CustomerLoginPage onSuccess={(loggedInUser) => setUser(loggedInUser)} />
        <ChatWidget open={helpChatOpen} onOpenChange={setHelpChatOpen} />
      </>
    );
  }

  if (user.role === 'admin' && !isExplicitStorefrontMode()) {
    return null;
  }

  return (
    <div className="sw-app">
      {toast && <div className="sw-toast">{toast}</div>}
      {orderConfirmation && (
        <div className="sw-order-success-toast" role="status" aria-live="polite">
          <span className="sw-order-success-icon"><CheckCircle2 size={26} /></span>
          <div>
            <strong>Order confirmed!</strong>
            <p>
              Order #{orderConfirmation.orderNumber} is being sent to the kitchen.
              {orderConfirmation.whatsappNotification?.status === 'sent'
                ? ' WhatsApp confirmation sent.'
                : orderConfirmation.whatsappNotification?.status === 'waiting_for_agent'
                  ? ' WhatsApp order details will be sent after a delivery agent is assigned.'
                  : orderConfirmation.whatsappOptIn
                  ? ' WhatsApp confirmation could not be sent; please check your order details.'
                  : ''}
            </p>
          </div>
          <span className="sw-order-success-sparkle" aria-hidden="true">✦</span>
        </div>
      )}

      {/* VIBRANT ORANGE TOP OFFER RIBBON */}
      <div className="sw-top-promo-ribbon">
        <div className="sw-container sw-ribbon-inner">
          <span>✨ 100% Pure Desi Ghee Mithai &amp; Hot Snacks • Freshly Prepared Every Morning</span>
          <span>
            🚚 Free Delivery above ₹{storeInfo?.freeDeliveryMinOrder ?? 999} • Use code <strong>FIRST50</strong> or <strong>FESTIVE20</strong>
          </span>
        </div>
      </div>

      {/* REDESIGNED ORANGE & WHITE STICKY NAVBAR */}
      <header className="sw-navbar">
        <div className="sw-nav-inner">
          <div className="sw-nav-left">
            <div className="sw-brand" onClick={() => setView('menu')}>
              <img className="sw-brand-logo" src="/radha-swami-logo.jpg" alt="" />
              <span className="sw-brand-name">{storeInfo?.shopName || 'Radha Swami'}</span>
            </div>

            {/* SWIGGY AUTO-DETECT & SAVED ADDRESS PILL */}
            <button
              type="button"
              className="sw-location-selector"
              onClick={() => setAddressModalOpen(true)}
            >
              <MapPin size={17} color="#FF5200" />
              <strong className="loc-tag">{selectedAddress ? selectedAddress.label : 'Set Location'}</strong>
              <span className="loc-trunc">
                {selectedAddress
                  ? `${selectedAddress.street}, ${selectedAddress.city}`
                  : 'Select or GPS-detect address'}
              </span>
              <ChevronDown size={16} color="#FF5200" />
            </button>
          </div>

          <nav className="sw-nav-links">
            <button
              type="button"
              className={`sw-head-btn sw-desktop-nav-action ${view === 'menu' ? 'active' : ''}`}
              onClick={handleMenuNavigation}
            >
              <MenuIcon size={17} /> Menu
            </button>

            <button
              type="button"
              className="sw-head-btn sw-desktop-nav-action"
              onClick={() => setHelpChatOpen(true)}
            >
              <HelpCircle size={17} /> Help
            </button>

            <button
              type="button"
              className={`sw-head-btn sw-desktop-nav-action ${view === 'track' ? 'active' : ''}`}
              onClick={() => setView('track')}
            >
              <Compass size={17} /> Track Order
            </button>

            {user?.role === 'admin' && (
              <button
                type="button"
                className="sw-head-btn sw-mobile-admin"
                onClick={() => navigateToAdminDashboard()}
                style={{
                  background: '#fff7ed',
                  color: '#FF5200',
                  border: '1px solid #fed7aa',
                  borderRadius: 10,
                  padding: '7px 12px'
                }}
                title="Switch back to Admin Console (no login needed)"
              >
                ⚙️ Admin Dashboard
              </button>
            )}

            {user ? (
              <div className="sw-user-pill sw-mobile-account">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span className="u-dot">{user.name?.[0]}</span>
                )}
                <span>{user.name.split(' ')[0]}</span>
                <button
                  onClick={() => {
                    clearCustomerSession();
                    setUser(null);
                  }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="sw-head-btn sw-mobile-account" onClick={() => setAuthModalOpen(true)}>
                <GoogleIcon size={16} /> Sign In
              </button>
            )}

            <button
              type="button"
              className={`sw-cart-nav-btn sw-mobile-cart ${cartCount > 0 ? 'has-items' : ''}`}
              onClick={() => setView('cart')}
            >
              <img className="sw-cart-icon" src="/cart-icon.png" alt="" />
              <span>Cart</span>
              <span className="cart-badge-num">{cartCount}</span>
            </button>
          </nav>
        </div>
      </header>

      {view === 'menu' && (
        <section className="sw-mobile-store-overview" aria-label="Store information">
          <div className="sw-mobile-store-card">
            <div className="sw-mobile-store-title-row">
              <div>
                <span className="sw-mobile-store-kicker">PURE VEG · FRESHLY PREPARED</span>
                <h1>{storeInfo?.shopName || 'Radha Swami'}</h1>
                <p>Artisanal sweets, snacks &amp; daily favourites</p>
              </div>
              <span className="sw-mobile-pure-veg">100% Veg</span>
            </div>

            <div className="sw-mobile-store-meta">
              <div>
                <MapPin size={16} />
                <span><strong>Outlet</strong>{storeInfo?.shopAddress || 'Station Road, Civil Lines, Main Market'}</span>
              </div>
              <button type="button" onClick={() => setAddressModalOpen(true)}>
                <Clock size={16} />
                <span>
                  <strong>20 min delivery</strong>
                  {selectedAddress
                    ? `${selectedAddress.street}, ${selectedAddress.city}`
                    : 'Choose a delivery location'}
                </span>
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MAIN CONTENT ROUTER */}
      {view === 'cart' ? (
        <main className="sw-container">
          <SwiggyCartView
            cart={cart}
            user={user}
            addresses={addresses}
            selectedAddress={selectedAddress}
            coupons={coupons}
            cashOnDeliveryEnabled={storeInfo?.cashOnDeliveryEnabled !== false}
            preselectedCouponCode={preselectedCouponCode}
            onSelectAddress={(addr) => setSelectedAddress(addr)}
            onOpenAddressModal={() => setAddressModalOpen(true)}
            onRequireAuth={() => setAuthModalOpen(true)}
            onUpdateQty={handleUpdateQty}
            onClearCart={() => setCart([])}
            onBackToMenu={() => setView('menu')}
            onOrderPlaced={(newOrder) => {
              setActiveTrackedOrder(newOrder);
              setView('track');
              setOrderConfirmation(newOrder);
              fetchStoreData();
              notify(`🎉 Order #${newOrder.orderNumber} Placed Successfully!`);
            }}
          />
        </main>
      ) : view === 'track' ? (
        <main className="sw-container">
          <OrderTracker
            activeOrder={activeTrackedOrder || myOrders[0] || null}
            myOrders={myOrders}
            onSelectOrder={(o) => setActiveTrackedOrder(o)}
          />
        </main>
      ) : (
        <>
          {/* REDESIGNED SUNRISE ORANGE & WHITE BOUTIQUE HERO */}
          <section className="sw-hero">
            <div className="sw-container">
              <div className="sw-hero-orange-card">
                <div className="sw-hero-left">
                  <span className="sw-hero-pill">
                    <Zap size={13} />{' '}
                    {selectedAddress
                      ? `20-Min Express Delivery to ${selectedAddress.label} (${selectedAddress.street})`
                      : 'Express 20-Min Delivery • Live GPS Tracking'}
                  </span>
                  <h1>
                    Artisanal Pure Ghee Mithai &amp; Hot Snacks, Delivered Fresh.
                  </h1>
                  <p>
                    Order single <strong>Pieces (₹18/Pc)</strong>, <strong>Half / Full Plates</strong>, or <strong>250g – 1kg Gift Boxes</strong> with auto GPS address detection &amp; instant online or doorstep checkout.
                  </p>

                  <div className="sw-hero-actions">
                    <button
                      className="sw-btn-hero-white"
                      onClick={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Explore Fresh Menu <ArrowRight size={17} />
                    </button>
                    <button
                      className="sw-btn-hero-glass"
                      onClick={() => setAddressModalOpen(true)}
                    >
                      <MapPin size={17} /> {selectedAddress ? 'Change Location' : 'Set Delivery Address'}
                    </button>
                  </div>

                  <div className="sw-hero-metrics">
                    <div><strong>100% Pure</strong><span>A2 Desi Cow Ghee</span></div>
                    <div><strong>1 Pc – 1 Kg</strong><span>Flexible Portions</span></div>
                    <div><strong>₹{storeInfo?.freeDeliveryMinOrder ?? 999}+</strong><span>Free Delivery</span></div>
                  </div>
                </div>

                <div className="sw-hero-cards">
                <div className="sw-featured-visual">
                  <img src="/uploads/images/kaju-katli.jpg" alt="Kaju Katli" />
                  <div className="sw-visual-cap">
                    <span>Bestseller</span>
                    <h4>Royal Silver Kaju Katli</h4>
                    <p>From ₹22 / Piece • ₹460 / 500g</p>
                  </div>
                </div>
                  <div className="sw-featured-visual secondary">
                    <img src="/uploads/images/punjabi-samosa.jpg" alt="Hot Samosa" />
                    <div className="sw-visual-cap">
                      <span>Piping Hot</span>
                      <h4>Crispy Punjabi Samosa</h4>
                      <p>₹22 / Piece • ₹80 Full Plate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <main className="sw-container sw-menu-content" ref={menuRef}>
            {/* SWIGGY DEALS FOR YOU CAROUSEL */}
            {coupons.length > 0 && (
              <section className="sw-deals-sec">
                <h2>Deals for you</h2>
                <div className="sw-deals-row">
                  {coupons.map((c) => (
                    <div
                      className="sw-deal-card"
                      key={c._id}
                      onClick={() => {
                        setPreselectedCouponCode(c.code);
                        notify(`🎟️ "${c.code}" ready! Will auto-apply in Cart.`);
                      }}
                    >
                      <div className="deal-badge"><Percent size={20} /></div>
                      <div>
                        <strong>
                          {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `FLAT ₹${c.discountValue} OFF`}
                        </strong>
                        <span>USE {c.code} | ABOVE ₹{c.minOrderAmount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="sw-mobile-menu-heading">
              <span>MENU</span>
              <i />
              <span className="sw-mobile-menu-caption">Choose your favourites</span>
            </div>

            {/* SWIGGY "WHAT'S ON YOUR MIND?" CIRCULAR CATEGORIES */}
            <section className="sw-mind-sec">
              <h2>What&apos;s on your mind?</h2>
              <div className="sw-mind-row">
                {MIND_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    className={`sw-mind-item ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <div className="mind-circle">
                      <img src={cat.img} alt={cat.label} />
                    </div>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* SEARCH + FILTER CHIPS */}
            <section className="sw-filter-bar">
              <div className="sw-search-box">
                <Search size={18} color="#FF5200" />
                <input
                  type="text"
                  placeholder="Search sweets and snacks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="sw-filter-chips">
                <button
                  type="button"
                  className={`sw-chip ${pieceOnly ? 'active' : ''}`}
                  onClick={() => setPieceOnly((v) => !v)}
                >
                  🧩 Buy by Piece
                </button>

                <div className="sw-sort-pill">
                  <SlidersHorizontal size={14} />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="featured">Relevance</option>
                    <option value="price-asc">Cost: Low to High</option>
                    <option value="rating">Rating 4.8+</option>
                    <option value="fast">Delivery Time</option>
                  </select>
                </div>
              </div>
            </section>

            {storeInfo && !storeInfo.isStoreOpen && (
              <div className="sw-error-alert" style={{ marginBottom: 18 }}>
                ⏸️ Store is temporarily paused for new online orders right now.
              </div>
            )}

            <div className="sw-mobile-recommendation-heading">
              <h2>{selectedCategory === 'All' ? 'Popular now' : selectedCategory}</h2>
              <span>{filteredProducts.length} items</span>
            </div>

            {/* MENU GRID */}
            <div className="sw-menu-grid">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p._id}
                  product={p}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                  onOpenReviews={(prod) => setReviewProduct(prod)}
                />
              ))}
            </div>

            {/* CUSTOMER REVIEWS */}
            {reviews.length > 0 && (
              <section className="sw-reviews-sec">
                <h2>Customer Reviews &amp; Ratings</h2>
                <div className="sw-rev-grid">
                  {reviews.slice(0, 4).map((r) => (
                    <div className="sw-rev-card" key={r._id}>
                      <div className="sw-rev-top">
                        <strong>{r.userName}</strong>
                        <span className="rev-green-pill">
                          <Star size={11} fill="#fff" stroke="#fff" /> {r.rating}.0
                        </span>
                      </div>
                      <small className="rev-prod-lbl">{r.productName}</small>
                      <p>“{r.comment}”</p>
                      {r.adminReply && (
                        <div className="sw-owner-reply">
                          <strong>Radha Swami:</strong> {r.adminReply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TRUST STRIP */}
            <section className="sw-trust-grid">
              <div className="sw-trust-item">
                <Award size={22} color="#FF5200" />
                <div>
                  <h4>Pure A2 Cow Ghee</h4>
                  <p>Handcrafted fresh every morning with zero preservatives.</p>
                </div>
              </div>
              <div className="sw-trust-item">
                <MapPin size={22} color="#FF5200" />
                <div>
                  <h4>Auto GPS Address &amp; Tracking</h4>
                  <p>Pin your Home or Work address once for automatic delivery routing.</p>
                </div>
              </div>
              <div className="sw-trust-item">
                <ShieldCheck size={22} color="#FF5200" />
                <div>
                  <h4>100% Secure Payment Gateway</h4>
                  <p>
                    Pay seamlessly via UPI, cards
                    {storeInfo?.cashOnDeliveryEnabled !== false ? ', or Cash on Delivery.' : '.'}
                  </p>
                </div>
              </div>
            </section>
          </main>
        </>
      )}

      {/* SWIGGY ICONIC BOTTOM STICKY VIEW CART BAR */}
      {view === 'menu' && cartCount > 0 && (
        <div className="sw-bottom-cart-bar" onClick={() => setView('cart')}>
          <div>
            <strong>{cartCount} {cartCount === 1 ? 'Item' : 'Items'} added</strong>
            <span> | ₹{cartTotal}</span>
          </div>
          <div className="view-cart-right">
            <span>VIEW CART</span>
            <img className="sw-cart-icon" src="/cart-icon.png" alt="" />
          </div>
        </div>
      )}

      <nav className="sw-mobile-bottom-nav" aria-label="Store navigation">
        <button
          type="button"
          className={`sw-mobile-tab ${view === 'menu' ? 'active' : ''}`}
          onClick={handleMenuNavigation}
        >
          <HomeIcon size={20} />
          <span>Menu</span>
        </button>
        <button
          type="button"
          className={`sw-mobile-tab ${view === 'track' ? 'active' : ''}`}
          onClick={() => setView('track')}
        >
          <Compass size={20} />
          <span>Orders</span>
        </button>
        <button
          type="button"
          className={`sw-mobile-tab ${helpChatOpen ? 'active' : ''}`}
          onClick={() => setHelpChatOpen(true)}
        >
          <HelpCircle size={20} />
          <span>Help</span>
        </button>
        <button
          type="button"
          className={`sw-mobile-tab sw-mobile-cart-tab ${view === 'cart' ? 'active' : ''}`}
          onClick={() => setView('cart')}
        >
          <img src="/cart-icon.png" alt="" />
          <span>Cart</span>
          {cartCount > 0 && <span className="sw-mobile-cart-count">{cartCount}</span>}
        </button>
      </nav>

      <footer className="sw-footer">
        <div className="sw-container sw-footer-inner">
          <div>
            <h3><img className="sw-footer-logo" src="/radha-swami-logo.jpg" alt="" />{storeInfo?.shopName || 'Radha Swami'}</h3>
            <p>{storeInfo?.shopAddress || 'Station Road, Civil Lines, Main Market'} • Pure Veg</p>
          </div>
          <span>© 2026 Radha Swami • Instant Live Sync Enabled</span>
        </div>
      </footer>

      {addressModalOpen && (
        <SwiggyAddressModal
          addresses={addresses}
          selectedAddress={selectedAddress}
          onSelectAddress={(addr) => {
            setSelectedAddress(addr);
            notify(`📍 Delivering to ${addr.label}: ${addr.street}`);
          }}
          onSaveNewAddress={(newAddr) => {
            setAddresses((prev) => [newAddr, ...prev]);
          }}
          onClose={() => setAddressModalOpen(false)}
        />
      )}

      {authModalOpen && (
        <GoogleAuthModal
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(u) => {
            setUser(u);
            notify(`Signed in as ${u.name}`);
          }}
        />
      )}

      {reviewProduct && (
        <ReviewsModal
          product={reviewProduct}
          user={user}
          onClose={() => setReviewProduct(null)}
          onReviewSubmitted={() => {
            fetchStoreData();
            notify('⭐ Review posted!');
          }}
        />
      )}
      <ChatWidget open={helpChatOpen} onOpenChange={setHelpChatOpen} />
    </div>
  );
}
