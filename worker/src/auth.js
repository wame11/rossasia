// Authentication for the private admin and the optional bot API.
//
// Admin: Cloudflare Access sits in front of /admin and signs every request with a JWT.
// The Worker verifies that JWT itself (signature, audience, expiry, email allowlist), so the
// admin stays private even if the Access application is misconfigured or removed.

let jwksCache = { domain: '', keys: null, fetchedAt: 0 };

const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(teamDomain, forceRefresh = false) {
  const fresh = Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000;
  if (!forceRefresh && fresh && jwksCache.domain === teamDomain && jwksCache.keys) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Could not fetch Cloudflare Access keys');
  const { keys } = await res.json();
  jwksCache = { domain: teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function cookie(request, name) {
  const match = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : '';
}

/**
 * Returns { email } for an allowed admin, or throws an Error describing why access is refused.
 */
export async function requireAdmin(request, env) {
  const url = new URL(request.url);
  const allowed = (env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

  // Local development only: `wrangler dev` with DEV_BYPASS_ACCESS="true" in .dev.vars.
  // The hostname check means this can never switch auth off on the deployed Worker.
  if (env.DEV_BYPASS_ACCESS === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
    return { email: allowed[0] || 'dev@localhost' };
  }

  const teamDomain = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!teamDomain || !env.ACCESS_AUD || !allowed.length) {
    throw new Error('Admin is locked: ACCESS_TEAM_DOMAIN, ACCESS_AUD and ADMIN_EMAILS must be set as Worker secrets.');
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie(request, 'CF_Authorization');
  if (!token) throw new Error('No Cloudflare Access token on the request.');
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  if (!signatureB64) throw new Error('Malformed Access token.');

  const header = b64urlToJson(headerB64);
  const payload = b64urlToJson(payloadB64);
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');

  let jwk = (await getKeys(teamDomain)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(teamDomain, true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk) throw new Error('Unknown signing key.');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  if (!valid) throw new Error('Invalid token signature.');

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(env.ACCESS_AUD)) throw new Error('Token is for a different application.');
  if (payload.iss !== `https://${teamDomain}`) throw new Error('Token is from a different issuer.');
  if (!payload.exp || payload.exp < now) throw new Error('Token has expired.');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('Token is not valid yet.');

  const email = String(payload.email || '').toLowerCase();
  if (!email || !allowed.includes(email)) throw new Error('This account is not on the admin allowlist.');
  return { email };
}

/** Blocks cross-site form posts and scripted requests to the admin API (CSRF). */
export function sameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin;
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/**
 * Bot API key check. Returns 'read' or 'write', or null if the key is missing or wrong.
 * The key can be sent as "Authorization: Bearer KEY", "X-API-Key: KEY" or "?key=KEY".
 */
export async function botAccess(request, env) {
  const expected = env.BOT_API_KEY || '';
  if (expected.length < 24) return null; // not configured: the bot API does not exist
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  const given = (auth.startsWith('Bearer ') ? auth.slice(7) : '') || request.headers.get('X-API-Key') || url.searchParams.get('key') || '';
  if (!given) return null;
  // Compare hashes so the comparison time does not depend on how many characters match.
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  return env.BOT_ACCESS === 'write' ? 'write' : 'read';
}
