// Inline dark-mode HTML matching the Orbivex orange brand. Kept self-contained
// (no external CSS) so it renders consistently in Gmail / Outlook / Apple Mail.

function shell({ headline, body, ctaLabel, ctaUrl }) {
  const cta = ctaUrl && ctaLabel
    ? `<p style="text-align:center;margin:24px 0 0;">
         <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#f97316,#fbbf24);color:#0a0a0a;text-decoration:none;border-radius:10px;font:600 14px/1 system-ui,-apple-system,sans-serif;">
           ${escapeHtml(ctaLabel)}
         </a>
       </p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;color:#e5e5e5;">
  <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid rgba(249,115,22,0.15);border-radius:14px;padding:28px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <div style="width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fbbf24,#f97316 50%,#7c2d12);box-shadow:0 0 16px rgba(249,115,22,0.45);"></div>
      <div style="font:700 16px/1 system-ui;letter-spacing:0.04em;">
        <span style="color:#fff;">ORBI</span><span style="color:#f97316;">VEX</span>
      </div>
    </div>
    <h2 style="font:700 18px/1.3 system-ui;color:#fff;margin:0 0 12px;">${escapeHtml(headline)}</h2>
    <div style="font:400 14px/1.6 system-ui;color:#d1d1d1;">${body}</div>
    ${cta}
    <p style="font:400 12px/1.4 system-ui;color:#777;margin:28px 0 0;text-align:center;">
      You're receiving this because you opted in to Orbivex notifications.<br/>
      Manage preferences in Settings.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(actionUrl) {
  if (!actionUrl) return '';
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;
  const base = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
  return base.replace(/\/+$/, '') + (actionUrl.startsWith('/') ? actionUrl : '/' + actionUrl);
}

function gradeTemplate(ctx) {
  return {
    subject: ctx.title || 'Quiz scored',
    html: shell({
      headline: ctx.title || 'Quiz scored',
      body: `<p>${escapeHtml(ctx.message || '')}</p>`,
      ctaLabel: ctx.actionUrl ? 'View result' : null,
      ctaUrl: absoluteUrl(ctx.actionUrl),
    }),
  };
}

function applicationStatusTemplate(ctx) {
  return {
    subject: ctx.title || 'Application update',
    html: shell({
      headline: ctx.title || 'Application update',
      body: `<p>${escapeHtml(ctx.message || '')}</p>`,
      ctaLabel: ctx.actionUrl ? 'Open Jobs' : null,
      ctaUrl: absoluteUrl(ctx.actionUrl || '/jobs'),
    }),
  };
}

function testPublishedTemplate(ctx) {
  return {
    subject: ctx.title || 'New test scheduled',
    html: shell({
      headline: ctx.title || 'New test scheduled',
      body: `<p>${escapeHtml(ctx.message || 'A new test has been published for your section.')}</p>`,
      ctaLabel: 'Open Tests',
      ctaUrl: absoluteUrl(ctx.actionUrl || '/tests'),
    }),
  };
}

function courseAccessTemplate(ctx) {
  return {
    subject: ctx.title || 'New course available',
    html: shell({
      headline: ctx.title || 'New course available',
      body: `<p>${escapeHtml(ctx.message || '')}</p>`,
      ctaLabel: 'Open course',
      ctaUrl: absoluteUrl(ctx.actionUrl || '/courses'),
    }),
  };
}

function courseCompleteTemplate(ctx) {
  return {
    subject: ctx.title || 'Course complete',
    html: shell({
      headline: ctx.title || 'Course complete',
      body: `<p>${escapeHtml(ctx.message || 'You finished a course — well done.')}</p>`,
      ctaLabel: 'View progress',
      ctaUrl: absoluteUrl(ctx.actionUrl || '/progress'),
    }),
  };
}

function genericTemplate(ctx) {
  return {
    subject: ctx.title || 'Update from Orbivex',
    html: shell({
      headline: ctx.title || 'Update from Orbivex',
      body: `<p>${escapeHtml(ctx.message || '')}</p>`,
      ctaLabel: ctx.actionUrl ? 'Open' : null,
      ctaUrl: absoluteUrl(ctx.actionUrl),
    }),
  };
}

function pickTemplate(type) {
  switch (type) {
    case 'grade':              return gradeTemplate;
    case 'application_status': return applicationStatusTemplate;
    case 'test_published':     return testPublishedTemplate;
    case 'course_access':      return courseAccessTemplate;
    case 'course_complete':    return courseCompleteTemplate;
    default:                   return genericTemplate;
  }
}

module.exports = { pickTemplate };
