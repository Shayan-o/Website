import { fail, hasAdmin, json, validOrigin } from "../../../shared/worker.js";

function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export async function onRequestGet({ request, env }) {
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage subscribers.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const { results = [] } = await env.DB.prepare("SELECT email, consent_at, confirmed_at FROM newsletter_subscribers WHERE active = 1 AND confirmed_at IS NOT NULL ORDER BY confirmed_at DESC").all();
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const rows = [["email", "consent_at", "confirmed_at"], ...results.map((item) => [item.email, item.consent_at, item.confirmed_at])];
    return new Response(rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=margins-subscribers.csv", "Cache-Control": "no-store" } });
  }
  return json({ subscribers: results });
}

export async function onRequestDelete({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage subscribers.", 401);
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email || email.length > 254) return fail("Choose a subscriber to remove.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM newsletter_tokens WHERE email = ?").bind(email),
    env.DB.prepare("DELETE FROM newsletter_subscribers WHERE email = ?").bind(email)
  ]);
  return json({ removed: true });
}
