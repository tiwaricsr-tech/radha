const mongoose = require('mongoose');

const deliveryConfigSchema = new mongoose.Schema(
  {
    shopName: { type: String, default: 'Radha Swami' },
    shopAddress: { type: String, default: 'Station Road, Civil Lines, Main Market' },
    shopLat: { type: Number, default: 24.5362 },
    shopLng: { type: Number, default: 81.3037 },
    isStoreOpen: { type: Boolean, default: true },
    cashOnDeliveryEnabled: { type: Boolean, default: true },
    baseDistanceKm: { type: Number, default: 2 },
    baseFee: { type: Number, default: 25 },
    perKmFee: { type: Number, default: 8 },
    packagingCharge: { type: Number, default: 5 },
    freeDeliveryEnabled: { type: Boolean, default: true },
    freeDeliveryMinOrder: { type: Number, default: 999 },
    maxDeliveryDistanceKm: { type: Number, default: 25 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryConfig', deliveryConfigSchema);
