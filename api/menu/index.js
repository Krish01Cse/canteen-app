import { saveMenuItem } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const menuItems = await saveMenuItem(req.body || {});
    sendJson(res, 200, { menuItems });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
}
