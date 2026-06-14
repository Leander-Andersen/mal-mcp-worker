import { MalClient } from "./mal.js";
import { TOOL_DEFINITIONS, callTool } from "./tools.js";
import { VERSION } from "./version.js";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Authorization",
  "Access-Control-Max-Age": "86400",
};

function sseResponse(data: unknown, sessionId?: string): Response {
  const encoder = new TextEncoder();
  const body = encoder.encode(
    `event: message\ndata: ${JSON.stringify(data)}\n\n`
  );

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    ...CORS_HEADERS,
  };
  if (sessionId !== undefined) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  return new Response(body, { status: 200, headers });
}

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export async function handleMcp(
  request: Request,
  mal: MalClient,
  isAuthenticated: boolean,
  baseUrl: string
): Promise<Response> {
  let message: JsonRpcRequest;

  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return sseResponse({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  const { method, id } = message;

  if (method === "initialize") {
    const sessionId = crypto.randomUUID();
    return sseResponse(
      {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "mal-mcp-worker", version: VERSION },
          instructions:
            "MyAnimeList v2 tools. Read-only tools (search, rankings, seasonal, user lists) work without authentication. Write tools (mal_update_anime_status, mal_delete_anime_from_list, mal_get_my_profile) require MAL OAuth — authenticate at " +
            baseUrl +
            "/oauth/authorize.",
        },
      },
      sessionId
    );
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === "tools/list") {
    return sseResponse({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOL_DEFINITIONS },
    });
  }

  if (method === "tools/call") {
    const params = message.params as ToolCallParams | undefined;
    const toolName = params?.name ?? "";
    const toolArgs = params?.arguments ?? {};

    try {
      const text = await callTool(toolName, toolArgs, mal, isAuthenticated);
      return sseResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text }],
          isError: false,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return sseResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${msg}` }],
          isError: true,
        },
      });
    }
  }

  return sseResponse({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  });
}
