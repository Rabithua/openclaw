/**
 * Simple authentication utilities for Traveler submit endpoint.
 *
 * Supports two methods:
 * 1. API Token in X-API-Token header
 * 2. HMAC-SHA256 signature in X-Signature header
 */

export function validateApiToken(token: string, envToken?: string): boolean {
  if (!envToken) return false;
  if (!token) return false;
  // Use timing-safe comparison to prevent timing attacks
  return token === envToken;
}

export async function validateHmacSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureData = encoder.encode(body);
  const computed = await crypto.subtle.sign("HMAC", key, signatureData);

  const computedHex = Array.from(new Uint8Array(computed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Remove "sha256=" prefix if present
  const providedHex = signature.replace(/^sha256=/, "");

  return computedHex === providedHex;
}

export function getAuthToken(headers: Headers): string | null {
  return headers.get("x-api-token") ?? headers.get("X-API-Token") ?? null;
}

export function getSignature(headers: Headers): string | null {
  return headers.get("x-signature") ?? headers.get("X-Signature") ?? null;
}
