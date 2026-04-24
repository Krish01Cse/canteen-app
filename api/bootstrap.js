import { getBootstrap } from "../lib/db.js";
import { allowMethods, sendJson } from "../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) return;

  try {
    sendJson(res, 200, await getBootstrap());
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
}
