// // /api/products.js
// export default async function handler(req, res) {
//   const {
//     GITHUB_TOKEN,
//     GITHUB_OWNER,
//     GITHUB_REPO,
//     GITHUB_FILEPATH,
//     ADMIN_KEY,
//   } = process.env;
//   if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILEPATH) {
//     return res.status(500).json({ message: "Missing GitHub envs" });
//   }

//   const base = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILEPATH}`;
//   const headers = {
//     Authorization: `token ${GITHUB_TOKEN}`,
//     "User-Agent": "zft-store",
//     Accept: "application/vnd.github+json",
//   };

//   async function ghGet() {
//     const r = await fetch(base, { headers });
//     if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
//     return r.json();
//   }

//   if (req.method === "GET") {
//     try {
//       const j = await ghGet();
//       const content = JSON.parse(
//         Buffer.from(j.content, "base64").toString("utf8")
//       );
//       return res.status(200).json(content);
//     } catch (e) {
//       return res.status(500).json({ message: e.message });
//     }
//   }

//   if (req.method === "PUT") {
//     try {
//       if ((req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
//         return res.status(401).json({ message: "Unauthorized" });
//       }
//       const latest = await ghGet();
//       const incoming = req.body || {};
//       incoming.updatedAt = new Date().toISOString();

//       const contentB64 = Buffer.from(
//         JSON.stringify(incoming, null, 2),
//         "utf8"
//       ).toString("base64");

//       const r = await fetch(base, {
//         method: "PUT",
//         headers: { ...headers, "Content-Type": "application/json" },
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
//       return res.status(500).json({ message: e.message });
//     }
//   }

//   res.setHeader("Allow", "GET, PUT");
//   return res.status(405).end("Method Not Allowed");
// }

// /api/products.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_FILEPATH,
    ADMIN_KEY,
  } = process.env;

  const onVercel = !!process.env.VERCEL;
  const missingGit =
    !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILEPATH;

  // isDevLocal artinya boleh nulis ke disk hanya saat BUKAN di Vercel
  const isDevLocal = !onVercel && missingGit;
  !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILEPATH;
  const localJsonPath = path.join(
    process.cwd(),
    "assets",
    "data",
    "products.json"
  );

  const send500 = (e) =>
    res.status(500).json({ message: e.message || String(e) });

  // Helper GitHub
  const ghBase = GITHUB_FILEPATH
    ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILEPATH}`
    : "";
  const ghHeaders = GITHUB_TOKEN
    ? {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "zft-store",
        Accept: "application/vnd.github+json",
      }
    : {};

  async function ghGet() {
    const r = await fetch(ghBase, { headers: ghHeaders });
    if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
    return r.json();
  }

  // GET
  if (req.method === "GET") {
    try {
      if (isDevLocal) {
        const txt = fs.readFileSync(localJsonPath, "utf8");
        return res.status(200).json(JSON.parse(txt));
      } else {
        const j = await ghGet();
        const content = JSON.parse(
          Buffer.from(j.content, "base64").toString("utf8")
        );
        return res.status(200).json(content);
      }
    } catch (e) {
      return send500(e);
    }
  }

  // PUT
  if (req.method === "PUT") {
    try {
      if ((req.headers["x-admin-key"] || "") !== ADMIN_KEY) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const incoming = req.body || {};
      incoming.updatedAt = new Date().toISOString();

      if (isDevLocal) {
        // DEV: tulis ke file lokal
        fs.mkdirSync(path.dirname(localJsonPath), { recursive: true });
        fs.writeFileSync(
          localJsonPath,
          JSON.stringify(incoming, null, 2),
          "utf8"
        );
        return res.status(200).json({ ok: true, commitSha: "dev-local" });
      }

      // PROD: commit ke GitHub
      const latest = await ghGet();
      const contentB64 = Buffer.from(
        JSON.stringify(incoming, null, 2),
        "utf8"
      ).toString("base64");

      const r = await fetch(ghBase, {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
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
      return send500(e);
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end("Method Not Allowed");
}
