const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    authorName: {
        type: String,
        trim: true,
        default: function() {
            return this.name;
        }
    },
    location: { 
        type: String, 
        default: 'ఆంధ్రప్రదేశ్ / తెలంగాణ',
        trim: true
    },
    category: { 
        type: String, 
        default: 'marriage' 
    },
    service: { 
        type: String, 
        required: true,
        trim: true
    },
    serviceName: {
        type: String,
        trim: true,
        default: function() {
            return this.service;
        }
    },
    rating: { 
        type: Number, 
        min: 1, 
        max: 5, 
        default: 5 
    },
    comment: { 
        type: String, 
        required: true,
        trim: true
    },
    verified: { 
        type: Boolean, 
        default: true 
    },
    isVerifiedBooking: {
        type: Boolean,
        default: true
    },
    likes: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: String, 
        enum: ['approved', 'pending', 'flagged', 'rejected'], 
        default: 'approved' 
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    adminNotes: {
        type: String,
        default: ''
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);
