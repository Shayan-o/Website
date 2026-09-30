import { allowRate, fail, json, readJson, randomToken, sendEmail, tokenHash } from "../../../shared/worker.js";

export async function onRequestPost({ request, env }) {
  if (!request.headers.get("Origin") || request.headers.get("Origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  if (!env.DB) return fail("Newsletter service is not configured yet.", 503);
  const body = await readJson(request);
  if (typeof body?.email !== "string") return fail("Enter a valid email address.");
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const subscribed = await env.DB.prepare("SELECT email FROM newsletter_subscribers WHERE email = ? AND active = 1 AND confirmed_at IS NOT NULL").bind(email).first();
  if (!subscribed) return json({ ok: true, message: "If this address is subscribed, an unsubscribe link is on its way." }, 202);
  const secret = env.SESSION_SECRET || "margins-newsletter-rate-limit";
  const rateKey = await tokenHash(`${secret}:unsubscribe:${email}`);
  if (!(await allowRate(env.DB, `unsubscribe:${rateKey}`, 2, 60 * 60 * 1000))) return fail("Too many requests. Please try again later.", 429);
  const token = await randomToken();
  const digest = await tokenHash(token);
  const url = `${new URL(request.url).origin}/unsubscribe.html?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(env, {
    to: email,
    subject: "Confirm your Margins unsubscribe request",
    html: `<p>Confirm that you want to stop receiving new essays from Margins.</p><p><a href="${url}">Unsubscribe</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore the message.</p>`
  });
  if (!sent) return fail("Email service is not configured yet. Please contact the site owner to unsubscribe.", 503);
  await env.DB.prepare("DELETE FROM newsletter_tokens WHERE email = ? AND purpose = 'unsubscribe'").bind(email).run();
  await env.DB.prepare("INSERT INTO newsletter_tokens (token_hash, email, purpose, expires_at) VALUES (?, ?, 'unsubscribe', ?)").bind(digest, email, Date.now() + 24 * 60 * 60 * 1000).run();
  return json({ ok: true, message: "If this address is subscribed, an unsubscribe link is on its way." }, 202);
}

export async function onRequestDelete({ request, env }) {
  if (!request.headers.get("Origin") || request.headers.get("Origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  const body = await readJson(request);
  if (typeof body?.token !== "string" || body.token.length > 100) return fail("This unsubscribe link is invalid or expired.", 400);
  const digest = await tokenHash(body.token);
  const entry = await env.DB.prepare("SELECT email FROM newsletter_tokens WHERE token_hash = ? AND purpose = 'unsubscribe' AND expires_at > ?").bind(digest, Date.now()).first();
  if (!entry) return fail("This unsubscribe link is invalid or expired.", 400);
  await env.DB.batch([
    env.DB.prepare("UPDATE newsletter_subscribers SET active = 0 WHERE email = ?").bind(entry.email),
    env.DB.prepare("DELETE FROM newsletter_tokens WHERE token_hash = ?").bind(digest)
  ]);
  return json({ ok: true, message: "You have been unsubscribed from Margins." });
}
