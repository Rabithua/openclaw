import { json } from '../utils/http.ts';
import { verifyGithubSignatureOrThrow } from '../utils/github_signature.ts';
import { openclawToolsInvoke, requireEnv } from '../utils/openclaw.ts';

type GithubIssuesEvent = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: { login: string };
  };
  repository: { full_name: string };
};

type GithubWebhookEnvelope = {
  source: 'github';
  event: string;
  delivery?: string | null;
  receivedAt: string;
  payload: unknown;
};

function buildSystemEventText(args: {
  repo: string;
  action: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  author: string;
  body: string | null;
}): string {
  const { repo, action, issueNumber, issueTitle, issueUrl, author, body } = args;
  const clippedBody = (body ?? '').trim();

  return [
    '[Webhook] GitHub issue event received',
    `repo: ${repo}`,
    `action: ${action}`,
    `issue: #${issueNumber} ${issueTitle}`,
    `url: ${issueUrl}`,
    `author: ${author}`,
    '',
    'body:',
    clippedBody ? clippedBody.slice(0, 8000) : '(empty)',
    '',
    'Instruction:',
    '- Please triage this issue and (if appropriate) reply on GitHub.' ,
    '- When posting a GitHub comment, append signature: “——由 OpenClaw 助手代回复”.',
  ].join('\n');
}

export async function handleGithubWebhook(req: Request): Promise<Response> {
  const secret = requireEnv('GITHUB_WEBHOOK_SECRET');

  const signature256 = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');
  const delivery = req.headers.get('x-github-delivery');

  const bodyBytes = new Uint8Array(await req.arrayBuffer());

  try {
    await verifyGithubSignatureOrThrow({ secret, signature256, bodyBytes });
  } catch (e) {
    return json({ ok: false, error: 'signature_verification_failed', detail: String(e) }, 401);
  }

  if (!event) {
    return json({ ok: false, error: 'missing_header:x-github-event' }, 400);
  }

  // Only support issues for now.
  if (event !== 'issues') {
    return json({ ok: true, ignored: true, reason: `event_not_supported:${event}` });
  }

  const payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as GithubIssuesEvent;

  // Only new issues for now.
  if (payload.action !== 'opened') {
    return json({ ok: true, ignored: true, reason: `action_not_supported:${payload.action}` });
  }

  const gatewayUrl = Deno.env.get('OPENCLAW_GATEWAY_URL') ?? 'http://127.0.0.1:18789';
  const gatewayToken = requireEnv('OPENCLAW_GATEWAY_TOKEN');

  const text = buildSystemEventText({
    repo: payload.repository.full_name,
    action: payload.action,
    issueNumber: payload.issue.number,
    issueTitle: payload.issue.title,
    issueUrl: payload.issue.html_url,
    author: payload.issue.user.login,
    body: payload.issue.body,
  });

  const envelope: GithubWebhookEnvelope = {
    source: 'github',
    event,
    delivery,
    receivedAt: new Date().toISOString(),
    payload,
  };

  // Send as a wake event so OpenClaw main session receives it immediately.
  // (OpenClaw can then decide whether/how to reply and how to notify.)
  await openclawToolsInvoke({
    gatewayUrl,
    gatewayToken,
    tool: 'cron',
    action: 'wake',
    toolArgs: {
      mode: 'now',
      text,
      // Provide a compact JSON envelope for agents that prefer structured parsing.
      // Keep it short to avoid hitting payload limits.
      meta: envelope,
    },
  });

  return json({ ok: true, forwarded: true });
}
