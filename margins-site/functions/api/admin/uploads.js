import { fail, hasAdmin, json, validOrigin } from "../../../shared/worker.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const TYPES = {
  jpg: { contentType: "image/jpeg", kind: "image" },
  jpeg: { contentType: "image/jpeg", kind: "image" },
  png: { contentType: "image/png", kind: "image" },
  gif: { contentType: "image/gif", kind: "image" },
  webp: { contentType: "image/webp", kind: "image" },
  avif: { contentType: "image/avif", kind: "image" },
  glb: { contentType: "model/gltf-binary", kind: "file" },
  stl: { contentType: "model/stl", kind: "file" },
  pdf: { contentType: "application/pdf", kind: "file" }
};

function matchesSignature(bytes, extension) {
  if (extension === "jpg" || extension === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value);
  if (extension === "gif") return String.fromCharCode(...bytes.subarray(0, 6)) === "GIF87a" || String.fromCharCode(...bytes.subarray(0, 6)) === "GIF89a";
  if (extension === "webp") return String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (extension === "avif") return String.fromCharCode(...bytes.subarray(4, 12)).includes("ftypavif") || String.fromCharCode(...bytes.subarray(4, 12)).includes("ftypavis");
  if (extension === "glb") return String.fromCharCode(...bytes.subarray(0, 4)) === "glTF";
  if (extension === "pdf") return String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  // STL has no fixed signature; it will only be served as an attachment.
  return extension === "stl";
}

function safeFilename(value, extension) {
  const base = value.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "upload";
  return `${base}.${extension}`;
}

export async function onRequestPost({ request, env }) {
  if (!validOrigin(request)) return fail("Invalid request origin.", 403);
  if (!(await hasAdmin(request, env))) return fail("Sign in to upload files.", 401);
  if (!env.MEDIA) return fail("File storage is not connected yet. Add the MEDIA R2 bucket binding in Cloudflare and redeploy.", 503);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_FILE_SIZE + 64 * 1024) return fail("Files must be 20 MB or smaller.", 413);

  let form;
  try { form = await request.formData(); } catch { return fail("Choose a file and try again.", 400); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return fail("Choose a file to upload.", 400);
  if (file.size > MAX_FILE_SIZE) return fail("Files must be 20 MB or smaller.", 413);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const type = TYPES[extension];
  if (!type) return fail("Supported files: JPG, PNG, GIF, WebP, AVIF, GLB, STL, and PDF.", 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, extension)) return fail("The file contents do not match its file type.", 415);
  const id = crypto.randomUUID();
  const key = `${id}.${extension}`;
  const filename = safeFilename(file.name, extension);
  const disposition = type.kind === "image" ? "inline" : "attachment";
  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: type.contentType,
      contentDisposition: `${disposition}; filename="${filename}"`,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: { originalName: filename }
  });
  return json({ url: `/media/${key}`, name: filename, contentType: type.contentType, kind: type.kind });
}
