import { Hono } from 'hono';
import qrcode from 'qrcode-generator';
import {
  renderIndex,
  renderCreate,
  renderProfile,
  renderNotFound,
  renderError
} from './templates';

type Bindings = {
  DB: D1Database;
  IDME_KV: KVNamespace;
  ASSETS: Fetcher;
  PUBLIC_URL?: string;
  SECRET_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_NUMBER?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ═══════════════════════════════════════════════════════════
// Trust Engine Translation
// ═══════════════════════════════════════════════════════════

interface PlatformSignals {
  platform: string;
  isVerified: boolean;
  accountAgeDays: number;
  followers: number;
  contentCount: number;
  verifiedAt: Date | null;
  displayName: string;
}

interface TrustBreakdown {
  total_score: number;
  coverage_score: number;
  age_score: number;
  social_score: number;
  content_score: number;
  freshness_score: number;
  consistency_score: number;
  platforms_verified: number;
  platforms_total: number;
  signals: Record<string, { account_age_days: number; followers: number; content_count: number }>;
}

function computeTrustScore(verifications: any[]): TrustBreakdown {
  const breakdown: TrustBreakdown = {
    total_score: 0,
    coverage_score: 0,
    age_score: 0,
    social_score: 0,
    content_score: 0,
    freshness_score: 0,
    consistency_score: 0,
    platforms_verified: 0,
    platforms_total: 4,
    signals: {}
  };

  const platformSignals: PlatformSignals[] = [];

  for (const v of verifications) {
    const metadata = typeof v.metadata_json === 'string' ? JSON.parse(v.metadata_json) : (v.metadata_json || {});
    const isVerified = v.status === 'verified';
    const verifiedAt = v.verified_at ? new Date(v.verified_at) : null;

    const signals: PlatformSignals = {
      platform: v.platform,
      isVerified,
      accountAgeDays: 0,
      followers: 0,
      contentCount: 0,
      verifiedAt,
      displayName: ''
    };

    if (isVerified) {
      // Account age
      const createdStr = metadata.created_at;
      if (createdStr) {
        try {
          const created = new Date(createdStr);
          signals.accountAgeDays = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
        } catch (e) {}
      }

      // Followers
      signals.followers = parseInt(metadata.followers) || 0;

      // Content count
      signals.contentCount = parseInt(metadata.public_repos) || 0;

      // Display name
      signals.displayName = metadata.display_name || metadata.name || metadata.given_name || '';

      breakdown.platforms_verified++;
      breakdown.signals[v.platform] = {
        account_age_days: signals.accountAgeDays,
        followers: signals.followers,
        content_count: signals.contentCount
      };
    }

    platformSignals.push(signals);
  }

  if (breakdown.platforms_verified === 0) {
    return breakdown;
  }

  // 1. Coverage (30%)
  const coverageMap: Record<number, number> = { 1: 40, 2: 70, 3: 90, 4: 100 };
  const coveragePct = coverageMap[breakdown.platforms_verified] || (breakdown.platforms_verified * 25);
  breakdown.coverage_score = coveragePct * 0.30;

  // 2. Account Age (20%)
  const verifiedSignals = platformSignals.filter(s => s.isVerified);
  const maxAge = verifiedSignals.length > 0 ? Math.max(...verifiedSignals.map(s => s.accountAgeDays)) : 0;
  const agePct = Math.min(100, (maxAge / 730) * 100);
  breakdown.age_score = agePct * 0.20;

  // 3. Social Signals (15%)
  const totalFollowers = verifiedSignals.reduce((sum, s) => sum + s.followers, 0);
  let socialPct = 0;
  if (totalFollowers > 0) {
    socialPct = Math.min(100, (Math.log10(totalFollowers + 1) / Math.log10(10001)) * 100);
  }
  breakdown.social_score = socialPct * 0.15;

  // 4. Content Signals (10%)
  const totalContent = verifiedSignals.reduce((sum, s) => sum + s.contentCount, 0);
  let contentPct = 0;
  if (totalContent > 0) {
    contentPct = Math.min(100, (Math.log10(totalContent + 1) / Math.log10(501)) * 100);
  }
  breakdown.content_score = contentPct * 0.10;

  // 5. Verification Freshness (15%)
  const times = verifiedSignals.filter(s => s.verifiedAt).map(s => s.verifiedAt!.getTime());
  const maxRecentTime = times.length > 0 ? Math.max(...times) : null;
  let freshnessPct = 0;
  if (maxRecentTime) {
    const daysSince = Math.floor((Date.now() - maxRecentTime) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) {
      freshnessPct = 100;
    } else if (daysSince >= 90) {
      freshnessPct = 0;
    } else {
      freshnessPct = Math.max(0, 100 - ((daysSince - 7) / 83) * 100);
    }
  }
  breakdown.freshness_score = freshnessPct * 0.15;

  // 6. Name Consistency (10%)
  const names = verifiedSignals.map(s => s.displayName.trim().toLowerCase()).filter(Boolean);
  let consistencyPct = 0;
  if (names.length >= 2) {
    const nameCounts: Record<string, number> = {};
    for (const name of names) {
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
    const mostCommonCount = Math.max(...Object.values(nameCounts));
    consistencyPct = (mostCommonCount / names.length) * 100;
  } else if (names.length === 1) {
    consistencyPct = 50;
  }
  breakdown.consistency_score = consistencyPct * 0.10;

  // Total
  const rawTotal = (
    breakdown.coverage_score +
    breakdown.age_score +
    breakdown.social_score +
    breakdown.content_score +
    breakdown.freshness_score +
    breakdown.consistency_score
  );
  breakdown.total_score = Math.min(100, Math.max(0, Math.round(rawTotal)));

  return breakdown;
}

// ═══════════════════════════════════════════════════════════
// Cryptographic Web Crypto Token Encryption
// ═══════════════════════════════════════════════════════════

async function encryptToken(plaintext: string, secretKey: string): Promise<string> {
  if (!plaintext) return '';
  try {
    const enc = new TextEncoder();
    const keyBuf = enc.encode((secretKey || 'change-me-to-a-random-64-char-string').slice(0, 32).padEnd(32, '\0'));
    const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    // Base64 encode
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error("Token encryption error:", e);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════
// Helper functions for state generation
// ═══════════════════════════════════════════════════════════

function generateRandomToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createOAuthState(sessionToken: string, platform: string, kv: KVNamespace): Promise<string> {
  const state = generateRandomToken(24);
  await kv.put(`oauth_state:${state}`, `${sessionToken}:${platform}`, { expirationTtl: 600 });
  return state;
}

async function validateOAuthState(state: string, platform: string, kv: KVNamespace): Promise<string | null> {
  const key = `oauth_state:${state}`;
  const value = await kv.get(key);
  if (!value) return null;
  await kv.delete(key); // single use

  const parts = value.split(':');
  if (parts.length < 2) return null;
  const [sessionToken, storedPlatform] = parts;
  if (storedPlatform !== platform) return null;
  return sessionToken;
}

// ═══════════════════════════════════════════════════════════
// Endpoints & Logic
// ═══════════════════════════════════════════════════════════

// Static uploaded files fallback mapping from Workers KV
app.get('/static/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  const parts = filename.split('.');
  const ext = parts.pop() || '';
  const slug = parts.join('.');
  const headshot = await c.env.IDME_KV.getWithMetadata(`headshot:${slug}`, 'arrayBuffer');
  if (!headshot || !headshot.value) {
    return c.notFound();
  }
  const contentType = (headshot.metadata as any)?.contentType || `image/${ext}`;
  return c.body(headshot.value, 200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400'
  });
});

// Serve other static assets from wrangler ASSETS binding by rewriting prefix
app.all('/static/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/static/, '');
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

// Favicon redirect
app.get('/favicon.ico', (c) => c.redirect('/static/images/logo.png'));

// Frontpage
app.get('/', (c) => {
  return c.html(renderIndex());
});

// Create Wizard page
app.get('/create', (c) => {
  return c.html(renderCreate());
});

// Health check
app.get('/health', async (c) => {
  const status: Record<string, string> = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    app: "IDme"
  };

  try {
    await c.env.DB.prepare("SELECT 1").first();
    status.database = "connected";
  } catch (e) {
    status.database = "disconnected";
    status.status = "degraded";
  }

  try {
    await c.env.IDME_KV.put("healthcheck_test", "1", { expirationTtl: 60 });
    status.kv = "connected";
  } catch (e) {
    status.kv = "disconnected";
    status.status = "degraded";
  }

  return c.json(status);
});

// Real-time username check
app.post('/api/check-slug', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawSlug = (body.slug || '').trim().toLowerCase();

  // Validate slug characters
  const slugRegex = /^[a-z0-9-_]+$/;
  if (!rawSlug || !slugRegex.test(rawSlug)) {
    return c.json({ available: false, reason: "Username must be alphanumeric and contain only dashes or underscores" });
  }

  if (rawSlug.length < 3 || rawSlug.length > 30) {
    return c.json({ available: false, reason: "Username must be between 3 and 30 characters" });
  }

  if (['create', 'demo', 'health', 'api', 'oauth', 'static', 'static-assets', 'healthcheck_test'].includes(rawSlug)) {
    return c.json({ available: false, reason: "This username is reserved" });
  }

  const existing = await c.env.DB.prepare("SELECT 1 FROM users WHERE slug = ?").bind(rawSlug).first();
  if (existing) {
    return c.json({ available: false, reason: "Username already taken" });
  }

  return c.json({ available: true, slug: rawSlug, reason: null });
});

// Create session and return OAuth links
app.post('/api/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawSlug = (body.slug || '').trim().toLowerCase();

  // Validate
  const slugRegex = /^[a-z0-9-_]+$/;
  if (!rawSlug || !slugRegex.test(rawSlug) || rawSlug.length < 3 || rawSlug.length > 30) {
    return c.json({ error: "Invalid username format" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT 1 FROM users WHERE slug = ?").bind(rawSlug).first();
  if (existing) {
    return c.json({ error: "Username already taken" }, 409);
  }

  const sessionToken = generateRandomToken(48);
  const userId = crypto.randomUUID();

  // Insert User
  await c.env.DB.prepare(
    "INSERT INTO users (id, slug, session_token) VALUES (?, ?, ?)"
  ).bind(userId, rawSlug, sessionToken).run();

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const oauthUrls: Record<string, string> = {};

  if (c.env.GITHUB_CLIENT_ID) {
    const githubState = await createOAuthState(sessionToken, 'github', c.env.IDME_KV);
    oauthUrls.github = `https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/github/callback`)}&scope=read:user&state=${githubState}&allow_signup=false`;
  }

  if (c.env.LINKEDIN_CLIENT_ID) {
    const linkedinState = await createOAuthState(sessionToken, 'linkedin', c.env.IDME_KV);
    oauthUrls.linkedin = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${c.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/linkedin/callback`)}&scope=openid%20profile%20email&state=${linkedinState}`;
  }

  if (c.env.FACEBOOK_CLIENT_ID) {
    const facebookState = await createOAuthState(sessionToken, 'facebook', c.env.IDME_KV);
    oauthUrls.facebook = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${c.env.FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/facebook/callback`)}&scope=public_profile&state=${facebookState}`;
  }

  return c.json({
    success: true,
    session_token: sessionToken,
    slug: rawSlug,
    oauth_urls: oauthUrls,
    whatsapp_available: true,
    next: "Connect your platforms to verify your identity."
  });
});

// Session status polling endpoint
app.get('/api/session/:session_token', async (c) => {
  const sessionToken = c.req.param('session_token');
  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.json({ error: "Session not found" }, 404);
  }

  const verificationsQuery = await c.env.DB.prepare("SELECT * FROM verifications WHERE user_id = ?").bind(user.id).all();
  const verifications = (verificationsQuery.results || []).map((v: any) => ({
    platform: v.platform,
    status: v.status,
    username: v.platform_username,
    verified_at: v.verified_at,
    metadata: typeof v.metadata_json === 'string' ? JSON.parse(v.metadata_json) : (v.metadata_json || {})
  }));

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const oauthUrls: Record<string, string> = {};

  if (c.env.GITHUB_CLIENT_ID) {
    const githubState = await createOAuthState(sessionToken, 'github', c.env.IDME_KV);
    oauthUrls.github = `https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/github/callback`)}&scope=read:user&state=${githubState}&allow_signup=false`;
  }

  if (c.env.LINKEDIN_CLIENT_ID) {
    const linkedinState = await createOAuthState(sessionToken, 'linkedin', c.env.IDME_KV);
    oauthUrls.linkedin = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${c.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/linkedin/callback`)}&scope=openid%20profile%20email&state=${linkedinState}`;
  }

  if (c.env.FACEBOOK_CLIENT_ID) {
    const facebookState = await createOAuthState(sessionToken, 'facebook', c.env.IDME_KV);
    oauthUrls.facebook = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${c.env.FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/facebook/callback`)}&scope=public_profile&state=${facebookState}`;
  }

  return c.json({
    slug: user.slug,
    display_name: user.display_name,
    onboarding_complete: user.onboarding_complete === 1,
    profile_url: `/${user.slug}`,
    verifications,
    oauth_urls: oauthUrls
  });
});

// Finalize onboarding
app.post('/api/complete/:session_token', async (c) => {
  const sessionToken = c.req.param('session_token');
  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.json({ error: "Session not found" }, 404);
  }

  const verificationsQuery = await c.env.DB.prepare("SELECT COUNT(1) as count FROM verifications WHERE user_id = ? AND status = 'verified'").bind(user.id).first();
  const verifiedCount = (verificationsQuery as any)?.count || 0;
  if (verifiedCount === 0) {
    return c.json({ error: "At least one platform must be verified before completing" }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET onboarding_complete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();

  return c.json({
    success: true,
    slug: user.slug,
    profile_url: `/${user.slug}`,
    verified_platforms: verifiedCount
  });
});

// Create WhatsApp verification link
app.post('/api/whatsapp/verify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionToken = body.session_token;
  const phone = body.phone;

  if (!sessionToken || !phone) {
    return c.json({ error: "Missing session_token or phone" }, 400);
  }

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.json({ error: "Session not found" }, 404);
  }

  const cleanedPhone = phone.replace(/[+\s\-()]/g, "");
  const code = Math.random().toString(16).substring(2, 10); // 8-char hex code

  await c.env.IDME_KV.put(
    `whatsapp_verify:${code}`,
    JSON.stringify({
      session_token: sessionToken,
      phone: `+${cleanedPhone}`,
      created_at: new Date().toISOString()
    }),
    { expirationTtl: 600 }
  );

  const messageText = `IDme-verify-${code}`;
  const waLink = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(messageText)}`;

  return c.json({
    success: true,
    verification_link: waLink,
    code: code
  });
});

// Confirm WhatsApp verification (Fallback & Webhook polling verification check)
app.post('/api/whatsapp/confirm/:code', async (c) => {
  const code = c.req.param('code').toLowerCase();

  // Check if Twilio webhook verified it already
  const webhookVerifiedSlug = await c.env.IDME_KV.get(`whatsapp_verified:${code}`);
  if (webhookVerifiedSlug) {
    await c.env.IDME_KV.delete(`whatsapp_verified:${code}`);
    return c.json({
      success: true,
      verified: true,
      profile_url: `/${webhookVerifiedSlug}`
    });
  }

  // If Twilio is active, do not allow local click-to-confirm fallback!
  if (c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN) {
    return c.json({
      error: "Verification message not received yet. Please send the message on WhatsApp and try again."
    }, 400);
  }

  // Fallback check
  const verificationDataStr = await c.env.IDME_KV.get(`whatsapp_verify:${code}`);
  if (!verificationDataStr) {
    return c.json({ error: "Verification code not found or expired" }, 400);
  }

  const verificationData = JSON.parse(verificationDataStr);
  await c.env.IDME_KV.delete(`whatsapp_verify:${code}`);

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(verificationData.session_token).first();
  if (!user) {
    return c.json({ error: "Session not found" }, 404);
  }

  const phone = verificationData.phone;
  // Compute standard verification hash for phone number privacy
  const phoneHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(phone));
  const phoneHash = Array.from(new Uint8Array(phoneHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

  const existing: any = await c.env.DB.prepare(
    "SELECT id FROM verifications WHERE user_id = ? AND platform = 'whatsapp'"
  ).bind(user.id).first();

  const timestamp = new Date().toISOString();
  const metadata = JSON.stringify({ phone_hash: phoneHash, verified_via: "fallback" });

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE verifications SET platform_user_id = ?, platform_username = ?, status = 'verified', verified_at = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(phone, phone, timestamp, metadata, existing.id).run();
  } else {
    const verificationId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO verifications (id, user_id, platform, platform_user_id, platform_username, status, verified_at, metadata_json) VALUES (?, ?, 'whatsapp', ?, ?, 'verified', ?, ?)"
    ).bind(verificationId, user.id, phone, phone, timestamp, metadata).run();
  }

  await c.env.DB.prepare("UPDATE users SET onboarding_complete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();

  return c.json({
    success: true,
    verified: true,
    profile_url: `/${user.slug}`
  });
});

// Twilio WhatsApp Incoming Webhook
app.post('/api/whatsapp/webhook', async (c) => {
  const body = await c.req.parseBody();
  const fromStr = (body['From'] as string) || '';
  const bodyStr = (body['Body'] as string) || '';

  console.log(`Received Twilio WhatsApp message from ${fromStr}: ${bodyStr}`);

  const match = bodyStr.match(/IDme-verify-([a-f0-9]+)/i);
  if (!match) {
    return c.json({ status: "ignored" });
  }

  const code = match[1].toLowerCase();
  const pendingDataStr = await c.env.IDME_KV.get(`whatsapp_verify:${code}`);
  if (!pendingDataStr) {
    return c.json({ status: "expired" });
  }

  const pendingData = JSON.parse(pendingDataStr);
  const sessionToken = pendingData.session_token;
  const senderPhone = fromStr.replace("whatsapp:", "").trim();

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.json({ status: "user_not_found" });
  }

  // Compute privacy hash
  const phoneHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(senderPhone));
  const phoneHash = Array.from(new Uint8Array(phoneHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

  const existing: any = await c.env.DB.prepare(
    "SELECT id FROM verifications WHERE user_id = ? AND platform = 'whatsapp'"
  ).bind(user.id).first();

  const timestamp = new Date().toISOString();
  const metadata = JSON.stringify({ phone_hash: phoneHash, verified_via: "webhook" });

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE verifications SET platform_user_id = ?, platform_username = ?, status = 'verified', verified_at = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(senderPhone, senderPhone, timestamp, metadata, existing.id).run();
  } else {
    const verificationId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO verifications (id, user_id, platform, platform_user_id, platform_username, status, verified_at, metadata_json) VALUES (?, ?, 'whatsapp', ?, ?, 'verified', ?, ?)"
    ).bind(verificationId, user.id, senderPhone, senderPhone, timestamp, metadata).run();
  }

  await c.env.DB.prepare("UPDATE users SET onboarding_complete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();

  // Notify webhook confirmation API
  await c.env.IDME_KV.put(`whatsapp_verified:${code}`, user.slug, { expirationTtl: 600 });
  await c.env.IDME_KV.delete(`whatsapp_verify:${code}`);

  return c.text(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Your phone number was successfully verified on IDme! Refresh your creation page to proceed.</Message></Response>`, 200, {
    'Content-Type': 'text/xml'
  });
});

// Upload profile custom headshot
app.post('/api/upload-headshot/:session_token', async (c) => {
  const sessionToken = c.req.param('session_token');
  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.json({ error: "Session not found" }, 404);
  }

  const body = await c.req.parseBody();
  const file = body['file'] as File;
  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return c.json({ error: "Invalid image format" }, 400);
  }

  // Read file data
  const fileData = await file.arrayBuffer();
  // Save directly to KV mapping under the user's slug
  await c.env.IDME_KV.put(`headshot:${user.slug}`, new Uint8Array(fileData), {
    metadata: { contentType: file.type || `image/${ext}` }
  });

  return c.json({
    success: true,
    avatar_url: `/static/uploads/${user.slug}.${ext}`
  });
});

// ═══════════════════════════════════════════════════════════
// OAuth Callback Endpoints
// ═══════════════════════════════════════════════════════════

async function saveOAuthVerification(db: D1Database, user: any, platform: string, userInfo: any, accessToken: string, secretKey: string) {
  const existing: any = await db.prepare(
    "SELECT id FROM verifications WHERE user_id = ? AND platform = ?"
  ).bind(user.id, platform).first();

  const encryptedToken = await encryptToken(accessToken, secretKey);
  const timestamp = new Date().toISOString();
  const metadata = JSON.stringify(userInfo.metadata);

  if (existing) {
    await db.prepare(
      "UPDATE verifications SET platform_user_id = ?, platform_username = ?, access_token_enc = ?, status = 'verified', verified_at = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(userInfo.platform_user_id, userInfo.platform_username, encryptedToken, timestamp, metadata, existing.id).run();
  } else {
    const verificationId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO verifications (id, user_id, platform, platform_user_id, platform_username, access_token_enc, status, verified_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, ?)"
    ).bind(verificationId, user.id, platform, userInfo.platform_user_id, userInfo.platform_username, encryptedToken, timestamp, metadata).run();
  }

  // Set display name if not set
  if (!user.display_name && userInfo.display_name) {
    await db.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(userInfo.display_name, user.id).run();
  }

  // Mark onboarding complete
  await db.prepare("UPDATE users SET onboarding_complete = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
}

// 1. GitHub Callback
app.get('/oauth/github/callback', async (c) => {
  const code = c.req.query('code') || '';
  const state = c.req.query('state') || '';

  const sessionToken = await validateOAuthState(state, 'github', c.env.IDME_KV);
  if (!sessionToken) {
    return c.redirect('/create?error=invalid_state');
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.redirect('/create?error=session_not_found');
  }

  // Exchange code
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code
    })
  });

  const tokenData = await tokenResp.json() as any;
  if (!tokenData || tokenData.error || !tokenData.access_token) {
    console.error("GitHub exchange error:", tokenData);
    return c.redirect(`/create?error=github_auth_failed&session=${sessionToken}`);
  }

  // Fetch GitHub profile details (requires User-Agent)
  const profileResp = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "IDme-Edge-Worker"
    }
  });

  if (!profileResp.ok) {
    console.error("GitHub profile fetch error:", profileResp.status);
    return c.redirect(`/create?error=github_api_failed&session=${sessionToken}`);
  }

  const profileData = await profileResp.json() as any;
  const userInfo = {
    platform_user_id: String(profileData.id),
    platform_username: profileData.login,
    display_name: profileData.name || profileData.login,
    metadata: {
      avatar_url: profileData.avatar_url,
      html_url: profileData.html_url,
      bio: profileData.bio,
      company: profileData.company,
      location: profileData.location,
      public_repos: profileData.public_repos || 0,
      followers: profileData.followers || 0,
      created_at: profileData.created_at
    }
  };

  await saveOAuthVerification(c.env.DB, user, 'github', userInfo, tokenData.access_token, c.env.SECRET_KEY || '');

  return c.redirect(`/create?github=success&session=${sessionToken}`);
});

// 2. LinkedIn Callback
app.get('/oauth/linkedin/callback', async (c) => {
  const code = c.req.query('code') || '';
  const state = c.req.query('state') || '';
  const err = c.req.query('error');
  const errDesc = c.req.query('error_description');

  if (err) {
    console.warn("LinkedIn callback error:", err, errDesc);
    return c.redirect('/create?error=linkedin_denied');
  }

  const sessionToken = await validateOAuthState(state, 'linkedin', c.env.IDME_KV);
  if (!sessionToken) {
    return c.redirect('/create?error=invalid_state');
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.redirect('/create?error=session_not_found');
  }

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;

  // Exchange code
  const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: c.env.LINKEDIN_CLIENT_ID || '',
      client_secret: c.env.LINKEDIN_CLIENT_SECRET || '',
      redirect_uri: `${publicUrl}/oauth/linkedin/callback`
    }).toString()
  });

  const tokenData = await tokenResp.json() as any;
  if (!tokenData || !tokenData.access_token) {
    console.error("LinkedIn token exchange error:", tokenData);
    return c.redirect(`/create?error=linkedin_auth_failed&session=${sessionToken}`);
  }

  // Fetch LinkedIn OpenID User info
  const profileResp = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`
    }
  });

  if (!profileResp.ok) {
    console.error("LinkedIn profile API error:", profileResp.status);
    return c.redirect(`/create?error=linkedin_api_failed&session=${sessionToken}`);
  }

  const profileData = await profileResp.json() as any;
  const userInfo = {
    platform_user_id: profileData.sub,
    platform_username: profileData.email || profileData.sub,
    display_name: profileData.name || '',
    metadata: {
      email: profileData.email,
      picture: profileData.picture,
      given_name: profileData.given_name,
      family_name: profileData.family_name,
      locale: profileData.locale
    }
  };

  await saveOAuthVerification(c.env.DB, user, 'linkedin', userInfo, tokenData.access_token, c.env.SECRET_KEY || '');

  return c.redirect(`/create?linkedin=success&session=${sessionToken}`);
});

// 3. Facebook Callback
app.get('/oauth/facebook/callback', async (c) => {
  const code = c.req.query('code') || '';
  const state = c.req.query('state') || '';
  const err = c.req.query('error');
  const errReason = c.req.query('error_reason');

  if (err) {
    console.warn("Facebook user denied auth:", err, errReason);
    return c.redirect('/create?error=facebook_denied');
  }

  const sessionToken = await validateOAuthState(state, 'facebook', c.env.IDME_KV);
  if (!sessionToken) {
    return c.redirect('/create?error=invalid_state');
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE session_token = ?").bind(sessionToken).first();
  if (!user) {
    return c.redirect('/create?error=session_not_found');
  }

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;

  // Exchange token
  const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${c.env.FACEBOOK_CLIENT_ID}&client_secret=${c.env.FACEBOOK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(`${publicUrl}/oauth/facebook/callback`)}&code=${code}`;
  const tokenResp = await fetch(tokenUrl);
  const tokenData = await tokenResp.json() as any;

  if (!tokenData || !tokenData.access_token) {
    console.error("Facebook token exchange failed:", tokenData);
    return c.redirect(`/create?error=facebook_auth_failed&session=${sessionToken}`);
  }

  // Fetch Facebook profile details
  const profileUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,picture.type(large),link&access_token=${tokenData.access_token}`;
  const profileResp = await fetch(profileUrl);
  if (!profileResp.ok) {
    console.error("Facebook Graph API failed:", profileResp.status);
    return c.redirect(`/create?error=facebook_api_failed&session=${sessionToken}`);
  }

  const profileData = await profileResp.json() as any;
  const avatarUrl = profileData.picture?.data?.url || null;

  let username = profileData.id;
  const link = profileData.link || "";
  if (link) {
    const parts = link.replace(/\/$/, '').split('/');
    if (parts.length > 0) {
      username = parts[parts.length - 1];
    }
  }

  const userInfo = {
    platform_user_id: profileData.id,
    platform_username: username,
    display_name: profileData.name || '',
    metadata: {
      profile_url: profileData.link || null,
      avatar_url: avatarUrl
    }
  };

  await saveOAuthVerification(c.env.DB, user, 'facebook', userInfo, tokenData.access_token, c.env.SECRET_KEY || '');

  return c.redirect(`/create?facebook=success&session=${sessionToken}`);
});

// ═══════════════════════════════════════════════════════════
// Demo Profile
// ═══════════════════════════════════════════════════════════

app.get('/demo', (c) => {
  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const user = {
    slug: "demo-user",
    display_name: "Jane Doe",
    created_at: new Date().toISOString()
  };

  const trustBreakdown = {
    total_score: 92,
    coverage_score: 90 * 0.30,
    age_score: 100 * 0.20,
    social_score: 85 * 0.15,
    content_score: 75 * 0.10,
    freshness_score: 100 * 0.15,
    consistency_score: 100 * 0.10,
    platforms_verified: 3,
    platforms_total: 4
  };

  const verifications = {
    github: {
      status: "verified",
      username: "janedoe-dev",
      verified_at: new Date().toISOString(),
      metadata: {
        public_repos: 42,
        followers: 185,
        company: "Decentralized Corp",
        location: "Remote",
        bio: "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems.",
        html_url: "https://github.com",
      }
    },
    linkedin: {
      status: "verified",
      username: "jane-doe",
      verified_at: new Date().toISOString(),
      metadata: {
        given_name: "Jane",
        family_name: "Doe",
        email: "jane.doe@example.com",
        locale: "en_US",
      }
    },
    whatsapp: {
      status: "verified",
      username: "+1234567890",
      verified_at: new Date().toISOString(),
      metadata: {
        phone_hash: "a8f3b2d9e0c1f2a3"
      }
    }
  };

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Jane Doe",
    "alternateName": "demo-user",
    "url": `${publicUrl}/demo`,
    "sameAs": ["https://github.com"],
    "description": "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems."
  });

  const ogMeta = {
    "og:title": "Jane Doe — Verified IDme Profile",
    "og:description": "Verified IDme profile with a Trust Score of 92.",
    "og:url": `${publicUrl}/demo`,
    "og:type": "profile",
    "og:site_name": "IDme",
    "twitter:card": "summary_large_image",
    "twitter:title": "Jane Doe — Verified IDme Profile",
    "twitter:description": "Verified IDme profile with a Trust Score of 92."
  };

  // Serve demo headshot from brain artifact path (fallback to generated logo png if missing)
  const customAvatar = "/static/images/logo.png";

  const html = renderProfile(
    user,
    verifications,
    92,
    trustBreakdown,
    customAvatar,
    `${publicUrl}/demo`,
    jsonLd,
    ogMeta
  );

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════
// Public Profile Pages, Badges, QRs
// ═══════════════════════════════════════════════════════════

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();

  if (!user || user.onboarding_complete !== 1) {
    return c.html(renderNotFound(slug), 404);
  }

  // Record visit in background
  const userAgent = c.req.header('User-Agent') || '';
  const referer = c.req.header('Referer') || '';
  const visitorIp = c.req.header('CF-Connecting-IP') || '';
  const visitId = crypto.randomUUID();

  // Non-blocking fire-and-forget query execution in Hono
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      "INSERT INTO profile_visits (id, user_id, visitor_ip, visitor_user_agent, referrer) VALUES (?, ?, ?, ?, ?)"
    ).bind(visitId, user.id, visitorIp, userAgent.substring(0, 512), referer.substring(0, 512)).run()
      .catch(e => console.error("Error logging profile visit:", e))
  );

  const verificationsQuery = await c.env.DB.prepare("SELECT * FROM verifications WHERE user_id = ? AND status = 'verified'").bind(user.id).all();
  const verifications: Record<string, any> = {};

  for (const v of (verificationsQuery.results as any[] || [])) {
    verifications[v.platform] = {
      status: v.status,
      username: v.platform_username,
      verified_at: v.verified_at,
      metadata: typeof v.metadata_json === 'string' ? JSON.parse(v.metadata_json) : (v.metadata_json || {})
    };
  }

  const trust = computeTrustScore(verificationsQuery.results || []);
  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const profileUrl = `${publicUrl}/${user.slug}`;

  // SEO & Social OpenGraph metas
  const ogMeta = {
    "og:title": `${user.display_name || user.slug} — IDme Verified Identity`,
    "og:description": `Verified across ${trust.platforms_verified} platform${trust.platforms_verified !== 1 ? 's' : ''} with a trust score of ${trust.total_score}/100. One link, fully verified.`,
    "og:url": profileUrl,
    "og:type": "profile",
    "og:site_name": "IDme",
    "twitter:card": "summary",
    "twitter:title": `${user.display_name || user.slug} — IDme Verified Identity`,
    "twitter:description": `Verified across ${trust.platforms_verified} platform${trust.platforms_verified !== 1 ? 's' : ''} with a trust score of ${trust.total_score}/100. One link, fully verified.`
  };

  // JSON-LD structured data
  const sameAs: string[] = [];
  if (verifications.github?.metadata?.html_url) sameAs.push(verifications.github.metadata.html_url);
  if (verifications.facebook?.metadata?.profile_url) sameAs.push(verifications.facebook.metadata.profile_url);

  const jsonLdData: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": user.display_name || user.slug,
    "alternateName": user.slug,
    "url": profileUrl
  };
  if (sameAs.length > 0) jsonLdData.sameAs = sameAs;

  const githubBio = verifications.github?.metadata?.bio || "";
  if (githubBio) jsonLdData.description = githubBio;

  const jsonLd = JSON.stringify(jsonLdData);

  // Look up custom avatar image in KV
  const customAvatarKey = `headshot:${user.slug}`;
  const customAvatarExists = await c.env.IDME_KV.get(customAvatarKey, 'arrayBuffer');
  let customAvatar: string | null = null;
  if (customAvatarExists) {
    // Return standard link endpoint pointing to dynamic KV mapping
    customAvatar = `/static/uploads/${user.slug}.png`;
  }

  const html = renderProfile(
    user,
    verifications,
    trust.total_score,
    trust,
    customAvatar,
    profileUrl,
    jsonLd,
    ogMeta
  );

  return c.html(html);
});

// JSON-LD dynamic endpoint
function generateAiSummary(user: any, trust: TrustBreakdown, verifications: Record<string, any>): string {
  const summaryParts = [
    `IDme Profile Summary for ${user.display_name || user.slug} (@${user.slug})`,
    `Overall Identity Trust Score: ${trust.total_score}/100`,
    `Account Created: ${user.created_at || 'N/A'}`,
    `\nVerified Platforms & Intelligence Gathered:`
  ];

  for (const [platform, data] of Object.entries(verifications)) {
    const meta = data.metadata || {};
    let part = `- ${platform.toUpperCase()}: username='${data.username}' (Verified: ${data.verified_at})`;
    if (platform === "github") {
      part += `\n  * Repositories: ${meta.public_repos || 0}`;
      part += `\n  * Followers: ${meta.followers || 0}`;
      if (meta.company) part += `\n  * Company: ${meta.company}`;
      if (meta.location) part += `\n  * Location: ${meta.location}`;
      if (meta.bio) part += `\n  * Bio: ${meta.bio}`;
    } else if (platform === "linkedin") {
      const name = `${meta.given_name || ''} ${meta.family_name || ''}`.trim();
      if (name) part += `\n  * Verified Name: ${name}`;
      if (meta.email) part += `\n  * Email: ${meta.email}`;
      if (meta.locale) part += `\n  * Locale: ${meta.locale}`;
    } else if (platform === "facebook") {
      if (meta.profile_url) part += `\n  * Profile: ${meta.profile_url}`;
    } else if (platform === "whatsapp") {
      part += `\n  * Phone number verified owner`;
    }
    summaryParts.push(part);
  }

  return summaryParts.join("\n");
}

app.get('/:slug/json', async (c) => {
  const slug = c.req.param('slug').toLowerCase();

  if (slug === 'demo' || slug === 'demo-user') {
    const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
    const user = {
      slug: "demo-user",
      display_name: "Jane Doe",
      created_at: new Date().toISOString()
    };
    const trust = { total_score: 92 };
    const verifications = {
      github: {
        platform: "github",
        status: "verified",
        username: "janedoe-dev",
        verified_at: new Date().toISOString(),
        metadata: {
          public_repos: 42,
          followers: 185,
          company: "Decentralized Corp",
          location: "Remote",
          bio: "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems.",
          html_url: "https://github.com",
        }
      },
      linkedin: {
        platform: "linkedin",
        status: "verified",
        username: "jane-doe",
        verified_at: new Date().toISOString(),
        metadata: {
          given_name: "Jane",
          family_name: "Doe",
          email: "jane.doe@example.com",
          locale: "en_US",
        }
      },
      whatsapp: {
        platform: "whatsapp",
        status: "verified",
        username: "+1234567890",
        verified_at: new Date().toISOString(),
        metadata: {
          phone_hash: "a8f3b2d9e0c1f2a3"
        }
      }
    };
    const aiSummary = generateAiSummary(user, trust as any, verifications);
    return c.json({
      slug: user.slug,
      display_name: user.display_name,
      trust_score: trust.total_score,
      verifications: verifications,
      created_at: user.created_at,
      profile_url: `${publicUrl}/demo`,
      ai_summary: aiSummary
    });
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();

  if (!user || user.onboarding_complete !== 1) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const verificationsQuery = await c.env.DB.prepare("SELECT * FROM verifications WHERE user_id = ? AND status = 'verified'").bind(user.id).all();
  const verifications: Record<string, any> = {};

  for (const v of (verificationsQuery.results as any[] || [])) {
    verifications[v.platform] = {
      platform: v.platform,
      status: v.status,
      username: v.platform_username,
      verified_at: v.verified_at,
      metadata: typeof v.metadata_json === 'string' ? JSON.parse(v.metadata_json) : (v.metadata_json || {})
    };
  }

  const trust = computeTrustScore(verificationsQuery.results || []);
  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const aiSummary = generateAiSummary(user, trust, verifications);

  return c.json({
    slug: user.slug,
    display_name: user.display_name,
    trust_score: trust.total_score,
    verifications: verifications,
    created_at: user.created_at,
    profile_url: `${publicUrl}/${user.slug}`,
    ai_summary: aiSummary
  });
});

app.get('/:slug/ai', async (c) => {
  const slug = c.req.param('slug').toLowerCase();

  if (slug === 'demo' || slug === 'demo-user') {
    const user = {
      slug: "demo-user",
      display_name: "Jane Doe",
      created_at: new Date().toISOString()
    };
    const trust = { total_score: 92 };
    const verifications = {
      github: {
        platform: "github",
        status: "verified",
        username: "janedoe-dev",
        verified_at: new Date().toISOString(),
        metadata: {
          public_repos: 42,
          followers: 185,
          company: "Decentralized Corp",
          location: "Remote",
          bio: "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems.",
          html_url: "https://github.com",
        }
      },
      linkedin: {
        platform: "linkedin",
        status: "verified",
        username: "jane-doe",
        verified_at: new Date().toISOString(),
        metadata: {
          given_name: "Jane",
          family_name: "Doe",
          email: "jane.doe@example.com",
          locale: "en_US",
        }
      },
      whatsapp: {
        platform: "whatsapp",
        status: "verified",
        username: "+1234567890",
        verified_at: new Date().toISOString(),
        metadata: {
          phone_hash: "a8f3b2d9e0c1f2a3"
        }
      }
    };
    const aiSummary = generateAiSummary(user, trust as any, verifications);
    const llmPromptContext = (
      `You are an expert career advisor and resume writer. Below is the verified identity, ` +
      `social proof, and activity data gathered via IDme for ${user.display_name || user.slug}.\n\n` +
      `--- START VERIFIED IDENTITY PROFILE ---\n` +
      `${aiSummary}\n` +
      `--- END VERIFIED IDENTITY PROFILE ---\n\n` +
      `Tasks for the AI Agent:\n` +
      `1. Generate a tailored and optimized professional CV / Resume for this user based on their verified platform presence.\n` +
      `2. Suggest portfolio layout, projects to highlight (using public repo metrics), and professional summary hooks.\n` +
      `3. Do not invent details not present in the verified metadata; highlight only factual, cross-verified achievements.`
    );
    return c.json({
      slug: user.slug,
      display_name: user.display_name,
      trust_score: trust.total_score,
      raw_verifications: verifications,
      ai_summary: aiSummary,
      llm_prompt_context: llmPromptContext
    });
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();

  if (!user || user.onboarding_complete !== 1) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const verificationsQuery = await c.env.DB.prepare("SELECT * FROM verifications WHERE user_id = ? AND status = 'verified'").bind(user.id).all();
  const verifications: Record<string, any> = {};

  for (const v of (verificationsQuery.results as any[] || [])) {
    verifications[v.platform] = {
      platform: v.platform,
      status: v.status,
      username: v.platform_username,
      verified_at: v.verified_at,
      metadata: typeof v.metadata_json === 'string' ? JSON.parse(v.metadata_json) : (v.metadata_json || {})
    };
  }

  const trust = computeTrustScore(verificationsQuery.results || []);
  const aiSummary = generateAiSummary(user, trust, verifications);

  const llmPromptContext = (
    `You are an expert career advisor and resume writer. Below is the verified identity, ` +
    `social proof, and activity data gathered via IDme for ${user.display_name || user.slug}.\n\n` +
    `--- START VERIFIED IDENTITY PROFILE ---\n` +
    `${aiSummary}\n` +
    `--- END VERIFIED IDENTITY PROFILE ---\n\n` +
    `Tasks for the AI Agent:\n` +
    `1. Generate a tailored and optimized professional CV / Resume for this user based on their verified platform presence.\n` +
    `2. Suggest portfolio layout, projects to highlight (using public repo metrics), and professional summary hooks.\n` +
    `3. Do not invent details not present in the verified metadata; highlight only factual, cross-verified achievements.`
  );

  return c.json({
    slug: user.slug,
    display_name: user.display_name,
    trust_score: trust.total_score,
    raw_verifications: verifications,
    ai_summary: aiSummary,
    llm_prompt_context: llmPromptContext
  });
});

// Embeddable Badge JS Route
app.get('/:slug/badge.js', async (c) => {
  const slug = c.req.param('slug').toLowerCase();

  if (slug === 'demo' || slug === 'demo-user') {
    const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
    const profileUrl = `${publicUrl}/demo`;
    const score = 92;
    const badgeColor = "linear-gradient(135deg, #10b981, #059669)"; // emerald
    const jsCode = `(function(){
  var d=document,s=d.createElement('div');
  s.innerHTML='<a href="${profileUrl}" target="_blank" rel="noopener" '
    +'style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;'
    +'border-radius:20px;background:${badgeColor};color:#fff;font-family:Inter,system-ui,sans-serif;'
    +'font-size:13px;font-weight:600;text-decoration:none;transition:transform 0.2s;'
    +'box-shadow:0 2px 8px rgba(0,0,0,0.15)" '
    +'onmouseover="this.style.transform=\\'scale(1.05)\\'" '
    +'onmouseout="this.style.transform=\\'scale(1)\\'">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    +'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
    +'<polyline points="9 12 11 14 15 10"/></svg>'
    +'IDme Verified &middot; ${score}</a>';
  d.currentScript.parentElement.appendChild(s.firstChild);
})();`;
    return c.text(jsCode, 200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300'
    });
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();

  if (!user || user.onboarding_complete !== 1) {
    return c.text("/* IDme: profile not found */", 200, {
      'Content-Type': 'application/javascript'
    });
  }

  const verificationsQuery = await c.env.DB.prepare("SELECT * FROM verifications WHERE user_id = ? AND status = 'verified'").bind(user.id).all();
  const trust = computeTrustScore(verificationsQuery.results || []);

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const profileUrl = `${publicUrl}/${user.slug}`;

  let badgeColor = "linear-gradient(135deg, #6b7280, #4b5563)"; // default gray
  const score = trust.total_score;
  if (score >= 80) badgeColor = "linear-gradient(135deg, #10b981, #059669)"; // emerald
  else if (score >= 60) badgeColor = "linear-gradient(135deg, #3b82f6, #2563eb)"; // blue
  else if (score >= 40) badgeColor = "linear-gradient(135deg, #f59e0b, #d97706)"; // amber

  const jsCode = `(function(){
  var d=document,s=d.createElement('div');
  s.innerHTML='<a href="${profileUrl}" target="_blank" rel="noopener" '
    +'style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;'
    +'border-radius:20px;background:${badgeColor};color:#fff;font-family:Inter,system-ui,sans-serif;'
    +'font-size:13px;font-weight:600;text-decoration:none;transition:transform 0.2s;'
    +'box-shadow:0 2px 8px rgba(0,0,0,0.15)" '
    +'onmouseover="this.style.transform=\\'scale(1.05)\\'" '
    +'onmouseout="this.style.transform=\\'scale(1)\\'">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    +'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
    +'<polyline points="9 12 11 14 15 10"/></svg>'
    +'IDme Verified &middot; ${score}</a>';
  d.currentScript.parentElement.appendChild(s.firstChild);
})();`;

  return c.text(jsCode, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=300'
  });
});

// Dynamic QR code SVG Route
app.get('/:slug/qr', async (c) => {
  const slug = c.req.param('slug').toLowerCase();

  if (slug === 'demo' || slug === 'demo-user') {
    const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
    const url = `${publicUrl}/demo`;
    const qr = qrcode(0, 'H');
    qr.addData(url);
    qr.make();
    const svgString = qr.createSvgTag(6, 4);
    return c.text(svgString, 200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    });
  }

  const user: any = await c.env.DB.prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first();

  if (!user || user.onboarding_complete !== 1) {
    return c.text("Profile not found", 404);
  }

  const publicUrl = c.env.PUBLIC_URL || new URL(c.req.url).origin;
  const url = `${publicUrl}/${user.slug}`;

  // Generate SVG QR Code dynamically
  const qr = qrcode(0, 'H');
  qr.addData(url);
  qr.make();

  const svgString = qr.createSvgTag(6, 4);

  return c.text(svgString, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400'
  });
});

export default app;
