// Partner referral links: any page opened with ?ref=planner-name remembers that partner
// for 60 days in this browser. The code is sent with checkout; the server only records
// it if it belongs to an active partner.

const KEY = 'gpd_ref';
const DAYS = 60;
const REF_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function captureReferral(search = window.location.search) {
  try {
    const ref = (new URLSearchParams(search).get('ref') || '').trim().toLowerCase();
    if (!REF_RE.test(ref)) return;
    localStorage.setItem(KEY, JSON.stringify({ ref, at: Date.now() }));
  } catch {
    /* storage blocked: referral just isn't remembered */
  }
}

export function getReferral() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || !REF_RE.test(saved.ref || '')) return '';
    if (Date.now() - saved.at > DAYS * 86400000) {
      localStorage.removeItem(KEY);
      return '';
    }
    return saved.ref;
  } catch {
    return '';
  }
}
