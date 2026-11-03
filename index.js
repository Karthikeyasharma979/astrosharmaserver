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
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');

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
const Review = require('./models/Review');
const Coupon = require('./models/Coupon');

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
        if (
            process.env.NODE_ENV !== 'production' ||
            allowedOrigins.includes(normalizedOrigin) ||
            normalizedOrigin.includes('192.168.') ||
            normalizedOrigin.includes('localhost') ||
            normalizedOrigin.includes('.loca.lt') ||
            normalizedOrigin.includes('.ngrok') ||
            normalizedOrigin.includes('trycloudflare.com') ||
            normalizedOrigin.includes('.devtunnels.ms') ||
            !process.env.FRONTEND_URL
        ) {
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

// A copy of the website's pricing code, so the displayed and charged prices follow the same rules.
// See scripts/sync-shared.js: run it after changing the original, and deploy both together.
const { quoteConsultation, quoteAdminCoupon, isBuiltInCouponCode, formatRupees } = require('./shared/utils/consultationPricing.js');

const NO_LOYALTY = { isValuableCustomer: false, isVipEligible: false, bookingCount: 0 };

// Booking-history filters that identify a customer by phone number or email
const getCustomerConditions = (phone, email) => {
    const conditions = [];
    if (phone) {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
        if (cleanPhone.length >= 10) {
            conditions.push({ phone: { $regex: cleanPhone } });
        }
    }
    if (email) {
        conditions.push({ email: String(email).trim().toLowerCase() });
    }
    return conditions;
};

/**
 * Loyalty / repeat-customer status from booking history.
 * Throws when the database cannot be queried, so callers can decide how to degrade.
 */
const computeLoyaltyInfo = async (phone, email) => {
    if (!phone && !email) return NO_LOYALTY;

    await connectToDatabase();
    if (!isConnected) throw new Error('Database unavailable');

    const orConditions = getCustomerConditions(phone, email);

    if (orConditions.length === 0) return NO_LOYALTY;

        const bookings = await Booking.find({
            $or: orConditions,
            status: { $ne: 'Failed' }
        }).sort({ createdAt: 1 }).select('couponCode isVipOrder createdAt status').lean();

        const count = bookings.length;

        if (count > 0) {
            let tier = 'Silver Seeker';
            let tierTe = 'రజత శ్రేణి సాధకులు';
            let perk = 'Priority Astrologer Callback';
            if (count >= 3) {
                tier = 'Platinum Patron';
                tierTe = 'పరమ విశిష్ట ఆత్మీయులు';
                perk = 'VIP Same-Day Callback & Dedicated Remedy Consultation';
            } else if (count >= 2) {
                tier = 'Gold Seeker';
                tierTe = 'స్వర్ణ శ్రేణి ఆత్మీయులు';
                perk = 'VIP Priority Callback within 12 Hours';
            }

            const VIP_CODES = ['LOYALTY25', 'VIPLOYALTY', 'VALUEDCLIENT', 'PARAM25', 'RETURNING', 'VIP', 'LOYALTY'];
            let lastVipIndex = 0; // 1-based index among completed bookings
            bookings.forEach((b, idx) => {
                const code = String(b.couponCode || '').trim().toUpperCase();
                if (b.isVipOrder || VIP_CODES.includes(code)) {
                    lastVipIndex = idx + 1;
                }
            });

            // Rules:
            // 1. Minimum 2 completed paid orders before becoming eligible for first VIP coupon
            // 2. Gap of at least 1 regular order between VIP coupon uses (alternate orders)
            const minOrdersRequired = 2;
            const gapRequired = 1;
            const hasMinOrders = count >= minOrdersRequired;
            const ordersSinceLastVip = lastVipIndex > 0 ? (count - lastVipIndex) : Infinity;
            const isVipEligible = hasMinOrders && (ordersSinceLastVip >= gapRequired);

            let ordersUntilNextVip = 0;
            let vipReason = '';
            if (!hasMinOrders) {
                ordersUntilNextVip = minOrdersRequired - count;
                vipReason = `Complete ${ordersUntilNextVip} more consultation to unlock 25% VIP Dakshina blessing (requires 2 completed paid orders).`;
            } else if (ordersSinceLastVip < gapRequired) {
                ordersUntilNextVip = gapRequired - ordersSinceLastVip;
                vipReason = `VIP blessing was applied on your previous booking (#${lastVipIndex}). Complete 1 regular consultation to unlock it again (Alternate orders policy).`;
            } else {
                ordersUntilNextVip = 0;
                vipReason = '25% VIP Dakshina Blessing is unlocked and ready to apply!';
            }

            return {
                isValuableCustomer: true,
                isVipEligible,
                bookingCount: count,
                nextConsultationNumber: count + 1,
                lastVipBookingIndex: lastVipIndex,
                ordersSinceLastVip,
                ordersUntilNextVip,
                vipReason,
                tier,
                tierTe,
                perk,
                loyaltyCode: 'LOYALTY25',
                discountPercent: 25
            };
        }

    return NO_LOYALTY;
};

/**
 * Server-side quote for a booking. When the booking history cannot be read, the customer is
 * treated as new and non-VIP: first-booking offers stay usable, loyalty discounts do not.
 */
const quoteForCustomer = async ({ consultationTypeId, couponCode, phone, email }) => {
    const code = String(couponCode || '').trim().toUpperCase();
    if (code && !isBuiltInCouponCode(code)) {
        return quoteForAdminCoupon({ consultationTypeId, code, phone, email });
    }

    let loyaltyInfo = NO_LOYALTY;
    try {
        loyaltyInfo = await computeLoyaltyInfo(phone, email);
    } catch (err) {
        console.warn('Loyalty lookup unavailable for quote, assuming new customer:', err.message);
    }
    return quoteConsultation({
        consultationTypeId,
        couponCode,
        isNewUser: !(Number(loyaltyInfo.bookingCount) > 0),
        loyaltyInfo
    });
};

/**
 * Server-side quote for a coupon created in AstroAdmin. Its limits come from the database,
 * so when that can't be read the coupon is refused rather than given away.
 */
const quoteForAdminCoupon = async ({ consultationTypeId, code, phone, email }) => {
    try {
        await connectToDatabase();
        if (!isConnected) throw new Error('Database unavailable');

        const coupon = await Coupon.findOne({ code }).lean();
        const customerConditions = getCustomerConditions(phone, email);
        const usedWithCode = { couponCode: code, status: { $ne: 'Failed' } };
        const [totalUses, customerUses, loyaltyInfo] = await Promise.all([
            Booking.countDocuments(usedWithCode),
            customerConditions.length > 0 ? Booking.countDocuments({ ...usedWithCode, $or: customerConditions }) : 0,
            computeLoyaltyInfo(phone, email)
        ]);

        return quoteAdminCoupon({
            consultationTypeId,
            couponCode: code,
            coupon,
            totalUses,
            customerUses,
            hasCustomerDetails: customerConditions.length > 0,
            isNewUser: !(Number(loyaltyInfo.bookingCount) > 0)
        });
    } catch (err) {
        console.error('Could not check admin coupon:', err.message);
        return { valid: false, message: 'We could not check this coupon right now. Please try again.' };
    }
};

const createOrderSchema = Joi.object({
    consultationTypeId: Joi.string().required(),
    couponCode: Joi.string().allow('').max(40),
    phone: Joi.string().allow('').max(20),
    email: Joi.string().allow('').max(254)
}).unknown(true);

app.post('/api/create-order', apiLimiter, async (req, res) => {
    try {
        const { error } = createOrderSchema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: 'Please select a consultation type and try again.' });

        const { consultationTypeId, couponCode, phone, email } = req.body;
        // Any client-sent "amount" is ignored: the price is computed here
        const quote = await quoteForCustomer({ consultationTypeId, couponCode, phone, email });
        if (!quote.valid) {
            return res.status(400).json({ success: false, couponRejected: Boolean(couponCode), message: quote.message });
        }

        const order = await razorpay.orders.create({
            amount: quote.finalAmount * 100,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
            notes: {
                consultationTypeId,
                couponCode: quote.couponCode,
                baseAmount: String(quote.baseAmount),
                discountAmount: String(quote.discountAmount),
                finalAmount: String(quote.finalAmount)
            }
        });
        res.json({ success: true, order, quote });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Lets the booking page check a coupon before payment. Create-order checks it again when charging.
app.post('/api/validate-coupon', apiLimiter, async (req, res) => {
    try {
        const { error } = createOrderSchema.validate(req.body);
        if (error) return res.status(400).json({ valid: false, message: 'Please select a consultation type and try again.' });

        const { consultationTypeId, couponCode, phone, email } = req.body;
        res.json(await quoteForCustomer({ consultationTypeId, couponCode, phone, email }));
    } catch (error) {
        console.error('Coupon check error:', error.message);
        res.status(500).json({ valid: false, message: 'We could not check this coupon right now. Please try again.' });
    }
});

// Endpoint to check customer loyalty / repeat customer status
app.get('/api/customer-loyalty', async (req, res) => {
    try {
        const { phone, email } = req.query;
        res.json(await computeLoyaltyInfo(phone, email));
    } catch (err) {
        console.error('Customer loyalty check error:', err.message);
        res.json(NO_LOYALTY);
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

        // The signature proves the payment belongs to this order; the order (created server-side)
        // proves what was supposed to be charged. Never trust client-sent price fields.
        let order, payment;
        try {
            [order, payment] = await Promise.all([
                razorpay.orders.fetch(payload.razorpay_order_id),
                razorpay.payments.fetch(payload.razorpay_payment_id)
            ]);
        } catch (fetchErr) {
            console.error('❌ Razorpay lookup failed during booking:', fetchErr.message);
            return res.status(502).json({ success: false, message: 'Could not confirm your payment with Razorpay. If money was deducted, please contact support with your payment ID.' });
        }

        const notes = order.notes || {};
        let expectedPaise;
        if (notes.finalAmount) {
            expectedPaise = Number(notes.finalAmount) * 100;
        } else {
            // Order created before server-side pricing existed: re-quote from the booking itself
            const quote = await quoteForCustomer({
                consultationTypeId: payload.consultationTypeId,
                couponCode: payload.couponCode,
                phone: payload.phone,
                email: payload.email
            });
            expectedPaise = quote.valid ? quote.finalAmount * 100 : NaN;
        }

        const paymentOk = payment.order_id === order.id
            && ['captured', 'authorized'].includes(payment.status)
            && Number(payment.amount) === Number(order.amount)
            && Number(order.amount) >= expectedPaise;
        if (!paymentOk) {
            console.error('❌ PAYMENT AMOUNT MISMATCH', {
                orderId: order.id, paymentId: payment.id, paymentStatus: payment.status,
                paidPaise: payment.amount, orderPaise: order.amount, expectedPaise, notes
            });
            return res.status(400).json({ success: false, message: 'Payment amount does not match the selected consultation. Please contact support with your payment ID for a refund.' });
        }

        // Replace client-supplied pricing/status with verified values
        const paidRupees = Number(payment.amount) / 100;
        const baseRupees = Number(notes.baseAmount) || paidRupees;
        delete payload.status;
        delete payload.isVipOrder;
        delete payload.isRepeatCustomer;
        delete payload.bookingNumber;
        payload.consultationTypeId = notes.consultationTypeId || payload.consultationTypeId;
        payload.price = formatRupees(baseRupees);
        payload.originalPrice = baseRupees;
        payload.finalPrice = paidRupees;
        payload.discountAmount = Math.max(0, baseRupees - paidRupees);
        payload.couponCode = notes.finalAmount ? (notes.couponCode || '') : String(payload.couponCode || '');

        let dbStatus = 'and saved to database';
        let newBooking = null;
        try {
            if (!process.env.MONGO_URI) {
                console.warn('⚠️ MONGO_URI not found. Skipping database storage.');
                dbStatus = 'but MongoDB URI not configured';
            } else {
                await connectToDatabase();
                
                // Tag the booking as testing or production based on the environment
                payload.environment = process.env.NODE_ENV === 'production' ? 'production' : 'testing';

                // Detect if this is a valuable repeat customer
                let repeatCount = 0;
                if (payload.phone) {
                    const cleanPhone = String(payload.phone).replace(/[^0-9]/g, '').slice(-10);
                    repeatCount = await Booking.countDocuments({ phone: { $regex: cleanPhone }, status: { $ne: 'Failed' } });
                }
                if (repeatCount > 0) {
                    payload.isRepeatCustomer = true;
                    payload.bookingNumber = repeatCount + 1;
                }

                // Tag whether VIP coupon was used on this booking
                const VIP_CODES = ['LOYALTY25', 'VIPLOYALTY', 'VALUEDCLIENT', 'PARAM25', 'RETURNING', 'VIP', 'LOYALTY'];
                const appliedCode = String(payload.couponCode || '').trim().toUpperCase();
                payload.isVipOrder = VIP_CODES.includes(appliedCode);
                
                newBooking = new Booking(payload);
                await newBooking.save();
                console.log('✅ SUCCESS: Booking stored in MongoDB', payload.isRepeatCustomer ? `(Valued Repeat Customer #${payload.bookingNumber}${payload.isVipOrder ? ' [VIP Coupon Applied]' : ''})` : '');
            }
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
                            ${row('⭐ Customer Loyalty', payload.isRepeatCustomer ? `👑 VALUED RETURNING CLIENT (#${payload.bookingNumber}) - PRIORITY CALLBACK!` : '🌸 First-Time Seeker')}
                            ${row('Consultation Type', payload.consultationType)}
                            ${row('Base Price', payload.price)}
                            ${row('Applied Coupon', payload.couponCode)}
                            ${row('Discount Saved', payload.discountAmount ? '₹' + payload.discountAmount : '')}
                            ${row('Final Dakshina Paid', payload.finalPrice ? '₹' + payload.finalPrice : '')}
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
                        ${payload.isRepeatCustomer ? `
                        <div style="background:#fef3c7; border:1px solid #f59e0b; padding:14px; border-radius:10px; margin-bottom:18px; color:#92400e; font-size:15px; font-weight:bold;">
                            👑 Welcome Back, Esteemed Returning Client! Thank you for your continued faith in AstroSharma. Your consultation (#${payload.bookingNumber}) is automatically prioritized in our queue.
                        </div>` : ''}
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

// Visitor-supplied text must never be interpreted as HTML inside outgoing emails
const escapeEmailHtml = (value = '') => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
            html: `<h3>New Inquiry from ${escapeEmailHtml(firstName)} ${escapeEmailHtml(lastName)}</h3><p><strong>Email:</strong> ${escapeEmailHtml(email)}</p><p><strong>Message:</strong><br/>${escapeEmailHtml(message).replace(/\r?\n/g, '<br/>')}</p>`,
            attachments: adminAttachments
        };

        const userMail = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: email,
            subject: 'Message Received - AstroSharma',
            html: `<h3>Namaste ${escapeEmailHtml(firstName)}</h3><p>We received your message.</p>`,
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

app.post('/api/payments/receipt', async (req, res) => {
    try {
        const { clientName, phoneNumber, serviceBooked, transactionId, date } = req.body;

        // Amount comes from Razorpay, never from the request body
        let amount;
        try {
            const payment = await razorpay.payments.fetch(String(transactionId || ''));
            amount = String(Number(payment.amount) / 100);
        } catch {
            return res.status(400).json({ success: false, message: 'Unknown payment ID' });
        }

        const templatePath = path.join(__dirname, 'templates', 'receipt-template.hbs');
        const templateHtml = fs.readFileSync(templatePath, 'utf8');

        const template = handlebars.compile(templateHtml);
        const finalHtml = template({
            clientName: clientName || 'Customer',
            phoneNumber: phoneNumber || 'N/A',
            serviceBooked: serviceBooked || 'Consultation',
            transactionId: transactionId || 'N/A',
            amount: amount || '0.00',
            date: date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
            receiptNumber: `RCPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            frontendUrl: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:5173'
        });

        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        const pdfBytes = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', bottom: '20px' }
        });

        await browser.close();

        const pdfBuffer = Buffer.from(pdfBytes);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=AstroSharma_Receipt_${transactionId || 'new'}.pdf`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Receipt generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate receipt' });
    }
});

app.get('/api/payment-config', (req, res) => {
    res.json({ upiId: process.env.PAYMENT_UPI_ID, merchantName: process.env.PAYMENT_MERCHANT_NAME });
});

app.get('/api/download-receipt/:transactionId', async (req, res) => {
    try {
        await connectToDatabase();
        const booking = await Booking.findOne({ razorpay_payment_id: req.params.transactionId });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const templatePath = path.join(__dirname, 'templates', 'receipt-template.hbs');
        const templateHtml = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateHtml);
        
        const finalHtml = template({
            clientName: booking.fullName || 'Customer',
            phoneNumber: booking.phone || 'N/A',
            serviceBooked: booking.consultationType || 'Consultation',
            transactionId: booking.razorpay_payment_id || 'N/A',
            amount: booking.finalPrice != null ? String(booking.finalPrice) : (booking.price || 'N/A'),
            date: new Date(booking.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
            receiptNumber: `RCPT-${new Date(booking.createdAt).getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            frontendUrl: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:5173'
        });

        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        const pdfBytes = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', bottom: '20px' }
        });
        await browser.close();

        const pdfBuffer = Buffer.from(pdfBytes);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=AstroSharma_Receipt_${booking.razorpay_payment_id || 'new'}.pdf`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Download Receipt error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate receipt' });
    }
});


app.get('/api/track/:transactionId', async (req, res) => {
    try {
        await connectToDatabase();
        const queryId = req.params.transactionId?.trim();
        if (!queryId) {
            return res.status(400).json({ success: false, message: 'Please provide a valid transaction ID or phone number' });
        }

        const booking = await Booking.findOne({
            $or: [
                { razorpay_payment_id: queryId },
                { phone: queryId }
            ]
        }).sort({ createdAt: -1 });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'No consultation booking found with this ID or phone number' });
        }

        const maskedPhone = booking.phone && booking.phone.length >= 6
            ? `${booking.phone.slice(0, 2)}******${booking.phone.slice(-2)}`
            : booking.phone;

        // A phone number is easy to know or guess; only the payment ID unlocks private details
        const byPaymentId = booking.razorpay_payment_id === queryId;
        const maskName = (name) => String(name || '').split(/\s+/).filter(Boolean)
            .map(w => w[0] + '•'.repeat(Math.max(1, w.length - 1))).join(' ');

        res.json({
            success: true,
            booking: {
                fullName: byPaymentId ? booking.fullName : maskName(booking.fullName),
                consultationType: booking.consultationType,
                date: booking.createdAt,
                status: booking.status || 'Pending',
                progressStep: booking.progressStep || null,
                astrologerUpdateNote: byPaymentId ? (booking.astrologerUpdateNote || null) : null,
                price: booking.finalPrice != null ? `₹${booking.finalPrice}` : booking.price,
                transactionId: byPaymentId ? booking.razorpay_payment_id : null,
                maskedPhone: maskedPhone,
                question: byPaymentId ? (booking.question || null) : null,
                girlName: byPaymentId ? (booking.girlName || null) : null,
                boyName: byPaymentId ? (booking.boyName || null) : null
            }
        });
    } catch (error) {
        console.error('Tracking Error:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving status' });
    }
});

// Review Endpoints
const reviewValidationSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100),
    authorName: Joi.string().trim().min(2).max(100),
    location: Joi.string().trim().max(100).allow('').default('ఆంధ్రప్రదేశ్ / తెలంగాణ'),
    category: Joi.string().valid('marriage', 'career', 'muhurtham', 'other').default('marriage'),
    service: Joi.string().trim(),
    serviceName: Joi.string().trim(),
    rating: Joi.number().integer().min(1).max(5).default(5),
    comment: Joi.string().trim().min(5).max(1000).required()
}).or('name', 'authorName').unknown(true);

// GET /api/reviews - Get approved reviews from MongoDB database with dynamic aggregate stats
app.get('/api/reviews', async (req, res) => {
    try {
        await connectToDatabase();
        if (!isConnected) {
            return res.json({ 
                success: true, 
                reviews: [], 
                data: [], 
                stats: { totalConsultations: 380, averageRating: 4.9, totalReviews: 0, satisfactionRate: 99.2 },
                offline: true 
            });
        }
        const reviews = await Review.find({ 
            status: { $in: ['approved'] },
            isDeleted: { $ne: true }
        }).sort({ createdAt: -1 }).limit(100);

        // Dynamically compute real aggregate statistics
        const totalBookings = await Booking.countDocuments({ status: { $ne: 'Failed' } });
        const validRatings = reviews.filter(r => typeof r.rating === 'number' && r.rating > 0);
        const reviewCount = validRatings.length;

        let avgRating = 4.9;
        let satisfactionRate = 99.2;

        if (reviewCount > 0) {
            const sumRatings = validRatings.reduce((sum, r) => sum + r.rating, 0);
            avgRating = Number((sumRatings / reviewCount).toFixed(1));
            const positiveRatings = validRatings.filter(r => r.rating >= 4).length;
            satisfactionRate = Number(((positiveRatings / reviewCount) * 100).toFixed(1));
        }

        res.json({ 
            success: true, 
            reviews, 
            data: reviews,
            stats: {
                totalConsultations: Math.max(totalBookings, 380),
                totalReviews: reviewCount,
                averageRating: avgRating,
                satisfactionRate: satisfactionRate
            }
        });
    } catch (error) {
        console.error('Fetch Reviews Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
});

// POST /api/reviews - Anyone can add a dynamic review to the database
app.post('/api/reviews', apiLimiter, async (req, res) => {
    try {
        const { error, value } = reviewValidationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const reviewerName = value.name || value.authorName;
        const reviewService = value.service || value.serviceName || 'వివాహ పొంతన (Marriage Matching)';

        await connectToDatabase();
        if (!isConnected) {
            // DB not connected: return graceful simulated response
            return res.status(201).json({
                success: true,
                message: 'Review saved locally (DB not connected)',
                review: { 
                    ...value, 
                    name: reviewerName,
                    authorName: reviewerName,
                    service: reviewService,
                    serviceName: reviewService,
                    _id: `local_${Date.now()}`, 
                    createdAt: new Date(), 
                    verified: false, 
                    likes: 0 
                }
            });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        const newReview = new Review({
            name: reviewerName,
            authorName: reviewerName,
            location: value.location || 'ఆంధ్రప్రదేశ్ / తెలంగాణ',
            category: value.category || 'marriage',
            service: reviewService,
            serviceName: reviewService,
            rating: value.rating || 5,
            comment: value.comment,
            // Submitted anonymously from the website: not linked to any paid booking
            verified: false,
            isVerifiedBooking: false,
            status: 'approved',
            ipAddress: String(clientIp),
            userAgent: String(userAgent)
        });

        await newReview.save();
        res.status(201).json({ 
            success: true, 
            message: 'Review submitted successfully and saved to database', 
            review: newReview 
        });
    } catch (error) {
        console.error('Submit Review Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to submit review' });
    }
});

// DELETE /api/reviews/:id - Admin ONLY can delete reviews from database
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const adminKey = req.headers['x-admin-key'];
        
        // Credentials come only from the environment; with neither configured, nobody is admin
        let isAdmin = false;
        if (adminKey && process.env.ADMIN_KEY && adminKey.length === process.env.ADMIN_KEY.length
            && crypto.timingSafeEqual(Buffer.from(adminKey), Buffer.from(process.env.ADMIN_KEY))) {
            isAdmin = true;
        } else if (authHeader && authHeader.startsWith('Bearer ') && process.env.JWT_SECRET) {
            const token = authHeader.split(' ')[1];
            const jwt = require('jsonwebtoken');
            try {
                if (jwt.verify(token, process.env.JWT_SECRET)) isAdmin = true;
            } catch { /* invalid or expired token */ }
        }

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied: Only administrators have access to delete reviews.'
            });
        }

        await connectToDatabase();
        const deleted = await Review.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Review not found in database' });
        }

        res.json({ 
            success: true, 
            message: 'Review successfully deleted from database by admin', 
            id: req.params.id 
        });
    } catch (error) {
        console.error('Delete Review Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete review' });
    }
});

// POST /api/reviews/:id/like - Like a review
const likeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many likes. Please try again later.' }
});

app.post('/api/reviews/:id/like', likeLimiter, async (req, res) => {
    try {
        await connectToDatabase();
        if (!isConnected) {
            return res.json({ success: true, message: 'Liked (offline)' });
        }
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        res.json({ success: true, likes: review.likes });
    } catch (error) {
        console.error('Like Review Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to update like' });
    }
});

// Dynamic Panchang Endpoints
const { CITIES, calculatePanchang } = require('./services/panchangCalculator');

app.get('/api/panchang/cities', (req, res) => {
    const list = Object.entries(CITIES).map(([key, val]) => ({
        id: key,
        name: val.name,
        tz: val.tz
    }));
    res.json({ success: true, cities: list });
});

app.get('/api/panchang', (req, res) => {
    try {
        const { date, city, lat, lon, tz } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        let latitude = 17.3850;
        let longitude = 78.4867;
        let tzOffset = 5.5;
        let cityName = 'హైదరాబాద్ (Hyderabad)';

        if (city && CITIES[city.toLowerCase()]) {
            const c = CITIES[city.toLowerCase()];
            latitude = c.lat;
            longitude = c.lon;
            tzOffset = c.tz;
            cityName = c.name;
        } else if (lat && lon) {
            latitude = parseFloat(lat);
            longitude = parseFloat(lon);
            tzOffset = tz ? parseFloat(tz) : 5.5;
            cityName = 'Custom Location';
        }

        const data = calculatePanchang(targetDate, latitude, longitude, tzOffset);
        res.json({
            success: true,
            city: cityName,
            data
        });
    } catch (error) {
        console.error('Panchang Calculation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate panchang' });
    }
});

// Location, Geocoding & Timezone Resolution Endpoints
const locationRoutes = require('./routes/locationRoutes');
app.use('/api/location', locationRoutes);

// Authoritative KP Kundli Calculation Endpoint (Swiss Ephemeris 2.10.03)
const { calculateKPKundliSwiss, calculateVimshottariDasha } = require('./services/swissEphemerisService');

app.post('/api/kp-kundli', (req, res) => {
    try {
        const schema = Joi.object({
            birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
            birthTime: Joi.string().pattern(/^\d{1,2}:\d{2}(:\d{2})?$/).required(),
            lat: Joi.number().min(-90).max(90).required(),
            lon: Joi.number().min(-180).max(180).required(),
            timezone: Joi.string().default('Asia/Kolkata'),
            ayanamshaMode: Joi.string().valid('KP_NEW', 'KP_ORIGINAL', 'KP_STRAIGHT').default('KP_NEW'),
            nodeMode: Joi.string().valid('mean', 'true').default('mean')
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const data = calculateKPKundliSwiss(value);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('KP Kundli Calculation Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Calculation error occurred while processing astrological data.'
        });
    }
});

// Dedicated Vimshottari Dasha Calculation Endpoint
app.post('/api/kp/vimshottari-dasha', (req, res) => {
    try {
        const schema = Joi.object({
            // Option A: Direct birth coordinates
            birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
            birthTime: Joi.string().pattern(/^\d{1,2}:\d{2}(:\d{2})?$/),
            lat: Joi.number().min(-90).max(90),
            lon: Joi.number().min(-180).max(180),
            timezone: Joi.string().default('Asia/Kolkata'),
            ayanamshaMode: Joi.string().valid('KP_NEW', 'KP_ORIGINAL', 'KP_STRAIGHT').default('KP_NEW'),

            // Option B: Pre-calculated Moon sidereal longitude & birthDateUtc
            moonSiderealLongitude: Joi.number().min(0).max(360),
            birthDateUtc: Joi.string().isoDate(),

            // Reference date for querying active dasha periods (defaults to current date)
            referenceDate: Joi.string().isoDate().allow(null, '')
        }).or('birthDate', 'moonSiderealLongitude');

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        let dashaResult;

        if (value.moonSiderealLongitude != null && value.birthDateUtc) {
            // Fast direct path: reuse verified Moon longitude
            dashaResult = calculateVimshottariDasha({
                moonSiderealLongitude: value.moonSiderealLongitude,
                birthDateUtc: value.birthDateUtc,
                referenceDate: value.referenceDate || null
            });
        } else {
            // Coordinate path: full Swiss Ephemeris astronomical resolution
            if (!value.birthDate || !value.birthTime || value.lat == null || value.lon == null) {
                return res.status(400).json({
                    success: false,
                    message: "Missing birthDate, birthTime, lat, or lon."
                });
            }

            const kpData = calculateKPKundliSwiss({
                birthDate: value.birthDate,
                birthTime: value.birthTime,
                lat: value.lat,
                lon: value.lon,
                timezone: value.timezone || 'Asia/Kolkata',
                ayanamshaMode: value.ayanamshaMode || 'KP_NEW'
            });

            const moonPlanet = kpData.planets.find(p => p.key === 'Moon');
            dashaResult = calculateVimshottariDasha({
                moonSiderealLongitude: moonPlanet.longitude,
                birthDateUtc: kpData.metadata.utcDate,
                referenceDate: value.referenceDate || null,
                planets: kpData.planets,
                cusps: kpData.cusps,
                aspects: kpData.aspects,
                significators: kpData.significators
            });
        }

        res.json({
            success: true,
            data: dashaResult
        });
    } catch (error) {
        console.error('Vimshottari Dasha Calculation Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Calculation error occurred while processing Vimshottari Dasha data.'
        });
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(port, '0.0.0.0', () => console.log(`🌟 AstroSharma Server running on port ${port}`));
}

module.exports = app;
