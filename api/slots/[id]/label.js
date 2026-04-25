import { updateSlotLabel } from "../../../lib/db.js";
import { allowMethods, sendJson } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["PATCH"])) return;

  try {
    const timeSlots = await updateSlotLabel(req.query.id, req.body?.label);
    sendJson(res, 200, { timeSlots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === "Slot not found."
      ? 404
      : message === "Slot time label is required."
        ? 400
        : 500;
    sendJson(res, status, { error: message });
  }
}
