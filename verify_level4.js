const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function request(path, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', reject);

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function runTests() {
    console.log("Starting Verification for Level 4 (Medium)...");

    // Test 1: Default UA (Should Fail)
    try {
        console.log("\n[Test 1] Requesting / with default UA...");
        const res1 = await request('/');
        if (res1.body.includes("Access Restricted") || res1.body.includes("ACCESS DENIED")) {
            console.log("PASS: Access Denied page received.");
        } else {
            console.error("FAIL: Should have been denied.");
            process.exit(1);
        }
    } catch (e) {
        console.error("FAIL: Connection error", e);
        process.exit(1);
    }

    // New Test 2: Fetch Logs to find UA
    let targetUA = '';
    try {
        console.log("\n[Test 2] Fetching Logs from /api/logs...");
        const resLogs = await request('/api/logs');
        if (resLogs.statusCode !== 200) {
            console.error("FAIL: Could not fetch logs.");
            process.exit(1);
        }

        console.log("PASS: Logs fetched.");
        // Find line with 200 OK
        const lines = resLogs.body.split('\n');
        const successLine = lines.find(l => l.includes('STATUS: 200 OK'));
        if (successLine) {
            // Extract UA:  ... | UA: SuperSecureBrowser/v5.5-Alpha | ...
            const match = successLine.match(/UA:\s*([^|]+)\s*\|/);
            if (match) {
                targetUA = match[1].trim();
                console.log("PASS: Found hidden UA:", targetUA);
            } else {
                console.error("FAIL: Could not parse UA from line:", successLine);
                process.exit(1);
            }
        } else {
            console.error("FAIL: No 200 OK entry found in logs.");
            process.exit(1);
        }

    } catch (e) {
        console.error("FAIL: Log fetch error", e);
        process.exit(1);
    }

    // Test 3: Spoofed UA (Should Succeed)
    let flag = '';
    try {
        console.log(`\n[Test 3] Requesting / with found UA: ${targetUA}...`);
        const res2 = await request('/', 'GET', { 'User-Agent': targetUA });
        if (res2.body.includes("ACCESS GRANTED")) {
            console.log("PASS: Access Granted.");

            // Extract Flag
            const match = res2.body.match(/BUG_FOUND\{.*?\}/);
            if (match) {
                flag = match[0];
                console.log("PASS: Flag found:", flag);
            } else {
                console.error("FAIL: Flag not found in response.");
                process.exit(1);
            }
        } else {
            console.error("FAIL: Access still denied or wrong page.");
            process.exit(1);
        }
    } catch (e) {
        console.error("FAIL: Connection error", e);
        process.exit(1);
    }

    // Test 4: Verify Endpoint
    try {
        console.log("\n[Test 4] Submitting Flag to /api/verify...");
        const payload = JSON.stringify({ code: flag });
        const res3 = await request('/api/verify', 'POST', {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }, payload);

        const json = JSON.parse(res3.body);
        if (json.success) {
            console.log("PASS: Verification successful.");
        } else {
            console.error("FAIL: Verification rejected.");
            process.exit(1);
        }
    } catch (e) {
        console.error("FAIL: Connection/Parse error", e);
        process.exit(1);
    }

    console.log("\nALL TESTS PASSED.");
}

setTimeout(runTests, 2000);
