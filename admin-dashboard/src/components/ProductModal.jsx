import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';

const PRESET_IMAGES = [
  { label: 'Kaju Katli', url: '/uploads/images/kaju-katli.jpg' },
  { label: 'Punjabi Samosa', url: '/uploads/images/punjabi-samosa.jpg' },
  { label: 'Motichoor Ladoo', url: '/uploads/images/motichoor-ladoo.jpg' },
  { label: 'Gulab Jamun', url: '/uploads/images/gulab-jamun.jpg' },
  { label: 'Kesar Rasmalai', url: '/uploads/images/rasmalai.jpg' },
  { label: 'Raj Kachori', url: '/uploads/images/raj-kachori.jpg' },
  { label: 'Kesar Jalebi', url: '/uploads/images/kesar-jalebi.jpg' },
  { label: 'Kesar Peda', url: '/uploads/images/kesar-peda.jpg' },
  { label: 'Bikaneri Bhujia', url: '/uploads/images/bikaneri-bhujia.jpg' },
  { label: 'Gift Box', url: '/uploads/images/festive-gift-box.jpg' }
];

const CATEGORIES = [
  'Sweets',
  'Hot Snacks',
  'Bengali & Dairy Sweets',
  'Namkeen & Savory',
  'Festive Gift Boxes'
];

const PRICE_KEYS = [
  { key: 'piece', label: '1 PIECE (₹/Pc)' },
  { key: 'half', label: 'HALF' },
  { key: 'full', label: 'FULL' },
  { key: '250g', label: '250G' },
  { key: '500g', label: '500G' },
  { key: '1kg', label: '1KG' }
];

export default function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    category: 'Sweets',
    description: '',
    image: '/uploads/images/kaju-katli.jpg',
    badge: 'Freshly Made',
    inStock: true,
    prepTimeMins: 12,
    prices: {
      piece: '',
      full: '',
      half: '',
      '250g': '',
      '500g': '',
      '1kg': ''
    },
    portionNotes: {
      piece: '1 Piece (Single Pc)',
      full: 'Full Plate',
      half: 'Half Plate'
    }
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        category: product.category || 'Sweets',
        description: product.description || '',
        image: product.image || '/uploads/images/kaju-katli.jpg',
        badge: product.badge || '',
        inStock: product.inStock !== false,
        prepTimeMins: product.prepTimeMins || 12,
        prices: {
          piece: product.prices?.piece ?? '',
          full: product.prices?.full ?? '',
          half: product.prices?.half ?? '',
          '250g': product.prices?.['250g'] ?? '',
          '500g': product.prices?.['500g'] ?? '',
          '1kg': product.prices?.['1kg'] ?? ''
        },
        portionNotes: {
          piece: product.portionNotes?.piece || '1 Piece (Single Pc)',
          full: product.portionNotes?.full || 'Full Plate',
          half: product.portionNotes?.half || 'Half Plate'
        }
      });
    }
  }, [product]);

  const handlePrice = (key, val) => {
    setForm((prev) => ({
      ...prev,
      prices: { ...prev.prices, [key]: val === '' ? '' : Number(val) }
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, image: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        prices: {
          piece: form.prices.piece ? Number(form.prices.piece) : null,
          full: form.prices.full ? Number(form.prices.full) : null,
          half: form.prices.half ? Number(form.prices.half) : null,
          '250g': form.prices['250g'] ? Number(form.prices['250g']) : null,
          '500g': form.prices['500g'] ? Number(form.prices['500g']) : null,
          '1kg': form.prices['1kg'] ? Number(form.prices['1kg']) : null
        }
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{product ? `Edit "${product.name}"` : 'Add New Sweet or Snack'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="error-banner">{err}</div>}

          <div className="form-grid-2">
            <div className="field">
              <label>Product Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Kesar Pista Barfi"
                required
              />
            </div>

            <div className="field">
              <label>Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Description *</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ingredients, taste notes, serving style..."
              required
            />
          </div>

          <div className="form-grid-3">
            <div className="field">
              <label>Highlight Badge</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="Bestseller / Hot & Fresh"
              />
            </div>
            <div className="field">
              <label>Prep Time (mins)</label>
              <input
                type="number"
                min={1}
                value={form.prepTimeMins}
                onChange={(e) => setForm({ ...form, prepTimeMins: Number(e.target.value) })}
              />
            </div>
            <div className="field checkbox-field">
              <label>Availability</label>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
                />
                <span>{form.inStock ? 'In Stock (Live on Menu)' : 'Sold Out'}</span>
              </label>
            </div>
          </div>

          <div className="pricing-section-box">
            <h4>Piece, Portion &amp; Weight Prices (₹) — Leave blank if not offered</h4>
            <div className="price-inputs-row six">
              {PRICE_KEYS.map(({ key, label }) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    value={form.prices[key]}
                    onChange={(e) => handlePrice(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="form-grid-3" style={{ marginTop: 10 }}>
              <div className="field">
                <label>1 Piece Note</label>
                <input
                  type="text"
                  value={form.portionNotes.piece}
                  onChange={(e) =>
                    setForm({ ...form, portionNotes: { ...form.portionNotes, piece: e.target.value } })
                  }
                  placeholder="1 Hot Samosa / 1 Pc"
                />
              </div>
              <div className="field">
                <label>Half Portion Label</label>
                <input
                  type="text"
                  value={form.portionNotes.half}
                  onChange={(e) =>
                    setForm({ ...form, portionNotes: { ...form.portionNotes, half: e.target.value } })
                  }
                  placeholder="Half Plate (2 pcs)"
                />
              </div>
              <div className="field">
                <label>Full Portion Label</label>
                <input
                  type="text"
                  value={form.portionNotes.full}
                  onChange={(e) =>
                    setForm({ ...form, portionNotes: { ...form.portionNotes, full: e.target.value } })
                  }
                  placeholder="Full Plate (4 pcs)"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label>Product Photo (Upload File, Paste URL, or Choose Studio Photo)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                style={{ flex: 1 }}
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="/uploads/images/kaju-katli.jpg"
              />
              <label className="upload-pill-btn">
                <Upload size={14} /> Upload Photo
                <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
              </label>
            </div>
            <div className="preset-thumbs">
              {PRESET_IMAGES.map((img) => (
                <button
                  type="button"
                  key={img.url}
                  className={`thumb-choice ${form.image === img.url ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, image: img.url })}
                >
                  <img src={img.url} alt={img.label} />
                  <span>{img.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-orange-primary" disabled={saving}>
              {saving ? 'Saving & Syncing...' : product ? 'Update & Sync Instantly' : 'Add Product to Live Menu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
