import { fail, json } from "../../shared/worker.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const { results = [] } = await env.DB.prepare("SELECT page_key, content_html FROM site_content").all();
  return json({ content: Object.fromEntries(results.map((row) => [row.page_key, row.content_html])) }, 200, {
    "Cache-Control": "public, max-age=60, s-maxage=300"
  });
}
