# MAL-MCP-Worker

A Cloudflare Worker that exposes the [MyAnimeList v2 API](https://myanimelist.net/apiconfig/references/api/v2) as a full read/write [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server with OAuth 2.0 authentication.

Connect it to Claude.ai (or any MCP client) and ask things like:
- "Search for anime similar to Attack on Titan"
- "What are the top 10 anime of all time on MAL?"
- "What's airing in spring 2025?"
- "Show me my completed anime list with scores"
- "Mark Fullmetal Alchemist: Brotherhood as completed with a score of 10"
- "Add Cowboy Bebop to my plan to watch list"

---

## MCP Tools

All tools require OAuth login — the `/mcp` endpoint returns 401 for unauthenticated requests, which triggers the MCP client's login flow automatically.

### Read

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_search_anime` | Search anime by keyword | `query` |
| `mal_get_anime` | Full details for one or more anime by ID | `id` or `ids[]` |
| `mal_get_rankings` | Top anime by ranking type | — |
| `mal_get_seasonal` | Seasonal anime chart | `year`, `season` |
| `mal_get_user_list` | A public user's anime list with personal scores, start & completion dates | `username` |

### Write

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_update_anime_status` | Update status, score, episodes watched, start/finish dates | `anime_id` |
| `mal_delete_anime_from_list` | Remove an anime from your list | `anime_id` |
| `mal_get_my_profile` | Your MAL profile and anime statistics | — |

---

## How Authentication Works

The worker uses OAuth 2.0 with PKCE. Each user authenticates with their own MAL account — no credentials are ever shared with the app.

```
1. MCP client connects → receives 401
2. Client discovers OAuth metadata at /.well-known/oauth-authorization-server
3. Client opens the login page at /oauth/authorize
4. User clicks "Sign in with MyAnimeList" → redirected to MAL
5. User logs in and approves on MAL's own page
6. Worker exchanges the code for MAL tokens, stores them in Cloudflare KV
7. Worker issues a signed session token to the MCP client
8. All subsequent requests use Authorization: Bearer <token>
9. MAL tokens are silently refreshed when they expire (31-day sessions)
```

User sessions are stored in Cloudflare KV and expire after 30 days, after which the user simply logs in again.

---

## Setup

### 1. Register a MAL OAuth App

1. Log in at [myanimelist.net](https://myanimelist.net)
2. Go to [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) → **Create ID**
3. Fill in:
   - App Name: anything you like
   - App Type: **Web**
   - App Redirect URL: `https://<your-worker>.workers.dev/auth/callback`
4. Copy both the **Client ID** and **Client Secret**

> You can add more redirect URIs later after you know your worker URL.

---

### 2. Deploy the Worker

#### Option A — Deploy from this repo (no local setup)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages → Create → Import from Git**
3. Connect GitHub and select this repo
4. Build settings:
   - Build command: *(leave empty)*
   - Deploy command: `npx wrangler deploy`
5. Click **Save and Deploy**

#### Option B — Fork and self-host

Same as Option A but fork the repo first, giving you full control to push your own changes.

#### Option C — Deploy via CLI

```bash
git clone https://github.com/Leander-Andersen/mal-mcp-worker.git
cd mal-mcp-worker
npm install
npm run deploy
```

---

### 3. Create a KV Namespace

```bash
wrangler kv namespace create MAL_KV
wrangler kv namespace create MAL_KV --preview
```

Paste the two IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MAL_KV"
id = "<prod-id>"
preview_id = "<preview-id>"
```

Alternatively create the namespace via the Cloudflare dashboard (**Workers & Pages → KV → Create**) and paste the ID into both fields.

---

### 4. Set Secrets

In the Cloudflare dashboard: **Workers → your worker → Settings → Variables and Secrets → Add**

| Name | Type | Value |
|------|------|-------|
| `MAL_CLIENT_ID` | Secret | From myanimelist.net/apiconfig |
| `MAL_CLIENT_SECRET` | Secret | From myanimelist.net/apiconfig |
| `SESSION_SECRET` | Secret | Random 64-char hex string (see below) |

Generate `SESSION_SECRET` — paste this in your browser console (F12):
```javascript
Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')
```

Or via CLI:
```bash
wrangler secret put MAL_CLIENT_ID
wrangler secret put MAL_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

---

### 5. Update MAL App Redirect URI

Go back to [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) and make sure the redirect URI matches your deployed worker:

```
https://<your-worker>.workers.dev/auth/callback
```

---

## Connecting to Claude.ai

1. Open [Claude.ai](https://claude.ai) → **Settings → Integrations → Add**
2. Enter your Worker URL:
   ```
   https://<your-worker>.workers.dev/mcp
   ```
3. Claude will prompt you to sign in with your MAL account
4. A login page opens → click **Sign in with MyAnimeList**
5. Approve on MAL → you're connected. All 8 tools are now available.

> **Sharing:** Anyone can paste your worker URL into their MCP client and sign in with their own MAL account. Each user gets their own isolated session.

---

## Local Development

```bash
cp .dev.vars.example .dev.vars
# Fill in MAL_CLIENT_ID, MAL_CLIENT_SECRET, SESSION_SECRET in .dev.vars

npm run dev   # starts at http://localhost:8787
```

Test the OAuth flow manually:

```bash
# Health check (should show version 2.0.0)
curl http://localhost:8787/

# OAuth metadata discovery
curl http://localhost:8787/.well-known/oauth-authorization-server

# Start auth flow (open in browser)
open "http://localhost:8787/oauth/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:9999/cb&state=abc&code_challenge=myverifier&code_challenge_method=plain"

# Exchange code for session token
curl -X POST http://localhost:8787/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=<CODE>&code_verifier=myverifier&redirect_uri=http://localhost:9999/cb"

# Authenticated tool call
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mal_get_my_profile","arguments":{}}}'
```

---

## Architecture

```
src/index.ts    — Request routing, CORS, Env interface, session resolution
src/auth.ts     — OAuth 2.0 proxy (authorize, callback, token, revoke, refresh)
src/kv.ts       — Typed Cloudflare KV helpers (sessions, PKCE state, auth codes)
src/mcp.ts      — MCP/JSON-RPC protocol (initialize, tools/list, tools/call)
src/tools.ts    — Tool definitions + dispatch + response formatting
src/mal.ts      — MAL v2 API client (read + write, Bearer token support)
src/version.ts  — Version constant
```

**OAuth endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 metadata for MCP client auto-discovery |
| `GET /oauth/authorize` | Login page → redirects user to MAL |
| `GET /auth/callback` | MAL redirect target — exchanges code, stores session |
| `POST /oauth/token` | MCP client exchanges auth code for session token |
| `POST /oauth/revoke` | Invalidates a session |

**Transport:** Streamable HTTP (MCP spec 2025-03-26) — client POSTs JSON-RPC to `/mcp`, server responds with SSE.

---

## Notes

- **Free to run** — Cloudflare Workers + KV free tier is more than enough for personal use
- **Per-user sessions** — every user authenticates with their own MAL account; sessions are isolated
- **Secrets never in source** — all credentials are Cloudflare secrets injected at runtime
- **Auto token refresh** — MAL access tokens are silently refreshed before they expire
- **CI** — TypeScript type-check runs on every push via GitHub Actions
