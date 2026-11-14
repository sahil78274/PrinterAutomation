/**
 * Email service adapter.
 *
 * This module provides email delivery abstraction. When SMTP credentials are
 * not configured, the adapter logs emails to console and clearly reports that
 * email delivery is disabled. This allows the application to function in
 * development without requiring a mail server.
 *
 * For production deployment, configure SMTP credentials in environment variables.
 */

import config from '../config/index.js';

/**
 * Check if email delivery is configured.
 *
 * Email is considered configured when all required SMTP settings are present.
 * In development, email can still be "sent" (logged) without SMTP configuration.
 */
export function isEmailConfigured() {
  const smtp = config.email?.smtp;
  return Boolean(
    smtp?.host &&
    smtp?.port &&
    smtp?.user &&
    smtp?.pass &&
    smtp?.from
  );
}

/**
 * Get the email delivery status for API responses.
 *
 * Returns information about whether emails will actually be sent or just logged.
 * This allows the frontend to inform users appropriately.
 */
export function getEmailStatus() {
  const configured = isEmailConfigured();
  return {
    configured,
    provider: configured ? 'smtp' : 'console',
    message: configured
      ? 'Email delivery is active'
      : 'Email delivery is not configured. Emails will be logged to console in development.',
  };
}

/**
 * Send a password reset email.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.resetToken - The raw reset token (only in development)
 * @param {string} params.resetUrl - The full reset URL with token
 * @param {string} params.userName - Recipient's name for personalization
 */
export async function sendPasswordResetEmail({ to, resetToken, resetUrl, userName }) {
  const status = getEmailStatus();

  if (!status.configured) {
    // In development, log the email details to console
    // The resetToken is only available in development (not production)
    console.log(`
═══════════════════════════════════════════════════════════════
📧 PASSWORD RESET EMAIL (not sent — SMTP not configured)
═══════════════════════════════════════════════════════════════
To: ${to}
Name: ${userName}
Reset URL: ${resetUrl}
${resetToken ? `Token (dev only): ${resetToken}` : ''}
───────────────────────────────────────────────────────────────
Configure SMTP to send real emails:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
═══════════════════════════════════════════════════════════════
`);
    return {
      sent: false,
      reason: 'SMTP_NOT_CONFIGURED',
      message: 'Email delivery is not configured. The reset token has been logged to the server console.',
    };
  }

  // Production: send via SMTP
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      },
    });

    await transporter.sendMail({
      from: config.email.smtp.from,
      to,
      subject: 'Reset your SmartPrint password',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; background: #2459E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h2>Reset your password</h2>
  <p>Hi ${userName},</p>
  <p>We received a request to reset the password for your SmartPrint account.</p>
  <p>Click the button below to choose a new password. This link will expire in ${config.auth.passwordResetTtlMinutes} minutes.</p>
  <p><a href="${resetUrl}" class="button">Reset password</a></p>
  <p>Or copy and paste this link into your browser:</p>
  <p style="word-break: break-all; font-size: 12px; color: #666;">${resetUrl}</p>
  <p>If you didn't request this, you can safely ignore this email. Your password will not change.</p>
  <div class="footer">
    <p>This email was sent by SmartPrint. If you have questions, contact support through your dashboard.</p>
  </div>
</body>
</html>`,
      text: `
Reset your SmartPrint password

Hi ${userName},

We received a request to reset the password for your SmartPrint account.

Visit this link to choose a new password (expires in ${config.auth.passwordResetTtlMinutes} minutes):
${resetUrl}

If you didn't request this, you can safely ignore this email. Your password will not change.

— SmartPrint
`,
    });

    return { sent: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    return {
      sent: false,
      reason: 'SMTP_ERROR',
      message: 'Failed to send email. Please try again later.',
    };
  }
}

/**
 * Send a welcome/verification email (optional, for future use).
 */
export async function sendWelcomeEmail({ to, userName, shopName }) {
  const status = getEmailStatus();

  if (!status.configured) {
    console.log(`
═══════════════════════════════════════════════════════════════
📧 WELCOME EMAIL (not sent — SMTP not configured)
═══════════════════════════════════════════════════════════════
To: ${to}
Name: ${userName}
Shop: ${shopName}
═══════════════════════════════════════════════════════════════
`);
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  // Similar SMTP sending as password reset
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      },
    });

    await transporter.sendMail({
      from: config.email.smtp.from,
      to,
      subject: `Welcome to SmartPrint, ${userName}!`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Welcome to SmartPrint!</h2>
  <p>Hi ${userName},</p>
  <p>Your shop <strong>${shopName}</strong> has been registered on SmartPrint.</p>
  <p>You can now log in to your dashboard to set up your machines and start accepting print orders.</p>
  <p>— The SmartPrint Team</p>
</body>
</html>`,
    });

    return { sent: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error.message);
    return { sent: false, reason: 'SMTP_ERROR' };
  }
}

export default {
  isEmailConfigured,
  getEmailStatus,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
