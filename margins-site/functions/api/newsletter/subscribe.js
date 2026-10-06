import { allowRate, fail, json, randomToken, readJson, sendEmail, tokenHash } from "../../../shared/worker.js";

export async function onRequestPost({ request, env }) {
  if (!request.headers.get("Origin") || request.headers.get("Origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  if (!env.DB) return fail("Newsletter signup is not configured yet.", 503);
  await env.DB.prepare("DELETE FROM newsletter_rate_limits WHERE window_started_at < ?").bind(Date.now() - 24 * 60 * 60 * 1000).run();
  await env.DB.prepare("DELETE FROM newsletter_tokens WHERE expires_at < ?").bind(Date.now()).run();
  await env.DB.prepare("DELETE FROM newsletter_subscribers WHERE active = 0 AND confirmed_at IS NULL AND created_at < datetime('now', '-7 days')").run();
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!body?.consent) return fail("Please agree to receive the newsletter.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const existing = await env.DB.prepare("SELECT active, confirmed_at FROM newsletter_subscribers WHERE email = ?").bind(email).first();
  if (existing?.active && existing.confirmed_at) return json({ ok: true, alreadySubscribed: true }, 202);
  const secret = env.SESSION_SECRET || "margins-newsletter-rate-limit";
  const ipKey = await tokenHash(`${secret}:subscribe-ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`);
  const emailKey = await tokenHash(`${secret}:subscribe-email:${email}`);
  if (!(await allowRate(env.DB, `ip:${ipKey}`, 5, 60 * 60 * 1000)) || !(await allowRate(env.DB, `email:${emailKey}`, 2, 60 * 60 * 1000))) return fail("Too many signup attempts. Please try again later.", 429);

  const token = await randomToken();
  const tokenDigest = await tokenHash(token);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const confirmUrl = `${new URL(request.url).origin}/confirm.html?token=${encodeURIComponent(token)}`;
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO newsletter_subscribers (email, consent_at, active) VALUES (?, ?, 0) ON CONFLICT(email) DO UPDATE SET consent_at = excluded.consent_at, active = 0, confirmed_at = NULL, created_at = CURRENT_TIMESTAMP").bind(email, now).run();
  await env.DB.prepare("DELETE FROM newsletter_tokens WHERE email = ? AND purpose = 'confirm'").bind(email).run();
  await env.DB.prepare("INSERT INTO newsletter_tokens (token_hash, email, purpose, expires_at) VALUES (?, ?, 'confirm', ?)").bind(tokenDigest, email, expiresAt).run();
  let sent = false;
  try { sent = await sendEmail(env, {
    to: email,
    subject: "Confirm your Essays by Shayan subscription",
    html: `<p>Confirm that you want to receive new essays from Essays by Shayan.</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore the message.</p>`
  }); } catch { sent = false; }
  if (!sent) return json({ ok: true, confirmationSent: false }, 202);
  return json({ ok: true, confirmationSent: true }, 202);
}
