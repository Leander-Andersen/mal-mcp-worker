# MAL-MCP-Worker

A Cloudflare Worker that exposes the [MyAnimeList v2 API](https://myanimelist.net/apiconfig/references/api/v2) as a read-only [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server using the Streamable HTTP transport.

Connect it to Claude.ai (or any MCP client) and ask things like:
- "Search for anime similar to Attack on Titan"
- "What are the top 10 anime of all time on MAL?"
- "What's airing in winter 2025?"
- "Show me JohnDoe's completed anime list with their personal scores"

## MCP Tools

<<<<<<< Updated upstream
=======
All tools require OAuth login — the `/mcp` endpoint returns 401 for unauthenticated requests, which triggers the MCP client's login flow automatically.

### Read — Anime

>>>>>>> Stashed changes
| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_search_anime` | Search anime by keyword | `query` |
| `mal_get_anime` | Full details for an anime by ID | `id` |
| `mal_get_rankings` | Top anime by ranking type | — |
| `mal_get_seasonal` | Seasonal anime chart | `year`, `season` |
<<<<<<< Updated upstream
| `mal_get_user_list` | A public user's anime list with personal scores | `username` |
=======
| `mal_get_user_list` | A public user's anime list with personal scores, start & completion dates | `username` |

### Read — Manga & Light Novels

Covers manga, light novels, novels, manhwa, manhua, one-shots and doujinshi — check each result's `media_type` to tell formats apart.

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_search_manga` | Search manga / light novels by keyword | `query` |
| `mal_get_manga` | Full details (authors, serialization) for one or more entries by ID | `id` or `ids[]` |
| `mal_get_manga_rankings` | Top manga by ranking type (use `novels` for light novels) | — |
| `mal_get_user_manga_list` | A public user's manga list with personal scores, start & completion dates | `username` |

### Write

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_update_anime_status` | Update status, score, episodes watched, start/finish dates | `anime_id` |
| `mal_delete_anime_from_list` | Remove an anime from your list | `anime_id` |
| `mal_update_manga_status` | Update status, score, chapters/volumes read, start/finish dates | `manga_id` |
| `mal_delete_manga_from_list` | Remove a manga from your list | `manga_id` |
| `mal_get_my_profile` | Your MAL profile and anime statistics | — |
>>>>>>> Stashed changes

> **Notes:** MAL has no seasonal chart for manga, and its profile endpoint only exposes anime statistics — so there is no `mal_get_seasonal` or manga-statistics equivalent.

---

## Getting a MAL Client ID

All deployment options require a MAL Client ID. It's free and takes 2 minutes.

1. Log in at [myanimelist.net](https://myanimelist.net)
2. Go to [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) → **Create ID**
3. App Name: anything • App Type: other • Redirect URL: `http://localhost`
4. Copy the **Client ID** from the next page

---

## Deployment

Cloudflare Workers is free. Pick the option that suits you:

---

### Option 1 — Deploy from this repo (easiest, no local setup)

Cloudflare pulls directly from this public GitHub repo and auto-deploys on every push to `main`. No CLI, no API tokens in GitHub.

1. **Sign up / log in** at [dash.cloudflare.com](https://dash.cloudflare.com) — it's free
2. Go to **Workers & Pages → Create → Import from Git**
3. Connect your GitHub and select this repo (`Leander-Andersen/mal-mcp-worker`)
4. Build settings:
   - Build command: `npm install`
   - Deploy command: `npx wrangler deploy`
5. Click **Save and Deploy**
6. Once deployed, go to your Worker → **Settings → Variables and Secrets → Add Secret**
   - Name: `MAL_CLIENT_ID` • Value: your MAL Client ID
7. Trigger a redeploy so the secret takes effect

Your Worker URL:
```
https://mal-mcp-worker.<your-subdomain>.workers.dev
```

---

### Option 2 — Fork and deploy your own copy

Same as Option 1, but gives you full control to modify and push your own changes.

1. Fork this repo on GitHub
2. Follow Option 1 steps, selecting your fork instead
3. Any push to `main` in your fork will auto-deploy

---

### Option 3 — Deploy from local clone

For those who prefer the CLI or want to develop locally.

```bash
# Clone and install
git clone https://github.com/Leander-Andersen/mal-mcp-worker.git
cd mal-mcp-worker
npm install

# Set your MAL Client ID as a Cloudflare secret
npx wrangler secret put MAL_CLIENT_ID
# Paste your Client ID when prompted

# Deploy
npm run deploy
```

<details>
<summary>Local development (wrangler dev)</summary>

```bash
# Create your local secrets file
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set MAL_CLIENT_ID=your_actual_client_id

# Start local dev server at http://localhost:8787
npm run dev
```

Test endpoints:
```bash
# Health check
curl http://localhost:8787/

# Initialize MCP session
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}'

# List available tools
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Search anime
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mal_search_anime","arguments":{"query":"fullmetal alchemist","limit":3}}}'
```
</details>

---

## Connecting to Claude.ai

1. Open [Claude.ai](https://claude.ai) → **Settings** → **Integrations**
2. Click **Add Integration**
3. Enter your Worker URL:
   ```
   https://mal-mcp-worker.<your-subdomain>.workers.dev/mcp
   ```
4. Save — Claude will discover all 5 tools automatically

---

## Architecture

```
src/index.ts     — Request routing, CORS, Env type
  └─ src/mcp.ts  — MCP/JSON-RPC protocol (initialize, tools/list, tools/call)
       └─ src/tools.ts  — Tool definitions (inputSchema) + dispatch + formatting
            └─ src/mal.ts    — MAL v2 API client (typed fetch wrappers)
```

**Transport:** Streamable HTTP (spec 2025-03-26) — client POSTs JSON-RPC to `/mcp`, server responds with SSE.

## Notes

- **Free to run** — Cloudflare Workers free tier is more than enough for personal use
- **Fully stateless** — no KV, D1, or persistent storage. Each request is self-contained.
- **Open-source safe** — `MAL_CLIENT_ID` is a Cloudflare secret injected at runtime; never in source code
- **Read-only** — only public MAL data. No OAuth, no write operations
- **CORS** — wildcard origin (`*`) so any MCP client can connect
