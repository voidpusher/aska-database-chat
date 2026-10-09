const RESEND_API_URL = "https://api.resend.com/emails";

function getEmailConfiguration() {
  return {
    provider: process.env.EMAIL_PROVIDER || "resend",
    resendApiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "",
    replyTo: process.env.EMAIL_REPLY_TO || "",
    appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  };
}

export function isEmailAuthOptional() {
  return String(process.env.EMAIL_AUTH_OPTIONAL || "").trim().toLowerCase() === "true";
}

export function isEmailDeliveryConfigured() {
  const configuration = getEmailConfiguration();

  return Boolean(
    configuration.from &&
      configuration.provider === "resend" &&
      configuration.resendApiKey,
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWithResend(payload, configuration) {
  const headers = {
    Authorization: `Bearer ${configuration.resendApiKey}`,
    "Content-Type": "application/json",
    "Idempotency-Key": payload.idempotencyKey,
  };

  const body = {
    from: configuration.from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    tags: payload.tags || [],
  };

  if (configuration.replyTo) {
    body.reply_to = [configuration.replyTo];
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Email provider rejected the request.",
    );
  }

  return {
    provider: "resend",
    messageId: data.id,
  };
}

export function buildVerificationEmail({
  email,
  firstName,
  token,
  appBaseUrl,
}) {
  const safeFirstName = escapeHtml(firstName || "there");
  const verifyLink =
    `${appBaseUrl}/?auth=verify` +
    `&email=${encodeURIComponent(email)}` +
    `&token=${encodeURIComponent(token)}`;

  return {
    to: email,
    subject: "Verify your Aska account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Verify your account</h2>
        <p>Hello ${safeFirstName},</p>
        <p>Your Aska account is almost ready. Use the verification token below or open the link to activate your account.</p>
        <p style="margin: 20px 0;">
          <a href="${verifyLink}" style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;">Verify Email</a>
        </p>
        <p><strong>Verification token:</strong> ${escapeHtml(token)}</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `,
    text: [
      `Hello ${firstName || "there"},`,
      "",
      "Your Aska account is almost ready.",
      `Verification token: ${token}`,
      `Verification link: ${verifyLink}`,
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
    tags: [{ name: "category", value: "verify_email" }],
    idempotencyKey: `verify-${email}-${token}`,
  };
}

export function buildPasswordResetEmail({
  email,
  firstName,
  token,
  appBaseUrl,
}) {
  const safeFirstName = escapeHtml(firstName || "there");
  const resetLink =
    `${appBaseUrl}/?auth=reset` +
    `&email=${encodeURIComponent(email)}` +
    `&token=${encodeURIComponent(token)}`;

  return {
    to: email,
    subject: "Reset your Aska password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Reset your password</h2>
        <p>Hello ${safeFirstName},</p>
        <p>We received a request to reset your Aska password. Use the token below or open the reset link.</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;">Reset Password</a>
        </p>
        <p><strong>Reset token:</strong> ${escapeHtml(token)}</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
    text: [
      `Hello ${firstName || "there"},`,
      "",
      "We received a request to reset your Aska password.",
      `Reset token: ${token}`,
      `Reset link: ${resetLink}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    tags: [{ name: "category", value: "password_reset" }],
    idempotencyKey: `reset-${email}-${token}`,
  };
}

export async function sendTransactionalEmail(payload) {
  const configuration = getEmailConfiguration();

  if (!configuration.from) {
    return {
      delivered: false,
      skipped: true,
      reason: "EMAIL_FROM is not configured.",
    };
  }

  if (
    configuration.provider === "resend" &&
    !configuration.resendApiKey
  ) {
    return {
      delivered: false,
      skipped: true,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  if (configuration.provider !== "resend") {
    throw new Error(
      `Unsupported email provider: ${configuration.provider}`,
    );
  }

  const result = await sendWithResend(payload, configuration);

  return {
    delivered: true,
    skipped: false,
    ...result,
  };
}

export function getAppBaseUrl() {
  return getEmailConfiguration().appBaseUrl;
}
