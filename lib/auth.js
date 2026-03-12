const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Get authenticated user from request. Expects Authorization: Bearer <id_token>.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ sub: string, email?: string } | null>}
 */
async function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload) return null;

    const allowedRaw = process.env.ALLOWED_EMAILS;
    if (allowedRaw) {
      const allowed = allowedRaw.split(',').map((e) => e.trim().toLowerCase());
      if (!allowed.includes((payload.email || '').toLowerCase())) {
        return { denied: true };
      }
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

module.exports = { getAuthUser };
