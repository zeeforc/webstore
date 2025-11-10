// pages/api/upload-logo.js
import { put } from "@vercel/blob";
import path from "path";

export const config = { api: { bodyParser: false, sizeLimit: "10mb" } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function getBoundary(ct) {
  const m = /boundary="?([^=";]+)"?/i.exec(ct || "");
  return m ? m[1] : null;
}
function parseMultipart(buf, boundary) {
  const sep = `--${boundary}`;
  const parts = buf.toString("latin1").split(sep);
  for (const part of parts) {
    const i = part.indexOf("\r\n\r\n");
    if (i === -1) continue;
    const header = part.slice(0, i);
    let body = part.slice(i + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    if (body.endsWith("--")) body = body.slice(0, -2);
    const fn = /filename="([^"]+)"/i.exec(header);
    const ct = /content-type:\s*([^\r\n]+)/i.exec(header);
    if (!fn) continue;
    return {
      filename: fn[1],
      data: Buffer.from(body, "latin1"),
      mime: ct?.[1] || "",
    };
  }
  return null;
}

export default async function handler(req, res) {
  // CORS opsional
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();

    let filename = "",
      fileBuf = null,
      mime = "";

    if (ct.includes("multipart/form-data")) {
      const boundary = getBoundary(ct);
      if (!boundary)
        return res.status(400).json({ message: "Invalid multipart data" });
      const part = parseMultipart(await readRaw(req), boundary);
      if (!part) return res.status(400).json({ message: "No file" });
      filename = part.filename;
      fileBuf = part.data;
      mime = part.mime || "";
    } else if (ct.startsWith("application/json")) {
      const raw = await readRaw(req);
      const body = JSON.parse(raw.toString("utf8") || "{}");
      if (!body.filename || !body.contentBase64) {
        return res.status(400).json({ message: "Missing filename/content" });
      }
      filename = body.filename;
      fileBuf = Buffer.from(body.contentBase64, "base64");
      mime = body.mime || body.contentType || "";
    } else {
      return res.status(415).json({ message: "Use multipart form or JSON" });
    }

    const MAX = 2 * 1024 * 1024;
    if (fileBuf.length > MAX)
      return res.status(413).json({ message: "File too large (>2MB)" });

    const allow = [".png", ".jpg", ".jpeg", ".svg"];
    const ext = path.extname(filename).toLowerCase();
    if (!allow.includes(ext))
      return res
        .status(415)
        .json({ message: "Only .png .jpg .jpeg .svg allowed" });

    const safe = (
      filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "logo"
    ).toLowerCase();
    const finalName = `${path.basename(safe, ext)}-${Date.now()}${ext}`;
    const key = `uploads/logos/${finalName}`;

    const { url } = await put(key, fileBuf, {
      access: "public",
      contentType: mime || (ext === ".svg" ? "image/svg+xml" : undefined),
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      // penting saat lokal; di production Vercel tidak wajib
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ ok: true, url });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Upload failed" });
  }
}