const request = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
};

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  requestPasswordReset: (body) => request("/api/auth/forgot-password-request", { method: "POST", body: JSON.stringify(body) }),
  resetPasswordWithOtp: (body) => request("/api/auth/forgot-password-reset", { method: "POST", body: JSON.stringify(body) }),
  createOrder: (body) => request("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  updateOrderStatus: (id, status) => request(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  toggleSlot: (id) => request(`/api/slots/${id}/toggle`, { method: "PATCH" }),
  adjustSlotCapacity: (id, delta) => request(`/api/slots/${id}/capacity`, { method: "PATCH", body: JSON.stringify({ delta }) }),
  toggleMenuItem: (id) => request(`/api/menu/${id}/toggle`, { method: "PATCH" }),
  saveMenuItem: (body) => request("/api/menu", { method: "POST", body: JSON.stringify(body) }),
};
