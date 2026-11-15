import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  PackageCheck,
  MapPin,
  PhoneCall,
  ShieldCheck
} from 'lucide-react';
import { apiRequest } from '../api';

const STEPS = ['Pending', 'Accepted', 'Preparing', 'Out for Delivery', 'Delivered'];

export default function OrderTracker({ activeOrder, myOrders, onSelectOrder }) {
  const [lookupInput, setLookupInput] = useState(activeOrder?.orderNumber || myOrders?.[0]?.orderNumber || '');
  const [tracked, setTracked] = useState(activeOrder || myOrders?.[0] || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeOrder) {
      setTracked(activeOrder);
      setLookupInput(activeOrder.orderNumber);
    }
  }, [activeOrder]);

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!lookupInput.trim()) return;
    setError('');
    try {
      const res = await apiRequest(`/api/orders/track/${lookupInput.trim()}`);
      setTracked(res.order);
      onSelectOrder?.(res.order);
    } catch (err) {
      setError(err.message);
    }
  };

  const stepIndex = tracked ? Math.max(0, STEPS.indexOf(tracked.status)) : 0;
  // Rider position along route (12% -> 90%)
  const riderPct = [14, 30, 48, 76, 90][stepIndex] || 14;

  return (
    <div className="sw-tracker-wrap">
      <div className="sw-tracker-top-card">
        <div>
          <h2>Live Order &amp; Delivery Tracking</h2>
          <p>Real-time kitchen &amp; GPS delivery route synced directly with Radha Swami</p>
        </div>

        <form className="sw-track-search" onSubmit={handleLookup}>
          <Search size={17} />
          <input
            type="text"
            placeholder="Order ID (e.g. ORD-10029)"
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value.toUpperCase())}
          />
          <button type="submit">Track</button>
        </form>
      </div>

      {error && <div className="sw-error-alert">{error}</div>}

      {myOrders.length > 0 && (
        <div className="sw-recent-orders-bar">
          <span>Your Orders:</span>
          {myOrders.slice(0, 6).map((o) => (
            <button
              key={o._id}
              className={`sw-ord-chip ${tracked?.orderNumber === o.orderNumber ? 'active' : ''}`}
              onClick={() => {
                setTracked(o);
                setLookupInput(o.orderNumber);
              }}
            >
              #{o.orderNumber} • {o.status}
            </button>
          ))}
        </div>
      )}

      {tracked && (
        <div className="sw-live-map-card">
          {/* SWIGGY LIVE ROUTE MAP CANVAS */}
          <div className="sw-live-map-banner">
            <svg viewBox="0 0 800 220" className="live-route-svg">
              <rect width="800" height="220" fill="#FFF7ED" />
              {/* City blocks */}
              <rect x="40" y="25" width="160" height="65" rx="10" fill="#FFEDD5" />
              <rect x="260" y="130" width="210" height="65" rx="10" fill="#FFEDD5" />
              <rect x="540" y="30" width="190" height="60" rx="10" fill="#FFEDD5" />

              {/* Road base */}
              <path
                d="M 95 145 C 260 65, 510 175, 705 95"
                stroke="#FED7AA"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
              />
              {/* Active Orange Route */}
              <path
                d="M 95 145 C 260 65, 510 175, 705 95"
                stroke="#FF5200"
                strokeWidth="4.5"
                strokeDasharray="8 6"
                fill="none"
              />
            </svg>

            {/* Shop Origin Pin */}
            <div className="route-pin shop" style={{ left: '11%', top: '60%' }}>
              <span>🏪 Radha Swami</span>
            </div>

            {/* Live Moving Delivery Partner Scooter */}
            <div
              className="route-rider-marker"
              style={{
                left: `${riderPct}%`,
                top: stepIndex === 2 ? '54%' : stepIndex === 3 ? '58%' : '48%'
              }}
            >
              <div className="rider-scooter">🛵</div>
              <span>
                {tracked.status === 'Delivered'
                  ? 'Delivered ✓'
                  : tracked.status === 'Out for Delivery'
                  ? 'On the way!'
                  : tracked.status}
              </span>
            </div>

            {/* Customer Destination Pin */}
            <div className="route-pin dest" style={{ left: '86%', top: '40%' }}>
              <span>🏠 {tracked.deliveryAddress?.label || 'Home'} ({tracked.distanceKm} km)</span>
            </div>

            <div className="map-eta-overlay">
              <Clock size={16} />
              <strong>
                {tracked.status === 'Delivered'
                  ? 'Delivered on time!'
                  : `Arriving in ~${tracked.estimatedMinutes || 20} mins`}
              </strong>
            </div>
          </div>

          {/* ORDER STATUS STEPPER */}
          <div className="sw-status-stepper">
            {STEPS.map((st, idx) => {
              const active = idx <= stepIndex;
              const Icon =
                idx === 0
                  ? Clock
                  : idx === 1
                  ? CheckCircle2
                  : idx === 2
                  ? ChefHat
                  : idx === 3
                  ? Truck
                  : PackageCheck;
              return (
                <div className={`sw-step-item ${active ? 'done' : ''}`} key={st}>
                  <div className="sw-step-dot"><Icon size={17} /></div>
                  <span>{st === 'Pending' ? 'Order Placed' : st}</span>
                </div>
              );
            })}
          </div>

          {/* RIDER + DETAILS */}
          <div className="sw-track-details-grid">
            <div className="sw-track-box">
              <div className="sw-rider-card">
                <div className="rider-av">🛵</div>
                <div style={{ flex: 1 }}>
                  <strong>Rajesh Kumar (Delivery Partner)</strong>
                  <span>★ 4.9 Rating • Live GPS Route Tracking</span>
                </div>
                <span className="call-pill"><PhoneCall size={14} /> Verified</span>
              </div>

              <h4 style={{ margin: '16px 0 8px' }}>Order #{tracked.orderNumber} Summary</h4>
              {tracked.items?.map((it, i) => (
                <div className="sw-track-item" key={i}>
                  <span>{it.quantity} × {it.name} ({it.variantLabel || it.variant})</span>
                  <strong>₹{it.lineTotal}</strong>
                </div>
              ))}

              <div className="sw-track-totals">
                <div><span>Item Subtotal</span><span>₹{tracked.subtotal}</span></div>
                {tracked.discountAmount > 0 && (
                  <div style={{ color: '#1BA672' }}>
                    <span>Coupon ({tracked.couponCode})</span>
                    <span>− ₹{tracked.discountAmount}</span>
                  </div>
                )}
                <div><span>Delivery Fee ({tracked.distanceKm} km)</span><span>₹{tracked.deliveryCharge}</span></div>
                <div className="grand">
                  <strong>Total ({tracked.paymentMethod} • {tracked.paymentStatus})</strong>
                  <strong>₹{tracked.totalAmount}</strong>
                </div>
                {tracked.paymentId && (
                  <small className="gateway-ref">
                    <ShieldCheck size={13} /> Gateway Transaction ID: {tracked.paymentId}
                  </small>
                )}
              </div>
            </div>

            <div className="sw-track-box">
              <h4>Delivering To [{tracked.deliveryAddress?.label || 'Home'}]</h4>
              <p className="dest-addr-line">
                <MapPin size={15} color="#FF5200" />
                <span>
                  {tracked.deliveryAddress?.street}, {tracked.deliveryAddress?.city} - {tracked.deliveryAddress?.pincode}
                </span>
              </p>

              <h4 style={{ margin: '18px 0 10px' }}>Live Status Timeline</h4>
              <div className="sw-timeline">
                {(tracked.statusHistory || []).slice().reverse().map((h, i) => (
                  <div className="sw-tl-row" key={i}>
                    <span className="tl-pip" />
                    <div>
                      <strong>{h.status}</strong>
                      <p>{h.note}</p>
                      <small>{new Date(h.timestamp).toLocaleTimeString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
