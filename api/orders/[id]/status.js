import { updateOrderStatus } from "../../../lib/db.js";
import { allowMethods, sendJson } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["PATCH"])) return;

  try {
    const orders = await updateOrderStatus(req.query.id, req.body?.status);
    sendJson(res, 200, { orders });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
}
