const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Sweets', 'Hot Snacks', 'Namkeen & Savory', 'Bengali & Dairy Sweets', 'Festive Gift Boxes']
    },
    description: { type: String, required: true },
    image: { type: String, required: true },
    badge: { type: String, default: '' },
    inStock: { type: Boolean, default: true },
    isVeg: { type: Boolean, default: true },
    prepTimeMins: { type: Number, default: 15 },
    prices: {
      piece: { type: Number, default: null },
      full: { type: Number, default: null },
      half: { type: Number, default: null },
      '250g': { type: Number, default: null },
      '500g': { type: Number, default: null },
      '1kg': { type: Number, default: null }
    },
    portionNotes: {
      piece: { type: String, default: '1 Piece (Single Pc)' },
      full: { type: String, default: 'Full Plate' },
      half: { type: String, default: 'Half Plate' }
    },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
