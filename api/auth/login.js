import { loginUser } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const user = await loginUser(req.body || {});
    if (!user) {
      sendJson(res, 401, { error: `No ${req.body?.role === "canteen" ? "staff" : "student"} account matched those details.` });
      return;
    }

    sendJson(res, 200, { session: user });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
}
