const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const QUESTION_ID = process.env.QUESTION_ID || 'level4_ua_spoof';
const MAIN_BACKEND_URL = 'https://buggit-backend-yy8i.onrender.com/api/store-result';

app.use(express.json());
app.use(express.json());
// app.use(express.static('public')); // MOVED DOWN


// Helper function to send result to main backend (backend-to-backend)
async function sendToMainBackend(teamcode, questionId) {
    try {
        const response = await fetch(MAIN_BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamcode, questionId })
        });

        const result = await response.json();
        console.log("[BACKEND-SYNC] Stored in Main Backend:", result);
        return { success: true, result };
    } catch (error) {
        console.error("[BACKEND-SYNC] Error contacting main backend:", error.message);
        return { success: false, error: error.message };
    }
}

// 1. The Vulnerable Endpoint (Root)
app.get('/', (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const REQUIRED_UA = 'SuperSecureBrowser/v5.5-Alpha'; // Updated for Medium difficulty

    // Check if the user agent matches exactly
    if (userAgent === REQUIRED_UA) {
        // If it matches, serve the "Admin" or "Success" page
        return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }

    // Otherwise, serve the default "Access Denied" page
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// NEW: Log Endpoint (The Info Disclosure)
app.get('/api/logs', (req, res) => {
    const logs = `
[2024-12-27 08:00:01] IP: 192.168.1.5 | UA: Mozilla/5.0 (Windows NT 10.0) | STATUS: 403 Forbidden
[2024-12-27 08:01:15] IP: 10.0.0.23   | UA: Chrome/120.0.0.0          | STATUS: 403 Forbidden
[2024-12-27 08:02:44] IP: 192.168.1.8 | UA: Safari/537.36             | STATUS: 403 Forbidden
[2024-12-27 08:05:00] IP: 127.0.0.1   | UA: SuperSecureBrowser/v5.5-Alpha | STATUS: 200 OK
[2024-12-27 08:06:12] IP: 192.168.1.9 | UA: Firefox/118.0             | STATUS: 403 Forbidden
[2024-12-27 08:10:30] IP: 10.0.0.55   | UA: Edge/119.0.0.0            | STATUS: 403 Forbidden
    `.trim();

    res.set('Content-Type', 'text/plain');
    res.send(logs);
});

app.use(express.static('public'));

// An API endpoint to get the current UA for the frontend to display
app.get('/api/info', (req, res) => {
    res.json({
        userAgent: req.headers['user-agent'],
        message: "Access Denied. Tier-1 Browser Required."
    });
});

// 2. Verification Endpoint
app.post('/api/verify', async (req, res) => {
    const { code, teamcode } = req.body;
    const serverCode = process.env.CODEWORD;

    if (code === serverCode) {
        // Backend-to-backend sync
        const y = teamcode || '382045158047';
        const syncResult = await sendToMainBackend(y, QUESTION_ID);

        res.json({
            success: true,
            message: "IDENTITY VERIFIED. WELCOME, ELITE USER.",
            bugFound: "BUG_FOUND{spoofing_headers_is_trivial}",
            redirect: "https://bug-hunt-manager-tau.vercel.app/dashboard",
            backendSync: syncResult
        });
    } else {
        res.json({
            success: false,
            message: "Invalid Codeword."
        });
    }
});

// 3. Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Level 4 (UA Spoof) running on port ${PORT}`);
    console.log(`Question ID: ${QUESTION_ID}`);

    // Self-ping to keep Render alive
    const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
    setInterval(() => {
        // Use RENDER_EXTERNAL_URL if set, otherwise use the provided URL (or localhost for dev)
        // The user specifically requested ' https://itsnotsoeasy.onrender.com ', so we'll prioritize that or localhost if needed.
        // Actually, best practice:
        const url = process.env.RENDER_EXTERNAL_URL || 'https://itsnotsoeasy.onrender.com';

        console.log(`[KEEP-ALIVE] Sending ping to ${url}/ping`);
        fetch(`${url}/ping`)
            .then(res => res.json())
            .then(data => console.log(`[KEEP-ALIVE] Pinged successfully at ${data.timestamp}`))
            .catch(err => console.error(`[KEEP-ALIVE] Ping failed: ${err.message}`));
    }, PING_INTERVAL);
    console.log('[KEEP-ALIVE] Self-ping enabled every 10 minutes');
});
