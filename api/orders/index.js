import { createOrder, getBootstrap } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const order = await createOrder(req.body || {});
    sendJson(res, 201, {
      order,
      ...(await getBootstrap()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message.includes("slot") || message.includes("Order items") ? 400 : 500;
    sendJson(res, status, { error: message });
  }
}
