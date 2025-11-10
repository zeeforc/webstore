// // /api/products.js
// import fs from "fs";
// import path from "path";

// export default async function handler(req, res) {
//   // --- CORS (aman kalau nanti beda origin) ---
//   const origin = req.headers.origin || "*";
//   res.setHeader("Access-Control-Allow-Origin", origin);
//   res.setHeader("Vary", "Origin");
//   res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
//   if (req.method === "OPTIONS") return res.status(204).end();

//   // --- ENV ---
//   const {
//     GITHUB_TOKEN,
//     GITHUB_OWNER,
//     GITHUB_REPO,
//     GITHUB_FILEPATH,
//     ADMIN_KEY,
//   } = process.env;

//   const onVercel = !!process.env.VERCEL;
//   const missingGit =
//     !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILEPATH;

//   // DEV lokal = bukan di Vercel & env GitHub belum lengkap
//   const isDevLocal = !onVercel && missingGit;

//   // Lokasi file lokal saat dev
//   const localJsonPath = path.join(
//     process.cwd(),
//     "assets",
//     "data",
//     "products.json"
//   );

//   // Build URL GitHub + headers (HARUS didefinisikan sebelum dipakai)
//   const ghBase = !missingGit
//     ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILEPATH}`
//     : null;

//   const ghHeaders = !missingGit
//     ? {
//         Authorization: `Bearer ${GITHUB_TOKEN}`, // pakai Bearer
//         "User-Agent": "zft-store",
//         Accept: "application/vnd.github+json",
//       }
//     : undefined;

//   async function ghGet() {
//     if (!ghBase) {
//       throw new Error(
//         "GitHub envs missing (set GITHUB_TOKEN/OWNER/REPO/FILEPATH)"
//       );
//     }
//     const r = await fetch(ghBase, { headers: ghHeaders });
//     if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
//     return r.json();
//   }

//   // --- Handlers ---
//   if (req.method === "GET") {
//     try {
//       if (isDevLocal) {
//         // DEV: baca file lokal (buat kalau belum ada)
//         try {
//           const txt = fs.readFileSync(localJsonPath, "utf8");
//           return res.status(200).json(JSON.parse(txt));
//         } catch {
//           const seed = {
//             version: 1,
//             updatedAt: new Date().toISOString(),
//             products: [],
//           };
//           fs.mkdirSync(path.dirname(localJsonPath), { recursive: true });
//           fs.writeFileSync(
//             localJsonPath,
//             JSON.stringify(seed, null, 2),
//             "utf8"
//           );
//           return res.status(200).json(seed);
//         }
//       }

//       if (missingGit) {
//         // Di Vercel tapi env GitHub belum lengkap
//         return res.status(500).json({
//           message:
//             "GitHub envs missing (set GITHUB_TOKEN/OWNER/REPO/FILEPATH) atau jalankan dev lokal.",
//         });
//       }

//       // PROD via GitHub
//       const j = await ghGet();
//       const content = JSON.parse(
//         Buffer.from(j.content || "", "base64").toString("utf8")
//       );
//       return res.status(200).json(content);
//     } catch (e) {
//       return res.status(500).json({ message: e.message || String(e) });
//     }
//   }

//   if (req.method === "PUT") {
//     try {
//       // Auth admin
//       if (!ADMIN_KEY || (req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
//         return res.status(401).json({ message: "Unauthorized" });
//       }

//       // Body bisa string/object tergantung runtime
//       const raw = req.body;
//       const incoming =
//         typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
//       incoming.updatedAt = new Date().toISOString();

//       if (isDevLocal) {
//         // DEV: tulis ke file lokal
//         fs.mkdirSync(path.dirname(localJsonPath), { recursive: true });
//         fs.writeFileSync(
//           localJsonPath,
//           JSON.stringify(incoming, null, 2),
//           "utf8"
//         );
//         return res.status(200).json({ ok: true, commitSha: "dev-local" });
//       }

//       if (missingGit) {
//         return res.status(500).json({
//           message:
//             "GitHub envs missing (set GITHUB_TOKEN/OWNER/REPO/FILEPATH) untuk mode produksi.",
//         });
//       }

//       // PROD: commit ke GitHub Contents API
//       const latest = await ghGet();
//       const contentB64 = Buffer.from(
//         JSON.stringify(incoming, null, 2),
//         "utf8"
//       ).toString("base64");

//       const r = await fetch(ghBase, {
//         method: "PUT",
//         headers: { ...ghHeaders, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           message: `chore(data): update products.json at ${incoming.updatedAt}`,
//           content: contentB64,
//           sha: latest.sha,
//         }),
//       });
//       if (!r.ok) throw new Error(`GitHub PUT failed: ${r.status}`);
//       const out = await r.json();
//       return res
//         .status(200)
//         .json({ ok: true, commitSha: out.commit?.sha || "" });
//     } catch (e) {
//       return res.status(500).json({ message: e.message || String(e) });
//     }
//   }

//   res.setHeader("Allow", "GET, PUT");
//   return res.status(405).end("Method Not Allowed");
// }

// DARI SINIIIIII

// /api/products.js
// import fs from "fs";
// import path from "path";

// export default async function handler(req, res) {
//   // CORS (biar aman kalau beda origin)
//   const origin = req.headers.origin || "*";
//   res.setHeader("Access-Control-Allow-Origin", origin);
//   res.setHeader("Vary", "Origin");
//   res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
//   if (req.method === "OPTIONS") return res.status(204).end();

//   const { ADMIN_KEY } = process.env; // opsional saat dev
//   const needKey = !!ADMIN_KEY; // kalau .env punya ADMIN_KEY, aktifkan auth

//   const jsonPath = path.join(process.cwd(), "assets", "data", "products.json");

//   // helper: pastikan file ada
//   function ensureSeed() {
//     const seed = {
//       version: 1,
//       updatedAt: new Date().toISOString(),
//       products: [],
//     };
//     fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
//     fs.writeFileSync(jsonPath, JSON.stringify(seed, null, 2), "utf8");
//     return seed;
//   }

//   if (req.method === "GET") {
//     try {
//       let txt;
//       try {
//         txt = fs.readFileSync(jsonPath, "utf8");
//       } catch {
//         return res.status(200).json(ensureSeed());
//       }
//       return res.status(200).json(JSON.parse(txt));
//     } catch (e) {
//       return res.status(500).json({ message: e.message || String(e) });
//     }
//   }

//   if (req.method === "PUT") {
//     try {
//       if (needKey && (req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
//         return res.status(401).json({ message: "Unauthorized" });
//       }

//       // body bisa string/object tergantung runtime vercel dev
//       const raw = req.body;
//       const incoming =
//         typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
//       incoming.updatedAt = new Date().toISOString();

//       fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
//       fs.writeFileSync(jsonPath, JSON.stringify(incoming, null, 2), "utf8");
//       return res.status(200).json({ ok: true, commitSha: "dev-local" });
//     } catch (e) {
//       return res.status(500).json({ message: e.message || String(e) });
//     }
//   }

//   res.setHeader("Allow", "GET, PUT");
//   return res.status(405).end("Method Not Allowed"); 
// }




// /api/products.js
import { put, list, del } from "@vercel/blob";

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { ADMIN_KEY } = process.env;
  const needKey = !!ADMIN_KEY;

  const key = "assets/data/products.json";

  async function ensureSeed() {
    const seed = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products: [],
    };
    // tulis seed ke Blob jika belum ada
    await put(key, JSON.stringify(seed, null, 2), {
      contentType: "application/json",
      cacheControlMaxAge: 0,
      addRandomSuffix: false, // penting agar kunci tetap sama
    });
    return seed;
  }

  async function readJson() {
    // cek apakah blob ada
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs || blobs.length === 0) {
      return null;
    }
    // ambil URL lalu fetch isinya
    const url = blobs[0].url;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch blob ${resp.status}`);
    return await resp.json();
  }

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
        contentType: "application/json",
        cacheControlMaxAge: 0,
        addRandomSuffix: false, // selalu tulis ke kunci yang sama
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ message: e.message || String(e) });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end("Method Not Allowed");
}

