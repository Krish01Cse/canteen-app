import { allowMethods, sendJson } from "../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "HEAD"])) return;
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  sendJson(res, 200, { ok: true });
}
