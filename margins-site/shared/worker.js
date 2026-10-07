const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export function validOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin && origin === new URL(request.url).origin;
}

export function normalizeEssay(input) {
  if (!input || typeof input !== "object") return null;
  const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const slug = clean(input.slug, 100).toLowerCase();
  const title = clean(input.title, 180);
  const excerpt = clean(input.excerpt, 500);
  const publishedOn = clean(input.date, 30);
  const minutes = Number.parseInt(input.minutes, 10);
  const tags = Array.isArray(input.tags) ? input.tags.map((x) => clean(x, 40)).filter(Boolean).slice(0, 12) : [];
  const paragraphs = Array.isArray(input.paragraphs) ? input.paragraphs.map((x) => clean(x, 12000)).filter(Boolean).slice(0, 100) : [];
  const status = input.status === "published" ? "published" : "draft";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(publishedOn) || !Number.isFinite(minutes) || minutes < 1 || minutes > 240 || paragraphs.length === 0) return null;
  return { slug, title, excerpt, date: publishedOn, minutes, tags, paragraphs, status,
    contentHtml: typeof input.contentHtml === "string" ? input.contentHtml : "",
    endnotesHtml: typeof input.endnotesHtml === "string" ? input.endnotesHtml : "",
    sourcesHtml: typeof input.sourcesHtml === "string" ? input.sourcesHtml : "" };
}

const richTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "b", "em", "i", "u", "s", "del", "br", "hr", "a", "sup", "sub", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "img"]);
const dropTags = "script,style,iframe,object,embed,svg,math,form,input,button,select,textarea,link,meta,base,video,audio,source";
const safeMediaPath = (value) => /^\/media\/[0-9a-f-]{36}\.(?:jpe?g|png|gif|webp|avif|glb|stl|pdf)$/i.test(value);

function safeRichStyle(value) {
  const allowed = [];
  for (const item of value.split(";")) {
    const [rawName, ...rest] = item.split(":");
    const name = rawName?.trim().toLowerCase();
    const val = rest.join(":").trim().toLowerCase();
    if (!val || /url\s*\(|expression|javascript|var\s*\(/i.test(val)) continue;
    if (name === "text-align" && /^(left|right|center|justify)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "font-weight" && /^(normal|bold|[1-9]00)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "font-style" && /^(normal|italic|oblique)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "text-decoration" && /^(none|underline|line-through)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "vertical-align" && /^(baseline|sub|super|middle)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "color" && /^(#[0-9a-f]{3,8}|black|white|red|blue|green|gray|grey)$/.test(val)) allowed.push(`${name}:${val}`);
    if (name === "font-size" && /^(?:[5-9]|[1-4][0-9])(?:px|pt)$/.test(val)) allowed.push(`${name}:${val}`);
  }
  return allowed.join(";");
}

export async function sanitizeRichHtml(input, maxLength = 300000) {
  if (typeof input !== "string") return "";
  if (input.length > maxLength) return "";
  const html = input.trim();
  if (!html) return "";
  const wrapped = new Response(`<html><body>${html}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  const safe = new HTMLRewriter()
    .on(dropTags, { element(element) { element.remove(); } })
    .on("*", { element(element) {
      const tag = element.tagName.toLowerCase();
      if (!richTags.has(tag)) { element.removeAndKeepContent(); return; }
      if (tag === "img") {
        const src = element.getAttribute("src") || "";
        let imageUrl;
        try { imageUrl = new URL(src, "https://shayanolumi.com"); } catch {}
        if (!safeMediaPath(src) && (!imageUrl || imageUrl.protocol !== "https:" || !/(?:^|\.)googleusercontent\.com$/i.test(imageUrl.hostname))) {
          element.remove();
          return;
        }
      }
      for (const [name, value] of [...element.attributes]) {
        const attr = name.toLowerCase();
        if (attr === "href" && tag === "a") {
          if (!safeMediaPath(value) && !/^(?:https?:\/\/|mailto:|tel:|#[a-z0-9_.:-]{1,120})$/i.test(value)) element.removeAttribute(name);
          else if (/^https?:\/\//i.test(value)) element.setAttribute("rel", "noopener noreferrer");
          continue;
        }
        if (attr === "src" && tag === "img") continue;
        if ((attr === "alt" || attr === "title") && tag === "img") continue;
        if (attr === "style") {
          const style = safeRichStyle(value);
          if (style) element.setAttribute("style", style); else element.removeAttribute(name);
          continue;
        }
        if (attr === "id" && /^[a-z0-9_.:-]{1,120}$/i.test(value)) continue;
        if (attr === "name" && tag === "a" && /^[a-z0-9_.:-]{1,120}$/i.test(value)) continue;
        if ((attr === "colspan" || attr === "rowspan") && (tag === "td" || tag === "th") && /^[1-9]\d?$/.test(value)) continue;
        if (attr === "start" && tag === "ol" && /^\d{1,4}$/.test(value)) continue;
        element.removeAttribute(name);
      }
    } })
    .transform(wrapped);
  const result = await safe.text();
  return result.replace(/^.*?<body>/is, "").replace(/<\/body>.*$/is, "").trim();
}

export async function toEssay(row) {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    date: new Date(`${row.published_on}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
    dateValue: row.published_on,
    minutes: row.minutes,
    tags: JSON.parse(row.tags_json || "[]"),
    paragraphs: JSON.parse(row.paragraphs_json || "[]"),
    contentHtml: row.content_html || "",
    endnotesHtml: row.endnotes_html || "",
    sourcesHtml: row.sources_html || "",
    status: row.status
  };
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64url = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===" .slice((value.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(left); const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

export async function issueSession(secret) {
  const payload = b64url(encoder.encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${payload}.${b64url(await hmac(secret, payload))}`;
}

export async function hasAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)__Host-margins_admin=([A-Za-z0-9_.-]+)/);
  if (!match) return false;
  const [payload, signature, extra] = match[1].split(".");
  if (!payload || !signature || extra) return false;
  const expected = b64url(await hmac(env.SESSION_SECRET, payload));
  if (!constantTimeEqual(signature, expected)) return false;
  try { return JSON.parse(new TextDecoder().decode(fromB64url(payload))).exp > Date.now(); } catch { return false; }
}

export function sessionCookie(token, maxAge = 28800) {
  return `__Host-margins_admin=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function randomToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function tokenHash(token) {
  return b64url(await sha256(token));
}

export async function allowRate(db, key, limit, windowMs) {
  const now = Date.now();
  const row = await db.prepare("SELECT attempts, window_started_at FROM newsletter_rate_limits WHERE rate_key = ?").bind(key).first();
  if (row && now - row.window_started_at < windowMs && row.attempts >= limit) return false;
  const attempts = row && now - row.window_started_at < windowMs ? row.attempts + 1 : 1;
  const started = row && now - row.window_started_at < windowMs ? row.window_started_at : now;
  await db.prepare("INSERT INTO newsletter_rate_limits (rate_key, attempts, window_started_at) VALUES (?, ?, ?) ON CONFLICT(rate_key) DO UPDATE SET attempts = excluded.attempts, window_started_at = excluded.window_started_at").bind(key, attempts, started).run();
  return true;
}

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html })
  });
  return response.ok;
}
