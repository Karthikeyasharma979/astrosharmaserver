const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression'); // Added

// Ensure we load the .env file from the server directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

// Trust Proxy (Required for Vercel/Render/Heroku/AWS LB)
app.set('trust proxy', 1);

// Middleware

// Compression (Gzip)
app.use(compression());

// Security Headers
app.use(helmet());

// CORS Configuration
// CORS Configuration
const normalizeUrl = (url) => url ? url.replace(/\/$/, '') : '';

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://astrosharma.vercel.app',
    normalizeUrl(process.env.FRONTEND_URL)
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeUrl(origin);

        // Check if the normalized origin is in the allowed list
        const isAllowed = allowedOrigins.some(allowed => allowed === normalizedOrigin);

        if (isAllowed) {
            return callback(null, true);
        }

        // Fallback: If FRONTEND_URL is NOT set in env, allow all (Development mode)
        if (!process.env.FRONTEND_URL) {
            return callback(null, true);
        }

        console.log('CORS BLOCKED:', origin);
        console.log('Allowed:', allowedOrigins);

        var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Global Rate Limiter (Basic protection)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply global limiter to all requests
app.use(globalLimiter);

// Strict Rate Limiter for sensitive endpoints (Booking, Contact)
const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per hour
    message: { success: false, message: 'Too many requests, please try again later.' }
});

// Ensure uploads directory exists - REMOVED for Vercel/Render compatibility (Memory Storage)

// Multer setup for file uploads (Memory Storage)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Email Transporter (SMTP)
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Read Logo File Path
// Read Logo File Path (Now local to server folder for production)
const logoPath = path.join(__dirname, 'logo_icon.jpg');

// ... existing middleware ...

const axios = require('axios');

// Helper: Verify reCAPTCHA
// Helper: Verify reCAPTCHA (Removed)
// const verifyRecaptcha = async (token) => { ... }

// API Endpoint to handle booking
const bookingSchema = Joi.object({
    // Common Fields
    // captchaToken: Joi.string().required(), // Removed
    fullName: Joi.string().min(2).max(100).allow('', null), // Optional for marriage match
    dob: Joi.string().allow('', null),
    birthTime: Joi.string().allow('', null),
    birthPlace: Joi.string().allow('', null),
    pincode: Joi.string().allow('', null),
    question: Joi.string().allow('', null),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({ 'string.pattern.base': 'Phone number must be exactly 10 digits.' }),
    email: Joi.string().email().required(),
    consultationType: Joi.string().required(),
    price: Joi.string().allow('', null),
    utrNumber: Joi.string().required(),

    // Marriage Matching Specific
    girlName: Joi.string().allow('', null),
    girlDob: Joi.string().allow('', null),
    girlTime: Joi.string().allow('', null),
    girlPlace: Joi.string().allow('', null),
    boyName: Joi.string().allow('', null),
    boyDob: Joi.string().allow('', null),
    boyTime: Joi.string().allow('', null),
    boyPlace: Joi.string().allow('', null),
    // Second person optional
    girl2Name: Joi.string().allow('', null),
    girl2Dob: Joi.string().allow('', null),
    girl2Time: Joi.string().allow('', null),
    girl2Place: Joi.string().allow('', null),
    boy2Name: Joi.string().allow('', null),
    boy2Dob: Joi.string().allow('', null),
    boy2Time: Joi.string().allow('', null),
    boy2Place: Joi.string().allow('', null),

    startDate: Joi.string().allow('', null),
    endDate: Joi.string().allow('', null)
});

app.post('/api/book-consultation', apiLimiter, upload.single('screenshot'), async (req, res) => {
    try {
        // Dynamic import for file-type (ESM module)
        const { fileTypeFromBuffer } = await import('file-type');

        // Validate Input
        console.log('Booking Request Received. Body Keys:', Object.keys(req.body));

        const { error } = bookingSchema.validate(req.body, { abortEarly: false, allowUnknown: true });
        if (error) {
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(path.join(__dirname, 'validation_error.log'), JSON.stringify({
                endpoint: 'booking',
                body: req.body,
                errors: error.details.map(detail => detail.message)
            }, null, 2));

            return res.status(400).json({
                success: false,
                message: 'Validation Error',
                errors: error.details.map(detail => detail.message)
            });
        }

        // Verify reCAPTCHA - REMOVED
        /*
        const isCaptchaValid = await verifyRecaptcha(req.body.captchaToken);
        if (!isCaptchaValid) {
            return res.status(400).json({ success: false, message: 'Invalid CAPTCHA. Please try again.' });
        }
        */

        const {
            fullName, dob, birthTime, birthPlace, pincode,
            question, phone, email, consultationType, price, utrNumber,
            // Match specific fields
            girlName, girlDob, girlTime, girlPlace, girlPincode,
            boyName, boyDob, boyTime, boyPlace, boyPincode,
            girl2Name, girl2Dob, girl2Time, girl2Place, girl2Pincode,
            boy2Name, boy2Dob, boy2Time, boy2Place, boy2Pincode,
            startDate, endDate, muhurthamLocation
        } = req.body;

        // Handle In-Memory File & Security Check
        let screenshotBuffer = null;
        let screenshotName = 'screenshot.jpg';

        if (req.file) {
            const fileType = await fileTypeFromBuffer(req.file.buffer);
            const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

            if (!fileType || !allowedMimes.includes(fileType.mime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
                });
            }
            screenshotBuffer = req.file.buffer;
            // Sanitizing filename just in case
            screenshotName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        }

        const transporter = createTransporter();
        const adminEmail = process.env.ADMIN_EMAIL; // Admin email to receive notifications

        // Email Template Helper
        const createEmailTemplate = (title, message, detailsHtml) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .wrapper { padding: 40px 20px; background-color: #f4f4f4; min-height: 100vh; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
        .header { padding: 40px 0 20px; text-align: center; }
        .logo-img { width: 80px; height: 80px; object-fit: cover; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .content { padding: 0 40px 40px; text-align: center; }
        .title { color: #6441A5; font-size: 26px; margin-bottom: 20px; font-weight: 700; }
        .message { color: #4a5568; line-height: 1.6; font-size: 16px; margin-bottom: 30px; text-align: left; }
        
        .details-box { background-color: #faf5ff; border: 1px solid #e9d8fd; border-radius: 12px; padding: 20px; margin: 30px 0; }
        .details-table { width: 100%; border-collapse: collapse; text-align: left; }
        .details-table th { color: #6b46c1; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 8px 0; width: 40%; vertical-align: top; }
        .details-table td { color: #2d3748; font-size: 15px; font-weight: 500; padding: 8px 0; vertical-align: top; }
        
        .footer { background-color: #fbfbfb; padding: 20px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
        
        .highlight { color: #805ad5; font-weight: 700; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                 <img src="cid:logo" alt="AstroSharma" class="logo-img">
            </div>
            <div class="content">
                <h1 class="title">${title}</h1>
                <div class="message">${message}</div>
                ${detailsHtml}
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Astro Services. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>
        `;

        // Prepare Attachments
        const commonAttachments = [{
            filename: 'logo.jpg',
            path: logoPath,
            cid: 'logo'
        }];

        const adminAttachments = [...commonAttachments];
        if (screenshotBuffer) {
            adminAttachments.push({
                filename: screenshotName,
                content: screenshotBuffer
            });
        }

        // Helper to format time to AM/PM
        const formatTime = (timeStr) => {
            if (!timeStr) return '';
            const [hour, minute] = timeStr.split(':');
            const h = parseInt(hour, 10);
            if (isNaN(h)) return timeStr;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minute} ${ampm}`;
        };

        // Helper to generate dynamic tables based on type
        const generateDetailsTable = (isAdmin) => {
            if (girlName && boyName) {
                // Marriage Matching Format
                return `
                    <div class="details-box">
                        <table class="details-table" style="width:100%">
                            ${isAdmin ? `<tr><td colspan="3" style="text-align:center; font-weight:bold; padding-bottom:10px;">Client Name: ${fullName}</td></tr>` : ''}
                            <tr>
                                <th style="width:20%">Field</th>
                                <th style="width:40%; color:#d53f8c">Girl</th>
                                <th style="width:40%; color:#3182ce">Boy</th>
                            </tr>
                            <tr><td>Name</td><td>${girlName}</td><td>${boyName}</td></tr>
                            <tr><td>DOB</td><td>${girlDob}</td><td>${boyDob}</td></tr>
                            <tr><td>Time</td><td>${formatTime(girlTime)}</td><td>${formatTime(boyTime)}</td></tr>
                            <tr><td>Place</td><td>${girlPlace}</td><td>${boyPlace}</td></tr>
                            <tr><td>Pincode</td><td>${girlPincode || '-'}</td><td>${boyPincode || '-'}</td></tr>
                            ${girl2Name ? `
                            <tr><td colspan="3" style="border-top:1px solid #ddd; padding-top:10px; font-weight:bold; color:#d53f8c; text-align: center;">--- Second Girl Details ---</td></tr>
                            <tr><td>Name</td><td colspan="2">${girl2Name}</td></tr>
                            <tr><td>DOB</td><td colspan="2">${girl2Dob}</td></tr>
                            <tr><td>Time</td><td colspan="2">${formatTime(girl2Time)}</td></tr>
                            <tr><td>Place</td><td colspan="2">${girl2Place}</td></tr>
                            <tr><td>Pincode</td><td colspan="2">${girl2Pincode || '-'}</td></tr>
                            ` : ''}
                            ${boy2Name ? `
                            <tr><td colspan="3" style="border-top:1px solid #ddd; padding-top:10px; font-weight:bold; color:#3182ce; text-align: center;">--- Second Boy Details ---</td></tr>
                            <tr><td>Name</td><td colspan="2">${boy2Name}</td></tr>
                            <tr><td>DOB</td><td colspan="2">${boy2Dob}</td></tr>
                            <tr><td>Time</td><td colspan="2">${formatTime(boy2Time)}</td></tr>
                            <tr><td>Place</td><td colspan="2">${boy2Place}</td></tr>
                            <tr><td>Pincode</td><td colspan="2">${boy2Pincode || '-'}</td></tr>
                            ` : ''}
                            ${startDate && endDate ? `
                            <tr><td colspan="3" style="border-top:1px solid #ddd; padding-top:10px; font-weight:bold; color:#702459">Preferred Date Range</td></tr>
                            <tr><td>Start Date</td><td colspan="2">${startDate}</td></tr>
                            <tr><td>End Date</td><td colspan="2">${endDate}</td></tr>
                            ${muhurthamLocation ? `<tr><td>For Location</td><td colspan="2">${muhurthamLocation}</td></tr>` : ''}
                            ` : ''}
                            ${isAdmin ? `
                            <tr><td colspan="3" style="border-top:1px solid #ddd; padding-top:10px; font-weight:bold; color:#555">Contact Info</td></tr>
                            <tr><td>Phone</td><td colspan="2">${phone}</td></tr>
                            <tr><td>Email</td><td colspan="2">${email}</td></tr>
                            <tr><td>UTR</td><td colspan="2">${utrNumber}</td></tr>
                            ` : ''}
                            <tr><td colspan="3" style="border-top:1px solid #eee; padding-top:8px; color:#555;"><strong style="color:#2d3748">Terms & Disclaimer:</strong> Accepted</td></tr>
                        </table>
                    </div>
                `;
            } else {
                // Standard Format
                return `
                    <div class="details-box">
                        <table class="details-table">
                            ${isAdmin ? `<tr><th>Client Name</th><td>${fullName}</td></tr>` : ''}
                            <tr><th>Service</th><td class="highlight">${consultationType}</td></tr>
                            ${isAdmin ? `<tr><th>Payment</th><td class="highlight">${price}</td></tr>` : ''}
                            ${isAdmin ? `<tr><th>Phone</th><td>${phone}</td></tr>` : ''}
                            ${isAdmin ? `<tr><th>Email</th><td>${email}</td></tr>` : ''}
                            ${dob ? `<tr><th>DOB</th><td>${dob}</td></tr>` : ''}
                            ${birthTime ? `<tr><th>Time</th><td>${formatTime(birthTime)}</td></tr>` : ''}
                            ${pincode ? `<tr><th>Pincode</th><td>${pincode}</td></tr>` : ''}
                            ${startDate ? `<tr><th>Start Date</th><td>${startDate}</td></tr>` : ''}
                            ${endDate ? `<tr><th>End Date</th><td>${endDate}</td></tr>` : ''}
                            ${muhurthamLocation ? `<tr><th>Muhurtham Place</th><td>${muhurthamLocation}</td></tr>` : ''}
                            ${isAdmin ? `<tr><th>UTR / Ref</th><td>${utrNumber}</td></tr>` : ''}
                            <tr><th>Terms & Disclaimer</th><td>Accepted</td></tr>
                            ${question && question !== 'N/A' ? `<tr><th style="padding-top:12px">Question/Purpose</th><td style="padding-top:12px; font-style: italic; color: #555;">"${question}"</td></tr>` : ''}
                        </table>
                    </div>
                `;
            }
        };

        const adminDetailsHtml = generateDetailsTable(true);
        const userDetailsHtml = generateDetailsTable(false);

        const adminMailOptions = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: adminEmail,
            subject: `New Application: ${girlName ? 'Marriage Match' : fullName} - ${consultationType}`,
            html: createEmailTemplate(
                "New Booking Received",
                `<p>Dear Admin,</p>
                 <p>A new consultation request has been submitted. verify the details below.</p>`,
                adminDetailsHtml
            ),
            attachments: adminAttachments
        };

        const userMailOptions = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: email,
            subject: 'Divine Journey Begins - Booking Received',
            html: createEmailTemplate(
                "Booking Confirmation",
                `<p>Namaste ${fullName || ''},</p>
                 <p>Thank you for choosing us. We have received your request for <strong>${consultationType}</strong>.</p> 
                 <p>Our team is verifying your payment (UTR: ${utrNumber}). We will contact you shortly.</p>`,
                userDetailsHtml
            ),
            attachments: commonAttachments
        };

        // Send Emails
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        res.status(200).json({ success: true, message: 'Booking processed successfully' });

    } catch (error) {
        console.error('Error processing booking:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Contact Validation Schema
const contactSchema = Joi.object({
    // captchaToken: Joi.string().required(), // Removed
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    message: Joi.string().min(3).max(1000).required()
});

// API Endpoint to handle contact form
app.post('/api/contact', apiLimiter, upload.single('image'), async (req, res) => {
    try {
        // Dynamic import for file-type (ESM module)
        const { fileTypeFromBuffer } = await import('file-type');

        // Validate Input
        console.log('Contact Request Received. Body keys:', Object.keys(req.body));
        const { error } = contactSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(path.join(__dirname, 'validation_error.log'), JSON.stringify({
                endpoint: 'contact',
                body: req.body,
                errors: error.details.map(detail => detail.message)
            }, null, 2));

            console.log('Contact Validation Error:', error.details.map(d => d.message));
            return res.status(400).json({
                success: false,
                message: 'Validation Error',
                errors: error.details.map(detail => detail.message)
            });
        }

        // Verify reCAPTCHA - REMOVED
        /*
        const isCaptchaValid = await verifyRecaptcha(req.body.captchaToken);
        console.log('Backend: reCAPTCHA valid?', isCaptchaValid);
        if (!isCaptchaValid) {
            return res.status(400).json({ success: false, message: 'Invalid CAPTCHA. Please try again.' });
        }
        */

        const { firstName, lastName, email, message } = req.body;
        const fullName = `${firstName} ${lastName}`;

        // Handle In-Memory File & Security Check
        let imageBuffer = null;
        let imageName = 'image.jpg';

        if (req.file) {
            const fileType = await fileTypeFromBuffer(req.file.buffer);
            const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

            if (!fileType || !allowedMimes.includes(fileType.mime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
                });
            }
            imageBuffer = req.file.buffer;
            imageName = req.file.originalname;
        }

        console.log('Backend: Processing Contact Form for:', fullName);


        const transporter = createTransporter();
        const adminEmail = process.env.ADMIN_EMAIL; // Admin email to receive notifications

        // Email Template Helper (Duplicated for isolation)
        const createEmailTemplate = (title, messageContent, detailsHtml) => `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .wrapper { padding: 40px 20px; background-color: #f4f4f4; min-height: 100vh; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
                .header { padding: 40px 0 20px; text-align: center; }
                .logo-img { width: 80px; height: 80px; object-fit: cover; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                .content { padding: 0 40px 40px; text-align: center; }
                .title { color: #6441A5; font-size: 26px; margin-bottom: 20px; font-weight: 700; }
                .message { color: #4a5568; line-height: 1.6; font-size: 16px; margin-bottom: 30px; text-align: left; }
                
                .details-box { background-color: #faf5ff; border: 1px solid #e9d8fd; border-radius: 12px; padding: 20px; margin: 30px 0; }
                .details-table { width: 100%; border-collapse: collapse; text-align: left; }
                .details-table th { color: #6b46c1; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 8px 0; width: 30%; vertical-align: top; }
                .details-table td { color: #2d3748; font-size: 15px; font-weight: 500; padding: 8px 0; vertical-align: top; }
                
                .footer { background-color: #fbfbfb; padding: 20px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                         <img src="cid:logo" alt="AstroSharma" class="logo-img">
                    </div>
                    <div class="content">
                        <h1 class="title">${title}</h1>
                        <div class="message">${messageContent}</div>
                        ${detailsHtml}
                    </div>
                    <div class="footer">
                        &copy; ${new Date().getFullYear()} Astro Services. All rights reserved.
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        const commonAttachments = [{
            filename: 'logo.jpg',
            path: logoPath,
            cid: 'logo'
        }];

        const adminAttachments = [...commonAttachments];
        if (imageBuffer) {
            adminAttachments.push({
                filename: imageName,
                content: imageBuffer
            });
        }

        // 1. Email to Admin
        const adminDetailsHtml = `
            <div class="details-box">
                <table class="details-table">
                    <tr><th>Name</th><td>${fullName}</td></tr>
                    <tr><th>Email</th><td>${email}</td></tr>
                    <tr><th>Message</th><td>${message}</td></tr>
                </table>
            </div>
        `;

        const adminMailOptions = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: adminEmail,
            subject: `New Contact Inquiry: ${fullName}`,
            html: createEmailTemplate(
                "New Contact Inquiry",
                `<p>Dear Admin,</p><p>You have received a new message from the contact form.</p><p>See attached image if available.</p>`,
                adminDetailsHtml
            ),
            attachments: adminAttachments
        };

        // 2. Email to User (Auto-reply)
        const userDetailsHtml = `
             <div class="details-box">
                <p style="font-style: italic; color: #666;">"${message}"</p>
                <p style="font-size: 14px; margin-top: 10px; color: #888;">We will respond to this email address: ${email}</p>
            </div>
        `;

        const userMailOptions = {
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: email,
            subject: 'We received your message - AstroSharma',
            html: createEmailTemplate(
                "Namaste " + firstName,
                `<p>Thank you for reaching out to us. We have received your message and will get back to you shortly.</p>`,
                userDetailsHtml
            ),
            attachments: commonAttachments
        };

        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        res.status(200).json({ success: true, message: 'Message sent successfully' });

    } catch (error) {
        console.error('Error sending contact message:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// API Endpoint to get payment configuration
app.get('/api/payment-config', (req, res) => {
    // In a real app, these could come from a database or secure environment variables
    // For now, we serve them from here, which is more secure than hardcoding in frontend
    // as we can change them without rebuilding the frontend.
    const paymentConfig = {
        upiId: process.env.PAYMENT_UPI_ID || 'astrosharma74@ptyes',
        merchantName: process.env.PAYMENT_MERCHANT_NAME || 'AstroSharma'
    };
    res.json(paymentConfig);
});

// Export the app for Vercel (Serverless)
module.exports = app;

// Only listen if running locally (not required by Vercel)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
