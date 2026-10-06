// Transactional email through Resend's REST API (no SDK).
// Set RESEND_API_KEY and EMAIL_FROM in Netlify. Without a key, emails are skipped and logged.

export const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL || 'theeverydayearners@gmail.com';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.warn(`[email] RESEND_API_KEY not set; skipped "${subject}" to ${to}`);
    return { sent: false, reason: 'not_configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Guest Photo Drop <onboarding@resend.dev>',
      to: [to],
      reply_to: SUPPORT_EMAIL(),
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[email] Resend ${res.status}: ${detail.slice(0, 300)}`);
    return { sent: false, reason: `resend_${res.status}` };
  }
  return { sent: true };
}

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ef;font-family:Helvetica,Arial,sans-serif;color:#2b2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7a5c4a">Guest Photo Drop</p>
<h1 style="margin:0 0 20px;font-size:22px;font-weight:600">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;font-size:13px;color:#7a706a">Questions? Reply to this email or write to ${escapeHtml(SUPPORT_EMAIL())}.</p>
</td></tr></table>
<p style="font-size:12px;color:#9a908a;margin:16px 0 0">Guest Photo Drop, a product of The Digital Comeback, PO Box 9456, Overland Park, KS 66219</p>
</td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#7a5c4a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(label)}</a></p>`;

export function resetPasswordEmail({ eventName, link, hours }) {
  const subject = `Reset your password for ${eventName}`;
  const html = layout('Reset your dashboard password', `
<p style="margin:0 0 12px;line-height:1.5">Someone asked to reset the dashboard password for <strong>${escapeHtml(eventName)}</strong>.</p>
${button(link, 'Choose a new password')}
<p style="margin:0;line-height:1.5;color:#5c524c">This link works once and expires in ${hours} hour${hours === 1 ? '' : 's'}. If you didn't ask for this, you can ignore this email and your password stays the same.</p>`);
  const text = `Reset the dashboard password for ${eventName}:\n${link}\n\nThis link works once and expires in ${hours} hour${hours === 1 ? '' : 's'}. If you didn't ask for this, ignore this email.\n\nSupport: ${SUPPORT_EMAIL()}`;
  return { subject, html, text };
}

export function deletionNoticeEmail({ eventName, deleteOnText, daysLeft, dashboardUrl }) {
  const subject = `${eventName}: your photos will be deleted in ${daysLeft} days`;
  const html = layout(`Your photos will be deleted in ${daysLeft} days`, `
<p style="margin:0 0 12px;line-height:1.5">Hosting for <strong>${escapeHtml(eventName)}</strong> has ended. All photos and videos will be permanently deleted on <strong>${escapeHtml(deleteOnText)}</strong>.</p>
<p style="margin:0 0 12px;line-height:1.5">Before then you can download everything, or extend hosting 12 more months for $19 from your dashboard.</p>
${button(dashboardUrl, 'Open your dashboard')}
<p style="margin:0;line-height:1.5;color:#5c524c">After ${escapeHtml(deleteOnText)} the files can't be recovered.</p>`);
  const text = `Hosting for ${eventName} has ended. All photos and videos will be permanently deleted on ${deleteOnText}.\n\nDownload everything or extend hosting 12 more months for $19 from your dashboard:\n${dashboardUrl}\n\nSupport: ${SUPPORT_EMAIL()}`;
  return { subject, html, text };
}
