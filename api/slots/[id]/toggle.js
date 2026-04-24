import { toggleSlot } from "../../../lib/db.js";
import { allowMethods, sendJson } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["PATCH"])) return;

  try {
    const timeSlots = await toggleSlot(req.query.id);
    sendJson(res, 200, { timeSlots });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
}
