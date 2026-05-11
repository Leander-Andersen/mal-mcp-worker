import { MalClient } from "./mal.js";
import { CORS_HEADERS, handleMcp } from "./mcp.js";
import { VERSION } from "./version.js";
import {
  handleOAuthMetadata,
  handleAuthorize,
  handleCallback,
  handleToken,
  handleRevoke,
  resolveSession,
} from "./auth.js";

export interface Env {
  MAL_CLIENT_ID: string;
  MAL_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  MAL_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const baseUrl = url.origin;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // OAuth authorization server metadata (MCP spec discovery)
    if (request.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
      return handleOAuthMetadata(request);
    }

    // OAuth flow endpoints
    if (request.method === "GET" && url.pathname === "/oauth/authorize") {
      return handleAuthorize(request, env);
    }
    if (request.method === "GET" && url.pathname === "/auth/callback") {
      return handleCallback(request, env);
    }
    if (request.method === "POST" && url.pathname === "/oauth/token") {
      return handleToken(request, env);
    }
    if (request.method === "POST" && url.pathname === "/oauth/revoke") {
      return handleRevoke(request, env);
    }

    // MCP endpoint
    if (request.method === "POST" && url.pathname === "/mcp") {
      let session = null;
      try {
        session = await resolveSession(request, env);
      } catch {
        // Refresh token expired — signal re-auth
        return new Response(null, { status: 401, headers: CORS_HEADERS });
      }
      const mal = session
        ? new MalClient(env.MAL_CLIENT_ID, session.mal_access_token)
        : new MalClient(env.MAL_CLIENT_ID);
      return handleMcp(request, mal, session !== null, baseUrl);
    }

    // Health check
    if (url.pathname === "/") {
      return Response.json(
        {
          name: "mal-mcp-worker",
          version: VERSION,
          status: "ok",
          transport: "streamable-http",
          endpoint: "/mcp",
          auth: `${baseUrl}/.well-known/oauth-authorization-server`,
        },
        { headers: CORS_HEADERS }
      );
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
} satisfies ExportedHandler<Env>;
