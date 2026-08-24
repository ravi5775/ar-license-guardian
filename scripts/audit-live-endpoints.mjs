// Live HTTP Endpoint & Security Leak Audit Script
const BASE = "http://localhost:8080";

const tests = [
  { name: "1. Homepage", method: "GET", url: `${BASE}/` },
  { name: "2. Auth Page", method: "GET", url: `${BASE}/auth` },
  { name: "3. Setup Wizard", method: "GET", url: `${BASE}/setup` },
  { name: "4. Scan Page", method: "GET", url: `${BASE}/scan` },
  { name: "5. Gallery Page", method: "GET", url: `${BASE}/gallery` },
  { name: "6. AR Business Cards", method: "GET", url: `${BASE}/ar-business-cards` },
  { name: "7. Dashboard Root", method: "GET", url: `${BASE}/dashboard` },
  { name: "8. Dashboard Licenses", method: "GET", url: `${BASE}/dashboard/licenses` },
  { name: "9. Sitemap", method: "GET", url: `${BASE}/sitemap.xml` },
  { name: "10. Legacy Activate GET", method: "GET", url: `${BASE}/api/public/license/activate` },
  { name: "11. Legacy Activate POST", method: "POST", url: `${BASE}/api/public/license/activate`, body: {} },
  { name: "12. Licence Status (No Key)", method: "GET", url: `${BASE}/api/public/licence/status` },
  { name: "13. Licence Status (Fake Key)", method: "GET", url: `${BASE}/api/public/licence/status?key=fake_license_key_123` },
  { name: "14. Licence Activate (Empty)", method: "POST", url: `${BASE}/api/public/licence/activate`, body: {} },
  { name: "15. Licence Refresh (Empty)", method: "POST", url: `${BASE}/api/public/licence/refresh`, body: {} },
  { name: "16. Licence Manifest (No Secret)", method: "GET", url: `${BASE}/api/public/licence/manifest` },
  { name: "17. Licence Release (No Secret)", method: "GET", url: `${BASE}/api/public/licence/release` },
  { name: "18. Signed Media (Invalid Nonce)", method: "GET", url: `${BASE}/api/public/m/invalid-nonce-12345` },
];

console.log("================================================================================");
console.log("            AETHER AR — LIVE HTTP ENDPOINT & SECURITY LEAK AUDIT                ");
console.log("================================================================================\n");

async function runAudit() {
  const sensitivePatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/i,
    /LICENCE_PRIVATE_KEY/i,
    /DEFAULT_ADMIN_PASSWORD/i,
    /RELEASE_MANIFEST_SECRET/i,
    /eyJh[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, // JWT / Service keys
    /d_key/i,
    /privateKey/i,
    /\"crv\":\"Ed25519\",\"d\":/i,
    /postgres:\/\//i
  ];

  let leaksFound = 0;

  for (const t of tests) {
    try {
      const opts = {
        method: t.method,
        headers: { "Content-Type": "application/json", "User-Agent": "AetherAudit/1.0" },
      };
      if (t.body) opts.body = JSON.stringify(t.body);

      const res = await fetch(t.url, opts);
      const text = await res.text();
      const status = res.status;
      const headers = Object.fromEntries(res.headers.entries());

      // Check for security headers
      const secHeaders = {
        nosniff: headers["x-content-type-options"] || "MISSING",
        frameGuard: headers["x-frame-options"] || "MISSING",
        csp: headers["content-security-policy"] ? "PRESENT" : "MISSING",
      };

      // Check for sensitive leaks in response text
      const detectedLeaks = [];
      for (const pat of sensitivePatterns) {
        if (pat.test(text)) {
          detectedLeaks.push(pat.toString());
        }
      }

      console.log(`[HTTP ${status}] ${t.name}`);
      console.log(`  -> URL: ${t.url}`);
      console.log(`  -> Security Headers: x-content-type-options: ${secHeaders.nosniff}, x-frame-options: ${secHeaders.frameGuard}, CSP: ${secHeaders.csp}`);
      
      if (detectedLeaks.length > 0) {
        leaksFound++;
        console.log(`  🚨 SENSITIVE PATTERN DETECTED: ${detectedLeaks.join(", ")}`);
        console.log(`  -> Snippet: ${text.slice(0, 200)}`);
      } else {
        const preview = text.trim().slice(0, 100).replace(/\n/g, " ");
        console.log(`  -> Response Preview: ${preview || "(empty body)"}`);
      }
      console.log("");
    } catch (err) {
      console.log(`[FAIL] ${t.name} -> Error: ${err.message}\n`);
    }
  }

  console.log("================================================================================");
  console.log(`Audit Complete. Total Leaks Found in Responses: ${leaksFound}`);
  console.log("================================================================================");
}

runAudit();
