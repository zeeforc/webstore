// /api/products.js
import { put, list } from "@vercel/blob";

export default async function handler(req, res) {
  // ==== CORS ====
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { ADMIN_KEY } = process.env;
  const needKey = !!ADMIN_KEY;

  const key = "assets/data/products.json";

  // ==== helper: buat file awal kalau belum ada ====
  async function ensureSeed() {
    const seed = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products: [],
    };
    await put(key, JSON.stringify(seed, null, 2), {
      access: "public", // wajib untuk blob publik
      contentType: "application/json",
      cacheControlMaxAge: 0,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN, // dibutuhkan saat lokal
    });
    return seed;
  }

  // ==== helper: baca isi blob ====
  async function readJson() {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs || blobs.length === 0) return null;
    const url = blobs[0].url;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch blob ${resp.status}`);
    return await resp.json();
  }

  // ==== GET ====
  if (req.method === "GET") {
    try {
      const data = await readJson();
      if (!data) {
        const seeded = await ensureSeed();
        return res.status(200).json(seeded);
      }
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ message: e.message || String(e) });
    }
  }

  // ==== PUT ====
  if (req.method === "PUT") {
    try {
      if (needKey && (req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const raw = req.body;
      const incoming =
        typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
      incoming.updatedAt = new Date().toISOString();

      await put(key, JSON.stringify(incoming, null, 2), {
        access: "public", // wajib diset public
        contentType: "application/json",
        cacheControlMaxAge: 0,
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN, // dibutuhkan saat lokal
      });

      return res.status(200).json({ ok: true, commitSha: "blob" });
    } catch (e) {
      return res.status(500).json({ message: e.message || String(e) });
    }
  }

  // ==== default ====
  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end("Method Not Allowed");
}
