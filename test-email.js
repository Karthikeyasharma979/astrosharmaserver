const fs = require('fs');

// Create a boundary for multipart data
const boundary = '--------------------------' + Date.now().toString(16);

// Construct the body
const fields = {
    fullName: "Test User",
    dob: "1990-01-01",
    question: "This is a test email triggered manually to verify the template.",
    phone: "9999999999",
    email: "s06699201@gmail.com", // Targeting the user's email
    consultationType: "Quick Guidance",
    price: "₹501",
    utrNumber: "TEST-UTR-SAMPLE"
};

let body = '';
for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
}
body += `--${boundary}--\r\n`;

// Send the request
fetch('http://localhost:5000/api/book-consultation', {
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
})
    .then(res => res.json())
    .then(data => console.log('Response:', data))
    .catch(err => console.error('Error:', err));
