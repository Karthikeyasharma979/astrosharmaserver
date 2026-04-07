const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // Razorpay Fields
    razorpay_payment_id: { type: String, required: true },
    razorpay_order_id: { type: String, required: true },
    razorpay_signature: { type: String, required: true },

    // Status tracking
    status: { type: String, enum: ['Completed', 'Failed', 'Pending'], default: 'Completed' },

    // Core Consultation Info
    consultationType: { type: String, required: true },
    price: { type: String },
    
    // Primary Client Information
    fullName: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    
    // Standard Consultation Fields
    dob: { type: String },
    birthTime: { type: String },
    birthPlace: { type: String },
    pincode: { type: String },
    question: { type: String },
    
    // Marriage Matching - Bride 1
    girlName: { type: String },
    girlDob: { type: String },
    girlTime: { type: String },
    girlPlace: { type: String },
    girlPincode: { type: String },
    
    // Marriage Matching - Groom 1
    boyName: { type: String },
    boyDob: { type: String },
    boyTime: { type: String },
    boyPlace: { type: String },
    boyPincode: { type: String },

    // Marriage Matching - Bride 2 (Optional)
    girl2Name: { type: String },
    girl2Dob: { type: String },
    girl2Time: { type: String },
    girl2Place: { type: String },
    girl2Pincode: { type: String },

    // Marriage Matching - Groom 2 (Optional)
    boy2Name: { type: String },
    boy2Dob: { type: String },
    boy2Time: { type: String },
    boy2Place: { type: String },
    boy2Pincode: { type: String },

    // Muhurtham Specific
    startDate: { type: String },
    endDate: { type: String },
    muhurthamLocation: { type: String },

}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
