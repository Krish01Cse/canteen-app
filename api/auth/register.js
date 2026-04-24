import { registerUser } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const session = await registerUser(req.body || {});
    sendJson(res, 201, { session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === "This mobile number is already registered."
      ? 409
      : message === "Staff registration is disabled. Use the assigned staff login credentials."
        ? 403
        : 500;
    sendJson(res, status, { error: message });
  }
}
