import { fail, hasAdmin, json, readJson, sanitizeRichHtml, validOrigin } from "../../../shared/worker.js";

const allowedPages = new Set(["home-intro", "home-newsletter", "footer-note", "privacy", "site-brand", "newsletter-email-label", "newsletter-placeholder", "newsletter-consent", "newsletter-button", "newsletter-note", "newsletter-sending", "newsletter-success", "newsletter-pending", "newsletter-existing", "newsletter-error", "footer-home-label", "footer-tags-label", "footer-privacy-label"]);

export async function onRequestGet({ request, env }) {
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage site content.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const { results = [] } = await env.DB.prepare("SELECT page_key, content_html FROM site_content ORDER BY page_key").all();
  return json({ content: Object.fromEntries(results.map((row) => [row.page_key, row.content_html])) });
}

export async function onRequestPut({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage site content.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const input = await readJson(request);
  if (!input || !allowedPages.has(input.pageKey) || typeof input.contentHtml !== "string") return fail("Choose a valid site section and enter its content.");
  const contentHtml = await sanitizeRichHtml(input.contentHtml, 30000);
  if (!contentHtml || !contentHtml.replace(/<[^>]*>/g, "").trim()) return fail("Add some text before saving.");
  await env.DB.prepare("INSERT INTO site_content (page_key, content_html, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(page_key) DO UPDATE SET content_html = excluded.content_html, updated_at = CURRENT_TIMESTAMP")
    .bind(input.pageKey, contentHtml).run();
  return json({ saved: true, pageKey: input.pageKey, contentHtml });
}
