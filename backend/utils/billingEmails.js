/**
 * Orbivex Billing Email Templates
 * Triggered by: trial start, payment success, trial expiry warning, renewal reminder
 */
const { sendEmail } = require('./email');

const BRAND = {
  name: 'Orbivex',
  color: '#f97316',
  logo: 'O',
  support: 'support@orbivex.com',
  phone: '+91 90000 00000',
};

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; font-family: 'Outfit', -apple-system, sans-serif; background: #f4f4f5; }
  .wrap { max-width: 580px; margin: 2rem auto; }
  .header { background: #020209; padding: 1.5rem 2rem; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 0.75rem; }
  .mark { width: 36px; height: 36px; background: linear-gradient(135deg, #f97316, #6366f1); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 1.1rem; }
  .brand { color: white; font-weight: 700; font-size: 1.1rem; }
  .body { background: white; padding: 2rem; }
  .footer { background: #f4f4f5; padding: 1.25rem 2rem; border-radius: 0 0 12px 12px; font-size: 0.78rem; color: #6b7280; text-align: center; }
  h1 { font-size: 1.5rem; color: #111; margin: 0 0 0.75rem; font-weight: 800; }
  p { color: #374151; line-height: 1.6; margin: 0.75rem 0; }
  .btn { display: inline-block; background: #f97316; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; margin: 1rem 0; }
  .highlight { background: #fff7ed; border-left: 3px solid #f97316; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; margin: 1rem 0; }
  .info-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.88rem; }
  .info-label { color: #6b7280; }
  .info-value { font-weight: 600; color: #111; }
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="mark">O</div>
    <span class="brand">Orbivex</span>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    Orbivex Technologies Pvt. Ltd. · Made in India 🇮🇳<br>
    Questions? Reply to this email or call ${BRAND.phone}<br>
    <a href="mailto:${BRAND.support}" style="color: #f97316;">${BRAND.support}</a>
  </div>
</div></body></html>`;
}

async function sendTrialWelcomeEmail({ to, adminName, collegeName, planName, trialEnds }) {
  const html = baseTemplate(`
    <h1>Welcome to Orbivex! 🎉</h1>
    <p>Hi ${adminName},</p>
    <p>Your 14-day free trial for <strong>${collegeName}</strong> has started on the <strong>${planName} plan</strong>.</p>
    <div class="highlight">
      <strong>Trial ends:</strong> ${new Date(trialEnds).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
    <p><strong>What happens next:</strong></p>
    <p>Our team will set up your college data, import your students, and configure your courses within 24 hours. We'll WhatsApp you when it's ready.</p>
    <a href="https://app.orbivex.com/login" class="btn">Access Your Platform →</a>
    <p style="font-size: 0.85rem; color: #6b7280;">Need help? Call us at ${BRAND.phone} or reply to this email. We're available 9 AM – 7 PM IST.</p>
  `);
  return sendEmail({ to, subject: `Welcome to Orbivex — ${collegeName} trial started!`, html });
}

async function sendPaymentSuccessEmail({ to, adminName, collegeName, planName, amount, billingCycle, nextBillingDate, paymentId }) {
  const html = baseTemplate(`
    <h1>Payment Confirmed ✓</h1>
    <p>Hi ${adminName}, thank you for subscribing to Orbivex!</p>
    <div style="margin: 1.5rem 0;">
      <div class="info-row"><span class="info-label">College</span><span class="info-value">${collegeName}</span></div>
      <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName}</span></div>
      <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value">₹${amount.toLocaleString('en-IN')} + GST</span></div>
      <div class="info-row"><span class="info-label">Billing Cycle</span><span class="info-value">${billingCycle}</span></div>
      <div class="info-row"><span class="info-label">Next Billing</span><span class="info-value">${new Date(nextBillingDate).toLocaleDateString('en-IN')}</span></div>
      <div class="info-row"><span class="info-label">Payment ID</span><span class="info-value" style="font-size: 0.78rem;">${paymentId}</span></div>
    </div>
    <p>A GST-compliant invoice will be emailed to you separately. Save this email for your records.</p>
    <a href="https://app.orbivex.com/billing" class="btn">View Billing Dashboard →</a>
  `);
  return sendEmail({ to, subject: `Payment confirmed — Orbivex ${planName} subscription`, html });
}

async function sendTrialExpiryWarningEmail({ to, adminName, collegeName, planName, daysLeft, upgradeUrl }) {
  const urgencyColor = daysLeft <= 1 ? '#ef4444' : '#f59e0b';
  const html = baseTemplate(`
    <h1 style="color: ${urgencyColor};">Your trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</h1>
    <p>Hi ${adminName},</p>
    <p>Your <strong>${planName}</strong> trial for <strong>${collegeName}</strong> ends very soon. After expiry, your students will lose access to Orbivex.</p>
    <div class="highlight" style="border-color: ${urgencyColor}; background: ${daysLeft <= 1 ? '#fef2f2' : '#fffbeb'};">
      <strong>Don't lose your data or student progress!</strong> Subscribe now to continue uninterrupted.
    </div>
    <a href="${upgradeUrl || 'https://app.orbivex.com/billing'}" class="btn" style="background: ${urgencyColor};">Subscribe Now → Keep Access</a>
    <p>Or call us directly: <strong>${BRAND.phone}</strong> — we'll set everything up for you.</p>
    <p style="font-size: 0.85rem; color: #6b7280;">Want to continue with a different plan? Reply to this email and we'll help you choose.</p>
  `);
  return sendEmail({ to, subject: `⚠️ Orbivex trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${collegeName}`, html });
}

async function sendRenewalReminderEmail({ to, adminName, collegeName, planName, amount, renewalDate }) {
  const html = baseTemplate(`
    <h1>Renewal Reminder 📅</h1>
    <p>Hi ${adminName},</p>
    <p>Your <strong>${planName} plan</strong> for <strong>${collegeName}</strong> will auto-renew on <strong>${new Date(renewalDate).toLocaleDateString('en-IN')}</strong>.</p>
    <div style="margin: 1.5rem 0;">
      <div class="info-row"><span class="info-label">Amount</span><span class="info-value">₹${amount.toLocaleString('en-IN')} + 18% GST</span></div>
      <div class="info-row"><span class="info-label">Renewal Date</span><span class="info-value">${new Date(renewalDate).toLocaleDateString('en-IN')}</span></div>
    </div>
    <p>No action needed if you'd like to continue. A GST invoice will be sent after payment.</p>
    <p>Want to upgrade or change your plan? <a href="https://app.orbivex.com/billing" style="color: #f97316;">Visit billing dashboard</a></p>
    <p style="font-size: 0.85rem; color: #6b7280;">Save 20% by switching to annual billing — contact us at ${BRAND.phone}</p>
  `);
  return sendEmail({ to, subject: `Orbivex renewal reminder — ${collegeName}`, html });
}

async function sendDemoRequestNotificationEmail({ to, name, college, phone, email, students }) {
  const html = baseTemplate(`
    <h1>🔔 New Demo Request!</h1>
    <div style="margin: 1.5rem 0;">
      <div class="info-row"><span class="info-label">Name</span><span class="info-value">${name}</span></div>
      <div class="info-row"><span class="info-label">College</span><span class="info-value">${college}</span></div>
      <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${phone}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${email}</span></div>
      <div class="info-row"><span class="info-label">Students</span><span class="info-value">${students || 'Not specified'}</span></div>
    </div>
    <div class="highlight">Call within 2 hours for best conversion rate. Use this script: "Hi ${name}, this is [your name] from Orbivex. I saw your demo request for ${college}. Do you have 5 minutes for a quick call?"</div>
    <a href="tel:${phone}" class="btn">Call Now →</a>
  `);
  return sendEmail({
    to,
    subject: `🔔 New demo request: ${college} (${students} students)`,
    html,
  });
}

module.exports = {
  sendTrialWelcomeEmail,
  sendPaymentSuccessEmail,
  sendTrialExpiryWarningEmail,
  sendRenewalReminderEmail,
  sendDemoRequestNotificationEmail,
};
