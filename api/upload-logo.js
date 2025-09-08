// export default async function handler(req, res) {
//   // === CORS & preflight ===
//   const origin = req.headers.origin || "*";
//   res.setHeader("Access-Control-Allow-Origin", origin);
//   res.setHeader("Vary", "Origin");
//   res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
//   if (req.method === "OPTIONS") return res.status(204).end();

//   if (req.method !== "POST") {
//     res.setHeader("Allow", "POST");
//     return res.status(405).end("Method Not Allowed");
//   }

//   // === deklarasi SEKALI saja ===
//   const { ADMIN_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
//   const clientKey = req.headers["x-admin-key"] || "";

//   if (!ADMIN_KEY || clientKey !== ADMIN_KEY) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   // *Opsional* – cegah nulis ke FS saat deploy (preview/prod),
//   // tapi tetap boleh saat `vercel dev` lokal.
//   const missingGit = !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO;
//   const isVercelDev =
//     process.env.VERCEL === "1" && process.env.VERCEL_ENV === "development";
//   const canWriteLocal = !process.env.VERCEL || isVercelDev;

//   // === ambil file dari request ===
//   const ct = (req.headers["content-type"] || "").toLowerCase();
//   let filename = "";
//   let fileBuf = null;

//   if (ct.startsWith("application/json")) {
//     const { filename: fn, contentBase64 } = await readJSON(req);
//     if (!fn || !contentBase64)
//       return res.status(400).json({ message: "Missing filename/content" });
//     filename = fn;
//     fileBuf = Buffer.from(contentBase64, "base64");
//   } else if (ct.includes("multipart/form-data")) {
//     const boundary = getBoundary(ct);
//     if (!boundary)
//       return res.status(400).json({ message: "Invalid multipart data" });
//     const raw = await readRaw(req);
//     const part = parseMultipart(raw, boundary);
//     if (!part) return res.status(400).json({ message: "No file found" });
//     filename = part.filename;
//     fileBuf = part.data;
//   } else {
//     return res.status(415).json({ message: "Unsupported Content-Type" });
//   }

//   // === validasi & penamaan ===
//   const MAX = 2 * 1024 * 1024;
//   if (fileBuf.length > MAX)
//     return res.status(413).json({ message: "File too large (>2MB)" });

//   const allow = [".png", ".jpg", ".jpeg", ".svg"];
//   const ext = require("path").extname(filename).toLowerCase();
//   if (!allow.includes(ext))
//     return res
//       .status(415)
//       .json({ message: "Only .png .jpg .jpeg .svg allowed" });

//   const safeBase = (
//     filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "logo"
//   ).toLowerCase();
//   const finalName = `${require("path").basename(
//     safeBase,
//     ext
//   )}-${Date.now()}${ext}`;
//   const publicPath = `/assets/img/logos/${finalName}`;

//   // === simpan ===
//   if (canWriteLocal && missingGit) {
//     // dev lokal: simpan ke folder project
//     const absDir = require("path").join(
//       process.cwd(),
//       "assets",
//       "img",
//       "logos"
//     );
//     require("fs").mkdirSync(absDir, { recursive: true });
//     require("fs").writeFileSync(
//       require("path").join(absDir, finalName),
//       fileBuf
//     );
//     return res.status(200).json({ ok: true, path: publicPath });
//   }

//   if (missingGit) {
//     // deploy tapi env GitHub belum diset -> kasih error jelas
//     return res
//       .status(500)
//       .json({ message: "GitHub envs missing (GITHUB_TOKEN/OWNER/REPO)." });
//   }

//   // produksi: commit ke GitHub
//   const uploadPath = `assets/img/logos/${finalName}`;
//   const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${uploadPath}`;
//   const r = await fetch(url, {
//     method: "PUT",
//     headers: {
//       Authorization: `Bearer ${GITHUB_TOKEN}`,
//       "User-Agent": "zft-store",
//       Accept: "application/vnd.github+json",
//       "Content-Type": "application/json",
//     },

//     body: JSON.stringify({
//       message: `feat(logo): upload ${finalName}`,
//       content: contentB64,
//     }),
//   });
//   if (!r.ok) throw new Error(`GitHub upload failed: ${r.status}`);
//   return res.status(200).json({ ok: true, path: publicPath });
// }

// /api/upload-logo.js
import fs from "fs";
import path from "path";

// --- helpers untuk baca body ---
async function readJSON(req) {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString("utf8");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}
async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function getBoundary(ct) {
  const m = /boundary="?([^=";]+)"?/i.exec(ct || "");
  return m ? m[1] : null;
}
function parseMultipart(buffer, boundary) {
  const sep = `--${boundary}`;
  const parts = buffer.toString("latin1").split(sep);
  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    const header = part.slice(0, idx);
    let body = part.slice(idx + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    if (body.endsWith("--")) body = body.slice(0, -2);
    const fnMatch = /filename="([^"]+)"/i.exec(header);
    const nameMatch = /name="([^"]+)"/i.exec(header);
    if (!fnMatch || !nameMatch) continue;
    const filename = fnMatch[1];
    return { filename, data: Buffer.from(body, "latin1") };
  }
  return null;
}

export default async function handler(req, res) {
  // CORS + preflight
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

  const { ADMIN_KEY } = process.env; // opsional saat dev
  const needKey = !!ADMIN_KEY;
  const clientKey = req.headers["x-admin-key"] || "";
  if (needKey && clientKey !== ADMIN_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    let filename = "";
    let fileBuf = null;

    if (ct.startsWith("application/json")) {
      const { filename: fn, contentBase64 } = await readJSON(req);
      if (!fn || !contentBase64)
        return res.status(400).json({ message: "Missing filename/content" });
      filename = fn;
      fileBuf = Buffer.from(contentBase64, "base64");
    } else if (ct.includes("multipart/form-data")) {
      const boundary = getBoundary(ct);
      if (!boundary)
        return res.status(400).json({ message: "Invalid multipart data" });
      const raw = await readRaw(req);
      const part = parseMultipart(raw, boundary);
      if (!part) return res.status(400).json({ message: "No file found" });
      filename = part.filename;
      fileBuf = part.data;
    } else {
      return res.status(415).json({ message: "Unsupported Content-Type" });
    }

    // validasi
    const MAX = 2 * 1024 * 1024;
    if (fileBuf.length > MAX)
      return res.status(413).json({ message: "File too large (>2MB)" });

    const allow = [".png", ".jpg", ".jpeg", ".svg"];
    const ext = path.extname(filename).toLowerCase();
    if (!allow.includes(ext))
      return res
        .status(415)
        .json({ message: "Only .png .jpg .jpeg .svg allowed" });

    // penamaan aman
    const safeBase = (
      filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "logo"
    ).toLowerCase();
    const finalName = `${path.basename(safeBase, ext)}-${Date.now()}${ext}`;
    const publicPath = `/assets/img/logos/${finalName}`;

    // simpan lokal
    const absDir = path.join(process.cwd(), "assets", "img", "logos");
    fs.mkdirSync(absDir, { recursive: true });
    fs.writeFileSync(path.join(absDir, finalName), fileBuf);

    return res.status(200).json({ ok: true, path: publicPath });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || "Upload failed" });
  }
}
