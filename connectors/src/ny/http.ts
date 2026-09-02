// ---------------------------------------------------------------------------
// Logged fetch wrapper
// ---------------------------------------------------------------------------
// Every Namma Yatri API call goes through `loggedFetch` so we get a uniform
// log of URL, method, request headers (with sensitive values redacted),
// request body, status, response body and elapsed time. The returned object
// is shape-compatible with the subset of the Fetch Response interface that
// existing call sites use (`ok`, `status`, `text()`, `json()`).
// ---------------------------------------------------------------------------

export interface LoggedResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: <T = any>() => Promise<T>;
}

const SENSITIVE_HEADER_KEYS = new Set(['token', 'authorization', 'cookie']);

function sanitizeHeaders(headers: any): Record<string, string> {
  if (!headers) return {};
  const entries: [string, string][] = Array.isArray(headers)
    ? (headers as [string, string][])
    : Object.entries(headers as Record<string, string>);
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) && typeof value === 'string') {
      out[key] = value.length > 8
        ? `${value.substring(0, 8)}…(len=${value.length})`
        : '<redacted>';
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

export async function loggedFetch(url: string, init: RequestInit = {}): Promise<LoggedResponse> {
  const method = init.method || 'GET';
  const headers = sanitizeHeaders(init.headers);
  const reqBody = typeof init.body === 'string'
    ? init.body
    : init.body
      ? '<binary>'
      : undefined;

  console.log(`[ny-api] → ${method} ${url}`);
  console.log(`[ny-api]   request headers: ${JSON.stringify(headers)}`);
  if (reqBody !== undefined) {
    console.log(`[ny-api]   request body: ${reqBody}`);
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await globalThis.fetch(url, init);
  } catch (err: any) {
    console.error(`[ny-api] ✗ ${method} ${url} — network error: ${err.message}`);
    throw err;
  }
  const text = await res.text().catch(() => '');
  const elapsed = Date.now() - started;

  console.log(`[ny-api] ← ${res.status} ${method} ${url} (${elapsed}ms)`);
  console.log(`[ny-api]   response body: ${text}`);

  return {
    ok: res.ok,
    status: res.status,
    text: async () => text,
    json: async <T = any>() => JSON.parse(text) as T,
  };
}
