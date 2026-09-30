import { fail, hasAdmin, json, normalizeEssay, readJson, toEssay, validOrigin } from "../../../shared/worker.js";

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
  const essay = normalizeEssay(await readJson(request));
  if (!essay) return fail("Check the title, URL slug, date, reading time, tags, and essay paragraphs.");
  await env.DB.prepare(`INSERT INTO essays (slug, title, excerpt, published_on, minutes, tags_json, paragraphs_json, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET title = excluded.title, excerpt = excluded.excerpt, published_on = excluded.published_on,
    minutes = excluded.minutes, tags_json = excluded.tags_json, paragraphs_json = excluded.paragraphs_json,
    status = excluded.status, updated_at = CURRENT_TIMESTAMP`)
    .bind(essay.slug, essay.title, essay.excerpt, essay.date, essay.minutes, JSON.stringify(essay.tags), JSON.stringify(essay.paragraphs), essay.status).run();
  return json({ saved: true, essay });
}
