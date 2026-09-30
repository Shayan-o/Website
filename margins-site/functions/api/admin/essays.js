import { fail, hasAdmin, json, normalizeEssay, readJson, sanitizeRichHtml, toEssay, validOrigin } from "../../../shared/worker.js";

export async function onRequestGet({ request, env }) {
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage essays.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const { results = [] } = await env.DB.prepare("SELECT * FROM essays ORDER BY published_on DESC, title ASC").all();
  return json({ essays: await Promise.all(results.map(toEssay)) });
}

export async function onRequestPut({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage essays.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const input = await readJson(request);
  const contentHtml = await sanitizeRichHtml(input?.contentHtml || "");
  const emptySection = (html) => !html.replace(/<[^>]*>/g, "").replace(/(?:&nbsp;|&#160;|&#xA0;)/gi, "").trim();
  const safeEndnotes = await sanitizeRichHtml(input?.endnotesHtml || "", 100000);
  const safeSources = await sanitizeRichHtml(input?.sourcesHtml || "", 100000);
  const endnotesHtml = emptySection(safeEndnotes) ? "" : safeEndnotes;
  const sourcesHtml = emptySection(safeSources) ? "" : safeSources;
  const richText = contentHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();
  const paragraphs = Array.isArray(input?.paragraphs) && input.paragraphs.length ? input.paragraphs : richText ? [richText] : [];
  const essay = normalizeEssay({ ...input, paragraphs, contentHtml, endnotesHtml, sourcesHtml });
  if (!essay) return fail("Check the title, URL slug, date, reading time, tags, and essay paragraphs.");
  await env.DB.prepare(`INSERT INTO essays (slug, title, excerpt, published_on, minutes, tags_json, paragraphs_json, content_html, endnotes_html, sources_html, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET title = excluded.title, excerpt = excluded.excerpt, published_on = excluded.published_on,
    minutes = excluded.minutes, tags_json = excluded.tags_json, paragraphs_json = excluded.paragraphs_json, content_html = excluded.content_html,
    endnotes_html = excluded.endnotes_html, sources_html = excluded.sources_html,
    status = excluded.status, updated_at = CURRENT_TIMESTAMP`)
    .bind(essay.slug, essay.title, essay.excerpt, essay.date, essay.minutes, JSON.stringify(essay.tags), JSON.stringify(essay.paragraphs), essay.contentHtml, essay.endnotesHtml, essay.sourcesHtml, essay.status).run();
  return json({ saved: true, essay });
}

export async function onRequestDelete({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to manage essays.", 401);
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    return fail("Choose a valid essay to delete.");
  }
  const result = await env.DB.prepare("DELETE FROM essays WHERE slug = ?").bind(slug).run();
  if (!result.meta?.changes) return fail("That essay could not be found.", 404);
  return json({ deleted: true, slug });
}
