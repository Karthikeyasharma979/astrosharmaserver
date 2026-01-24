const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env' });

console.log('Using SMTP Settings:');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USER);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: 'karthikeyasharma979@gmail.com',
    subject: 'AstroSharma Test Email',
    text: 'This is a test email from your Astro application to verify SMTP settings.'
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log('Error sending email:', error);
    } else {
        console.log('Email sent successfully:', info.response);
    }
});
