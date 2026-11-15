const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    variant: { type: String, required: true },
    variantLabel: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: {
      id: { type: String, default: '' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      avatar: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    couponCode: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 },
    distanceKm: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    packagingCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    cookingInstructions: { type: String, default: '' },
    noContactDelivery: { type: Boolean, default: false },
    whatsappOptIn: { type: Boolean, default: false },
    deliveryAgentPhone: { type: String, default: '' },
    whatsappNotificationStatus: {
      type: String,
      enum: ['not_requested', 'waiting_for_agent', 'sending', 'sent', 'failed'],
      default: 'not_requested'
    },
    whatsappNotificationSentFor: { type: String, default: '' },
    deliveryAddress: {
      label: { type: String, default: 'Home' },
      street: { type: String, required: true },
      landmark: { type: String, default: '' },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      lat: { type: Number, default: 24.5485 },
      lng: { type: Number, default: 81.3182 }
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'Netbanking', 'Razorpay', 'Cash on Delivery'],
      default: 'UPI'
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'COD Pending'],
      default: 'Paid'
    },
    paymentId: { type: String, default: '' },
    gatewayOrderId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Pending'
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
      }
    ],
    estimatedMinutes: { type: Number, default: 28 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
