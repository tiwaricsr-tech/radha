import React, { useState, useEffect } from 'react';
import { Star, Clock, Plus, Minus, MessageCircle } from 'lucide-react';

const VARIANT_ORDER = ['piece', 'half', 'full', '250g', '500g', '1kg'];

export function getAvailableVariants(product) {
  const list = [];
  for (const key of VARIANT_ORDER) {
    const val = product.prices?.[key];
    if (val !== null && val !== undefined && Number(val) > 0) {
      let shortLabel = key.toUpperCase();
      let fullLabel = key.toUpperCase();
      if (key === 'piece') {
        shortLabel = '1 Pc';
        fullLabel = product.portionNotes?.piece || '1 Piece';
      } else if (key === 'half') {
        shortLabel = 'Half';
        fullLabel = product.portionNotes?.half || 'Half Plate';
      } else if (key === 'full') {
        shortLabel = 'Full';
        fullLabel = product.portionNotes?.full || 'Full Plate';
      } else {
        shortLabel = key;
        fullLabel = `${key} Box`;
      }
      list.push({ key, shortLabel, fullLabel, price: Number(val) });
    }
  }
  return list;
}

export default function ProductCard({
  product,
  cart,
  onAddToCart,
  onUpdateQty,
  onOpenReviews
}) {
  const variants = getAvailableVariants(product);
  const [selectedKey, setSelectedKey] = useState(variants[0]?.key || 'piece');

  useEffect(() => {
    if (!variants.some((v) => v.key === selectedKey) && variants.length > 0) {
      setSelectedKey(variants[0].key);
    }
  }, [product, variants, selectedKey]);

  const activeVariant = variants.find((v) => v.key === selectedKey) || variants[0];
  const existingInCart = cart.find(
    (c) => c.productId === product._id && c.variant === activeVariant?.key
  );
  const currentQty = existingInCart?.quantity || 0;

  return (
    <article className={`sw-prod-card ${!product.inStock ? 'soldout' : ''}`}>
      <div className="sw-prod-media">
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.badge && <span className="sw-top-badge">{product.badge}</span>}
        <span className="sw-time-pill"><Clock size={11} /> {product.prepTimeMins || 12} MINS</span>
      </div>

      <div className="sw-prod-body">
        <div className="sw-veg-rating-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sw-veg-sq"><i /></span>
            <span className="sw-cat-lbl">{product.category}</span>
          </div>

          <button className="sw-star-pill" onClick={() => onOpenReviews(product)}>
            <Star size={12} fill="#1BA672" stroke="#1BA672" />
            <strong>{product.rating || 4.9}</strong>
            <span>({product.reviewCount || 0})</span>
          </button>
        </div>

        <h3 className="sw-prod-title">{product.name}</h3>
        <p className="sw-prod-desc">{product.description}</p>

        {/* PIECE / HALF / FULL / WEIGHT PILLS */}
        <div className="sw-variants-box">
          <div className="sw-var-pills">
            {variants.map((v) => (
              <button
                type="button"
                key={v.key}
                className={`sw-var-chip ${activeVariant?.key === v.key ? 'active' : ''}`}
                onClick={() => setSelectedKey(v.key)}
              >
                <span>{v.shortLabel}</span>
                <strong>₹{v.price}</strong>
              </button>
            ))}
          </div>
          {activeVariant?.key === 'piece' && (
            <div className="sw-quick-pcs">
              <span>Quick Add Pieces:</span>
              {[2, 4, 6].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => onAddToCart(product, activeVariant, n)}
                  disabled={!product.inStock}
                >
                  +{n} Pcs
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sw-prod-footer">
          <div className="sw-price-block">
            <strong>₹{activeVariant ? activeVariant.price : '—'}</strong>
            <small>{activeVariant?.fullLabel}</small>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="sw-rev-btn"
              title="Read & Write Reviews"
              onClick={() => onOpenReviews(product)}
            >
              <MessageCircle size={16} />
            </button>

            {/* SWIGGY SIGNATURE ADD / STEPPER BUTTON */}
            {!product.inStock ? (
              <span className="sw-sold-btn">SOLD OUT</span>
            ) : currentQty > 0 ? (
              <div className="sw-card-stepper">
                <button
                  type="button"
                  onClick={() => onUpdateQty(product._id, activeVariant.key, currentQty - 1)}
                >
                  <Minus size={14} />
                </button>
                <strong>{currentQty}</strong>
                <button
                  type="button"
                  onClick={() => onUpdateQty(product._id, activeVariant.key, currentQty + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sw-add-btn"
                onClick={() => onAddToCart(product, activeVariant, 1)}
              >
                ADD <Plus size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
