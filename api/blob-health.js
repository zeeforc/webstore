// pages/api/blob-health.js
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    const { url } = await put("test/hello.txt", Buffer.from("ok"), {
      access: "public",
      addRandomSuffix: true,
    });
    res.status(200).json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}

