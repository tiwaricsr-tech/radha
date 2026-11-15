import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  MapPin,
  CreditCard,
  Plus,
  Minus,
  TicketPercent,
  CheckCircle2,
  ShieldCheck,
  Navigation,
  Home,
  Briefcase,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '../api';
import PaymentGatewayModal from './PaymentGatewayModal';

function isValidIndianMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const nationalNumber =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(nationalNumber);
}

export default function SwiggyCartView({
  cart,
  user,
  addresses,
  selectedAddress,
  coupons,
  cashOnDeliveryEnabled = true,
  preselectedCouponCode,
  onSelectAddress,
  onOpenAddressModal,
  onRequireAuth,
  onUpdateQty,
  onClearCart,
  onBackToMenu,
  onOrderPlaced
}) {
  const [couponInput, setCouponInput] = useState(preselectedCouponCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponFeedback, setCouponFeedback] = useState('');

  const [cookingInstructions, setCookingInstructions] = useState('');
  const [noContactDelivery, setNoContactDelivery] = useState(false);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  const [deliveryQuote, setDeliveryQuote] = useState({
    distanceKm: 2.4,
    deliveryCharge: 28,
    standardFeeWithoutFree: 28,
    packagingCharge: 5,
    qualifiedFree: false,
    freeDeliveryMinOrder: 999,
    etaMinutes: 22
  });

  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [placingCod, setPlacingCod] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/whatsapp/status')
      .then(({ enabled }) => {
        if (active) setWhatsappEnabled(Boolean(enabled));
      })
      .catch(() => {
        if (active) setWhatsappEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((s, item) => s + item.unitPrice * item.quantity, 0),
    [cart]
  );

  // Auto-fetch distance & fee from backend whenever selected address or subtotal changes
  useEffect(() => {
    if (!selectedAddress || subtotal === 0) return;
    apiRequest('/api/delivery/calculate', {
      method: 'POST',
      body: JSON.stringify({
        lat: selectedAddress.lat,
        lng: selectedAddress.lng,
        subtotal
      })
    })
      .then((q) => setDeliveryQuote(q))
      .catch((err) => setError(err.message));
  }, [selectedAddress, subtotal]);

  useEffect(() => {
    if (preselectedCouponCode && subtotal > 0 && !appliedCoupon) {
      handleApplyCoupon(preselectedCouponCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedCouponCode]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (subtotal < (appliedCoupon.minOrderAmount || 0)) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      const raw = Math.round((subtotal * appliedCoupon.discountValue) / 100);
      return appliedCoupon.maxDiscount ? Math.min(raw, appliedCoupon.maxDiscount) : raw;
    }
    return Math.min(appliedCoupon.discountValue, subtotal);
  }, [appliedCoupon, subtotal]);

  const toPay = Math.max(
    0,
    subtotal - discountAmount + (deliveryQuote.deliveryCharge || 0) + (deliveryQuote.packagingCharge || 0)
  );

  const totalSavings =
    discountAmount +
    (deliveryQuote.qualifiedFree ? Number(deliveryQuote.standardFeeWithoutFree || 0) : 0);

  const handleApplyCoupon = async (codeToUse) => {
    const code = (codeToUse ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponFeedback('');
    try {
      const res = await apiRequest('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal })
      });
      setAppliedCoupon(res.coupon);
      setCouponInput(res.coupon.code);
      setCouponFeedback(`‘${res.coupon.code}’ applied! ₹${res.discountAmount} savings`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponFeedback(err.message);
    }
  };

  const finalizeOrder = async ({ paymentMethod, paymentId = '', gatewayOrderId = '' }) => {
    setError('');
    if (!selectedAddress) {
      setError('Please choose or add a delivery address before placing your order.');
      onOpenAddressModal();
      return;
    }
    if (!user && !customerName.trim()) {
      setError('Please enter your name or sign in with Google.');
      return;
    }
    if (whatsappOptIn && !isValidIndianMobile(customerPhone)) {
      setError('Enter a valid Indian mobile number for WhatsApp order updates.');
      return;
    }
    setPlacingCod(true);
    try {
      const res = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          user: {
            id: user?._id || 'guest',
            name: user?.name || customerName || 'Customer',
            email: user?.email || 'customer@shreemithai.in',
            phone: customerPhone
          },
          items: cart,
          couponCode: appliedCoupon && discountAmount > 0 ? appliedCoupon.code : '',
          distanceKm: deliveryQuote.distanceKm,
          deliveryAddress: {
            label: selectedAddress.label || 'Home',
            street: `${selectedAddress.flatNo ? selectedAddress.flatNo + ', ' : ''}${selectedAddress.street}`,
            landmark: selectedAddress.landmark || '',
            city: selectedAddress.city || 'Rewa',
            pincode: selectedAddress.pincode || '486001',
            lat: selectedAddress.lat,
            lng: selectedAddress.lng
          },
          cookingInstructions,
          noContactDelivery,
          whatsappOptIn,
          paymentMethod,
          paymentId,
          gatewayOrderId
        })
      });
      onClearCart();
      onOrderPlaced({
        ...res.order,
        whatsappNotification: res.whatsappNotification
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacingCod(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="sw-empty-cart-page">
        <div className="sw-empty-illu">🛒</div>
        <h2>Your cart is empty</h2>
        <p>You can go to the home menu to view fresh sweets, hot samosas &amp; chaats.</p>
        <button className="sw-btn-orange lg" onClick={onBackToMenu}>
          SEE MENU ITEMS NEAR YOU
        </button>
      </div>
    );
  }

  return (
    <div className="sw-checkout-wrapper">
      <button className="sw-back-link" onClick={onBackToMenu}>
        <ArrowLeft size={16} /> Back to Menu
      </button>

      <div className="sw-checkout-grid">
        {/* LEFT COLUMN: SWIGGY 3-STEP ACCORDION */}
        <div className="sw-steps-col">
          {/* STEP 1: ACCOUNT */}
          <div className="sw-step-card">
            <div className="sw-step-icon"><User size={18} /></div>
            <div className="sw-step-body">
              <div className="sw-step-head">
                <h3>Account</h3>
                {user && <CheckCircle2 size={18} color="#1BA672" />}
              </div>

              {user ? (
                <p className="sw-logged-text">
                  Signed in as <strong>{user.name}</strong> ({user.email || user.phone})
                </p>
              ) : (
                <div className="sw-guest-row">
                  <div className="sw-field-group" style={{ marginBottom: 10 }}>
                    <input
                      type="text"
                      placeholder="Your Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <button type="button" className="sw-outline-orange" onClick={onRequireAuth}>
                    Or Sign in with Google for 1-Click Sync
                  </button>
                </div>
              )}
              <div className="sw-whatsapp-fields">
                <label htmlFor="whatsapp-phone">Mobile number (India)</label>
                <input
                  id="whatsapp-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                {whatsappEnabled && (
                  <label className="sw-whatsapp-consent">
                    <input
                      type="checkbox"
                      checked={whatsappOptIn}
                      onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    />
                    <span>Send my order confirmation on WhatsApp</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: DELIVERY ADDRESS (SWIGGY CARDS + GPS AUTO-DETECT) */}
          <div className="sw-step-card">
            <div className="sw-step-icon"><MapPin size={18} /></div>
            <div className="sw-step-body">
              <div className="sw-step-head">
                <h3>Choose a delivery address</h3>
                <button type="button" className="sw-gps-inline-btn" onClick={onOpenAddressModal}>
                  <Navigation size={14} /> Auto-Detect GPS / Manage
                </button>
              </div>

              <div className="sw-addr-cards-grid">
                {addresses.map((addr) => {
                  const isSel = selectedAddress?.id === addr.id;
                  const Icon =
                    addr.label === 'Home' ? Home : addr.label === 'Work' ? Briefcase : MapPin;
                  return (
                    <div
                      key={addr.id}
                      className={`sw-checkout-addr-card ${isSel ? 'selected' : ''}`}
                      onClick={() => onSelectAddress(addr)}
                    >
                      <div className="addr-card-head">
                        <Icon size={17} />
                        <strong>{addr.label}</strong>
                        {isSel && <CheckCircle2 size={16} color="#1BA672" style={{ marginLeft: 'auto' }} />}
                      </div>
                      <p>
                        {addr.flatNo ? `${addr.flatNo}, ` : ''}{addr.street}, {addr.city} - {addr.pincode}
                      </p>
                      <span className="eta-mins-txt">
                        {isSel ? `${deliveryQuote.etaMinutes} MINS • ${deliveryQuote.distanceKm} km` : 'Tap to select'}
                      </span>
                      <button
                        type="button"
                        className={`deliver-here-btn ${isSel ? 'active' : ''}`}
                        onClick={() => onSelectAddress(addr)}
                      >
                        {isSel ? 'DELIVERING HERE ✓' : 'DELIVER HERE'}
                      </button>
                    </div>
                  );
                })}

                <div className="sw-checkout-addr-card add-new-card" onClick={onOpenAddressModal}>
                  <div className="addr-card-head">
                    <MapPin size={17} color="#FF5200" />
                    <strong>Add New Address</strong>
                  </div>
                  <p>Pin exact location on map or auto-detect via live GPS</p>
                  <button type="button" className="add-new-outline-btn">
                    ADD NEW
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: PAYMENT GATEWAY */}
          <div className="sw-step-card">
            <div className="sw-step-icon"><CreditCard size={18} /></div>
            <div className="sw-step-body">
              <div className="sw-step-head">
                <h3>Choose payment method</h3>
              </div>

              {error && <div className="sw-error-alert">{error}</div>}

              <div className="sw-payment-choices">
                <div className="sw-pay-hero-box">
                  <div>
                    <strong>Pay Online (UPI QR, GPay, PhonePe, Cards, Netbanking)</strong>
                    <p>Instant verification via Razorpay Payment Gateway</p>
                  </div>
                  <button
                    type="button"
                    className="sw-btn-green-pay"
                    onClick={() => {
                      if (!selectedAddress) {
                        setError('Please select or add a delivery address first.');
                        onOpenAddressModal();
                        return;
                      }
                      if (!user && !customerName.trim()) {
                        setError('Please enter your name or sign in with Google.');
                        return;
                      }
                      if (whatsappOptIn && !isValidIndianMobile(customerPhone)) {
                        setError('Enter a valid Indian mobile number for WhatsApp order updates.');
                        return;
                      }
                      setError('');
                      setGatewayModalOpen(true);
                    }}
                  >
                    PROCEED TO PAY ₹{toPay}
                  </button>
                </div>

                {cashOnDeliveryEnabled && (
                  <div className="sw-cod-row">
                    <div>
                      <strong>Pay on Delivery (Cash / UPI at Doorstep)</strong>
                      <p>Pay cash or scan delivery partner QR when order arrives</p>
                    </div>
                    <button
                      type="button"
                      className="sw-outline-orange"
                      disabled={placingCod}
                      onClick={() => finalizeOrder({ paymentMethod: 'Cash on Delivery' })}
                    >
                      {placingCod ? 'Placing...' : 'Place COD Order'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SWIGGY CART RECEIPT */}
        <aside className="sw-receipt-col">
          <div className="sw-receipt-card">
            <div className="sw-rest-mini">
              <img src={cart[0]?.image || '/uploads/images/kaju-katli.jpg'} alt="Shop" />
              <div>
                <h4>Radha Swami</h4>
                <span>Civil Lines • {deliveryQuote.distanceKm} km away</span>
              </div>
            </div>

            {/* ITEMS LIST */}
            <div className="sw-cart-items">
              {cart.map((item) => (
                <div className="sw-cart-line" key={`${item.productId}_${item.variant}`}>
                  <span className="sw-veg-sq"><i /></span>
                  <div className="sw-line-name">
                    <strong>{item.name}</strong>
                    <small>
                      {item.variant === 'piece'
                        ? `Piece (₹${item.unitPrice}/pc)`
                        : item.variantLabel}
                    </small>
                  </div>

                  {/* SWIGGY GREEN STEPPER */}
                  <div className="sw-qty-box">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.productId, item.variant, item.quantity - 1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.productId, item.variant, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <span className="sw-line-amt">₹{item.unitPrice * item.quantity}</span>
                </div>
              ))}
            </div>

            {/* COOKING SUGGESTIONS */}
            <div className="sw-note-input-wrap">
              <input
                type="text"
                placeholder="❝ Any suggestions? Less sugar, extra green chutney, gift note..."
                value={cookingInstructions}
                onChange={(e) => setCookingInstructions(e.target.value)}
              />
            </div>

            {/* NO CONTACT DELIVERY */}
            <label className="sw-nocontact-box">
              <input
                type="checkbox"
                checked={noContactDelivery}
                onChange={(e) => setNoContactDelivery(e.target.checked)}
              />
              <div>
                <strong>Opt in for No-contact Delivery</strong>
                <p>Partner will leave your order neatly at your doorstep (for online paid orders).</p>
              </div>
            </label>

            {/* APPLY COUPON */}
            <div className="sw-coupon-box">
              <div className="sw-coupon-input-row">
                <TicketPercent size={17} color="#FF5200" />
                <input
                  type="text"
                  placeholder="Apply Coupon Code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                />
                <button type="button" onClick={() => handleApplyCoupon()}>APPLY</button>
              </div>
              {couponFeedback && <small className="sw-cpn-msg">{couponFeedback}</small>}

              {coupons.length > 0 && (
                <div className="sw-cpn-pills">
                  {coupons.map((c) => (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => handleApplyCoupon(c.code)}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SWIGGY BILL DETAILS */}
            <div className="sw-bill-details">
              <h5>Bill Details</h5>
              <div className="sw-bill-row">
                <span>Item Total</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="sw-bill-row">
                <span>Delivery Partner Fee | {deliveryQuote.distanceKm} km</span>
                <span>
                  {deliveryQuote.qualifiedFree ? (
                    <>
                      <s style={{ color: '#9CA3AF', marginRight: 5 }}>₹{deliveryQuote.standardFeeWithoutFree}</s>
                      <strong style={{ color: '#1BA672' }}>FREE</strong>
                    </>
                  ) : (
                    `₹${deliveryQuote.deliveryCharge}`
                  )}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="sw-bill-row green">
                  <span>Item Discount ({appliedCoupon?.code})</span>
                  <span>− ₹{discountAmount}</span>
                </div>
              )}
              <div className="sw-bill-row">
                <span>Packaging &amp; Platform Fee</span>
                <span>₹{deliveryQuote.packagingCharge || 0}</span>
              </div>

              <div className="sw-to-pay-row">
                <strong>TO PAY</strong>
                <strong>₹{toPay}</strong>
              </div>
            </div>

            {totalSavings > 0 && (
              <div className="sw-savings-strip">
                <Sparkles size={15} /> Savings of <strong>₹{totalSavings}</strong> on this order!
              </div>
            )}
          </div>

          <div className="sw-safe-note">
            <ShieldCheck size={18} color="#1BA672" />
            <span>Safe and Hygienic Kitchen • Live GPS Order &amp; Delivery Tracking</span>
          </div>
        </aside>
      </div>

      {gatewayModalOpen && (
        <PaymentGatewayModal
          amount={toPay}
          customer={{ name: user?.name || customerName, email: user?.email, phone: customerPhone }}
          checkout={{
            user: {
              id: user?._id || 'guest',
              name: user?.name || customerName || 'Customer',
              email: user?.email || 'customer@shreemithai.in',
              phone: customerPhone
            },
            items: cart,
            couponCode: appliedCoupon && discountAmount > 0 ? appliedCoupon.code : '',
            distanceKm: deliveryQuote.distanceKm,
            deliveryAddress: {
              label: selectedAddress.label || 'Home',
              street: `${selectedAddress.flatNo ? selectedAddress.flatNo + ', ' : ''}${selectedAddress.street}`,
              landmark: selectedAddress.landmark || '',
              city: selectedAddress.city || 'Rewa',
              pincode: selectedAddress.pincode || '486001',
              lat: selectedAddress.lat,
              lng: selectedAddress.lng
            },
            cookingInstructions,
            noContactDelivery,
            whatsappOptIn
          }}
          onClose={() => setGatewayModalOpen(false)}
          onPaymentSuccess={(order) => {
            setGatewayModalOpen(false);
            onClearCart();
            onOrderPlaced(order);
          }}
        />
      )}
    </div>
  );
}
