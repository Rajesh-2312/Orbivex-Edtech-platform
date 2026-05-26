const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Orbivex <noreply@orbivex.dev>';

let resendClient = null;
if (RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(RESEND_API_KEY);
  } catch (err) {
    console.warn('[email] resend npm package not installed — emails will be skipped');
  }
}

async function sendEmail({ to, subject, html }) {
  if (!to || !subject || !html) return { skipped: true, reason: 'missing_fields' };
  if (!resendClient) {
    console.log(`[email skipped] to=${to} subject="${subject}"`);
    return { skipped: true, reason: 'no_api_key' };
  }
  try {
    const result = await resendClient.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    if (result.error) {
      console.warn('[email] resend error:', result.error?.message || result.error);
      return { skipped: false, ok: false, error: result.error?.message };
    }
    return { skipped: false, ok: true, id: result.data?.id };
  } catch (err) {
    console.warn('[email] send failed:', err?.message || err);
    return { skipped: false, ok: false, error: err?.message };
  }
}

module.exports = { sendEmail };
