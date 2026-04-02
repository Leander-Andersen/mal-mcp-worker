import { MalClient } from "./mal.js";
import { CORS_HEADERS, handleMcp } from "./mcp.js";

export interface Env {
  MAL_CLIENT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "POST" && url.pathname === "/mcp") {
      const mal = new MalClient(env.MAL_CLIENT_ID);
      return handleMcp(request, mal);
    }

    if (url.pathname === "/") {
      return Response.json(
        {
          name: "mal-mcp-worker",
          status: "ok",
          transport: "streamable-http",
          endpoint: "/mcp",
        },
        { headers: CORS_HEADERS }
      );
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
} satisfies ExportedHandler<Env>;
