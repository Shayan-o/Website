import { fail, json, toEssay } from "../../shared/worker.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return fail("The content database is not configured yet.", 503);
  const { results = [] } = await env.DB.prepare("SELECT * FROM essays WHERE status = 'published' ORDER BY published_on DESC, title ASC").all();
  return json({ essays: await Promise.all(results.map(toEssay)) }, 200, { "Cache-Control": "public, max-age=60, s-maxage=300" });
}
