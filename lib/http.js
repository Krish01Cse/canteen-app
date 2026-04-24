export const sendJson = (res, status, payload) => {
  res.status(status).json(payload);
};

export const allowMethods = (req, res, methods) => {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
  return false;
};
