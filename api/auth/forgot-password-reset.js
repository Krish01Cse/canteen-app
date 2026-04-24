import { resetPasswordWithOtp } from "../../lib/db.js";
import { allowMethods, sendJson } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    await resetPasswordWithOtp(req.body || {});
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === "No student account matched that mobile number."
      ? 404
      : message === "Staff password reset is disabled. Use the assigned staff login credentials."
        ? 403
        : message === "Invalid or expired OTP."
          ? 400
          : message === "This OTP has already been used."
            ? 409
            : message === "Password must be at least 4 characters."
              ? 400
              : 500;
    sendJson(res, status, { error: message });
  }
}
