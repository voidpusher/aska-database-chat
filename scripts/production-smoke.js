import crypto from "node:crypto";

const baseUrl = String(
  process.env.SMOKE_BASE_URL || "http://localhost:4000",
).replace(/\/+$/, "");

let sessionCookie = "";

async function fetchJson(pathname, expectedStatus, options = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/orrico_session=([^;]+)/);
    if (match) {
      sessionCookie = `orrico_session=${match[1]}`;
    }
  }

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method || "GET"} ${pathname} returned ${response.status}, expected ${expectedStatus}.\nBody: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }

  return body;
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);

  // 1. Health checks
  const health = await fetchJson("/api/health", 200);
  console.log("✓ /api/health:", health.status, `(store: ${health.store?.mode})`);

  const ready = await fetchJson("/api/health/ready", 200);
  console.log("✓ /api/health/ready:", ready.ready);

  if (!ready.ready) {
    throw new Error(`Readiness reported false. Body: ${JSON.stringify(ready)}`);
  }

  // 2. Unauthenticated access should be rejected
  await fetchJson("/api/auth/session", 401);
  console.log("✓ /api/auth/session rejects unauthenticated requests");

  await fetchJson("/api/dashboard/summary", 401);
  console.log("✓ /api/dashboard/summary rejects unauthenticated requests");

  // 3. Signup with a unique ephemeral test account
  const testEmail = `smoke-${crypto.randomBytes(6).toString("hex")}@orrico-smoke.invalid`;
  const testPassword = `Smoke${crypto.randomBytes(8).toString("hex")}!`;

  const signupResult = await fetchJson("/api/auth/signup", 201, {
    method: "POST",
    body: {
      firstName: "Smoke",
      lastName: "Test",
      email: testEmail,
      businessName: "Smoke Test Store",
      password: testPassword,
    },
  });

  console.log(
    "✓ /api/auth/signup: created user",
    signupResult.user?.email,
    signupResult.requiresEmailVerification
      ? "(email verification required)"
      : "(auto-verified)",
  );

  // 4. If email verification is not required, test authenticated session
  if (!signupResult.requiresEmailVerification) {
    const session = await fetchJson("/api/auth/session", 200);
    console.log("✓ /api/auth/session: resolved user", session.user?.email);

    // 5. Chat endpoint (should work even without a connected DB — returns a reply)
    const chat = await fetchJson("/api/chat/message", 200, {
      method: "POST",
      body: { message: "What are my top products?" },
    });
    console.log("✓ /api/chat/message: got reply mode:", chat.mode);

    // 6. Dashboard summary
    const summary = await fetchJson("/api/dashboard/summary", 200);
    console.log("✓ /api/dashboard/summary: available:", summary.available);

    // 7. Logout
    await fetchJson("/api/auth/logout", 204, { method: "POST" });
    console.log("✓ /api/auth/logout: session cleared");

    // 8. Session should now be gone
    await fetchJson("/api/auth/session", 401);
    console.log("✓ /api/auth/session: correctly rejected after logout");

    // 9. Login again
    const loginResult = await fetchJson("/api/auth/login", 200, {
      method: "POST",
      body: { email: testEmail, password: testPassword },
    });
    console.log("✓ /api/auth/login: logged in as", loginResult.user?.email);

    // 10. Wrong password should 401
    await fetchJson("/api/auth/login", 401, {
      method: "POST",
      body: { email: testEmail, password: "wrongpassword" },
    });
    console.log("✓ /api/auth/login: rejects wrong password");
  } else {
    console.log("  (skipping authenticated tests — email verification required in this environment)");
  }

  console.log("\nProduction smoke test passed.");
}

main().catch((error) => {
  console.error("\nSmoke test FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
