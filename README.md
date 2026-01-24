# Astro Backend Server

This is the backend server for the Astro application, responsible for handling consultation bookings and sending emails securely.

## Why is this needed?
React runs in the browser (client-side) and cannot securely communicate with SMTP email servers directly. Doing so would expose your email passwords to anyone visiting the website. This server acts as a secure bridge.

## Setup Instructions

1.  **Install Dependencies** (if you haven't already):
    ```bash
    cd server
    npm install
    ```

2.  **Configure Environment Variables**:
    Open the `.env` file in this directory and update the following placeholders with your actual email credentials:

    ```env
    # Server Port
    PORT=5000

    # SMTP Configuration (Example for Gmail)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER=your-actual-email@gmail.com
    SMTP_PASS=your-app-password  # Generate this in Google Account > Security > App Passwords
    SMTP_FROM_EMAIL=your-actual-email@gmail.com

    # Admin Email (Where to send booking notifications)
    ADMIN_EMAIL=your-admin-email@example.com
    ```

3.  **Run the Server**:
    The server needs to be running for the React app to send emails.
    ```bash
    npm run dev
    ```

## API Endpoints

### POST `/api/book-consultation`
-   **Body**: FormData (fullName, dob, phone, email, etc.)
-   **Files**: `screenshot` (Payment proof)
-   **Action**: Sends two emails (one to Admin with attachment, one to User).
# astrosharmaserver
