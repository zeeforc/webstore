export default async function handler(req, res) {
  // === CORS & preflight ===
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

  // === deklarasi SEKALI saja ===
  const { ADMIN_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const clientKey = req.headers["x-admin-key"] || "";

  if (!ADMIN_KEY || clientKey !== ADMIN_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // *Opsional* – cegah nulis ke FS saat deploy (preview/prod),
  // tapi tetap boleh saat `vercel dev` lokal.
  const missingGit = !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO;
  const isVercelDev =
    process.env.VERCEL === "1" && process.env.VERCEL_ENV === "development";
  const canWriteLocal = !process.env.VERCEL || isVercelDev;

  // === ambil file dari request ===
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

  // === validasi & penamaan ===
  const MAX = 2 * 1024 * 1024;
  if (fileBuf.length > MAX)
    return res.status(413).json({ message: "File too large (>2MB)" });

  const allow = [".png", ".jpg", ".jpeg", ".svg"];
  const ext = require("path").extname(filename).toLowerCase();
  if (!allow.includes(ext))
    return res
      .status(415)
      .json({ message: "Only .png .jpg .jpeg .svg allowed" });

  const safeBase = (
    filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "logo"
  ).toLowerCase();
  const finalName = `${require("path").basename(
    safeBase,
    ext
  )}-${Date.now()}${ext}`;
  const publicPath = `/assets/img/logos/${finalName}`;

  // === simpan ===
  if (canWriteLocal && missingGit) {
    // dev lokal: simpan ke folder project
    const absDir = require("path").join(
      process.cwd(),
      "assets",
      "img",
      "logos"
    );
    require("fs").mkdirSync(absDir, { recursive: true });
    require("fs").writeFileSync(
      require("path").join(absDir, finalName),
      fileBuf
    );
    return res.status(200).json({ ok: true, path: publicPath });
  }

  if (missingGit) {
    // deploy tapi env GitHub belum diset -> kasih error jelas
    return res
      .status(500)
      .json({ message: "GitHub envs missing (GITHUB_TOKEN/OWNER/REPO)." });
  }

  // produksi: commit ke GitHub
  const uploadPath = `assets/img/logos/${finalName}`;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${uploadPath}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "User-Agent": "zft-store",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `feat(logo): upload ${finalName}`,
      content: fileBuf.toString("base64"),
    }),
  });
  if (!r.ok) throw new Error(`GitHub upload failed: ${r.status}`);
  return res.status(200).json({ ok: true, path: publicPath });
}
