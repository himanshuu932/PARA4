const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const QUESTION_ID = process.env.QUESTION_ID || 'level4_ua_spoof';
const MAIN_BACKEND_URL = 'https://buggit-backend-yy8i.onrender.com/api/store-result';

app.use(express.json());

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
    const logs = [];
    const totalLogs = 150; // Total entries (> 100)
    const successIndex = 42; // index 42 = 43rd entry

    // Decoys that are similar to the real one ("Hit and Trial" confusion)
    const decoyUAs = [
        'SuperSecureBrowser/v1.5',
        'SuperSecureBrowser/v2.5',
        'SuperSecureBrowser/v2.34',
        'SuperSecureBrowser/v5.0-Beta',
        'SuperSecureBrowser/v5.5-Rc1',
        'SuperSecureBrowser/v4.1.1'
    ];

    // Pick 5 random slots for decoys (excluding the success index)
    const decoyIndices = new Set();
    while (decoyIndices.size < 5) {
        const r = Math.floor(Math.random() * totalLogs);
        if (r !== successIndex) decoyIndices.add(r);
    }

    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Mozilla/5.0 (X11; Linux x86_64)',
        'Chrome/120.0.0.0 Safari/537.36',
        'Safari/605.1.15',
        'Edge/119.0.0.0'
    ];

    for (let i = 0; i < totalLogs; i++) {
        // Mock timestamp: getting recent times
        const date = new Date(Date.now() - (totalLogs - i) * 60000); // 1 min apart
        const timestamp = date.toISOString().replace('T', ' ').substring(0, 19);

        if (i === successIndex) {
            // THE REAL ONE
            logs.push(`[${timestamp}] IP: 127.0.0.1       | UA: SuperSecureBrowser/v5.5-Alpha      | STATUS: 200 OK`);
        } else if (decoyIndices.has(i)) {
            // THE DECOY (Fake Success with similar name)
            const decoyUA = decoyUAs[Math.floor(Math.random() * decoyUAs.length)];
            const fakeIP = `10.0.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`;
            logs.push(`[${timestamp}] IP: ${fakeIP.padEnd(15)} | UA: ${decoyUA.padEnd(34)} | STATUS: 200 OK`);
        } else {
            // STANDARD FAILURE
            const ip = `192.168.1.${Math.floor(Math.random() * 250) + 1}`;
            const ua = uas[Math.floor(Math.random() * uas.length)];
            // Pad UA for cleaner look
            logs.push(`[${timestamp}] IP: ${ip.padEnd(15)} | UA: ${ua.padEnd(34)} | STATUS: 403 Forbidden`);
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(logs.join('\n'));
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
