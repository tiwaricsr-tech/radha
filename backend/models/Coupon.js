const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['percentage', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    description: { type: String, default: '' },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
