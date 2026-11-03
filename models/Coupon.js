const mongoose = require('mongoose');

// Coupons are created in AstroAdmin and only read here, so keep both copies of this schema in step.
const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, default: '', trim: true },
    discountType: { type: String, enum: ['percentage', 'flat'], required: true },
    discountValue: { type: Number, required: true },
    minAmount: { type: Number, default: 0 },
    // Inclusive dates in Indian time, as YYYY-MM-DD. Empty means no limit on that side.
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    // Total bookings allowed across all customers. Null means unlimited.
    usageLimit: { type: Number, default: null },
    oneUsePerCustomer: { type: Boolean, default: true },
    newCustomersOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Coupon', couponSchema);
