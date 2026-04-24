import { requestPasswordReset } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const payload = await requestPasswordReset(req.body || {});
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === "No student account matched that mobile number."
      ? 404
      : message === "Staff password reset is disabled. Use the assigned staff login credentials."
        ? 403
        : 500;
    sendJson(res, status, { error: message });
  }
}
