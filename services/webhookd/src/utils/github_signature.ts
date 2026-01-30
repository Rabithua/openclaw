function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('invalid_hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyGithubSignatureOrThrow(args: {
  secret: string;
  signature256: string | null;
  // Deno's WebCrypto types are picky; keep this as an ArrayBuffer-backed Uint8Array.
  bodyBytes: Uint8Array<ArrayBuffer>;
}): Promise<void> {
  const { secret, signature256, bodyBytes } = args;

  // GitHub sends: X-Hub-Signature-256: sha256=<hex>
  if (!signature256 || !signature256.startsWith('sha256=')) {
    throw new Error('missing_signature');
  }

  const expectedHex = signature256.slice('sha256='.length);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, bodyBytes.buffer));
  const expected = hexToBytes(expectedHex);

  if (!timingSafeEqual(mac, expected)) {
    throw new Error('bad_signature');
  }
}
