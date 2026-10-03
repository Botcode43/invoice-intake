import crypto from "crypto";

export interface SessionPayload {
  userId: string;
  tenantId: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not configured");
  }
  return secret;
}

/**
 * Signs a session payload into a token: "<payloadBase64Url>.<signatureHex>"
 */
export function signSession(payload: SessionPayload): string {
  const secret = getSecret();
  const rawPayload = JSON.stringify(payload);
  const payloadB64 = Buffer.from(rawPayload, "utf-8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed session token using timing-safe HMAC comparison.
 * Returns SessionPayload if valid, null otherwise.
 */
export function verifySession(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [payloadB64, signature] = parts;
    const secret = getSecret();
    const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const data = JSON.parse(jsonStr);

    if (
      typeof data === "object" &&
      data !== null &&
      typeof data.userId === "string" &&
      typeof data.tenantId === "string" &&
      data.userId.trim() !== "" &&
      data.tenantId.trim() !== ""
    ) {
      return { userId: data.userId, tenantId: data.tenantId };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the session from the incoming Request's cookies.
 */
export function getSession(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  // Parse cookies from header
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (!sessionCookie) {
    return null;
  }

  const token = sessionCookie.slice("session=".length);
  return verifySession(token);
}

/**
 * Generates the serialized cookie string for the session cookie.
 */
export function createSessionCookie(userId: string, tenantId: string): string {
  const token = signSession({ userId, tenantId });
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

/**
 * Generates the serialized cookie string to expire/clear the session cookie.
 */
export function clearSessionCookie(): string {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
