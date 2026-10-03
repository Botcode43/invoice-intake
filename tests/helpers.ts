import { pool } from "@/lib/db";
import { signSession } from "@/lib/session";

/**
 * Generates the Cookie header value containing a valid signed session.
 */
export function makeSessionCookie(userId: string, tenantId: string): string {
  const token = signSession({ userId, tenantId });
  return `session=${token}`;
}

/**
 * Constructs a standard Request object for testing route handlers.
 */
export function buildRequest(
  url: string,
  options?: {
    method?: string;
    session?: { userId: string; tenantId: string };
    body?: unknown;
    headers?: Record<string, string>;
  }
): Request {
  const method = options?.method || "GET";
  const headers = new Headers(options?.headers || {});

  if (options?.session) {
    headers.set("cookie", makeSessionCookie(options.session.userId, options.session.tenantId));
  }

  let body: string | undefined = undefined;
  if (options?.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

/**
 * Truncates invoices and invoice_lines tables between tests for complete test isolation.
 */
export async function truncateTables(): Promise<void> {
  await pool.query("TRUNCATE TABLE invoice_lines, invoices CASCADE;");
}
