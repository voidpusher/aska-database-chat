import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "orrico-api-tests-"),
);

process.env.NODE_ENV = "test";
process.env.APP_DATA_DIRECTORY = tempRoot;
process.env.GEMINI_API_KEY = "";

const appModuleUrl = `${pathToFileURL(
  path.resolve("server", "app.js"),
).href}?test=${Date.now()}`;
const { app } = await import(appModuleUrl);
const { executeReadOnlyQuery } = await import("../server/query-runtime.js");

const server = app.listen(0);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/api`;

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return { status: response.status, body: null };
  }

  const body = await response.json();
  return { status: response.status, body };
}

async function signupAndVerify(email) {
  const signup = await request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Test",
      lastName: "User",
      email,
      businessName: "Test Store",
      password: "password123",
    }),
  });

  assert.equal(signup.status, 201);
  assert.equal(signup.body.requiresEmailVerification, true);
  assert.ok(signup.body.verificationToken);

  const verify = await request("/auth/verify-email/confirm", {
    method: "POST",
    body: JSON.stringify({
      email,
      token: signup.body.verificationToken,
    }),
  });

  assert.equal(verify.status, 200);
  assert.ok(verify.body.token);
  return verify.body.token;
}

test("signup requires email verification and login is blocked until verified", async () => {
  const email = `verify-${Date.now()}@example.com`;
  const signup = await request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Verify",
      lastName: "User",
      email,
      businessName: "Verify Store",
      password: "password123",
    }),
  });

  assert.equal(signup.status, 201);
  assert.equal(signup.body.requiresEmailVerification, true);
  assert.ok(signup.body.verificationToken);

  const blockedLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password123",
    }),
  });

  assert.equal(blockedLogin.status, 403);
  assert.equal(
    blockedLogin.body.requiresEmailVerification,
    true,
  );

  const verify = await request("/auth/verify-email/confirm", {
    method: "POST",
    body: JSON.stringify({
      email,
      token: signup.body.verificationToken,
    }),
  });

  assert.equal(verify.status, 200);
  assert.ok(verify.body.token);
  assert.equal(verify.body.user.emailVerified, true);
});

test("health endpoints expose runtime status", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.store.mode, "sqlite");
  assert.ok(Array.isArray(health.body.runtime.warnings));

  const ready = await request("/health/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.ready, true);
});

test("API boundaries return structured errors", async () => {
  const missingRoute = await request("/does-not-exist");
  assert.equal(missingRoute.status, 404);
  assert.equal(missingRoute.body.error, "API endpoint not found.");
  assert.ok(missingRoute.body.requestId);

  const malformedResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not-json",
  });
  const malformedBody = await malformedResponse.json();
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedBody.error, "Malformed JSON body.");
  assert.ok(malformedBody.requestId);
});

test("authentication inputs have bounded lengths", async () => {
  const oversizedSignup = await request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      firstName: "A".repeat(81),
      lastName: "User",
      email: `bounded-${Date.now()}@example.com`,
      businessName: "Test Store",
      password: "password123",
    }),
  });

  assert.equal(oversizedSignup.status, 400);
  assert.match(oversizedSignup.body.error, /too long/i);

  const oversizedLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "demo@orrico.com",
      password: "x".repeat(257),
    }),
  });

  assert.equal(oversizedLogin.status, 400);
  assert.equal(oversizedLogin.body.error, "Invalid login request.");
});

test("password reset updates the account password", async () => {
  const email = `reset-${Date.now()}@example.com`;
  await signupAndVerify(email);

  const resetRequest = await request("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  assert.equal(resetRequest.status, 200);
  assert.ok(resetRequest.body.resetToken);

  const confirmReset = await request("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({
      email,
      token: resetRequest.body.resetToken,
      password: "newpassword123",
    }),
  });

  assert.equal(confirmReset.status, 200);

  const oldPasswordLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password123",
    }),
  });

  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "newpassword123",
    }),
  });

  assert.equal(newPasswordLogin.status, 200);
  assert.ok(newPasswordLogin.body.token);
});

test("new accounts cannot access sample dashboard data before setup", async () => {
  const email = `dashboard-${Date.now()}@example.com`;
  const token = await signupAndVerify(email);
  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const summary = await request("/dashboard/summary", {
    headers: authHeaders,
  });
  assert.equal(summary.status, 400);
  assert.match(summary.body.error, /shop setup/i);
});

test("dashboard APIs and write paths work in the demo workspace", async () => {
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "demo@orrico.com",
      password: "demo123",
    }),
  });

  assert.equal(login.status, 200);
  assert.equal(login.body.user.authProvider, "demo");

  const authHeaders = {
    Authorization: `Bearer ${login.body.token}`,
  };

  const oversizedChat = await request("/chat/message", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ message: "x".repeat(4001) }),
  });
  assert.equal(oversizedChat.status, 413);

  const restoredSession = await request("/auth/session", {
    headers: authHeaders,
  });
  assert.equal(restoredSession.status, 200);
  assert.equal(restoredSession.body.user.id, "demo-user");
  assert.equal(restoredSession.body.user.authProvider, "demo");

  const invalidLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "demo@orrico.com",
      password: "wrong-password",
    }),
  });
  assert.equal(invalidLogin.status, 401);

  const summary = await request("/dashboard/summary", {
    headers: authHeaders,
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.available, true);
  assert.ok(summary.body.metrics.length >= 4);

  const chat = await request("/chat/message", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      message: "Show me the top 5 products this week",
    }),
  });
  assert.equal(chat.status, 503);
  assert.match(chat.body.error, /Gemini/);

  const createdProduct = await request("/dashboard/products", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "API Test Product",
      category: "Testing",
      price: 999,
      stock: 5,
    }),
  });

  assert.equal(createdProduct.status, 201);
  const productId = createdProduct.body.product.id;

  const updatedProduct = await request(
    `/dashboard/products/${productId}`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        name: "API Test Product Updated",
        category: "Testing",
        price: 1299,
        stock: 7,
      }),
    },
  );

  assert.equal(updatedProduct.status, 200);
  assert.equal(updatedProduct.body.product.price, 1299);

  const updatedStock = await request(
    `/dashboard/products/${productId}/stock`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ stock: 3 }),
    },
  );

  assert.equal(updatedStock.status, 200);
  assert.equal(updatedStock.body.product.stock, 3);

  const createdOrder = await request("/dashboard/orders", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      productId,
      quantity: 1,
      customerName: "API Test Customer",
      customerEmail: "api.customer@example.com",
      customerPhone: "+91 90000 00000",
    }),
  });

  assert.equal(createdOrder.status, 201);
  assert.ok(createdOrder.body.order.id);

  const customers = await request("/dashboard/customers", {
    headers: authHeaders,
  });

  assert.equal(customers.status, 200);
  const createdCustomer = customers.body.customers.find(
    (entry) => entry.email === "api.customer@example.com",
  );
  assert.ok(createdCustomer);

  const updatedCustomer = await request(
    `/dashboard/customers/${createdCustomer.id}`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        name: "API Test Customer Updated",
        email: "api.customer@example.com",
        phone: "+91 91111 11111",
      }),
    },
  );

  assert.equal(updatedCustomer.status, 200);
  assert.equal(
    updatedCustomer.body.customer.name,
    "API Test Customer Updated",
  );

  const orders = await request("/dashboard/orders", {
    headers: authHeaders,
  });
  assert.equal(orders.status, 200);
  assert.ok(
    orders.body.orders.some(
      (entry) => entry.customerEmail === "api.customer@example.com",
    ),
  );

  const deleteProduct = await request(
    `/dashboard/products/${productId}`,
    {
      method: "DELETE",
      headers: authHeaders,
    },
  );
  assert.equal(deleteProduct.status, 400);
});

test("cookie logout revokes the session on the server", async () => {
  const token = await signupAndVerify(`cookie-${Date.now()}@example.com`);
  const headers = { Cookie: `orrico_session=${token}` };
  assert.equal((await request("/auth/session", { headers })).status, 200);
  assert.equal((await request("/auth/logout", { method: "POST", headers })).status, 204);
  assert.equal((await request("/auth/session", { headers })).status, 401);
});

test("customer CSV imports stay isolated and missing Gemini credentials return no fabricated chat history", async () => {
  const tokenA = await signupAndVerify(`csv-a-${Date.now()}@example.com`);
  const tokenB = await signupAndVerify(`csv-b-${Date.now()}@example.com`);
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };
  assert.equal((await request("/database/current", { headers: headersA })).body.connection, null);
  assert.equal((await request("/dashboard/summary", { headers: headersA })).status, 400);
  for (const [headers, csvContent] of [[headersA, 'id,item,revenue,cost\n1,Alpha,20,5\n2,Beta,30,10'], [headersB, 'id,item,revenue,cost\n1,Other,999,1']]) {
    const imported = await request("/database/import-csv", { method: "POST", headers, body: JSON.stringify({ csvContent, tableName: "metrics", fileName: "metrics.csv" }) });
    assert.equal(imported.status, 201);
  }
  const currentA = (await request("/database/current", { headers: headersA })).body.connection;
  const currentB = (await request("/database/current", { headers: headersB })).body.connection;
  assert.notEqual(currentA.filePath, currentB.filePath);
  const schema = await request("/database/schema", { headers: headersA });
  assert.deepEqual(schema.body.schema.map(table => table.table), ["metrics"]);
  const ask = (headers, message) => request("/chat/message", { method: "POST", headers, body: JSON.stringify({ message }) });
  const sumA = await ask(headersA, "What is the total revenue in metrics?");
  assert.equal(sumA.status, 503);
  assert.match(sumA.body.error, /Gemini API key/);
  assert.equal(sumA.body.reply, undefined);
  assert.equal((await ask(headersB, "What is the total revenue in metrics?")).status, 503);
  assert.equal((await executeReadOnlyQuery(currentA, "SELECT SUM(revenue) AS total FROM metrics"))[0].total, 50);
  assert.equal((await executeReadOnlyQuery(currentB, "SELECT SUM(revenue) AS total FROM metrics"))[0].total, 999);
  assert.equal((await request("/chat/history", { headers: headersA })).body.messages.length, 0);
  const intelligence = (await request("/intelligence/status", { headers: headersA })).body;
  assert.equal(intelligence.provider, "gemini");
  assert.equal(intelligence.configured, false);
  assert.equal((await ask(headersA, "x".repeat(4001))).status, 413);
  await assert.rejects(executeReadOnlyQuery(currentA, "WITH removed AS (DELETE FROM metrics RETURNING *) SELECT * FROM removed"), /read-only/);
  await assert.rejects(executeReadOnlyQuery(currentA, "SELECT * FROM metrics; DROP TABLE metrics"), /read-only/);
  assert.equal((await executeReadOnlyQuery(currentA, "SELECT COUNT(*) AS total FROM metrics"))[0].total, 2);
  assert.equal((await request("/database/connect", { method: "POST", headers: headersA, body: JSON.stringify({ databaseType: "sqlite", filePath: currentB.filePath }) })).status, 400);
});

test("CSV accepts multiline quoted fields and invalid replacements preserve the original table", async () => {
  const token = await signupAndVerify(`csv-quotes-${Date.now()}@example.com`);
  const headers = { Authorization: `Bearer ${token}` };
  const upload = csvContent => request("/database/import-csv", { method: "POST", headers, body: JSON.stringify({ csvContent, tableName: "notes", fileName: "notes.csv" }) });
  assert.equal((await upload('name,note\nAlpha,"Two\nlines, and ""quotes"""')).status, 201);
  const current = (await request("/database/current", { headers })).body.connection;
  const rows = await executeReadOnlyQuery(current, "SELECT note FROM notes");
  assert.equal(rows[0].note, 'Two\nlines, and "quotes"');
  assert.equal((await upload("name,name\nAlpha,Beta")).status, 400);
  assert.equal((await executeReadOnlyQuery(current, "SELECT COUNT(*) AS total FROM notes"))[0].total, 1);
});

test("unknown API routes return JSON and intelligence status requires authentication", async () => {
  assert.equal((await request("/intelligence/status")).status, 401);
  assert.equal((await request("/does-not-exist")).status, 404);
});
