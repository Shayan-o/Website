import { fail, json, readJson, tokenHash } from "../../../shared/worker.js";

export async function onRequestPost({ request, env }) {
  if (!request.headers.get("Origin") || request.headers.get("Origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  if (!env.DB) return fail("Newsletter signup is not configured yet.", 503);
  const body = await readJson(request);
  if (typeof body?.token !== "string" || body.token.length > 100) return fail("This confirmation link is invalid or expired.", 400);
  const digest = await tokenHash(body.token);
  const entry = await env.DB.prepare("SELECT email FROM newsletter_tokens WHERE token_hash = ? AND purpose = 'confirm' AND expires_at > ?").bind(digest, Date.now()).first();
  if (!entry) return fail("This confirmation link is invalid or expired.", 400);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE newsletter_subscribers SET active = 1, confirmed_at = ? WHERE email = ?").bind(now, entry.email),
    env.DB.prepare("DELETE FROM newsletter_tokens WHERE token_hash = ?").bind(digest)
  ]);
  return json({ ok: true, message: "You’re subscribed to Margins. You can close this page." });
}
