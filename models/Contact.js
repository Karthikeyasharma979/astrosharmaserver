const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    hasAttachment: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema);
