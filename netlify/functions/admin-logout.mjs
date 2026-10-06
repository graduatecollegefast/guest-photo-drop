// POST /.netlify/functions/admin-logout
import { handler, json, requireMethod } from '../lib/http.mjs';
import { clearedAdminCookie } from '../lib/session.mjs';

export default handler('admin-logout', async (req) => {
  requireMethod(req, 'POST');
  return json({ ok: true }, 200, { 'Set-Cookie': clearedAdminCookie() });
});
