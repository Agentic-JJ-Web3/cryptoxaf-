const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (e.g. a proxy error) — status code alone drives the error below.
  }

  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.details);
  }

  return body;
}

export const api = {
  getMarketRate: () => request('/api/quotes/market'),
  previewQuote: (data) => request('/api/quotes/preview', { method: 'POST', body: JSON.stringify(data) }),
  createOrder: (data) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  getOrder: (reference) => request(`/api/orders/${encodeURIComponent(reference)}`),
  claimPayment: (reference, data) =>
    request(`/api/orders/${encodeURIComponent(reference)}/claim-payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  notify: (phone) => request('/api/notify', { method: 'POST', body: JSON.stringify({ phone }) }),
  submitReview: (reference, data) =>
    request(`/api/orders/${encodeURIComponent(reference)}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: () => request('/api/reviews'),
  getActivity: () => request('/api/activity'),
};

export const adminApi = {
  login: (email, password) =>
    request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/admin/auth/logout', { method: 'POST' }),
  me: () => request('/api/admin/auth/me'),
  listQueue: () => request('/api/admin/orders'),
  getOrder: (reference) => request(`/api/admin/orders/${encodeURIComponent(reference)}`),
  verifyPayment: (reference) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/verify-payment`, { method: 'POST' }),
  rejectPayment: (reference, reason) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/reject-payment`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  completeOrder: (reference, payoutTxHash) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ payoutTxHash }),
    }),
  refundOrder: (reference, note) =>
    request(`/api/admin/orders/${encodeURIComponent(reference)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  getSettings: () => request('/api/admin/settings'),
  updateSettings: (data) => request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  listNotifyRequests: () => request('/api/admin/notify-requests'),
  markNotified: (id) => request(`/api/admin/notify-requests/${encodeURIComponent(id)}/mark-notified`, { method: 'POST' }),
  listReviews: (status) => request(`/api/admin/reviews${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveReview: (id) => request(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  rejectReview: (id) => request(`/api/admin/reviews/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
};

export { ApiError };
