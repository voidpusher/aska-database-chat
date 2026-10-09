import crypto from "node:crypto";

const SCRYPT_PARAMS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
};

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_TTL_HOURS = readPositiveNumber(
  process.env.SESSION_TTL_HOURS,
  24 * 30,
);
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = Math.max(
  60 * 1000,
  readPositiveNumber(process.env.SESSION_REFRESH_INTERVAL_MINUTES, 5) *
    60 *
    1000,
);
const PASSWORD_RESET_TTL_HOURS = readPositiveNumber(
  process.env.PASSWORD_RESET_TTL_HOURS,
  2,
);
const EMAIL_VERIFICATION_TTL_HOURS = readPositiveNumber(
  process.env.EMAIL_VERIFICATION_TTL_HOURS,
  24,
);

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_PARAMS.keyLength,
      {
        N: SCRYPT_PARAMS.cost,
        r: SCRYPT_PARAMS.blockSize,
        p: SCRYPT_PARAMS.parallelization,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function createTimedToken(ttlHours) {
  const createdAt = new Date();

  return {
    token: createToken(),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(
      createdAt.getTime() + ttlHours * 60 * 60 * 1000,
    ).toISOString(),
  };
}

export function createPasswordResetToken(userId) {
  return {
    userId,
    ...createTimedToken(PASSWORD_RESET_TTL_HOURS),
  };
}

export function createEmailVerificationToken(userId) {
  return {
    userId,
    ...createTimedToken(EMAIL_VERIFICATION_TTL_HOURS),
  };
}

export function isPasswordHash(value) {
  return (
    typeof value === "string" &&
    value.startsWith("scrypt$")
  );
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);

  return [
    "scrypt",
    SCRYPT_PARAMS.cost,
    SCRYPT_PARAMS.blockSize,
    SCRYPT_PARAMS.parallelization,
    salt,
    Buffer.from(derivedKey).toString("hex"),
  ].join("$");
}

export async function verifyPassword(password, storedValue) {
  if (!isPasswordHash(storedValue)) {
    return false;
  }

  const [
    algorithm,
    cost,
    blockSize,
    parallelization,
    salt,
    expectedHash,
  ] = storedValue.split("$");

  if (
    algorithm !== "scrypt" ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !salt ||
    !expectedHash
  ) {
    return false;
  }

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      expectedHash.length / 2,
      {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );
  });

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(derivedKey);

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function createSession(userId) {
  const createdAt = new Date();

  return {
    token: createToken(),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(
      createdAt.getTime() + SESSION_TTL_MS,
    ).toISOString(),
    lastSeenAt: createdAt.toISOString(),
  };
}

export function isSessionExpired(session) {
  if (!session?.expiresAt) {
    return true;
  }

  return Date.parse(session.expiresAt) <= Date.now();
}

export function isTimedTokenExpired(token) {
  if (!token?.expiresAt) {
    return true;
  }

  return Date.parse(token.expiresAt) <= Date.now();
}

export function touchSession(session) {
  const now = new Date();

  session.lastSeenAt = now.toISOString();
  session.expiresAt = new Date(
    now.getTime() + SESSION_TTL_MS,
  ).toISOString();

  return session;
}

export function shouldRefreshSession(session) {
  const lastSeenAt = Date.parse(
    session?.lastSeenAt || session?.createdAt || "",
  );

  return (
    !Number.isFinite(lastSeenAt) ||
    Date.now() - lastSeenAt >= SESSION_REFRESH_INTERVAL_MS
  );
}
