export interface SessionData {
  mal_access_token: string;
  mal_refresh_token: string;
  mal_token_expires_at: number; // unix seconds
  mal_username: string;
}

export interface PkceData {
  mal_code_verifier: string;
  client_redirect_uri: string;
  client_code_challenge: string;
  client_code_challenge_method: string;
  client_state: string;
}

export interface CodeData {
  session_id: string;
  client_code_challenge: string;
  client_code_challenge_method: string;
  client_redirect_uri: string;
}

const SESSION_TTL = 2592000; // 30 days
const PKCE_TTL = 600; // 10 minutes
const CODE_TTL = 300; // 5 minutes

export async function putSession(kv: KVNamespace, sessionId: string, data: SessionData): Promise<void> {
  await kv.put(`session:${sessionId}`, JSON.stringify(data), { expirationTtl: SESSION_TTL });
}

export async function getSession(kv: KVNamespace, sessionId: string): Promise<SessionData | null> {
  const raw = await kv.get(`session:${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  await kv.delete(`session:${sessionId}`);
}

export async function putPkce(kv: KVNamespace, state: string, data: PkceData): Promise<void> {
  await kv.put(`pkce:${state}`, JSON.stringify(data), { expirationTtl: PKCE_TTL });
}

export async function getPkce(kv: KVNamespace, state: string): Promise<PkceData | null> {
  const raw = await kv.get(`pkce:${state}`);
  if (!raw) return null;
  return JSON.parse(raw) as PkceData;
}

export async function deletePkce(kv: KVNamespace, state: string): Promise<void> {
  await kv.delete(`pkce:${state}`);
}

export async function putCode(kv: KVNamespace, code: string, data: CodeData): Promise<void> {
  await kv.put(`code:${code}`, JSON.stringify(data), { expirationTtl: CODE_TTL });
}

export async function getAndDeleteCode(kv: KVNamespace, code: string): Promise<CodeData | null> {
  const raw = await kv.get(`code:${code}`);
  if (!raw) return null;
  await kv.delete(`code:${code}`);
  return JSON.parse(raw) as CodeData;
}
