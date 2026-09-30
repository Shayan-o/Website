import { fail, hasAdmin, json, randomToken, readJson, tokenHash, validOrigin } from "../../../shared/worker.js";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export async function onRequestPost({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to email subscribers.", 401);
  if (!env.DB || !env.RESEND_API_KEY || !env.MAIL_FROM) return fail("Configure D1, Resend, and MAIL_FROM before sending newsletter emails.", 503);
  const body = await readJson(request);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail("Choose a published essay.");
  const essay = await env.DB.prepare("SELECT slug, title, excerpt, status FROM essays WHERE slug = ?").bind(slug).first();
  if (!essay || essay.status !== "published") return fail("Only published essays can be emailed.", 404);
  const { results: subscribers = [] } = await env.DB.prepare("SELECT email FROM newsletter_subscribers WHERE active = 1 AND confirmed_at IS NOT NULL ORDER BY email LIMIT 5000").all();
  if (!subscribers.length) return json({ sent: 0, message: "There are no confirmed subscribers yet." });

  const campaignId = crypto.randomUUID();
  const subject = `New essay from Margins: ${essay.title}`;
  await env.DB.prepare("INSERT INTO newsletter_campaigns (id, essay_slug, subject, status, recipient_count) VALUES (?, ?, ?, 'sending', 0)").bind(campaignId, slug, subject).run();
  const origin = new URL(request.url).origin;
  const emailItems = [];
  const tokenStatements = [];
  for (const subscriber of subscribers) {
    const token = await randomToken();
    const digest = await tokenHash(token);
    tokenStatements.push(env.DB.prepare("INSERT INTO newsletter_tokens (token_hash, email, purpose, expires_at) VALUES (?, ?, 'unsubscribe', ?)").bind(digest, subscriber.email, Date.now() + 365 * 24 * 60 * 60 * 1000));
    const unsubscribeUrl = `${origin}/unsubscribe.html?token=${encodeURIComponent(token)}`;
    emailItems.push({
      from: env.MAIL_FROM,
      to: [subscriber.email],
      subject,
      html: `<div style="font-family:Georgia,serif;max-width:560px;margin:40px auto;color:#24211e;line-height:1.7"><p style="font:12px Arial,sans-serif;letter-spacing:.14em;color:#77736d">MARGINS</p><h1 style="font-weight:400">${escapeHtml(essay.title)}</h1><p>${escapeHtml(essay.excerpt)}</p><p><a href="${origin}/essays/${encodeURIComponent(slug)}" style="color:#24211e">Read the essay →</a></p><hr style="border:0;border-top:1px solid #dfddd7;margin:32px 0"><p style="font:12px Arial,sans-serif;color:#77736d">You receive this because you subscribed to Margins. <a href="${unsubscribeUrl}" style="color:#77736d">Unsubscribe</a>.</p></div>`
    });
  }
  for (let start = 0; start < tokenStatements.length; start += 100) {
    await env.DB.batch(tokenStatements.slice(start, start + 100));
  }

  let sent = 0;
  for (let start = 0; start < emailItems.length; start += 100) {
    const batchIndex = Math.floor(start / 100);
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `margins-${campaignId}-${batchIndex}` },
      body: JSON.stringify(emailItems.slice(start, start + 100))
    });
    if (!response.ok) {
      await env.DB.prepare("UPDATE newsletter_campaigns SET status = 'failed', recipient_count = ? WHERE id = ?").bind(sent, campaignId).run();
      return fail(`The email provider stopped after ${sent} of ${subscribers.length} messages. Review the provider dashboard before retrying.`, 502);
    }
    sent += Math.min(100, emailItems.length - start);
  }
  await env.DB.prepare("UPDATE newsletter_campaigns SET status = 'sent', recipient_count = ?, sent_at = ? WHERE id = ?").bind(sent, new Date().toISOString(), campaignId).run();
  return json({ sent, message: `Sent “${essay.title}” to ${sent} confirmed subscriber${sent === 1 ? "" : "s"}.` });
}
