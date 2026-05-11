import {
  SessionData,
  PkceData,
  CodeData,
  putSession,
  getSession,
  deleteSession,
  putPkce,
  getPkce,
  deletePkce,
  putCode,
  getAndDeleteCode,
} from "./kv.js";

// Minimal env shape needed by auth handlers — avoids circular import with index.ts
interface AuthEnv {
  MAL_CLIENT_ID: string;
  MAL_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  MAL_KV: KVNamespace;
}

const MAL_AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize";
const MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";
const MAL_API_BASE = "https://api.myanimelist.net/v2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Authorization",
};

// --- PKCE helpers ---

function generatePkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 43);
}

async function computeChallenge(verifier: string, method: string): Promise<string> {
  if (method === "plain") return verifier;
  // S256: SHA-256(verifier) → base64url
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// --- HMAC session token signing ---

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signToken(sessionId: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionId));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${sessionId}.${sigB64}`;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const sessionId = token.slice(0, dot);
  const expected = await signToken(sessionId, secret);
  if (token.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? sessionId : null;
}

// --- OAuth metadata discovery (RFC 8414) ---

export function handleOAuthMetadata(request: Request): Response {
  const baseUrl = new URL(request.url).origin;
  return Response.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
    },
    { headers: CORS_HEADERS }
  );
}

// --- Authorization endpoint ---

export async function handleAuthorize(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = url.origin;
  const params = url.searchParams;

  const responseType = params.get("response_type");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") ?? "plain";

  if (!redirectUri || !codeChallenge) {
    return new Response("Missing required parameters: redirect_uri, code_challenge", { status: 400 });
  }

  if (responseType !== "code") {
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set("error", "unsupported_response_type");
    if (state) errorUrl.searchParams.set("state", state);
    return Response.redirect(errorUrl.toString(), 302);
  }

  // Generate PKCE verifier for MAL (MAL only supports plain)
  const malVerifier = generatePkceVerifier();
  const workerState = crypto.randomUUID();

  await putPkce(env.MAL_KV, workerState, {
    mal_code_verifier: malVerifier,
    client_redirect_uri: redirectUri,
    client_code_challenge: codeChallenge,
    client_code_challenge_method: codeChallengeMethod,
    client_state: state,
  } satisfies PkceData);

  const malAuthUrl = new URL(MAL_AUTH_URL);
  malAuthUrl.searchParams.set("response_type", "code");
  malAuthUrl.searchParams.set("client_id", env.MAL_CLIENT_ID);
  malAuthUrl.searchParams.set("state", workerState);
  malAuthUrl.searchParams.set("code_challenge", malVerifier);
  malAuthUrl.searchParams.set("code_challenge_method", "plain");
  malAuthUrl.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);

  return new Response(loginPage(malAuthUrl.toString()), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function loginPage(malAuthUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect MyAnimeList</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bubblegum:  #FFB2B7;
      --light-pink: #FFD5D8;
      --highlight:  #FF8F9A;
      --hot-pink:   #FF6B9D;
      --deep-rose:  #501928;
      --rose-shadow: #D88090;
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--light-pink);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><text y='24' font-size='24'>🩷</text></svg>") 16 16, auto;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: radial-gradient(circle, var(--bubblegum) 1.5px, transparent 1.5px);
      background-size: 28px 28px;
      pointer-events: none;
      z-index: 0;
    }

    .card {
      position: relative;
      z-index: 1;
      background: #fff;
      border: 2px solid var(--bubblegum);
      border-radius: 28px;
      padding: 48px 40px 40px;
      width: 100%;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 6px 0 var(--rose-shadow), 0 12px 32px rgba(80,25,40,.15);
    }

    .blossom {
      width: 72px;
      height: 72px;
      background: var(--bubblegum);
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      box-shadow: 0 4px 0 var(--highlight);
      animation: heartbeat 1.8s ease-in-out infinite;
      transform-origin: center;
    }

    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      14%       { transform: scale(1.08); }
      28%       { transform: scale(1); }
      42%       { transform: scale(1.05); }
      56%       { transform: scale(1); }
    }

    h1 {
      color: var(--deep-rose);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 8px;
    }

    .subtitle {
      color: var(--rose-shadow);
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 28px;
    }

    .perms {
      background: var(--light-pink);
      border: 1.5px solid var(--bubblegum);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 24px;
      text-align: left;
    }

    .perms-label {
      color: var(--rose-shadow);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .perm {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--deep-rose);
      font-size: 13px;
      margin-bottom: 7px;
    }

    .perm:last-child { margin-bottom: 0; }

    .pip {
      width: 7px;
      height: 7px;
      background: var(--hot-pink);
      border-radius: 50%;
      flex-shrink: 0;
    }

    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: var(--highlight);
      color: #fff;
      text-decoration: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.2px;
      border: none;
      box-shadow: 0 4px 0 var(--hot-pink);
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .btn:hover {
      background: var(--hot-pink);
      transform: translateY(-2px);
      box-shadow: 0 6px 0 #d45085;
    }

    .btn:active {
      transform: translateY(2px);
      box-shadow: 0 2px 0 var(--hot-pink);
    }

    .footer {
      margin-top: 18px;
      color: var(--rose-shadow);
      font-size: 12px;
      line-height: 1.7;
    }

    .footer a { color: var(--hot-pink); text-decoration: none; }
    .footer a:hover { color: var(--deep-rose); }
  </style>
</head>
<body>
  <div class="card">
    <div class="blossom">🌸</div>
    <h1>Connect MyAnimeList</h1>
    <p class="subtitle">Sign in with your MAL account to give Claude<br>access to your anime list.</p>

    <div class="perms">
      <div class="perms-label">This will allow Claude to</div>
      <div class="perm"><span class="pip"></span> Read your anime list &amp; profile</div>
      <div class="perm"><span class="pip"></span> Update watch status &amp; scores</div>
      <div class="perm"><span class="pip"></span> Set start &amp; completion dates</div>
      <div class="perm"><span class="pip"></span> Add &amp; remove anime from your list</div>
    </div>

    <a href="${malAuthUrl}" class="btn">Sign in with MyAnimeList 🩷</a>

    <p class="footer">
      You'll be redirected to MyAnimeList to authorize.<br>
      Your password is never seen by this app.<br>
      <a href="https://myanimelist.net" target="_blank">myanimelist.net</a>
    </p>
  </div>

  <script>
    document.addEventListener('click', e => {
      const colors = ['#FFB2B7','#FF8F9A','#FF6B9D','#FFD5D8','#D88090','#ff85c2'];
      for (let i = 0; i < 6; i++) {
        const heart = document.createElement('span');
        heart.textContent = '♥';
        heart.style.cssText = \`position:fixed;left:\${e.clientX}px;top:\${e.clientY}px;color:\${colors[i % colors.length]};font-size:\${10 + Math.random()*14}px;pointer-events:none;z-index:9999;transition:all .9s ease-out;opacity:1;\`;
        document.body.appendChild(heart);
        requestAnimationFrame(() => {
          heart.style.transform = \`translate(\${(Math.random()-0.5)*80}px,\${-40 - Math.random()*60}px)\`;
          heart.style.opacity = '0';
        });
        setTimeout(() => heart.remove(), 950);
      }
    });
  </script>
</body>
</html>`;
}

// --- Callback endpoint ---

function errorPage(message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><title>Auth Error</title></head><body><h2>Authentication Error</h2><p>${message}</p><p>Please close this tab and try again.</p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

export async function handleCallback(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return errorPage("Missing code or state parameter.");
  }

  const pkceData = await getPkce(env.MAL_KV, state);
  if (!pkceData) {
    return errorPage("Authorization session expired or invalid. Please try again.");
  }
  await deletePkce(env.MAL_KV, state);

  // Exchange authorization code with MAL
  const tokenRes = await fetch(MAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.MAL_CLIENT_ID,
      client_secret: env.MAL_CLIENT_SECRET,
      code,
      code_verifier: pkceData.mal_code_verifier,
      redirect_uri: `${baseUrl}/auth/callback`,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    return errorPage(`MAL token exchange failed (${tokenRes.status}): ${body}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch MAL username to store with the session
  const profileRes = await fetch(`${MAL_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profileData = profileRes.ok
    ? ((await profileRes.json()) as { name: string })
    : { name: "unknown" };

  // Persist the session
  const sessionId = crypto.randomUUID();
  await putSession(env.MAL_KV, sessionId, {
    mal_access_token: tokenData.access_token,
    mal_refresh_token: tokenData.refresh_token,
    mal_token_expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    mal_username: profileData.name,
  } satisfies SessionData);

  // Issue a short-lived auth code to the MCP client
  const authCode = crypto.randomUUID();
  await putCode(env.MAL_KV, authCode, {
    session_id: sessionId,
    client_code_challenge: pkceData.client_code_challenge,
    client_code_challenge_method: pkceData.client_code_challenge_method,
    client_redirect_uri: pkceData.client_redirect_uri,
  } satisfies CodeData);

  // Redirect back to the MCP client's redirect_uri
  const clientRedirect = new URL(pkceData.client_redirect_uri);
  clientRedirect.searchParams.set("code", authCode);
  if (pkceData.client_state) clientRedirect.searchParams.set("state", pkceData.client_state);

  return Response.redirect(clientRedirect.toString(), 302);
}

// --- Token endpoint ---

export async function handleToken(request: Request, env: AuthEnv): Promise<Response> {
  let body: URLSearchParams;
  try {
    body = new URLSearchParams(await request.text());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: CORS_HEADERS });
  }

  const grantType = body.get("grant_type");
  const code = body.get("code");
  const codeVerifier = body.get("code_verifier");
  const redirectUri = body.get("redirect_uri");

  if (grantType !== "authorization_code") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!code || !codeVerifier || !redirectUri) {
    return Response.json(
      { error: "invalid_request", error_description: "Missing code, code_verifier, or redirect_uri" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const codeData = await getAndDeleteCode(env.MAL_KV, code);
  if (!codeData) {
    return Response.json({ error: "invalid_grant" }, { status: 400, headers: CORS_HEADERS });
  }

  // Validate PKCE
  const expectedChallenge = await computeChallenge(codeVerifier, codeData.client_code_challenge_method);
  if (expectedChallenge !== codeData.client_code_challenge) {
    return Response.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (redirectUri !== codeData.client_redirect_uri) {
    return Response.json(
      { error: "invalid_grant", error_description: "redirect_uri mismatch" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const accessToken = await signToken(codeData.session_id, env.SESSION_SECRET);
  return Response.json(
    { access_token: accessToken, token_type: "Bearer", expires_in: 2592000, scope: "" },
    { headers: CORS_HEADERS }
  );
}

// --- Revocation endpoint ---

export async function handleRevoke(request: Request, env: AuthEnv): Promise<Response> {
  try {
    const body = new URLSearchParams(await request.text());
    const token = body.get("token");
    if (token) {
      const sessionId = await verifyToken(token, env.SESSION_SECRET);
      if (sessionId) await deleteSession(env.MAL_KV, sessionId);
    }
  } catch {
    // Revocation always returns 200 per RFC 7009
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

// --- Session resolution (called on every /mcp request) ---

export async function resolveSession(request: Request, env: AuthEnv): Promise<SessionData | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const sessionId = await verifyToken(token, env.SESSION_SECRET);
  if (!sessionId) return null;

  const session = await getSession(env.MAL_KV, sessionId);
  if (!session) return null;

  // Auto-refresh if the MAL access token expires within 60 seconds
  if (session.mal_token_expires_at < Math.floor(Date.now() / 1000) + 60) {
    return refreshMalToken(session, sessionId, env);
  }

  return session;
}

async function refreshMalToken(
  session: SessionData,
  sessionId: string,
  env: AuthEnv
): Promise<SessionData> {
  const res = await fetch(MAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.mal_refresh_token,
      client_id: env.MAL_CLIENT_ID,
      client_secret: env.MAL_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    await deleteSession(env.MAL_KV, sessionId);
    throw new Error("MAL session expired. Please re-authenticate.");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const updated: SessionData = {
    ...session,
    mal_access_token: data.access_token,
    mal_refresh_token: data.refresh_token,
    mal_token_expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };

  await putSession(env.MAL_KV, sessionId, updated);
  return updated;
}
