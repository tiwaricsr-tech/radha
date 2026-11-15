const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    orderNumber: { type: String, default: '' },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userAvatar: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    adminReply: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
