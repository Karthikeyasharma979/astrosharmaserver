const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Load environment variables from .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Connect to MongoDB (for persistent server mode)
let isConnected = false;
const connectToDatabase = async () => {
    if (isConnected) return;
    if (!process.env.MONGO_URI) {
        console.warn('❌ MONGO_URI is missing. Database operations will fail.');
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Wait 5 seconds for server selection
            connectTimeoutMS: 10000,        // Wait 10 seconds for initial connection
        });
        isConnected = true;
        console.log('✅ MongoDB successfully connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        // Important: don't throw here so server can still serve non-db routes
    }
};

// Initial connect
connectToDatabase().catch(err => console.error('Initial DB Connect failed:', err));

const Booking = require('./models/Booking');
const Contact = require('./models/Contact');

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(compression());
app.use(helmet());

const normalizeUrl = (url) => url ? url.replace(/\/$/, '') : '';
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://astrosharma.vercel.app',
    normalizeUrl(process.env.FRONTEND_URL)
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const normalizedOrigin = normalizeUrl(origin);
        if (allowedOrigins.includes(normalizedOrigin) || !process.env.FRONTEND_URL) {
            return callback(null, true);
        }
        callback(new Error('CORS BLOCKED'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { success: false, message: 'Too many requests.' }
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const logoPath = path.join(__dirname, 'logo_icon.jpg');

app.post('/api/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        const order = await razorpay.orders.create({
            amount: Math.round(Number(amount) * 100),
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`
        });
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const bookingSchema = Joi.object({
    razorpay_payment_id: Joi.string().required(),
    razorpay_order_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    consultationType: Joi.string().required()
}).unknown(true);

app.post('/api/book-consultation', apiLimiter, upload.single('screenshot'), async (req, res) => {
    try {
        await connectToDatabase();
        const { fileTypeFromBuffer } = await import('file-type');
        const { error } = bookingSchema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: 'Validation Error', errors: error.details.map(d => d.message) });

        const payload = req.body;
        const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(payload.razorpay_order_id + "|" + payload.razorpay_payment_id).digest('hex');

        if (generated_signature !== payload.razorpay_signature) return res.status(400).json({ success: false, message: 'Payment Verification Failed' });

        let dbStatus = 'and saved to database';
        let newBooking = null;
        try {
            newBooking = new Booking(payload);
            await newBooking.save();
            console.log('✅ SUCCESS: Booking stored in MongoDB');
        } catch (dbError) {
            console.error('❌ DB ERROR:', dbError.message);
            dbStatus = `but failed to save to database (Error: ${dbError.message})`;
        }

        // --- Optimized Email Sending (Parallel & Non-Blocking) ---
        const transporter = createTransporter();
        const adminEmail = process.env.ADMIN_EMAIL;
        
        const createEmailTemplate = (title, msg, details) => `<html><body style="font-family:sans-serif;"><h2>${title}</h2><p>${msg}</p>${details}</body></html>`;
        
        const mailOptions = [
            {
                from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                to: adminEmail,
                subject: `New Booking: ${payload.fullName || 'User'}`,
                html: createEmailTemplate("New Booking", "A new booking has been received.", `<pre>${JSON.stringify(payload, null, 2)}</pre>`),
                attachments: [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }]
            },
            {
                from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                to: payload.email,
                subject: 'Booking Received - AstroSharma',
                html: createEmailTemplate("Booking Confirmation", "We received your booking for " + payload.consultationType, "<p>Thank you!</p>"),
                attachments: [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }]
            }
        ];

        // RESPOND IMMEDIATELY TO DECREASE LOADING TIME
        res.status(200).json({ success: true, message: `Booking processed ${dbStatus}`, bookingId: newBooking?._id });

        // Background tasks
        Promise.allSettled(mailOptions.map(opt => transporter.sendMail(opt)))
            .then(results => console.log('Emails processed'))
            .catch(e => console.error('Background email error:', e));

    } catch (error) {
        console.error('General Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

const contactSchema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    message: Joi.string().required()
}).unknown(true);

app.post('/api/contact', apiLimiter, upload.single('image'), async (req, res) => {
    try {
        await connectToDatabase();
        const { error } = contactSchema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: 'Validation Error' });

        const { firstName, lastName, email, message } = req.body;
        let dbStatus = 'and saved to database';
        try {
            const newContact = new Contact({ firstName, lastName, email, message });
            await newContact.save();
        } catch (dbError) {
            dbStatus = `but failed to save to database (Error: ${dbError.message})`;
        }

        const transporter = createTransporter();
        const adminEmail = process.env.ADMIN_EMAIL;
        
        const adminMail = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: adminEmail,
            subject: `New Contact: ${firstName}`,
            html: `<h3>New Inquiry from ${firstName} ${lastName}</h3><p>${message}</p>`,
            attachments: [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }]
        };

        const userMail = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: email,
            subject: 'Message Received - AstroSharma',
            html: `<h3>Namaste ${firstName}</h3><p>We received your message.</p>`,
            attachments: [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }]
        };

        // RESPOND IMMEDIATELY
        res.status(200).json({ success: true, message: `Message sent successfully ${dbStatus}` });

        // Background tasks
        Promise.allSettled([transporter.sendMail(adminMail), transporter.sendMail(userMail)]);

    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/api/payment-config', (req, res) => {
    res.json({ upiId: process.env.PAYMENT_UPI_ID, merchantName: process.env.PAYMENT_MERCHANT_NAME });
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;
