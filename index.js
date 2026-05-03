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
        
        const escapeHtml = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const row = (label, value) => {
            if (!value) return '';
            return `
                <tr>
                    <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#4b5563; width:40%;">${escapeHtml(label)}</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#111827; font-weight:600;">${escapeHtml(value)}</td>
                </tr>
            `;
        };

        const adminBookingHtml = `
            <html>
                <body style="margin:0; padding:24px; background:#f3f4f6; font-family:Arial, sans-serif;">
                    <div style="max-width:700px; margin:0 auto; background:#ffffff; border-radius:14px; padding:24px; border:1px solid #e5e7eb;">
                        <div style="text-align:center; margin-bottom:20px;">
                            <img src="cid:logo" alt="AstroSharma" style="width:70px; height:70px; border-radius:999px; object-fit:cover;" />
                            <h2 style="margin:16px 0 6px; color:#4f46e5; font-size:30px;">New Booking Received</h2>
                            <p style="margin:0; color:#6b7280;">A customer has completed payment and booking.</p>
                        </div>
                        <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
                            ${row('Consultation Type', payload.consultationType)}
                            ${row('Price', payload.price)}
                            ${row('Customer Name', payload.fullName)}
                            ${row('Phone', payload.phone)}
                            ${row('Email', payload.email)}
                            ${row('Date of Birth', payload.dob)}
                            ${row('Birth Time', payload.birthTime)}
                            ${row('Birth Place', payload.birthPlace)}
                            ${row('Pincode', payload.pincode)}
                            ${row('Question / Purpose', payload.question || payload.message)}
                            ${row('Bride Name', payload.girlName)}
                            ${row('Bride DoB', payload.girlDob)}
                            ${row('Bride Birth Time', payload.girlTime)}
                            ${row('Bride Birth Place', payload.girlPlace)}
                            ${row('Bride Pincode', payload.girlPincode)}
                            ${row('Groom Name', payload.boyName)}
                            ${row('Groom DoB', payload.boyDob)}
                            ${row('Groom Birth Time', payload.boyTime)}
                            ${row('Groom Birth Place', payload.boyPlace)}
                            ${row('Groom Pincode', payload.boyPincode)}
                            ${row('Extra Person Added', payload.extraPersonType !== 'none' && payload.extraPersonType ? payload.extraPersonType.toUpperCase() : '')}
                            ${row('Bride 2 Name', payload.girl2Name)}
                            ${row('Bride 2 DoB', payload.girl2Dob)}
                            ${row('Bride 2 Birth Time', payload.girl2Time)}
                            ${row('Bride 2 Birth Place', payload.girl2Place)}
                            ${row('Bride 2 Pincode', payload.girl2Pincode)}
                            ${row('Groom 2 Name', payload.boy2Name)}
                            ${row('Groom 2 DoB', payload.boy2Dob)}
                            ${row('Groom 2 Birth Time', payload.boy2Time)}
                            ${row('Groom 2 Birth Place', payload.boy2Place)}
                            ${row('Groom 2 Pincode', payload.boy2Pincode)}
                            ${row('Start Date', payload.startDate)}
                            ${row('End Date', payload.endDate)}
                            ${row('Muhurtham Location', payload.muhurthamLocation)}
                            ${row('Payment ID', payload.razorpay_payment_id)}
                            ${row('Order ID', payload.razorpay_order_id)}
                        </table>
                    </div>
                </body>
            </html>
        `;

        const userBookingHtml = `
            <html>
                <body style="margin:0; padding:24px; background:#f3f4f6; font-family:Arial, sans-serif;">
                    <div style="max-width:700px; margin:0 auto; background:#ffffff; border-radius:14px; padding:24px; border:1px solid #e5e7eb;">
                        <div style="text-align:center; margin-bottom:20px;">
                            <img src="cid:logo" alt="AstroSharma" style="width:88px; height:88px; border-radius:999px; object-fit:cover;" />
                            <h2 style="margin:16px 0 6px; color:#5b3fa3; font-size:46px;">Booking Confirmation</h2>
                        </div>
                        <p style="font-size:18px; color:#4b5563; line-height:1.8; margin:0 0 10px;">Namaste ${escapeHtml(payload.fullName || 'Customer')},</p>
                        <p style="font-size:18px; color:#4b5563; line-height:1.8; margin:0 0 10px;">Thank you for choosing us. We have received your request for ${escapeHtml(payload.consultationType || 'consultation')}.</p>
                        <p style="font-size:18px; color:#4b5563; line-height:1.8; margin:0;">Our team is verifying your payment (UTR: ${escapeHtml(payload.razorpay_payment_id || 'N/A')}). We will contact you shortly.</p>
                    </div>
                </body>
            </html>
        `;

        const adminAttachments = [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }];
        if (req.file) {
            adminAttachments.push({
                filename: req.file.originalname,
                content: req.file.buffer
            });
        }

        const mailOptions = [
            {
                from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                to: adminEmail,
                subject: `New Booking: ${payload.fullName || 'User'}`,
                html: adminBookingHtml,
                attachments: adminAttachments
            },
            {
                from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                to: payload.email,
                subject: 'Booking Received - AstroSharma',
                html: userBookingHtml,
                attachments: [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }]
            }
        ];

        // Wait for email results so frontend can show accurate status.
        const emailResults = await Promise.allSettled(mailOptions.map(opt => transporter.sendMail(opt)));
        const emailFailures = [];
        const bookingMeta = {
            bookingId: newBooking?._id?.toString() || null,
            paymentId: payload.razorpay_payment_id,
            orderId: payload.razorpay_order_id,
            customerEmail: payload.email,
            consultationType: payload.consultationType
        };

        emailResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                console.log(`✅ Email ${index + 1} sent successfully:`, {
                    ...bookingMeta,
                    messageId: result.value.messageId
                });
            } else {
                const reason = result.reason?.message || 'Unknown email error';
                emailFailures.push(`Email ${index + 1}: ${reason}`);
                console.error(`❌ Email ${index + 1} failed:`, {
                    ...bookingMeta,
                    reason,
                    rawError: result.reason
                });
            }
        });

        const emailSent = emailFailures.length === 0;
        const emailError = emailSent ? null : emailFailures.join(' | ');

        if (emailSent) {
            console.log('✅ BOOKING_EMAIL_STATUS: ALL_SENT', bookingMeta);
        } else {
            console.error('❌ BOOKING_EMAIL_STATUS: PARTIAL_OR_FAILED', {
                ...bookingMeta,
                emailError
            });
        }

        res.status(200).json({
            success: true,
            message: `Booking processed ${dbStatus}`,
            bookingId: newBooking?._id,
            emailSent,
            emailError
        });

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
        
        const adminAttachments = [{ filename: 'logo.jpg', path: logoPath, cid: 'logo' }];
        if (req.file) {
            adminAttachments.push({
                filename: req.file.originalname,
                content: req.file.buffer
            });
        }

        const adminMail = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: adminEmail,
            subject: `New Contact: ${firstName}`,
            html: `<h3>New Inquiry from ${firstName} ${lastName}</h3><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br/>${message}</p>`,
            attachments: adminAttachments
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
        (async () => {
            try {
                const results = await Promise.allSettled([
                    transporter.sendMail(adminMail),
                    transporter.sendMail(userMail)
                ]);
                results.forEach((result, index) => {
                    const label = index === 0 ? 'Admin' : 'User';
                    if (result.status === 'fulfilled') {
                        console.log(`✅ ${label} Contact Email sent successfully:`, result.value.messageId);
                    } else {
                        console.error(`❌ ${label} Contact Email failed:`, result.reason);
                    }
                });
            } catch (e) {
                console.error('❌ Background contact email error:', e);
            }
        })();

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
