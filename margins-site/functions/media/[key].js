export async function onRequestGet({ params, env }) {
  if (!env.MEDIA) return new Response("Media storage is not configured.", { status: 503 });
  const key = params.key || "";
  if (!/^[0-9a-f-]{36}\.(?:jpe?g|png|gif|webp|avif|glb|stl|pdf)$/i.test(key)) return new Response("Not found.", { status: 404 });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
