import { hasAdmin, json, sessionCookie } from "../../../shared/worker.js";

export async function onRequestGet({ request, env }) {
  return json({ authenticated: await hasAdmin(request, env) });
}

export async function onRequestDelete({ request, env }) {
  if (!request.headers.get("Origin") || request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  return json({ authenticated: false }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
