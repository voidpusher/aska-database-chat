import "./env.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createSession,
  hashPassword,
  isPasswordHash,
  isSessionExpired,
  isTimedTokenExpired,
  shouldRefreshSession,
  touchSession,
  verifyPassword,
} from "./auth.js";
import { buildLlmChatReply, getChatModel, isChatConfigured } from "./llm-chat-engine.js";
import {
  assertMessageQuota,
  createCheckoutSession,
  createPortalSession,
  extractSubscriptionUpdate,
  getMonthlyMessageCount,
  getPlanForUser,
  isStripeEnabled,
  parseWebhookEvent,
  PLANS,
} from "./billing.js";
import {
  createRetailOrder,
  createRetailProduct,
  deleteRetailCustomer,
  deleteRetailProduct,
  getSchemaOverview,
  importCsvDataset,
  openRetailDatabase,
  updateRetailCustomer,
  updateRetailProductStock,
  updateRetailProduct,
} from "./demo-retail-db.js";
import {
  getRelationalSchemaOverview,
  testRelationalConnection,
} from "./live-relational-db.js";
import {
  getDashboardCustomers,
  getDashboardDetails,
  getDashboardOrders,
  getDashboardSummary,
} from "./dashboard-service.js";
import {
  appendAuditEntry,
  checkStoreHealth,
  getStoreInfo,
  getStoreMode,
  readData,
  writeData,
} from "./data-store.js";
import {
  errorHandler,
  requestContextMiddleware,
  requestLoggerMiddleware,
} from "./logger.js";
import {
  getCorsOrigins,
  getRuntimeSummary,
} from "./runtime.js";
import {
  decryptSecret,
  encryptSecret,
} from "./secrets.js";
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  getAppBaseUrl,
  isEmailAuthOptional,
  sendTransactionalEmail,
} from "./email-service.js";

const SESSION_COOKIE_NAME = "orrico_session";

const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (request) => request.path.startsWith("/health"),
  message: { error: "Too many requests. Please try again shortly." },
});

const authEndpointRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication requests. Try again later." },
});

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

app.use(
  cors({
    origin: getCorsOrigins(),
    credentials: true,
  }),
);
app.use(requestContextMiddleware);
app.use(requestLoggerMiddleware);
app.use("/api", apiRateLimit);
app.use("/api/auth", authEndpointRateLimit);
app.use(cookieParser());
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      if (req.originalUrl === "/api/billing/webhook") {
        req.rawBody = buf;
      }
    },
  }),
);

const authAttemptStore = new Map();
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 8;

function sanitizeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    businessName: user.businessName,
    avatarUrl: user.avatarUrl || null,
    authProvider: user.authProvider || "password",
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt || null,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

function isDemoUser(user) {
  return (
    user?.authProvider === "demo" ||
    user?.id === "demo-user" ||
    String(user?.email || "").trim().toLowerCase() === "demo@orrico.com"
  );
}

function createAuditEntry(request, event, userId) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || request.ip || "unknown").split(",")[0].trim();

  return {
    id: crypto.randomUUID(),
    userId: userId || undefined,
    event,
    ip,
    userAgent: request.headers["user-agent"] || undefined,
    createdAt: new Date().toISOString(),
  };
}

function setSessionCookie(response, token) {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: Number(process.env.SESSION_TTL_HOURS || 24 * 30) * 60 * 60 * 1000,
    path: "/",
  });
}

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

function normalizeConnectionPayload(payload) {
  return {
    databaseType: String(payload.databaseType || "").trim().toLowerCase(),
    host: String(payload.host || "").trim(),
    port: String(payload.port || "").trim(),
    databaseName: String(payload.databaseName || "").trim(),
    username: String(payload.username || "").trim(),
    password: String(payload.password || "").trim(),
    ssl: Boolean(payload.ssl),
    filePath: String(payload.filePath || "").trim(),
    isDemoConnection: Boolean(payload.isDemoConnection),
    connectedAt: payload.connectedAt || new Date().toISOString(),
  };
}

function sanitizeConnection(connection) {
  if (!connection) {
    return null;
  }

  const { password, ...safeConnection } = connection;

  return {
    ...safeConnection,
    hasPassword: Boolean(password),
  };
}

function canUseDemoWorkspace(user, connection) {
  return (
    isDemoUser(user) ||
    Boolean(connection?.isDemoConnection)
  );
}

function getPrivateCsvConnection(userId) {
  const directory = path.resolve(process.env.APP_DATA_DIRECTORY || (process.env.VERCEL ? "/tmp/orrico-data" : "server/data"), "workspaces");
  fs.mkdirSync(directory, { recursive: true });
  return {
    userId, databaseType: "sqlite", databaseName: "CSV workspace",
    filePath: path.join(directory, `${crypto.createHash("sha256").update(userId).digest("hex")}.sqlite`),
    isDemoConnection: false, connectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function scopeConnectionToUser(payload, user) {
  if (user.authProvider === "demo") {
    if (payload.isDemoConnection) return { ...payload, databaseType: "sqlite", filePath: "demo_retail_shop.db", ssl: false };
    throw new Error("Demo accounts use the sample database. Sign in with your own account to connect private data.");
  }
  if (payload.isDemoConnection) throw new Error("Use demo login to access the sample workspace.");
  if (payload.databaseType === "sqlite") {
    const privateConnection = getPrivateCsvConnection(user.id);
    if (payload.filePath && path.resolve(payload.filePath) !== privateConnection.filePath) throw new Error("Use CSV import to create your private SQLite workspace.");
    return privateConnection;
  }
  return payload;
}

function prepareConnectionForStorage(connection) {
  return {
    ...connection,
    password: connection.password
      ? encryptSecret(connection.password)
      : "",
  };
}

function prepareConnectionForUse(connection) {
  if (!connection) {
    return null;
  }

  return {
    ...connection,
    password: connection.password
      ? decryptSecret(connection.password)
      : "",
  };
}

function validateConnectionPayload(payload) {
  if (!payload.databaseType) {
    return "Database type is required.";
  }

  if (
    !["sqlite", "postgresql", "mysql", "oracle"].includes(
      payload.databaseType,
    )
  ) {
    return "Unsupported database type.";
  }

  if (payload.databaseType === "oracle") {
    return "Oracle connector is not implemented yet.";
  }

  if (payload.databaseType === "sqlite") {
    return null;
  }

  if (
    !payload.host ||
    !payload.port ||
    !payload.databaseName ||
    !payload.username ||
    !payload.password
  ) {
    return "Host, port, database name, username, and password are required.";
  }

  return null;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isTextLengthValid(value, maximum) {
  const text = normalizeText(value);
  return text.length > 0 && text.length <= maximum;
}

async function pruneExpiredSessions(data) {
  const sessionsChanged =
    data.sessions.some((entry) => isSessionExpired(entry));
  const passwordResetTokensChanged =
    data.passwordResetTokens.some(
      (entry) =>
        isTimedTokenExpired(entry) || entry.consumedAt,
    );
  const emailVerificationTokensChanged =
    data.emailVerificationTokens.some(
      (entry) =>
        isTimedTokenExpired(entry) || entry.consumedAt,
    );
  const nextSessions = data.sessions.filter(
    (entry) => !isSessionExpired(entry),
  );
  const nextPasswordResetTokens = data.passwordResetTokens.filter(
    (entry) =>
      !isTimedTokenExpired(entry) && !entry.consumedAt,
  );
  const nextEmailVerificationTokens =
    data.emailVerificationTokens.filter(
      (entry) =>
        !isTimedTokenExpired(entry) && !entry.consumedAt,
    );

  if (sessionsChanged) {
    data.sessions = nextSessions;
  }

  if (passwordResetTokensChanged) {
    data.passwordResetTokens = nextPasswordResetTokens;
  }

  if (emailVerificationTokensChanged) {
    data.emailVerificationTokens =
      nextEmailVerificationTokens;
  }

  if (
    sessionsChanged ||
    passwordResetTokensChanged ||
    emailVerificationTokensChanged
  ) {
    await writeData(data);
  }
}

function getRateLimitKey(request, email) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || request.ip || "unknown");

  return `${ipAddress}:${normalizeEmail(email)}`;
}

function assertAuthRateLimit(request, response, email) {
  const key = getRateLimitKey(request, email);
  const now = Date.now();
  const currentWindow =
    authAttemptStore.get(key) || { count: 0, firstAttemptAt: now };

  if (now - currentWindow.firstAttemptAt > AUTH_ATTEMPT_WINDOW_MS) {
    authAttemptStore.set(key, {
      count: 0,
      firstAttemptAt: now,
    });
    return { key, blocked: false };
  }

  if (currentWindow.count >= AUTH_MAX_ATTEMPTS) {
    response.status(429).json({
      error: "Too many login attempts. Try again in a few minutes.",
    });
    return { key, blocked: true };
  }

  return { key, blocked: false };
}

function recordFailedAuthAttempt(key) {
  const now = Date.now();
  const currentWindow =
    authAttemptStore.get(key) || { count: 0, firstAttemptAt: now };

  if (now - currentWindow.firstAttemptAt > AUTH_ATTEMPT_WINDOW_MS) {
    authAttemptStore.set(key, {
      count: 1,
      firstAttemptAt: now,
    });
    return;
  }

  authAttemptStore.set(key, {
    count: currentWindow.count + 1,
    firstAttemptAt: currentWindow.firstAttemptAt,
  });
}

function clearFailedAuthAttempts(key) {
  authAttemptStore.delete(key);
}

async function getSessionFromRequest(request) {
  const cookieToken = request.cookies?.[SESSION_COOKIE_NAME] || null;
  const authorization = request.headers.authorization || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return null;
  }

  const data = await readData();
  await pruneExpiredSessions(data);
  const session = data.sessions.find((entry) => entry.token === token);

  if (!session) {
    return null;
  }

  const user = data.users.find((entry) => entry.id === session.userId);

  if (!user) {
    return null;
  }

  if (shouldRefreshSession(session)) {
    touchSession(session);
    await writeData(data);
  }

  return { data, token, session, user };
}

function findUserByEmail(data, email) {
  return data.users.find(
    (entry) => entry.email.toLowerCase() === normalizeEmail(email),
  );
}

function getLatestVerificationTokenForUser(data, userId) {
  return [...data.emailVerificationTokens]
    .filter(
      (entry) =>
        entry.userId === userId &&
        !entry.consumedAt &&
        !isTimedTokenExpired(entry),
    )
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) -
        Date.parse(left.createdAt),
    )[0];
}

async function deliverVerificationEmail(user, token) {
  return sendTransactionalEmail(
    buildVerificationEmail({
      email: user.email,
      firstName: user.firstName,
      token,
      appBaseUrl: getAppBaseUrl(),
    }),
  );
}

async function deliverPasswordResetEmail(user, token) {
  return sendTransactionalEmail(
    buildPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      token,
      appBaseUrl: getAppBaseUrl(),
    }),
  );
}

app.get("/api/health", async (request, response) => {
  try {
    const storeHealth = await checkStoreHealth();
    const storeInfo = getStoreInfo();
    const runtime = getRuntimeSummary({
      storeMode: getStoreMode(),
      storeHealth,
    });

    response.json({
      status: storeHealth.ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      store: {
        ...storeInfo,
        ...storeHealth,
      },
      runtime,
    });
  } catch {
    response.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    });
  }
});

app.get("/api/health/ready", async (request, response) => {
  try {
    const storeHealth = await checkStoreHealth();
    const runtime = getRuntimeSummary({
      storeMode: getStoreMode(),
      storeHealth,
    });
    const ready =
      storeHealth.ok && runtime.missingProductionEnvVars.length === 0;

    response.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date().toISOString(),
      runtime,
    });
  } catch {
    response.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: "A required backend dependency is unavailable.",
      requestId: request.requestId,
    });
  }
});

app.post("/api/auth/signup", async (request, response) => {
  const {
    firstName,
    lastName,
    email,
    businessName,
    password,
  } = request.body || {};

  if (!firstName || !lastName || !email || !businessName || !password) {
    response.status(400).json({ error: "Missing required fields." });
    return;
  }

  if (
    !isTextLengthValid(firstName, 80) ||
    !isTextLengthValid(lastName, 80) ||
    !isTextLengthValid(businessName, 160)
  ) {
    response.status(400).json({
      error: "Name or business details are too long.",
    });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const rateLimit = assertAuthRateLimit(
    request,
    response,
    normalizedEmail,
  );

  if (rateLimit.blocked) {
    return;
  }

  if (!isValidEmail(normalizedEmail)) {
    recordFailedAuthAttempt(rateLimit.key);
    response.status(400).json({ error: "Invalid email address." });
    return;
  }

  if (String(password).length < 8 || String(password).length > 256) {
    recordFailedAuthAttempt(rateLimit.key);
    response
      .status(400)
      .json({ error: "Password must be between 8 and 256 characters." });
    return;
  }

  const data = await readData();
  const existingUser = findUserByEmail(data, normalizedEmail);

  if (existingUser) {
    if (
      existingUser.authProvider === "password" &&
      !existingUser.emailVerifiedAt
    ) {
      const verificationToken =
        getLatestVerificationTokenForUser(data, existingUser.id) ||
        createEmailVerificationToken(existingUser.id);

      if (
        !data.emailVerificationTokens.find(
          (entry) => entry.token === verificationToken.token,
        )
      ) {
        data.emailVerificationTokens.push(verificationToken);
      }

      await writeData(data);
      const emailResult = await deliverVerificationEmail(
        existingUser,
        verificationToken.token,
      );
      recordFailedAuthAttempt(rateLimit.key);
      response.status(409).json({
        error:
          "This email is already registered but still needs verification.",
        requiresEmailVerification: true,
        email: existingUser.email,
        emailDelivery: emailResult,
        verificationToken:
          process.env.NODE_ENV === "production"
            ? undefined
            : verificationToken.token,
      });
      return;
    }

    recordFailedAuthAttempt(rateLimit.key);
    response.status(409).json({ error: "Email already registered." });
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    firstName: normalizeText(firstName),
    lastName: normalizeText(lastName),
    email: normalizedEmail,
    businessName: normalizeText(businessName),
    passwordHash: await hashPassword(String(password)),
    authProvider: "password",
    createdAt: new Date().toISOString(),
    emailVerifiedAt: isEmailAuthOptional()
      ? new Date().toISOString()
      : null,
  };
  const requiresEmailVerification = !user.emailVerifiedAt;

  data.users.push(user);
  let verificationToken = null;
  let emailResult = {
    delivered: false,
    skipped: true,
    reason: "Email verification is currently optional.",
  };

  if (requiresEmailVerification) {
    verificationToken = createEmailVerificationToken(user.id);
    data.emailVerificationTokens.push(verificationToken);
  }

  let session = null;
  if (!requiresEmailVerification) {
    session = createSession(user.id);
    data.sessions.push(session);
  }

  await writeData(data);

  if (verificationToken) {
    emailResult = await deliverVerificationEmail(
      user,
      verificationToken.token,
    );
  }
  clearFailedAuthAttempts(rateLimit.key);

  if (session) {
    setSessionCookie(response, session.token);
  }

  appendAuditEntry(createAuditEntry(request, "signup_success", user.id)).catch(() => undefined);

  response.status(201).json({
    token: session?.token,
    user: sanitizeUser(user),
    requiresEmailVerification,
    emailDelivery: emailResult,
    verificationToken:
      !verificationToken || process.env.NODE_ENV === "production"
        ? undefined
        : verificationToken.token,
  });
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body || {};
  const normalizedEmail = normalizeEmail(email);
  const rateLimit = assertAuthRateLimit(
    request,
    response,
    normalizedEmail,
  );

  if (rateLimit.blocked) {
    return;
  }

  if (!normalizedEmail || !password) {
    recordFailedAuthAttempt(rateLimit.key);
    response.status(400).json({ error: "Email and password are required." });
    return;
  }

  if (!isValidEmail(normalizedEmail) || String(password).length > 256) {
    recordFailedAuthAttempt(rateLimit.key);
    response.status(400).json({ error: "Invalid login request." });
    return;
  }

  const data = await readData();
  await pruneExpiredSessions(data);

  let user = data.users.find(
    (entry) => entry.email.toLowerCase() === normalizedEmail,
  );

  if (normalizedEmail === "demo@orrico.com") {
    if (String(password) !== "demo123") {
      user = null;
    } else {
      if (!user) {
        user = {
          id: "demo-user",
          createdAt: new Date().toISOString(),
        };
        data.users.push(user);
      }

      Object.assign(user, {
        firstName: "Demo",
        lastName: "User",
        email: normalizedEmail,
        businessName: "Demo Retail Store",
        authProvider: "demo",
      });
    }
  } else if (user?.authProvider === "password") {
    const submittedPassword = String(password);
    const legacyPassword = user.password;
    let isAuthenticated = false;

    if (isPasswordHash(user.passwordHash)) {
      isAuthenticated = await verifyPassword(
        submittedPassword,
        user.passwordHash,
      );
    } else if (
      typeof legacyPassword === "string" &&
      legacyPassword === submittedPassword
    ) {
      user.passwordHash = await hashPassword(submittedPassword);
      delete user.password;
      isAuthenticated = true;
    }

    if (!isAuthenticated) {
      user = null;
    }
  }

  if (!user) {
    recordFailedAuthAttempt(rateLimit.key);
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (
    user.authProvider === "password" &&
    !user.emailVerifiedAt
  ) {
    if (isEmailAuthOptional()) {
      user.emailVerifiedAt = new Date().toISOString();
      const session = createSession(user.id);
      data.sessions.push(session);
      await writeData(data);
      clearFailedAuthAttempts(rateLimit.key);
      setSessionCookie(response, session.token);

      response.json({
        token: session.token,
        user: sanitizeUser(user),
      });
      return;
    }

    const verificationToken =
      getLatestVerificationTokenForUser(data, user.id) ||
      createEmailVerificationToken(user.id);

    if (
      !data.emailVerificationTokens.find(
        (entry) => entry.token === verificationToken.token,
      )
    ) {
      data.emailVerificationTokens.push(verificationToken);
    }

    await writeData(data);
    const emailResult = await deliverVerificationEmail(
      user,
      verificationToken.token,
    );
    response.status(403).json({
      error: "Please verify your email before signing in.",
      requiresEmailVerification: true,
      email: user.email,
      emailDelivery: emailResult,
      verificationToken:
        process.env.NODE_ENV === "production"
          ? undefined
          : verificationToken.token,
    });
    return;
  }

  data.sessions = data.sessions.filter((entry) => entry.userId !== user.id);
  const session = createSession(user.id);
  data.sessions.push(session);
  await writeData(data);
  clearFailedAuthAttempts(rateLimit.key);
  setSessionCookie(response, session.token);
  appendAuditEntry(createAuditEntry(request, "login_success", user.id)).catch(() => undefined);

  response.json({
    token: session.token,
    user: sanitizeUser(user),
  });
});

app.post("/api/auth/verify-email/request", async (request, response) => {
  if (isEmailAuthOptional()) {
    response.json({
      ok: true,
      message:
        "Email verification is currently optional for this deployment.",
    });
    return;
  }

  const normalizedEmail = normalizeEmail(request.body?.email);

  if (!normalizedEmail) {
    response.status(400).json({ error: "Email is required." });
    return;
  }

  const data = await readData();
  const user = findUserByEmail(data, normalizedEmail);

  if (!user) {
    response.json({
      ok: true,
      message:
        "If an account exists for that email, a verification link has been prepared.",
    });
    return;
  }

  if (user.emailVerifiedAt) {
    response.json({
      ok: true,
      message: "This email address is already verified.",
    });
    return;
  }

  data.emailVerificationTokens =
    data.emailVerificationTokens.filter(
      (entry) => entry.userId !== user.id,
    );

  const verificationToken = createEmailVerificationToken(
    user.id,
  );
  data.emailVerificationTokens.push(verificationToken);
  await writeData(data);
  const emailResult = await deliverVerificationEmail(
    user,
    verificationToken.token,
  );

  response.json({
    ok: true,
    message:
      "Verification instructions have been prepared for this email address.",
    emailDelivery: emailResult,
    verificationToken:
      process.env.NODE_ENV === "production"
        ? undefined
        : verificationToken.token,
  });
});

app.post("/api/auth/verify-email/confirm", async (request, response) => {
  if (isEmailAuthOptional()) {
    response.status(400).json({
      error: "Email verification is currently disabled for this deployment.",
    });
    return;
  }

  const normalizedEmail = normalizeEmail(request.body?.email);
  const token = String(request.body?.token || "").trim();

  if (!normalizedEmail || !token) {
    response
      .status(400)
      .json({ error: "Email and verification token are required." });
    return;
  }

  const data = await readData();
  const user = findUserByEmail(data, normalizedEmail);

  if (!user) {
    response.status(404).json({ error: "Account not found." });
    return;
  }

  const verificationToken = data.emailVerificationTokens.find(
    (entry) =>
      entry.token === token && entry.userId === user.id,
  );

  if (!verificationToken || isTimedTokenExpired(verificationToken)) {
    response.status(400).json({
      error: "Verification token is invalid or expired.",
    });
    return;
  }

  verificationToken.consumedAt = new Date().toISOString();
  user.emailVerifiedAt = new Date().toISOString();
  data.emailVerificationTokens =
    data.emailVerificationTokens.filter(
      (entry) => entry.userId !== user.id,
    );
  const session = createSession(user.id);
  data.sessions.push(session);
  await writeData(data);
  setSessionCookie(response, session.token);
  appendAuditEntry(createAuditEntry(request, "email_verified", user.id)).catch(() => undefined);

  response.json({
    token: session.token,
    user: sanitizeUser(user),
  });
});

app.post("/api/auth/password-reset/request", async (request, response) => {
  if (isEmailAuthOptional()) {
    response.status(400).json({
      error: "Password reset by email is currently unavailable.",
    });
    return;
  }

  const normalizedEmail = normalizeEmail(request.body?.email);

  if (!normalizedEmail) {
    response.status(400).json({ error: "Email is required." });
    return;
  }

  const data = await readData();
  const user = findUserByEmail(data, normalizedEmail);

  if (!user) {
    response.json({
      ok: true,
      message:
        "If an account exists for that email, reset instructions have been prepared.",
    });
    return;
  }

  data.passwordResetTokens = data.passwordResetTokens.filter(
    (entry) => entry.userId !== user.id,
  );
  const resetToken = createPasswordResetToken(user.id);
  data.passwordResetTokens.push(resetToken);
  await writeData(data);
  const emailResult = await deliverPasswordResetEmail(
    user,
    resetToken.token,
  );

  response.json({
    ok: true,
    message:
      "Reset instructions have been prepared for this email address.",
    emailDelivery: emailResult,
    resetToken:
      process.env.NODE_ENV === "production"
        ? undefined
        : resetToken.token,
  });
});

app.post("/api/auth/password-reset/confirm", async (request, response) => {
  const normalizedEmail = normalizeEmail(request.body?.email);
  const token = String(request.body?.token || "").trim();
  const password = String(request.body?.password || "");

  if (!normalizedEmail || !token || !password) {
    response.status(400).json({
      error: "Email, reset token, and new password are required.",
    });
    return;
  }

  if (password.length < 8) {
    response.status(400).json({
      error: "Password must be at least 8 characters.",
    });
    return;
  }

  const data = await readData();
  const user = findUserByEmail(data, normalizedEmail);

  if (!user) {
    response.status(404).json({ error: "Account not found." });
    return;
  }

  const resetToken = data.passwordResetTokens.find(
    (entry) =>
      entry.token === token && entry.userId === user.id,
  );

  if (!resetToken || isTimedTokenExpired(resetToken)) {
    response.status(400).json({
      error: "Reset token is invalid or expired.",
    });
    return;
  }

  resetToken.consumedAt = new Date().toISOString();
  user.passwordHash = await hashPassword(password);
  delete user.password;
  data.passwordResetTokens = data.passwordResetTokens.filter(
    (entry) => entry.userId !== user.id,
  );
  data.sessions = data.sessions.filter(
    (entry) => entry.userId !== user.id,
  );
  await writeData(data);
  appendAuditEntry(createAuditEntry(request, "password_reset", user.id)).catch(() => undefined);

  response.json({
    ok: true,
    message: "Password updated successfully. Sign in again.",
  });
});

app.get("/api/auth/session", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Session not found." });
    return;
  }

  response.json({
    user: sanitizeUser(session.user),
  });
});

app.post("/api/auth/logout", async (request, response) => {
  const authorization = request.headers.authorization || "";
  const token = request.cookies?.[SESSION_COOKIE_NAME] || (authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null);

  clearSessionCookie(response);

  if (!token) {
    response.status(204).end();
    return;
  }

  const data = await readData();
  data.sessions = data.sessions.filter((entry) => entry.token !== token);
  await writeData(data);
  response.status(204).end();
});

app.get("/api/database/current", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection = session.data.databaseConnections.find(
    (entry) => entry.userId === session.user.id,
  );

  response.json({
    connection: sanitizeConnection(connection || null),
  });
});

app.get("/api/database/schema", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before exploring schema details.",
    });
    return;
  }

  try {
    if (
      connection &&
      ["postgresql", "mysql"].includes(connection.databaseType)
    ) {
      const overview =
        await getRelationalSchemaOverview(
          prepareConnectionForUse(connection),
        );
      response.json(overview);
      return;
    }

    const overview = getSchemaOverview(
      prepareConnectionForUse(connection),
    );
    response.json(overview);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Schema inspection failed.",
    });
  }
});

app.post("/api/database/test", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  let payload;
  try { payload = scopeConnectionToUser(normalizeConnectionPayload(request.body || {}), session.user); }
  catch (error) { response.status(400).json({ error: error.message }); return; }
  const validationError = validateConnectionPayload(payload);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  try {
    if (
      ["postgresql", "mysql"].includes(payload.databaseType)
    ) {
      const result = await testRelationalConnection(payload);
      response.json({
        ok: result.ok,
        databasePath: `${payload.host}:${payload.port}/${payload.databaseName}`,
        tableCount: result.tableCount,
      });
      return;
    }

    const { database, databasePath } = openRetailDatabase(payload);
    try {
      const tableCountRow = database
        .prepare(`
          SELECT COUNT(*) AS total
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        `)
        .get();

      response.json({
        ok: true,
        databasePath,
        tableCount: Number(tableCountRow?.total || 0),
      });
    } finally {
      database.close();
    }
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Database connection test failed.",
    });
  }
});

app.post("/api/database/connect", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  let payload;
  try { payload = scopeConnectionToUser(normalizeConnectionPayload(request.body || {}), session.user); }
  catch (error) { response.status(400).json({ error: error.message }); return; }
  const validationError = validateConnectionPayload(payload);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  try {
    if (
      ["postgresql", "mysql"].includes(payload.databaseType)
    ) {
        await testRelationalConnection(payload);
      } else {
        const { database } = openRetailDatabase(payload);
        database.close();
    }
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify the database connection.",
    });
    return;
  }

  const nextConnection = {
    userId: session.user.id,
    ...prepareConnectionForStorage(payload),
    updatedAt: new Date().toISOString(),
  };

  session.data.databaseConnections =
    session.data.databaseConnections.filter(
      (entry) => entry.userId !== session.user.id,
    );
  session.data.databaseConnections.push(nextConnection);
  await writeData(session.data);

  response.json({ connection: sanitizeConnection(nextConnection) });
});

app.post("/api/database/import-csv", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  let connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (
    connection &&
    connection.databaseType &&
    connection.databaseType !== "sqlite" &&
    !connection.isDemoConnection
  ) {
    response.status(400).json({
      error:
        "CSV import is currently available for the demo SQLite database and SQLite file connections.",
    });
    return;
  }

  const { csvContent, tableName, fileName } = request.body || {};

  if (!csvContent || !String(csvContent).trim()) {
    response.status(400).json({ error: "CSV content is required." });
    return;
  }

  try {
    // A first import for a real account must never write into the shared demo.
    if (!connection && session.user.authProvider !== "demo") {
      connection = getPrivateCsvConnection(session.user.id);
    }
    const result = importCsvDataset(connection, {
      csvContent: String(csvContent),
      tableName: String(tableName || ""),
      fileName: String(fileName || ""),
    });

    if (connection && !session.data.databaseConnections.some(entry => entry.userId === session.user.id)) {
      session.data.databaseConnections.push(connection);
      await writeData(session.data);
    }

    response.status(201).json(result);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "CSV import failed.",
    });
  }
});

app.get("/api/dashboard/summary", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before opening the dashboard.",
    });
    return;
  }

  try {
    const summary = await getDashboardSummary(
      prepareConnectionForUse(connection),
    );
    response.json(summary);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Dashboard summary could not be loaded.",
    });
  }
});

app.get("/api/dashboard/details", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before opening the dashboard.",
    });
    return;
  }

  try {
    const details = await getDashboardDetails(
      prepareConnectionForUse(connection),
    );
    response.json(details);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Dashboard details could not be loaded.",
    });
  }
});

app.get("/api/dashboard/orders", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before viewing orders.",
    });
    return;
  }

  try {
    const orders = await getDashboardOrders(
      prepareConnectionForUse(connection),
      request.query.limit,
    );
    response.json(orders);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Dashboard orders could not be loaded.",
    });
  }
});

app.get("/api/dashboard/customers", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before viewing customers.",
    });
    return;
  }

  try {
    const customers = await getDashboardCustomers(
      prepareConnectionForUse(connection),
      request.query.limit,
    );
    response.json(customers);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Dashboard customers could not be loaded.",
    });
  }
});

app.post("/api/dashboard/products", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating products.",
    });
    return;
  }

  try {
    const product = createRetailProduct(
      prepareConnectionForUse(connection),
      request.body || {},
    );
    response.status(201).json({ product });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Product could not be created.",
    });
  }
});

app.patch("/api/dashboard/products/:productId", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating products.",
    });
    return;
  }

  try {
    const product = updateRetailProduct(
      prepareConnectionForUse(connection),
      {
        productId: request.params.productId,
        ...request.body,
      },
    );
    response.json({ product });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Product could not be updated.",
    });
  }
});

app.patch("/api/dashboard/products/:productId/stock", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating products.",
    });
    return;
  }

  try {
    const product = updateRetailProductStock(
      prepareConnectionForUse(connection),
      {
        productId: request.params.productId,
        stock: request.body?.stock,
      },
    );
    response.json({ product });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Product stock could not be updated.",
    });
  }
});

app.delete("/api/dashboard/products/:productId", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating products.",
    });
    return;
  }

  try {
    const product = deleteRetailProduct(
      prepareConnectionForUse(connection),
      {
        productId: request.params.productId,
      },
    );
    response.json({ product });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Product could not be deleted.",
    });
  }
});

app.patch("/api/dashboard/customers/:customerId", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating customers.",
    });
    return;
  }

  try {
    const customer = updateRetailCustomer(
      prepareConnectionForUse(connection),
      {
        customerId: request.params.customerId,
        ...request.body,
      },
    );
    response.json({ customer });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Customer could not be updated.",
    });
  }
});

app.delete("/api/dashboard/customers/:customerId", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before updating customers.",
    });
    return;
  }

  try {
    const customer = deleteRetailCustomer(
      prepareConnectionForUse(connection),
      {
        customerId: request.params.customerId,
      },
    );
    response.json({ customer });
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Customer could not be deleted.",
    });
  }
});

app.post("/api/dashboard/orders", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before creating orders.",
    });
    return;
  }

  try {
    const result = createRetailOrder(
      prepareConnectionForUse(connection),
      request.body || {},
    );
    response.status(201).json(result);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Order could not be created.",
    });
  }
});

app.get("/api/chat/history", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const messages = session.data.chatHistory
    .filter((entry) => entry.userId === session.user.id)
    .sort((left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );

  response.json({ messages });
});

app.get("/api/intelligence/status", async (request, response) => {
  if (!await getSessionFromRequest(request)) { response.status(401).json({ error: "Unauthorized." }); return; }
  response.json({ provider: "gemini", model: getChatModel(), configured: isChatConfigured() });
});

app.post("/api/chat/message", chatRateLimit, async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const { message, conversationId } = request.body || {};
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    response.status(400).json({ error: "Message is required." });
    return;
  }

  if (typeof message !== "string") {
    response.status(400).json({ error: "Questions must be text with at most 4,000 characters." });
    return;
  }
  if (message.length > 4000) {
    response.status(413).json({ error: "Message must be 4,000 characters or fewer." });
    return;
  }
  if (conversationId !== undefined && (typeof conversationId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(conversationId))) {
    response.status(400).json({ error: "Invalid conversation identifier." }); return;
  }

  const connection =
    session.data.databaseConnections.find(
      (entry) => entry.userId === session.user.id,
    ) || null;

  if (!connection && !canUseDemoWorkspace(session.user, connection)) {
    response.status(400).json({
      error:
        "Complete your new shop setup before starting chat queries.",
    });
    return;
  }

  try {
    assertMessageQuota(session.data, session.user);
  } catch (quotaError) {
    response.status(402).json({
      error: quotaError.message,
      upgradeRequired: true,
      currentPlan: quotaError.currentPlan,
    });
    return;
  }

  let result;

  try {
    const preparedConnection = prepareConnectionForUse(connection);

    // Build conversation history for context (last 6 exchanges)
    const recentHistory = session.data.chatHistory
      .filter((h) => h.userId === session.user.id && h.mode === "gemini" && (!conversationId || h.conversationId === conversationId))
      .slice(-6)
      .flatMap((h) => [
        { role: "user",      content: h.message },
        { role: "assistant", content: h.reply   },
      ]);

    result = await buildLlmChatReply(String(message), preparedConnection, { history: recentHistory });
  } catch (error) {
    response.status(error.status || 400).json({
      error:
        error instanceof Error
          ? error.message
          : "Chat query failed.",
    });
    return;
  }

  session.data.chatHistory.push({
    id: crypto.randomUUID(),
    userId: session.user.id,
    conversationId: conversationId || null,
    message: String(message).trim(),
    reply: result.reply,
    mode: result.mode,
    createdAt: new Date().toISOString(),
  });
  await writeData(session.data);

  response.json({ sql: null, rows: [], ...result });
});

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

app.get("/api/billing/status", async (request, response) => {
  const session = await getSessionFromRequest(request);
  if (!session) { response.status(401).json({ error: "Unauthorized." }); return; }

  const plan = getPlanForUser(session.user);
  const used = getMonthlyMessageCount(session.data, session.user.id);

  response.json({
    stripeEnabled: isStripeEnabled(),
    plan: {
      key: plan.key,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      features: plan.features,
    },
    usage: {
      messagesThisMonth: used,
      messagesLimit: plan.monthlyMessages === Infinity ? null : plan.monthlyMessages,
      dbConnectionsLimit: plan.dbConnections === Infinity ? null : plan.dbConnections,
    },
    subscription: {
      customerId: session.user.stripeCustomerId || null,
      subscriptionId: session.user.stripeSubscriptionId || null,
      status: session.user.stripeSubscriptionStatus || "active",
    },
    plans: Object.values(PLANS).map((p) => ({
      key: p.key,
      name: p.name,
      priceMonthly: p.priceMonthly,
      features: p.features,
      monthlyMessages: p.monthlyMessages === Infinity ? null : p.monthlyMessages,
      dbConnections: p.dbConnections === Infinity ? null : p.dbConnections,
    })),
  });
});

app.post("/api/billing/checkout", async (request, response) => {
  const session = await getSessionFromRequest(request);
  if (!session) { response.status(401).json({ error: "Unauthorized." }); return; }

  if (!isStripeEnabled()) {
    response.status(503).json({ error: "Billing is not configured on this server." });
    return;
  }

  const { planKey } = request.body || {};
  if (!planKey || !PLANS[planKey] || planKey === "free") {
    response.status(400).json({ error: "Valid paid plan key is required." });
    return;
  }

  const appBase = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

  try {
    const { url, customerId } = await createCheckoutSession(
      session.user,
      planKey,
      `${appBase}/billing/success?plan=${planKey}`,
      `${appBase}/billing/cancel`,
    );

    if (customerId && customerId !== session.user.stripeCustomerId) {
      session.user.stripeCustomerId = customerId;
      await writeData(session.data);
    }

    response.json({ url });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Checkout failed." });
  }
});

app.post("/api/billing/portal", async (request, response) => {
  const session = await getSessionFromRequest(request);
  if (!session) { response.status(401).json({ error: "Unauthorized." }); return; }

  if (!isStripeEnabled()) {
    response.status(503).json({ error: "Billing is not configured on this server." });
    return;
  }

  const customerId = session.user.stripeCustomerId;
  if (!customerId) {
    response.status(400).json({ error: "No billing account found. Subscribe first." });
    return;
  }

  const appBase = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;

  try {
    const { url } = await createPortalSession(customerId, `${appBase}/dashboard`);
    response.json({ url });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Portal session failed." });
  }
});

app.post("/api/billing/webhook", async (request, response) => {
  const sig = request.headers["stripe-signature"] || "";
  const rawBody = request.rawBody;

  if (!rawBody) {
    response.status(400).json({ error: "Missing raw body." });
    return;
  }

  let event;
  try {
    event = parseWebhookEvent(rawBody, sig);
  } catch (error) {
    response.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
    return;
  }

  const SUBSCRIPTION_EVENTS = new Set([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]);

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const { userId, customerId, planKey, status, subscriptionId } = extractSubscriptionUpdate(event);

    const data = await readData();
    const user = userId
      ? data.users.find((u) => u.id === userId)
      : data.users.find((u) => u.stripeCustomerId === customerId);

    if (user) {
      user.stripeCustomerId = customerId;
      user.stripeSubscriptionId = subscriptionId;
      user.stripePlanKey = status === "canceled" || status === "unpaid" ? "free" : planKey;
      user.stripeSubscriptionStatus = status;
      await writeData(data);
      appendAuditEntry(createAuditEntry(request, `billing_${event.type.replace("customer.subscription.", "")}`, user.id)).catch(() => undefined);
    }
  }

  response.json({ received: true });
});

// Pre-warm the local RAG embedding model so first chat message has no cold-start delay

app.get("/api/account/export", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const { user, data } = session;

  const userSessions = data.sessions.filter((s) => s.userId === user.id).map((s) => ({
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }));

  const chatHistory = data.chatHistory
    .filter((entry) => entry.userId === user.id)
    .map((entry) => ({
      message: entry.message,
      reply: entry.reply,
      createdAt: entry.createdAt,
    }));

  const connection = data.databaseConnections.find((c) => c.userId === user.id) || null;

  response.json({
    exportedAt: new Date().toISOString(),
    user: sanitizeUser(user),
    sessions: userSessions,
    chatHistory,
    databaseConnection: sanitizeConnection(connection),
  });
});

app.delete("/api/account", async (request, response) => {
  const session = await getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  const { user, data } = session;

  data.users = data.users.filter((u) => u.id !== user.id);
  data.sessions = data.sessions.filter((s) => s.userId !== user.id);
  data.chatHistory = data.chatHistory.filter((entry) => entry.userId !== user.id);
  data.databaseConnections = data.databaseConnections.filter((c) => c.userId !== user.id);
  data.emailVerificationTokens = data.emailVerificationTokens.filter((t) => t.userId !== user.id);
  data.passwordResetTokens = data.passwordResetTokens.filter((t) => t.userId !== user.id);

  await writeData(data);
  clearSessionCookie(response);
  appendAuditEntry(createAuditEntry(request, "account_deleted", user.id)).catch(() => undefined);

  response.json({ ok: true, message: "Account and all associated data deleted." });
});

// Serve React frontend for direct Node deployments (no nginx)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
app.use(express.static(distDir));
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found.", requestId: req.requestId });
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

app.use(errorHandler);
