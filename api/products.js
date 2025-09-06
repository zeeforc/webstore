// /api/products.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // (opsional) CORS aman kalau nanti beda origin
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_FILEPATH,
    ADMIN_KEY,
  } = process.env;

  // Deteksi lingkungan
  const onVercel = !!process.env.VERCEL;
  const missingGit =
    !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILEPATH;
  // Hanya tulis ke disk kalau DEV lokal (bukan Vercel) DAN env GitHub belum lengkap
  const isDevLocal = !onVercel && missingGit;

  const localJsonPath = path.join(
    process.cwd(),
    "assets",
    "data",
    "products.json"
  );

  // Build URL GitHub hanya jika env lengkap
  const ghBase = !missingGit
    ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILEPATH}`
    : null;

  async function ghGet() {
    if (!ghBase) throw new Error("GitHub envs missing, ghBase is null");
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "zft-store",
      Accept: "application/vnd.github+json",
    };

    const r = await fetch(ghBase, { headers });
    if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
    return r.json();
  }

  if (req.method === "GET") {
    try {
      if (isDevLocal) {
        const txt = fs.readFileSync(localJsonPath, "utf8");
        return res.status(200).json(JSON.parse(txt));
      }
      if (missingGit) {
        // Di Vercel tapi env GitHub belum lengkap → kasih pesan jelas
        return res.status(500).json({
          message:
            "GitHub envs missing (set GITHUB_TOKEN/OWNER/REPO/FILEPATH) atau jalankan dev lokal.",
        });
      }
      const j = await ghGet();
      const content = JSON.parse(
        Buffer.from(j.content, "base64").toString("utf8")
      );
      return res.status(200).json(content);
    } catch (e) {
      return res.status(500).json({ message: e.message || String(e) });
    }
  }

  if (req.method === "PUT") {
    try {
      if ((req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const incoming = req.body || {};
      incoming.updatedAt = new Date().toISOString();

      if (isDevLocal) {
        fs.mkdirSync(path.dirname(localJsonPath), { recursive: true });
        fs.writeFileSync(
          localJsonPath,
          JSON.stringify(incoming, null, 2),
          "utf8"
        );
        return res.status(200).json({ ok: true, commitSha: "dev-local" });
      }
      if (missingGit) {
        return res.status(500).json({
          message:
            "GitHub envs missing (set GITHUB_TOKEN/OWNER/REPO/FILEPATH) untuk mode produksi.",
        });
      }

      // Commit ke GitHub
      const headers = {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "zft-store",
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      const latest = await ghGet();
      const contentB64 = Buffer.from(
        JSON.stringify(incoming, null, 2),
        "utf8"
      ).toString("base64");

      const r = await fetch(ghBase, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `chore(data): update products.json at ${incoming.updatedAt}`,
          content: contentB64,
          sha: latest.sha,
        }),
      });
      if (!r.ok) throw new Error(`GitHub PUT failed: ${r.status}`);
      const out = await r.json();
      return res
        .status(200)
        .json({ ok: true, commitSha: out.commit?.sha || "" });
    } catch (e) {
      return res.status(500).json({ message: e.message || String(e) });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end("Method Not Allowed");
}
