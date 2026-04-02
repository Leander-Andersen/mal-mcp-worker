# MAL-MCP-Worker

A Cloudflare Worker that exposes the [MyAnimeList v2 API](https://myanimelist.net/apiconfig/references/api/v2) as a read-only [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server using the Streamable HTTP transport.

Connect it to Claude.ai (or any MCP client) and ask questions like:
- "Search for anime similar to Attack on Titan"
- "What are the top 10 anime of all time on MAL?"
- "What's airing in winter 2025?"
- "Show me user JohnDoe's completed anime list"

## MCP Tools

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `mal_search_anime` | Search anime by keyword | `query` |
| `mal_get_anime` | Full details for an anime by ID | `id` |
| `mal_get_rankings` | Top anime by ranking type | — |
| `mal_get_seasonal` | Seasonal anime chart | `year`, `season` |
| `mal_get_user_list` | A public user's anime list | `username` |

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A MyAnimeList API Client ID (see below)

## Getting a MAL Client ID

1. Log in to [myanimelist.net](https://myanimelist.net)
2. Go to **Account Settings → API → Create ID**  
   Direct link: [https://myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)
3. Fill in the app name and description. App type can be "other". Redirect URL can be `http://localhost`.
4. Copy the **Client ID** — you'll need it in the next step.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your local secrets file
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set MAL_CLIENT_ID to your actual client ID

# 3. Start the local dev server
npm run dev
# Worker is available at http://localhost:8787
```

Test it:

```bash
# Health check
curl http://localhost:8787/

# MCP initialize
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}}'

# List tools
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

## Deployment

Cloudflare pulls and deploys directly from this public GitHub repo — no CI/CD pipeline or API tokens needed in the repo.

### One-time setup

**1. Connect the repo in the Cloudflare dashboard:**
- Workers & Pages → Create → Import from Git → select this repo
- Set build command: `npm install && npm run deploy` (or leave as default if CF detects wrangler.toml)
- CF will auto-deploy on every push to `main`

**2. Set your MAL Client ID as a Cloudflare secret:**
- Workers & Pages → your Worker → Settings → Variables → Add Secret
- Name: `MAL_CLIENT_ID`, Value: your MAL client ID

Your Worker URL will be:
```
https://mal-mcp-worker.<your-subdomain>.workers.dev
```

## Connecting to Claude.ai

1. Open [Claude.ai](https://claude.ai) → **Settings** → **Integrations** (or **MCP Servers**)
2. Click **Add Integration** / **Add MCP Server**
3. Enter your Worker URL:
   ```
   https://mal-mcp-worker.<your-subdomain>.workers.dev/mcp
   ```
4. Save — Claude will discover the 5 available tools automatically.

## Architecture

```
src/index.ts     — Request routing, CORS, Env type
  └─ src/mcp.ts  — MCP/JSON-RPC protocol (initialize, tools/list, tools/call)
       └─ src/tools.ts  — Tool definitions (inputSchema) + dispatch + formatting
            └─ src/mal.ts    — MAL v2 API client (typed fetch wrappers)
```

**Transport:** Streamable HTTP (spec 2025-03-26) — client POSTs JSON-RPC to `/mcp`, server responds with SSE.

## Notes

- **Fully stateless** — no KV, D1, or persistent storage. Each request is self-contained.
- **Open-source safe** — `MAL_CLIENT_ID` is a Cloudflare secret injected at runtime; it never appears in source code.
- **Read-only** — only public MAL data is accessible. No OAuth, no user write operations.
- **CORS** — configured for wildcard origin (`*`) so any MCP client can connect.
