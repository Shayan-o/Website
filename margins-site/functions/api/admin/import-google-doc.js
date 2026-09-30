import { fail, hasAdmin, json, readJson, validOrigin } from "../../../shared/worker.js";

export async function onRequestPost({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to import a Google Doc.", 401);
  const input = await readJson(request);
  const rawUrl = typeof input?.url === "string" ? input.url.trim() : "";
  let source;
  try { source = new URL(rawUrl); } catch { return fail("Paste a valid Google Docs share link."); }
  if (source.protocol !== "https:" || source.hostname !== "docs.google.com") return fail("Use a Google Docs link beginning with https://docs.google.com/document/d/.");
  const match = source.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]{10,})\/(?:edit|view|pub)?\/?$/);
  if (!match) return fail("That link does not look like a Google Docs document link.");
  const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=html`;
  let response;
  try { response = await fetch(exportUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) }); }
  catch { return fail("Could not reach Google Docs. Try again in a moment.", 502); }
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return fail("Google could not export this document. Check that Anyone with the link can view it.", 422);
  }
  if (!/^(?:docs\.google\.com|drive\.google\.com|[a-z0-9.-]+\.googleusercontent\.com)$/i.test(new URL(response.url).hostname)) {
    return fail("Google redirected the export to an unexpected destination.", 422);
  }
  const rawHtml = await response.text();
  if (rawHtml.length > 500000 || /accounts\.google\.com|Sign in - Google Accounts/i.test(rawHtml.slice(0, 5000))) {
    return fail("This document is private. Change General access to Anyone with the link can view, then retry.", 422);
  }
  if (!rawHtml.replace(/<[^>]*>/g, "").trim()) return fail("Google returned an empty document.", 422);
  return json({ imported: true, sourceHtml: rawHtml });
}
