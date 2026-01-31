#!/usr/bin/env -S deno run --allow-net --allow-env
/** Minimal Rote OpenKey client (Deno).
 *
 * Auth:
 * - Sends OpenKey as `openkey`.
 *   - GET: query param `?openkey=...`
 *   - POST: JSON field `{ openkey: "...", ... }`
 *
 * Env:
 *   ROTE_API_BASE  e.g. https://api.rote.ink/v2/api
 *   ROTE_API_KEY   your OpenKey
 *
 * Examples:
 *   ROTE_API_KEY=... deno run -A rote_openkey.ts create --content "hello" --tag inbox --private
 *   ROTE_API_KEY=... deno run -A rote_openkey.ts list --limit 5
 *   ROTE_API_KEY=... deno run -A rote_openkey.ts search --keyword "hello"
 */

type Json = Record<string, unknown>;

function apiBase(): string {
  const base = (Deno.env.get('ROTE_API_BASE') ?? '').trim() || 'https://api.rote.ink/v2/api';
  return base.replace(/\/+$/, '');
}

function apiKey(): string {
  const key = (Deno.env.get('ROTE_API_KEY') ?? '').trim();
  if (!key) throw new Error('Missing ROTE_API_KEY env var');
  return key;
}

function withOpenKeyQuery(url: URL): URL {
  if (!url.searchParams.get('openkey')) url.searchParams.set('openkey', apiKey());
  return url;
}

async function request(method: string, path: string, opts?: { query?: Record<string, string | string[]>; body?: Json }):
  Promise<unknown> {
  const url = new URL(apiBase() + path);

  const query = opts?.query ?? {};
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, item);
    } else {
      url.searchParams.set(k, v);
    }
  }
  withOpenKeyQuery(url);

  const headers: Record<string, string> = {
    'accept': 'application/json',
  };

  let body: string | undefined;
  if (opts?.body) {
    const payload: Json = { openkey: apiKey(), ...opts.body };
    body = JSON.stringify(payload);
    headers['content-type'] = 'application/json';
  }

  const resp = await fetch(url, { method, headers, body });
  const text = await resp.text().catch(() => '');

  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

function takeArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function takeRepeatable(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) out.push(args[i + 1]);
  }
  return out;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(`Rote OpenKey client\n\nCommands:\n  create --content <text> [--title <t>] [--tag <t> ...] [--pin] [--private|--public] [--type rote|article|other]\n  list [--skip N] [--limit N] [--archived true|false] [--tag <t> ...]\n  search --keyword <kw> [--skip N] [--limit N] [--archived true|false] [--tag <t> ...]\n`);
    return 0;
  }

  if (cmd === 'create') {
    const content = takeArg(args, '--content');
    if (!content) throw new Error('Missing --content');

    const title = takeArg(args, '--title');
    const type = takeArg(args, '--type') ?? 'rote';
    const tags = takeRepeatable(args, '--tag');
    const pin = hasFlag(args, '--pin');

    const state = hasFlag(args, '--public') ? 'public' : 'private';

    const data = await request('POST', '/openkey/notes', {
      body: {
        content,
        title,
        type,
        tags,
        pin,
        state,
      },
    });
    console.log(JSON.stringify(data, null, 2));
    return 0;
  }

  if (cmd === 'list') {
    const skip = takeArg(args, '--skip') ?? '0';
    const limit = takeArg(args, '--limit') ?? '20';
    const archived = takeArg(args, '--archived');
    const tags = takeRepeatable(args, '--tag');

    const query: Record<string, string | string[]> = { skip, limit };
    if (archived != null) query['archived'] = archived;
    if (tags.length) query['tag'] = tags;

    const data = await request('GET', '/openkey/notes', { query });
    console.log(JSON.stringify(data, null, 2));
    return 0;
  }

  if (cmd === 'search') {
    const keyword = takeArg(args, '--keyword');
    if (!keyword) throw new Error('Missing --keyword');

    const skip = takeArg(args, '--skip') ?? '0';
    const limit = takeArg(args, '--limit') ?? '20';
    const archived = takeArg(args, '--archived');
    const tags = takeRepeatable(args, '--tag');

    const query: Record<string, string | string[]> = { keyword, skip, limit };
    if (archived != null) query['archived'] = archived;
    if (tags.length) query['tag'] = tags;

    const data = await request('GET', '/openkey/notes/search', { query });
    console.log(JSON.stringify(data, null, 2));
    return 0;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

if (import.meta.main) {
  main(Deno.args).catch((err) => {
    console.error(String(err));
    Deno.exit(1);
  });
}
