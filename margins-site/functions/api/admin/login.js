import { fail, hasAdmin, issueSession, json, readJson, sessionCookie, validOrigin } from "../../../shared/worker.js";

async function requestHash(ip, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip || "unknown")));
  return btoa(String.fromCharCode(...digest)).replace(/[+/=]/g, "_");
}

export async function onRequestPost({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!env.DB || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return fail("Admin access is not configured yet.", 503);
  if (await hasAdmin(request, env)) return json({ authenticated: true });
  const body = await readJson(request);
  if (!body || typeof body.password !== "string") return fail("Enter the admin password.");
  const now = Date.now();
  const ipHash = await requestHash(request.headers.get("CF-Connecting-IP"), env.SESSION_SECRET);
  const attempt = await env.DB.prepare("SELECT failures, window_started_at FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).first();
  if (attempt && now - attempt.window_started_at < 15 * 60 * 1000 && attempt.failures >= 5) return fail("Too many attempts. Wait 15 minutes and try again.", 429);
  if (body.password !== env.ADMIN_PASSWORD) {
    const failures = attempt && now - attempt.window_started_at < 15 * 60 * 1000 ? attempt.failures + 1 : 1;
    await env.DB.prepare("INSERT INTO admin_login_attempts (ip_hash, failures, window_started_at) VALUES (?, ?, ?) ON CONFLICT(ip_hash) DO UPDATE SET failures = excluded.failures, window_started_at = excluded.window_started_at").bind(ipHash, failures, attempt && now - attempt.window_started_at < 15 * 60 * 1000 ? attempt.window_started_at : now).run();
    return fail("Password not recognized.", 401);
  }
  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  const token = await issueSession(env.SESSION_SECRET);
  return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(token) });
}
