const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: undefined },
    passwordHash: { type: String, default: '' },
    passwordSalt: { type: String, default: '' },
    avatar: { type: String, default: '' },
    googleId: { type: String, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    phone: { type: String, default: '' },
    savedAddress: {
      street: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, default: '' },
      pincode: { type: String, default: '' },
      distanceKm: { type: Number, default: 3.5 }
    }
  },
  { timestamps: true, autoIndex: false }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });

module.exports = mongoose.model('User', userSchema);
